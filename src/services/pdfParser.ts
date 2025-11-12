import pdf from 'pdf-parse';
import fs from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { GeminiService } from './geminiService';
import { PromptComposerService } from './promptComposer';
import { ParsedInvoice, WorkItem, Recommendation } from '../models/types';

/**
 * PDF Parser Service
 * Extracts text from PDF invoices and parses structured data
 */
export class PDFParserService {
  private client?: Anthropic;
  private geminiService?: GeminiService;

  constructor(anthropicApiKey?: string, geminiService?: GeminiService) {
    if (anthropicApiKey) {
      this.client = new Anthropic({ apiKey: anthropicApiKey });
    }
    if (geminiService) {
      this.geminiService = geminiService;
    }
  }

  /**
   * Parse a PDF file and extract invoice data
   */
  async parsePDF(filePath: string): Promise<ParsedInvoice> {
    try {
      const dataBuffer = await fs.readFile(filePath);

      // Try Gemini first if available
      if (this.geminiService) {
        try {
          return await this.geminiService.parsePDF(dataBuffer);
        } catch (error) {
          console.warn('Gemini PDF parsing failed, falling back to regex:', error);
        }
      }

      // Try Claude if available
      if (this.client) {
        try {
          return await this.parseWithClaude(dataBuffer);
        } catch (error) {
          console.warn('Claude PDF parsing failed, falling back to regex:', error);
        }
      }

      // Fallback to basic text extraction
      const pdfData = await pdf(dataBuffer);
      const text = pdfData.text;
      return this.extractInvoiceData(text);
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error('Failed to parse PDF invoice');
    }
  }

  /**
   * Parse PDF using Claude AI for better accuracy
   * Note: Currently not used as Claude SDK doesn't support document type in this version
   * Using Gemini for PDF parsing instead
   */
  private async parseWithClaude(pdfBuffer: Buffer): Promise<ParsedInvoice> {
    // Fallback to text extraction for now
    const pdfData = await pdf(pdfBuffer);
    return this.extractInvoiceData(pdfData.text);
  }

  /**
   * Extract structured invoice data from PDF text
   * This is a basic implementation - would need customization for specific invoice formats
   */
  private extractInvoiceData(text: string): ParsedInvoice {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    const invoice: ParsedInvoice = {};

    // Extract customer name (common patterns)
    const nameMatch = text.match(/(?:Customer|Name|Bill To)[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
    if (nameMatch) invoice.customer_name = nameMatch[1].trim();

    // Extract phone (common patterns)
    const phoneMatch = text.match(/(?:Phone|Tel|Cell)[:\s]+([\d\-\(\)\s]+)/i);
    if (phoneMatch) {
      invoice.customer_phone = phoneMatch[1].replace(/[^\d+]/g, '');
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

    // Look for common work item patterns
    const workPatterns = [
      /(?:oil change|battery replacement|tire rotation|brake service|inspection)/gi,
    ];

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
