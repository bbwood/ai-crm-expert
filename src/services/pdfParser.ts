import pdf from 'pdf-parse';
import fs from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GeminiService } from './geminiService';
import { PromptComposerService } from './promptComposer';
import { ParsedInvoice, WorkItem, Recommendation } from '../models/types';

/**
 * PDF Parser Service
 * Extracts text from PDF invoices and parses structured data
 * Falls back through: Claude → Gemini → OpenAI → Regex
 */
export class PDFParserService {
  private anthropicClient?: Anthropic;
  private openaiClient?: OpenAI;
  private geminiService?: GeminiService;

  constructor(anthropicApiKey?: string, openaiApiKey?: string, geminiService?: GeminiService) {
    if (anthropicApiKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
    }
    if (openaiApiKey) {
      this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
    }
    if (geminiService) {
      this.geminiService = geminiService;
    }
  }

  /**
   * Parse a PDF file and extract invoice data
   * Falls back through: Claude → Gemini → OpenAI → Regex
   */
  async parsePDF(filePath: string): Promise<ParsedInvoice> {
    try {
      const dataBuffer = await fs.readFile(filePath);

      // Try Claude FIRST (best quality, excellent text extraction)
      if (this.anthropicClient) {
        try {
          console.log('Attempting PDF parse with Claude...');
          const result = await this.parseWithClaude(dataBuffer);
          console.log('✓ Successfully parsed PDF with Claude');
          return result;
        } catch (error: any) {
          console.error('✗ Claude PDF parsing failed:', error?.message || error);
          if (error?.message?.includes('API key')) {
            console.warn('   → Check that ANTHROPIC_API_KEY is set correctly in .env');
          }
          console.log('Trying Gemini...');
        }
      } else {
        console.log('⊘ Claude not available (ANTHROPIC_API_KEY not set)');
      }

      // Try Gemini if available (supports multiple models with fallback)
      if (this.geminiService) {
        try {
          console.log('Attempting PDF parse with Gemini...');
          const result = await this.geminiService.parsePDF(dataBuffer);
          console.log('✓ Successfully parsed PDF with Gemini');
          return result;
        } catch (error) {
          console.warn('✗ Gemini PDF parsing failed, trying OpenAI...');
        }
      }

      // Try OpenAI if available (GPT-4o)
      if (this.openaiClient) {
        try {
          console.log('Attempting PDF parse with OpenAI...');
          const result = await this.parseWithOpenAI(dataBuffer);
          console.log('✓ Successfully parsed PDF with OpenAI');
          return result;
        } catch (error: any) {
          console.error('✗ OpenAI PDF parsing failed:', error?.message || error);
          if (error?.message?.includes('API key') || error?.message?.includes('authentication')) {
            console.warn('   → Check that OPENAI_API_KEY is set correctly in .env');
          }
          console.log('Falling back to regex...');
        }
      } else {
        console.log('⊘ OpenAI not available (OPENAI_API_KEY not set)');
      }

      // Last resort: Fallback to regex text extraction
      console.log('Using regex-based text extraction as last resort...');
      const pdfData = await pdf(dataBuffer);
      const text = pdfData.text;
      return this.extractInvoiceData(text);
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error('Failed to parse PDF invoice');
    }
  }

  /**
   * Parse PDF using Claude AI
   * First extracts text from PDF, then uses Claude for structured parsing
   */
  private async parseWithClaude(pdfBuffer: Buffer): Promise<ParsedInvoice> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    // Extract text from PDF first
    const pdfData = await pdf(pdfBuffer);
    const text = pdfData.text;

    if (!text || text.trim().length === 0) {
      throw new Error('No text extracted from PDF');
    }

    const message = await this.anthropicClient.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Extract all information from this automotive service invoice and return ONLY a JSON object with this exact structure (no markdown, no extra text):

INVOICE TEXT:
${text}

JSON STRUCTURE:
{
  "shop_name": "shop name",
  "shop_address": "shop address",
  "shop_phone": "shop phone number",
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

CRITICAL RULES:
1. The CUSTOMER is the VEHICLE OWNER - NOT the service shop
2. Look for customer name in "Customer:", "Owner:", or "Bill To:" sections
3. Shop info is usually in the upper left header
4. Return ONLY valid JSON, no markdown formatting
5. If a field is not found, use null`
      }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      return JSON.parse(jsonText);
    } catch (e) {
      console.error('Failed to parse Claude response as JSON:', jsonText.substring(0, 200));
      throw new Error('Claude returned invalid JSON');
    }
  }

  /**
   * Parse PDF using OpenAI GPT-4o
   */
  private async parseWithOpenAI(pdfBuffer: Buffer): Promise<ParsedInvoice> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    // First extract text from PDF
    const pdfData = await pdf(pdfBuffer);
    const text = pdfData.text;

    if (!text || text.trim().length === 0) {
      throw new Error('No text extracted from PDF');
    }

    const response = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Extract all information from this automotive service invoice and return as a JSON object:

INVOICE TEXT:
${text}

JSON structure (use null if field not found):
{
  "shop_name": "shop name",
  "shop_address": "shop address",
  "shop_phone": "shop phone",
  "customer_name": "customer name (VEHICLE OWNER - not the shop name)",
  "customer_phone": "phone",
  "customer_email": "email",
  "vehicle_year": year as number,
  "vehicle_make": "make",
  "vehicle_model": "model",
  "vin": "VIN",
  "plate": "plate",
  "mileage": mileage as number,
  "service_date": "YYYY-MM-DD",
  "invoice_number": "invoice #",
  "advisor": "advisor name",
  "technician": "tech name",
  "work_items": [{"description": "service", "cost": amount}],
  "recommendations": [{"description": "service", "estimated_cost": amount, "category": "category", "urgency": "immediate|soon|future|monitor", "status": "recommended|declined|future"}],
  "total_amount": total as number
}

CRITICAL: Customer name is the VEHICLE OWNER, found in "Customer:", "Owner:", or "Bill To:" fields. Shop info is in the header.`
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    const responseText = response.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error('OpenAI returned empty response');
    }

    try {
      return JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse OpenAI response as JSON:', responseText.substring(0, 200));
      throw new Error('OpenAI returned invalid JSON');
    }
  }

  /**
   * Extract structured invoice data from PDF text
   * This is a basic implementation - would need customization for specific invoice formats
   */
  private extractInvoiceData(text: string): ParsedInvoice {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    const invoice: ParsedInvoice = {};

    // Extract customer name (multiple patterns to handle various formats)
    let customerName = null;

    // Try multiple patterns in order of specificity
    const namePatterns = [
      // Pattern 1: "Customer:" or "Customer Name:" followed by name (any case)
      /(?:Customer(?:\s+Name)?|Owner(?:\s+Name)?)[:\s]+([A-Z][A-Za-z'\-\s.]+?)(?:\n|$|  )/i,
      // Pattern 2: "Name:" followed by name (but not "Shop Name" or "Business Name")
      /(?<!Shop\s)(?<!Business\s)Name[:\s]+([A-Z][A-Za-z'\-\s.]+?)(?:\n|$|  )/i,
      // Pattern 3: "Bill To:" section
      /Bill\s+To[:\s]+([A-Z][A-Za-z'\-\s.]+?)(?:\n|$|  )/i,
      // Pattern 4: ALL CAPS names (2-4 words)
      /(?:Customer|Owner|Name)[:\s]+([A-Z][A-Z\s]{2,50}?)(?:\n|Phone|Email|Address|$)/i,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        customerName = match[1].trim();
        // Clean up: remove extra spaces, limit length
        customerName = customerName.replace(/\s+/g, ' ').substring(0, 100);
        // Validate: must be at least 2 characters and not just spaces/special chars
        if (customerName.length >= 2 && /[A-Za-z]{2,}/.test(customerName)) {
          invoice.customer_name = customerName;
          break;
        }
      }
    }

    // Extract phone (common patterns, prioritize customer phone over shop phone)
    const phonePatterns = [
      // Customer-specific phone patterns
      /(?:Customer\s+)?(?:Phone|Tel|Cell|Mobile)[:\s]+([\d\-\(\)\s.]+)/i,
      // Phone near customer name
      /Customer[^\n]*\n[^\n]*?([\(\d][\d\-\(\)\s.]{9,})/i,
      // General phone pattern (10+ digits)
      /([\(\d][\d\-\(\)\s.]{9,})/,
    ];

    for (const pattern of phonePatterns) {
      const match = text.match(pattern);
      if (match) {
        const cleaned = match[1].replace(/[^\d+]/g, '');
        // Validate: must have at least 10 digits
        if (cleaned.length >= 10) {
          invoice.customer_phone = cleaned;
          break;
        }
      }
    }

    // Extract email
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) invoice.customer_email = emailMatch[1];

    // Extract vehicle info
    const vehicleMatch = text.match(/(\d{4})\s+([A-Z][a-z]+)\s+([A-Z0-9][^\n]{2,20})/);
    if (vehicleMatch) {
      invoice.vehicle_year = parseInt(vehicleMatch[1]);
      invoice.vehicle_make = vehicleMatch[2];
      invoice.vehicle_model = vehicleMatch[3].trim();
    }

    // Extract VIN
    const vinMatch = text.match(/VIN[:\s]+([A-HJ-NPR-Z0-9]{17})/i);
    if (vinMatch) invoice.vin = vinMatch[1];

    // Extract plate
    const plateMatch = text.match(/(?:Plate|License)[:\s]+([A-Z0-9]+)/i);
    if (plateMatch) invoice.plate = plateMatch[1];

    // Extract mileage
    const mileageMatch = text.match(/(?:Mileage|Miles|Odometer)[:\s]+([\d,]+)/i);
    if (mileageMatch) {
      invoice.mileage = parseInt(mileageMatch[1].replace(/,/g, ''));
    }

    // Extract date
    const dateMatch = text.match(/(?:Date|Invoice Date)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    if (dateMatch) invoice.service_date = this.normalizeDate(dateMatch[1]);

    // Extract invoice number
    const invoiceMatch = text.match(/(?:Invoice|#|No\.?)[:\s]+(\d+)/i);
    if (invoiceMatch) invoice.invoice_number = invoiceMatch[1];

    // Extract advisor/technician
    const advisorMatch = text.match(/(?:Advisor|Service Advisor)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    if (advisorMatch) invoice.advisor = advisorMatch[1];

    const techMatch = text.match(/(?:Technician|Tech)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    if (techMatch) invoice.technician = techMatch[1];

    // Extract work items (basic pattern - would need refinement)
    invoice.work_items = this.extractWorkItems(text);

    // Extract recommendations
    invoice.recommendations = this.extractRecommendations(text);

    // Extract total
    const totalMatch = text.match(/(?:Total|Amount Due|Balance)[:\s]+\$?([\d,]+\.?\d*)/i);
    if (totalMatch) {
      invoice.total_amount = parseFloat(totalMatch[1].replace(/,/g, ''));
    }

    return invoice;
  }

  /**
   * Extract work items from invoice text
   */
  private extractWorkItems(text: string): WorkItem[] {
    const items: WorkItem[] = [];

    const lines = text.split('\n');
    for (const line of lines) {
      // Look for lines with service descriptions and prices
      const match = line.match(/([^$]+)\s+\$?([\d,]+\.?\d{2})/);
      if (match) {
        const description = match[1].trim();
        const cost = parseFloat(match[2].replace(/,/g, ''));

        // Filter out obvious non-work items
        if (description.length > 5 && description.length < 100) {
          items.push({ description, cost });
        }
      }
    }

    return items;
  }

  /**
   * Extract recommendations from invoice text
   */
  private extractRecommendations(text: string): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Look for recommendation sections
    const recSection = text.match(/(?:Recommended|Recommendations|Declined|Future Service)([\s\S]{0,500})/i);

    if (recSection) {
      const lines = recSection[1].split('\n');
      for (const line of lines) {
        const match = line.match(/([^$]+)\s+\$?([\d,]+\.?\d{2})/);
        if (match) {
          const description = match[1].trim();
          const cost = parseFloat(match[2].replace(/,/g, ''));

          recommendations.push({
            description,
            estimated_cost: cost,
            category: this.categorizeRecommendation(description),
            urgency: this.determineUrgency(description),
            status: 'recommended'
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Categorize a recommendation based on description
   */
  private categorizeRecommendation(description: string): string {
    const lower = description.toLowerCase();

    if (lower.includes('tire')) return 'tires';
    if (lower.includes('brake')) return 'brakes';
    if (lower.includes('oil')) return 'fluids';
    if (lower.includes('battery')) return 'electrical';
    if (lower.includes('filter')) return 'maintenance';
    if (lower.includes('belt') || lower.includes('hose')) return 'engine';

    return 'other';
  }

  /**
   * Determine urgency level based on description
   */
  private determineUrgency(description: string): 'immediate' | 'soon' | 'future' | 'monitor' {
    const lower = description.toLowerCase();

    if (lower.includes('immediate') || lower.includes('critical') || lower.includes('unsafe')) {
      return 'immediate';
    }
    if (lower.includes('soon') || lower.includes('recommend')) {
      return 'soon';
    }
    if (lower.includes('future') || lower.includes('monitor')) {
      return 'monitor';
    }

    return 'future';
  }

  /**
   * Normalize date format to ISO string
   */
  private normalizeDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  }
}
