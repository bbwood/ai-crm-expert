import { GoogleGenerativeAI } from '@google/generative-ai';
import { Context, TaskType, MessageGenerationResponse } from '../models/types';
import { PromptComposerService } from './promptComposer';

/**
 * Gemini AI Service
 * Handles message generation using Google's Gemini API
 */
export class GeminiService {
  private client: GoogleGenerativeAI;
  private promptComposer: PromptComposerService;
  private model: string;

  constructor(apiKey: string, promptComposer: PromptComposerService, model: string = 'gemini-2.5-flash') {
    this.client = new GoogleGenerativeAI(apiKey);
    this.promptComposer = promptComposer;
    this.model = model;
  }

  /**
   * Generate a customer engagement message
   */
  async generateMessage(
    context: Context,
    taskType: TaskType
  ): Promise<MessageGenerationResponse> {
    try {
      // Compose the multi-layer prompt
      const prompt = await this.promptComposer.composePrompt(context, taskType);

      // Call Gemini API
      const model = this.client.getGenerativeModel({ model: this.model });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();

      console.log('=== Gemini Response ===');
      console.log(responseText);
      console.log('======================');

      // Parse the response to extract message and scores
      const parsed = this.parseResponse(responseText);

      console.log('=== Parsed Scores ===');
      console.log(JSON.stringify(parsed.scores, null, 2));
      console.log('====================');

      return {
        message: parsed.message,
        task_type: taskType,
        scores: parsed.scores
      };
    } catch (error) {
      console.error('Error generating message:', error);
      throw new Error('Failed to generate message');
    }
  }

  /**
   * Parse the AI response to extract message and self-review scores
   */
  private parseResponse(responseText: string): {
    message: string;
    scores: { clarity: number; trust_tone: number; retention_impact: number };
  } {
    // Split on the separator between message and scores
    const parts = responseText.split('---');

    let message = responseText;
    let scores = { clarity: 10, trust_tone: 10, retention_impact: 10 }; // Default scores

    if (parts.length >= 2) {
      message = parts[0].trim();

      // Extract scores from the second part
      const scoresSection = parts[parts.length - 1];

      // Try multiple patterns for each score
      const clarityMatch = scoresSection.match(/Clarity[:\s]+(\d+)/i);
      const trustMatch = scoresSection.match(/(?:Trust|Trust\s*(?:&|and)?\s*Tone)[:\s]+(\d+)/i);
      const valueMatch = scoresSection.match(/(?:Value|Retention\s*Impact)[:\s]+(\d+)/i);

      if (clarityMatch) scores.clarity = parseInt(clarityMatch[1]);
      if (trustMatch) scores.trust_tone = parseInt(trustMatch[1]);
      if (valueMatch) scores.retention_impact = parseInt(valueMatch[1]);
    }

    // Remove "SELF-REVIEW SCORES:" header if present in message
    message = message.replace(/SELF-REVIEW SCORES:[\s\S]*$/i, '').trim();

    return { message, scores };
  }

  /**
   * Chat about invoice data
   */
  async chat(message: string, context: any, parsedInvoice: any): Promise<string> {
    try {
      const chatPrompt = `You are a helpful assistant analyzing an automotive service invoice. Here's the invoice data:

${JSON.stringify({ parsedInvoice, context }, null, 2)}

User question: ${message}

Please provide a helpful, concise answer to the user's question about this invoice.`;

      const model = this.client.getGenerativeModel({ model: this.model });
      const result = await model.generateContent(chatPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error in chat:', error);
      throw new Error('Failed to get chat response');
    }
  }

  /**
   * Parse PDF with Gemini (using vision capabilities)
   */
  async parsePDF(pdfBuffer: Buffer): Promise<any> {
    try {
      const base64Pdf = pdfBuffer.toString('base64');

      const model = this.client.getGenerativeModel({ model: 'gemini-2.5-pro' });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Pdf
          }
        },
        {
          text: `Extract all information from this automotive service invoice and return ONLY a JSON object with this exact structure (no markdown, no extra text):
{
  "shop_name": "shop name (usually in upper left corner)",
  "shop_address": "shop address (usually in upper left corner)",
  "shop_phone": "shop phone number (usually in upper left corner)",
  "customer_name": "customer/business name",
  "customer_phone": "phone number",
  "customer_email": "email address",
  "vehicle_year": year as number,
  "vehicle_make": "make",
  "vehicle_model": "model",
  "vin": "VIN number",
  "plate": "license plate",
  "mileage": mileage as number,
  "service_date": "YYYY-MM-DD",
  "invoice_number": "invoice #",
  "advisor": "service advisor name",
  "technician": "technician name",
  "work_items": [{"description": "service description", "cost": amount}],
  "recommendations": [{"description": "recommended service", "estimated_cost": amount, "category": "category", "urgency": "immediate|soon|future|monitor", "status": "recommended|declined|future"}],
  "total_amount": total as number
}

IMPORTANT INSTRUCTIONS:
1. The shop information (name, address, phone) is the SERVICE SHOP - typically in the UPPER LEFT corner
2. The customer is the VEHICLE OWNER. This could be:
   - An individual person's name
   - A business/company name (for fleet vehicles)
   - Another shop name (if it's a shop's vehicle being serviced)
3. If the customer section shows a business/shop name, use that as the customer_name
4. Do NOT use the service shop's information as the customer information - they are different
5. If any field is not found, use null
6. Be thorough and extract all services performed and any recommendations or declined work`
        }
      ]);

      const response = await result.response;
      const responseText = response.text();

      // Remove markdown code blocks if present
      const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('Error parsing PDF with Gemini:', error);
      throw error;
    }
  }
}
