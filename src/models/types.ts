// Core data models for the retention expert system

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  visit_count: number;
  last_visit_date: string;
}

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  vin?: string;
  plate?: string;
  current_est_mileage: number;
}

export interface Shop {
  name: string;
  address: string;
  phone: string;
  email?: string;
}

export interface WorkItem {
  description: string;
  category?: string;
  cost?: number;
}

export interface Recommendation {
  description: string;
  estimated_cost: number;
  category: string;
  urgency: 'immediate' | 'soon' | 'future' | 'monitor';
  status: 'recommended' | 'declined' | 'approved' | 'completed';
  date_recommended?: string;
}

export interface ServiceVisit {
  visit_id: string;
  date: string;
  mileage: number;
  advisor?: string;
  technician?: string;
  work_done: string[];
  amount: number;
  status: 'paid' | 'pending' | 'quoted';
}

export interface ServiceHistory {
  recent_visit?: ServiceVisit;
  past_recommendations?: Recommendation[];
}

export interface Finding {
  system: string;
  description: string;
  status: 'completed' | 'recommended' | 'monitoring';
  urgency?: 'immediate' | 'soon' | 'future' | 'monitor';
}

export interface Context {
  customer: Customer;
  vehicle: Vehicle;
  shop: Shop;
  service_history: ServiceHistory;
  current_findings: Finding[];
}

export interface ParsedInvoice {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  vehicle_year?: number;
  vehicle_make?: string;
  vehicle_model?: string;
  vin?: string;
  plate?: string;
  mileage?: number;
  service_date?: string;
  invoice_number?: string;
  advisor?: string;
  technician?: string;
  work_items?: WorkItem[];
  recommendations?: Recommendation[];
  total_amount?: number;
  status?: string;
}

export type TaskType =
  | 'followup_declined_work'
  | 'overdue_maintenance_reminder'
  | 'post_service_checkin'
  | 'inactive_customer_reconnect'
  | 'review_request';

export interface AIRunLog {
  id?: string;
  customer_id: string;
  task_type: TaskType;
  system_name: string;
  task_name: string;
  meta_name: string;
  context_snapshot: Context;
  final_message: string;
  self_scores?: {
    clarity: number;
    trust_tone: number;
    retention_impact: number;
  };
  outcome?: string;
  created_at?: string;
}

export interface MessageGenerationRequest {
  context: Context;
  task_type?: TaskType; // Optional - will auto-select if not provided
}

export interface MessageGenerationResponse {
  message: string;
  task_type: TaskType;
  scores: {
    clarity: number;
    trust_tone: number;
    retention_impact: number;
  };
  run_log_id?: string;
}
