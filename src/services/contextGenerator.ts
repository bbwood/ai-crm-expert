import { ParsedInvoice, Context, Customer, Vehicle, Shop, ServiceHistory, Finding } from '../models/types';
import { addDays, differenceInDays } from 'date-fns';

/**
 * Context Generator Service
 * Transforms parsed invoice data into structured context for AI prompts
 */
export class ContextGeneratorService {
  private defaultShop: Shop = {
    name: 'Auto Repair Shop',
    address: '',
    phone: ''
  };

  constructor(shopInfo?: Shop) {
    if (shopInfo) {
      this.defaultShop = shopInfo;
    }
  }

  /**
   * Generate a complete context object from parsed invoice data
   */
  generateContext(
    parsedInvoice: ParsedInvoice,
    existingCustomerData?: Partial<Customer>,
    existingVehicleData?: Partial<Vehicle>,
    pastServiceHistory?: ServiceHistory
  ): Context {
    const customer = this.buildCustomer(parsedInvoice, existingCustomerData);
    const vehicle = this.buildVehicle(parsedInvoice, existingVehicleData);
    const serviceHistory = this.buildServiceHistory(parsedInvoice, pastServiceHistory);
    const currentFindings = this.buildCurrentFindings(parsedInvoice);
    const shop = this.buildShop(parsedInvoice);

    return {
      customer,
      vehicle,
      shop,
      service_history: serviceHistory,
      current_findings: currentFindings
    };
  }

  /**
   * Build shop object from parsed data
   */
  private buildShop(parsed: ParsedInvoice): Shop {
    return {
      name: (parsed as any).shop_name || this.defaultShop.name,
      address: (parsed as any).shop_address || this.defaultShop.address,
      phone: (parsed as any).shop_phone || this.defaultShop.phone
    };
  }

  /**
   * Build customer object from parsed data
   */
  private buildCustomer(
    parsed: ParsedInvoice,
    existing?: Partial<Customer>
  ): Customer {
    const id = existing?.id || this.generateCustomerId(parsed.customer_name, parsed.customer_phone);

    return {
      id,
      name: parsed.customer_name || existing?.name || 'Unknown Customer',
      phone: parsed.customer_phone || existing?.phone || '',
      email: parsed.customer_email || existing?.email,
      visit_count: existing?.visit_count ? existing.visit_count + 1 : 1,
      last_visit_date: parsed.service_date || new Date().toISOString().split('T')[0]
    };
  }

  /**
   * Build vehicle object from parsed data
   */
  private buildVehicle(
    parsed: ParsedInvoice,
    existing?: Partial<Vehicle>
  ): Vehicle {
    const vin = parsed.vin || existing?.vin;
    const id = existing?.id || (vin ? `veh_${vin}` : this.generateVehicleId(parsed));

    return {
      id,
      year: parsed.vehicle_year || existing?.year || 0,
      make: parsed.vehicle_make || existing?.make || 'Unknown',
      model: parsed.vehicle_model || existing?.model || 'Unknown',
      vin: vin,
      plate: parsed.plate || existing?.plate,
      current_est_mileage: parsed.mileage || existing?.current_est_mileage || 0
    };
  }

  /**
   * Build service history from parsed data and existing history
   */
  private buildServiceHistory(
    parsed: ParsedInvoice,
    existing?: ServiceHistory
  ): ServiceHistory {
    const recentVisit = {
      visit_id: parsed.invoice_number || `inv_${Date.now()}`,
      date: parsed.service_date || new Date().toISOString().split('T')[0],
      mileage: parsed.mileage || 0,
      advisor: parsed.advisor,
      technician: parsed.technician,
      work_done: parsed.work_items?.map(item => item.description) || [],
      amount: parsed.total_amount || 0,
      status: (parsed.status as 'paid' | 'pending' | 'quoted') || 'paid'
    };

    // Merge with existing recommendations
    const pastRecommendations = [
      ...(existing?.past_recommendations || []),
      ...(parsed.recommendations || [])
    ];

    return {
      recent_visit: recentVisit,
      past_recommendations: pastRecommendations
    };
  }

  /**
   * Build current findings from parsed invoice
   */
  private buildCurrentFindings(parsed: ParsedInvoice): Finding[] {
    const findings: Finding[] = [];

    // Add completed work as findings
    if (parsed.work_items) {
      for (const item of parsed.work_items) {
        findings.push({
          system: this.categorizeSystem(item.description),
          description: item.description,
          status: 'completed'
        });
      }
    }

    // Add recommendations as findings
    if (parsed.recommendations) {
      for (const rec of parsed.recommendations) {
        findings.push({
          system: rec.category,
          description: rec.description,
          status: 'recommended',
          urgency: rec.urgency
        });
      }
    }

    return findings;
  }

  /**
   * Categorize work item into vehicle system
   */
  private categorizeSystem(description: string): string {
    const lower = description.toLowerCase();

    if (lower.includes('tire')) return 'tires';
    if (lower.includes('brake')) return 'brakes';
    if (lower.includes('oil') || lower.includes('fluid')) return 'fluids';
    if (lower.includes('battery') || lower.includes('electrical')) return 'electrical';
    if (lower.includes('filter') || lower.includes('air') || lower.includes('cabin')) return 'filters';
    if (lower.includes('belt') || lower.includes('hose') || lower.includes('engine')) return 'engine';
    if (lower.includes('transmission')) return 'transmission';
    if (lower.includes('suspension') || lower.includes('shock') || lower.includes('strut')) return 'suspension';

    return 'general';
  }

  /**
   * Generate a customer ID from name and phone
   */
  private generateCustomerId(name?: string, phone?: string): string {
    if (phone) {
      return `cust_${phone.replace(/[^\d]/g, '')}`;
    }
    if (name) {
      return `cust_${name.toLowerCase().replace(/\s+/g, '_')}`;
    }
    return `cust_${Date.now()}`;
  }

  /**
   * Generate a vehicle ID
   */
  private generateVehicleId(parsed: ParsedInvoice): string {
    const parts = [
      parsed.vehicle_year,
      parsed.vehicle_make,
      parsed.vehicle_model
    ].filter(Boolean);

    if (parts.length > 0) {
      return `veh_${parts.join('_').toLowerCase().replace(/\s+/g, '_')}`;
    }

    return `veh_${Date.now()}`;
  }

  /**
   * Estimate current mileage based on last known mileage and time passed
   * Assumes average of 12,000 miles per year (1,000 per month, ~33 per day)
   */
  estimateCurrentMileage(lastMileage: number, lastDate: string): number {
    const daysSince = differenceInDays(new Date(), new Date(lastDate));
    const estimatedMiles = Math.round(daysSince * 33); // ~33 miles per day average
    return lastMileage + estimatedMiles;
  }

  /**
   * Update context with estimated current mileage if time has passed
   */
  updateContextWithCurrentEstimates(context: Context): Context {
    if (context.service_history.recent_visit) {
      const lastVisit = context.service_history.recent_visit;
      const estimatedMileage = this.estimateCurrentMileage(
        lastVisit.mileage,
        lastVisit.date
      );

      return {
        ...context,
        vehicle: {
          ...context.vehicle,
          current_est_mileage: estimatedMileage
        }
      };
    }

    return context;
  }
}
