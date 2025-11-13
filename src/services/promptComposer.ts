import fs from 'fs/promises';
import path from 'path';
import { Context, TaskType } from '../models/types';

/**
 * Prompt Composer Service
 * Handles the multi-layer prompt system: System + Context + Task + Meta
 */
export class PromptComposerService {
  private promptsDir: string;
  private promptCache: Map<string, string> = new Map();

  constructor(promptsDir?: string) {
    this.promptsDir = promptsDir || path.join(process.cwd(), 'prompts');
  }

  /**
   * Compose a complete prompt from all layers
   */
  async composePrompt(
    context: Context,
    taskType: TaskType,
    systemName: string = '00_system_automotive_retention_expert',
    metaName: string = '30_meta_self_review_trust_clarity'
  ): Promise<string> {
    // Load all prompt layers
    const systemPrompt = await this.loadPrompt('system', systemName);
    const taskPrompt = await this.loadPrompt('task', this.getTaskFileName(taskType));
    const metaPrompt = await this.loadPrompt('meta', metaName);

    // Build context layer as formatted text
    const contextPrompt = this.buildContextPrompt(context);

    // Compose final prompt
    return this.assemblePrompt(systemPrompt, contextPrompt, taskPrompt, metaPrompt);
  }

  /**
   * Load a prompt file (with caching)
   */
  private async loadPrompt(layer: 'system' | 'task' | 'meta', fileName: string): Promise<string> {
    const cacheKey = `${layer}/${fileName}`;

    if (this.promptCache.has(cacheKey)) {
      return this.promptCache.get(cacheKey)!;
    }

    const filePath = path.join(this.promptsDir, layer, `${fileName}.md`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.promptCache.set(cacheKey, content);
      return content;
    } catch (error) {
      console.error(`Error loading prompt file: ${filePath}`, error);
      throw new Error(`Failed to load prompt: ${layer}/${fileName}`);
    }
  }

  /**
   * Build the context prompt from structured data
   */
  private buildContextPrompt(context: Context): string {
    const { customer, vehicle, shop, service_history, current_findings } = context;

    let contextText = '# Context: Customer and Service Data\n\n';

    // Customer section
    contextText += '## Customer\n';
    contextText += `- **Name**: ${customer.name}\n`;
    contextText += `- **Phone**: ${customer.phone}\n`;
    if (customer.email) contextText += `- **Email**: ${customer.email}\n`;
    contextText += `- **Visit Count**: ${customer.visit_count}\n`;
    contextText += `- **Last Visit**: ${customer.last_visit_date}\n\n`;

    // Vehicle section
    contextText += '## Vehicle\n';
    contextText += `- **Vehicle**: ${vehicle.year} ${vehicle.make} ${vehicle.model}\n`;
    if (vehicle.vin) contextText += `- **VIN**: ${vehicle.vin}\n`;
    if (vehicle.plate) contextText += `- **Plate**: ${vehicle.plate}\n`;
    contextText += `- **Current Estimated Mileage**: ${vehicle.current_est_mileage.toLocaleString()} miles\n\n`;

    // Shop section
    contextText += '## Shop Information\n';
    contextText += `- **Shop**: ${shop.name}\n`;
    contextText += `- **Address**: ${shop.address}\n`;
    contextText += `- **Phone**: ${shop.phone}\n\n`;

    // Recent visit section
    if (service_history.recent_visit) {
      const visit = service_history.recent_visit;

      // Calculate days since visit
      const visitDate = new Date(visit.date);
      const today = new Date();
      const daysSince = Math.floor((today.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));

      contextText += '## Recent Visit\n';
      contextText += `- **Date**: ${visit.date}\n`;
      contextText += `- **Days Since Visit**: ${daysSince} days ago\n`;
      contextText += `- **Mileage**: ${visit.mileage.toLocaleString()} miles\n`;
      if (visit.advisor) contextText += `- **Service Advisor**: ${visit.advisor}\n`;
      if (visit.technician) contextText += `- **Technician**: ${visit.technician}\n`;
      contextText += `- **Amount**: $${visit.amount.toFixed(2)}\n`;

      if (visit.work_done && visit.work_done.length > 0) {
        contextText += '- **Work Completed**:\n';
        visit.work_done.forEach(work => {
          contextText += `  - ${work}\n`;
        });
      }
      contextText += '\n';
    }

    // Past recommendations section
    if (service_history.past_recommendations && service_history.past_recommendations.length > 0) {
      contextText += '## Past Recommendations\n';
      service_history.past_recommendations.forEach(rec => {
        contextText += `- **${rec.description}**\n`;
        if (rec.estimated_cost != null) {
          contextText += `  - Estimated Cost: $${rec.estimated_cost.toFixed(2)}\n`;
        }
        contextText += `  - Category: ${rec.category}\n`;
        contextText += `  - Urgency: ${rec.urgency}\n`;
        contextText += `  - Status: ${rec.status}\n`;
      });
      contextText += '\n';
    }

    // Current findings section
    if (current_findings && current_findings.length > 0) {
      contextText += '## Current Findings\n';
      current_findings.forEach(finding => {
        contextText += `- **${finding.system}**: ${finding.description}\n`;
        contextText += `  - Status: ${finding.status}\n`;
        if (finding.urgency) contextText += `  - Urgency: ${finding.urgency}\n`;
      });
      contextText += '\n';
    }

    return contextText;
  }

  /**
   * Assemble all prompt layers into final prompt
   */
  private assemblePrompt(
    system: string,
    context: string,
    task: string,
    meta: string
  ): string {
    return `${system}

---

${context}

---

${task}

---

${meta}`;
  }

  /**
   * Get task file name from task type
   */
  private getTaskFileName(taskType: TaskType): string {
    const fileMap: Record<TaskType, string> = {
      followup_declined_work: '20_task_followup_declined_work',
      overdue_maintenance_reminder: '21_task_overdue_maintenance_reminder',
      post_service_checkin: '22_task_post_service_checkin',
      inactive_customer_reconnect: '23_task_inactive_customer_reconnect',
      review_request: '24_task_review_request'
    };

    return fileMap[taskType];
  }

  /**
   * Clear the prompt cache (useful for development/updates)
   */
  clearCache(): void {
    this.promptCache.clear();
  }

  /**
   * Get a specific prompt layer for debugging
   */
  async getPromptLayer(layer: 'system' | 'task' | 'meta', fileName: string): Promise<string> {
    return this.loadPrompt(layer, fileName);
  }
}
