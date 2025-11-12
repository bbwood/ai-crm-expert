import { Context, TaskType, Recommendation } from '../models/types';
import { differenceInDays } from 'date-fns';

/**
 * Task Selection Service
 * Determines which task type to use based on customer context
 */
export class TaskSelectorService {
  /**
   * Select the most appropriate task type based on context
   */
  selectTask(context: Context): TaskType {
    const daysSinceLastVisit = this.getDaysSinceLastVisit(context);

    // Priority 1: Recent visit with declined work (within 30-90 days)
    if (this.hasDeclinedWork(context) && daysSinceLastVisit >= 30 && daysSinceLastVisit <= 90) {
      return 'followup_declined_work';
    }

    // Priority 2: Overdue maintenance (based on mileage or time)
    if (this.isMaintenanceOverdue(context)) {
      return 'overdue_maintenance_reminder';
    }

    // Priority 3: Inactive customer (no visit in over 365 days)
    if (daysSinceLastVisit > 365) {
      return 'inactive_customer_reconnect';
    }

    // Priority 4: Recent visit check-in (within 7 days)
    if (daysSinceLastVisit <= 7) {
      return 'post_service_checkin';
    }

    // Priority 5: Review request (8-30 days after visit, good experience)
    if (daysSinceLastVisit >= 8 && daysSinceLastVisit <= 30) {
      return 'review_request';
    }

    // Default: Review request
    return 'review_request';
  }

  /**
   * Check if customer has declined work that should be followed up
   */
  private hasDeclinedWork(context: Context): boolean {
    if (!context.service_history.past_recommendations) {
      return false;
    }

    return context.service_history.past_recommendations.some(
      rec => rec.status === 'declined' || rec.status === 'recommended'
    );
  }

  /**
   * Check if maintenance is overdue based on typical intervals
   */
  private isMaintenanceOverdue(context: Context): boolean {
    const { vehicle, service_history } = context;

    if (!service_history.recent_visit) {
      return false;
    }

    const lastVisit = service_history.recent_visit;
    const milesSinceLastVisit = vehicle.current_est_mileage - lastVisit.mileage;
    const daysSinceLastVisit = this.getDaysSinceLastVisit(context);

    // Oil change typically due every 5,000-7,500 miles or 6 months
    if (milesSinceLastVisit > 7500 || daysSinceLastVisit > 180) {
      return true;
    }

    // Check for specific overdue services based on work done
    const lastWorkDone = lastVisit.work_done.map(w => w.toLowerCase()).join(' ');

    // If last visit was just an inspection or minor work, and it's been a while
    const isMinorService = lastWorkDone.includes('inspection') ||
                          lastWorkDone.includes('check') ||
                          lastWorkDone.includes('tire rotation');

    if (isMinorService && milesSinceLastVisit > 5000) {
      return true;
    }

    return false;
  }

  /**
   * Calculate days since last visit
   */
  private getDaysSinceLastVisit(context: Context): number {
    if (!context.service_history.recent_visit) {
      return 9999; // Very large number if no visit history
    }

    const lastVisitDate = new Date(context.service_history.recent_visit.date);
    return differenceInDays(new Date(), lastVisitDate);
  }

  /**
   * Get explanation for why a task was selected (useful for logging/debugging)
   */
  getTaskSelectionReason(context: Context, selectedTask: TaskType): string {
    const daysSince = this.getDaysSinceLastVisit(context);

    switch (selectedTask) {
      case 'followup_declined_work':
        return `Customer has declined work and it's been ${daysSince} days since last visit`;

      case 'overdue_maintenance_reminder':
        const milesSince = context.service_history.recent_visit
          ? context.vehicle.current_est_mileage - context.service_history.recent_visit.mileage
          : 0;
        return `Maintenance overdue: ${milesSince} miles and ${daysSince} days since last visit`;

      case 'inactive_customer_reconnect':
        return `Inactive customer: ${daysSince} days since last visit`;

      case 'post_service_checkin':
        return `Recent visit: ${daysSince} days ago`;

      case 'review_request':
        return `Good time for review request: ${daysSince} days after positive visit`;

      default:
        return 'Default task selection';
    }
  }

  /**
   * Validate that the selected task is appropriate for the context
   */
  validateTaskSelection(context: Context, taskType: TaskType): boolean {
    const daysSince = this.getDaysSinceLastVisit(context);

    switch (taskType) {
      case 'followup_declined_work':
        return this.hasDeclinedWork(context);

      case 'overdue_maintenance_reminder':
        return this.isMaintenanceOverdue(context);

      case 'inactive_customer_reconnect':
        return daysSince > 365;

      case 'post_service_checkin':
        return daysSince <= 7;

      case 'review_request':
        return daysSince >= 8 && daysSince <= 30;

      default:
        return true;
    }
  }
}
