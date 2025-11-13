import { GoogleGenerativeAI } from '@google/generative-ai';
import { Context, TaskType, MessageGenerationResponse } from '../models/types';
import { PromptComposerService } from './promptComposer';

/**
 * Gemini AI Service
 * Handles message generation using Google's Gemini API
 */
export class GeminiService {
  public client: GoogleGenerativeAI;
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
    let scores = { clarity: 5, trust_tone: 5, retention_impact: 5 }; // Default scores (neutral, not perfect)

    if (parts.length >= 2) {
      message = parts[0].trim();

      // Extract scores from the second part
      const scoresSection = parts[parts.length - 1];

      // Try multiple patterns for each score
      const clarityMatch = scoresSection.match(/Clarity[:\s]+(\d+)/i);
      const trustMatch = scoresSection.match(/(?:Trust|Trust\s*(?:&|and)?\s*Tone)[:\s]+(\d+)/i);
      const valueMatch = scoresSection.match(/(?:Value|Retention\s*Impact)[:\s]+(\d+)/i);

      let parsedAnyScore = false;
      if (clarityMatch) {
        scores.clarity = parseInt(clarityMatch[1]);
        parsedAnyScore = true;
      }
      if (trustMatch) {
        scores.trust_tone = parseInt(trustMatch[1]);
        parsedAnyScore = true;
      }
      if (valueMatch) {
        scores.retention_impact = parseInt(valueMatch[1]);
        parsedAnyScore = true;
      }

      // Log warning if no scores were parsed
      if (!parsedAnyScore) {
        console.warn('⚠️  Score parsing failed - using default scores (5/5/5)');
        console.warn('Scores section:', scoresSection.substring(0, 200));
      }
    } else {
      console.warn('⚠️  No score separator found - using default scores (5/5/5)');
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
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: `You are an expert automotive service invoice analyzer.

FORMAT REQUIREMENTS - YOU MUST FOLLOW THIS EXACTLY:

Start every response with an emoji section header. Use this template:

📋 Summary:
[Brief overview - max 2 sentences]

🚗 Vehicle:
• [Vehicle info as bullet points]
• [One fact per bullet]

💰 Services & Costs:
1. [Service name] - $XX.XX
2. [Service name] - $XX.XX
Total: $XXX.XX

→ Key Points:
• [Important takeaway]
• [Action item or insight]

MANDATORY RULES - DO NOT BREAK THESE:
1. Start EVERY section with an emoji header (📋 🚗 💰 📊 → ✓)
2. Use bullet points (•) or numbered lists - NO paragraphs
3. Bold all dollar amounts: **$XXX.XX**
4. Blank line between each section
5. Max 2 sentences if you must write prose
6. Keep responses scannable and visual

NEVER write prose paragraphs. ALWAYS use the structured format above.`
      });

      const userPrompt = `Here's the invoice data:

${JSON.stringify({ parsedInvoice, context }, null, 2)}

User question: ${message}

CRITICAL: Your response MUST start with "📋 Summary:" followed by sections with emoji headers. DO NOT write a paragraph response.`;

      const result = await model.generateContent(userPrompt);
      const response = await result.response;
      const text = response.text();

      console.log('=== GEMINI CHAT METHOD RAW RESPONSE ===');
      console.log(text);
      console.log('=== END RAW RESPONSE ===');

      return text;
    } catch (error) {
      console.error('Error in chat:', error);
      throw new Error('Failed to get chat response');
    }
  }

  /**
   * Parse PDF with Gemini (using vision capabilities)
   * Uses gemini-2.0-flash-exp for better availability and cost-effectiveness
   */
  async parsePDF(pdfBuffer: Buffer): Promise<any> {
    try {
      const base64Pdf = pdfBuffer.toString('base64');

      // Try models in order of availability and capability
      // Using stable model names that exist in v1beta API
      const models = [
        'gemini-2.0-flash-exp',      // Latest experimental (may have rate limits)
        'gemini-1.5-flash',           // Stable, widely available
        'gemini-1.5-pro'              // Most capable fallback
      ];

      let lastError;
      for (const modelName of models) {
        try {
          console.log(`Attempting PDF parse with ${modelName}...`);
          const model = this.client.getGenerativeModel({ model: modelName });

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

CRITICAL INSTRUCTIONS FOR CUSTOMER NAME EXTRACTION:
1. The shop information (name, address, phone) is the SERVICE SHOP - typically in the UPPER LEFT corner or header
2. The CUSTOMER is the VEHICLE OWNER - NOT the service shop. Look for the customer name in these locations (in order of priority):
   a. "Customer:", "Customer Name:", "Name:", "Owner:" field
   b. "Bill To:" section
   c. Near the vehicle information section
   d. In a "Vehicle Owner:" or "Owner Information:" section
   e. Any section clearly separate from the shop header/letterhead
3. Customer names can be in ANY of these formats - extract them all:
   - Proper case: "John Smith" or "John Q. Smith"
   - ALL CAPS: "JOHN SMITH" or "JOHN Q SMITH"
   - Mixed case: "JOHN Smith" or "John SMITH"
   - With suffixes: "John Smith Jr." or "JOHN SMITH III"
   - First name only followed by last name on next line
   - Full names with middle names or initials
   - Business names: "ABC Company" or "SMITH'S AUTO REPAIR"
4. VALIDATION: After extraction, verify the customer name is NOT the same as the shop name. If they match, the customer name is WRONG - look again.
5. If you truly cannot find any customer name after checking all locations, use null
6. For all other fields, if not found, use null
7. Be thorough and extract all services performed and any recommendations or declined work`
            }
          ]);

          const response = await result.response;
          const responseText = response.text();

          // Remove markdown code blocks if present
          const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(jsonText);

          console.log(`Successfully parsed PDF with ${modelName}`);
          return parsed;

        } catch (error: any) {
          lastError = error;
          // If it's a 503, 429, or 404 error, try next model
          if (error?.status === 503 || error?.status === 429 || error?.status === 404 || error?.message?.includes('overloaded')) {
            const reason = error.status === 404 ? 'not found' : error.status === 429 ? 'rate limited' : 'overloaded';
            console.warn(`${modelName} unavailable (${reason}), trying next model...`);
            continue;
          }
          // For other errors, throw immediately
          throw error;
        }
      }

      // If we exhausted all models, throw the last error
      throw lastError || new Error('All Gemini models failed');
    } catch (error) {
      console.error('Error parsing PDF with Gemini:', error);
      throw error;
    }
  }
}
