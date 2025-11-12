import fs from 'fs/promises';
import path from 'path';
import { AIRunLog } from '../models/types';

/**
 * Logger Service
 * Simple file-based logging for AI runs (can be replaced with database)
 */
export class LoggerService {
  private logsDir: string;

  constructor(logsDir?: string) {
    this.logsDir = logsDir || path.join(process.cwd(), 'logs');
    this.ensureLogsDirectory();
  }

  /**
   * Ensure logs directory exists
   */
  private async ensureLogsDirectory(): Promise<void> {
    try {
      await fs.access(this.logsDir);
    } catch {
      await fs.mkdir(this.logsDir, { recursive: true });
    }
  }

  /**
   * Log an AI run
   */
  async logRun(runLog: AIRunLog): Promise<string> {
    const id = this.generateId();
    const timestamp = new Date().toISOString();

    const logEntry = {
      ...runLog,
      id,
      created_at: timestamp
    };

    // Write to daily log file
    const fileName = `ai_runs_${this.getDateString()}.jsonl`;
    const filePath = path.join(this.logsDir, fileName);

    const logLine = JSON.stringify(logEntry) + '\n';

    await fs.appendFile(filePath, logLine);

    return id;
  }

  /**
   * Log a message outcome
   */
  async logOutcome(runId: string, outcome: string, outcomeData?: any): Promise<void> {
    const timestamp = new Date().toISOString();

    const outcomeEntry = {
      run_id: runId,
      outcome,
      outcome_data: outcomeData,
      recorded_at: timestamp
    };

    const fileName = `outcomes_${this.getDateString()}.jsonl`;
    const filePath = path.join(this.logsDir, fileName);

    const logLine = JSON.stringify(outcomeEntry) + '\n';

    await fs.appendFile(filePath, logLine);
  }

  /**
   * Get all runs for a specific customer
   */
  async getCustomerRuns(customerId: string): Promise<AIRunLog[]> {
    const files = await fs.readdir(this.logsDir);
    const runFiles = files.filter(f => f.startsWith('ai_runs_') && f.endsWith('.jsonl'));

    const runs: AIRunLog[] = [];

    for (const file of runFiles) {
      const content = await fs.readFile(path.join(this.logsDir, file), 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const run = JSON.parse(line) as AIRunLog;
          if (run.customer_id === customerId) {
            runs.push(run);
          }
        } catch (error) {
          console.error('Error parsing log line:', error);
        }
      }
    }

    return runs.sort((a, b) => {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }

  /**
   * Get recent runs (last N days)
   */
  async getRecentRuns(days: number = 7): Promise<AIRunLog[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const files = await fs.readdir(this.logsDir);
    const runFiles = files.filter(f => f.startsWith('ai_runs_') && f.endsWith('.jsonl'));

    const runs: AIRunLog[] = [];

    for (const file of runFiles) {
      const content = await fs.readFile(path.join(this.logsDir, file), 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const run = JSON.parse(line) as AIRunLog;
          const runDate = new Date(run.created_at || 0);

          if (runDate >= cutoffDate) {
            runs.push(run);
          }
        } catch (error) {
          console.error('Error parsing log line:', error);
        }
      }
    }

    return runs.sort((a, b) => {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }

  /**
   * Get statistics for task performance
   */
  async getTaskStats(): Promise<any> {
    const runs = await this.getRecentRuns(30);

    const stats = {
      total_runs: runs.length,
      by_task_type: {} as Record<string, number>,
      average_scores: {
        clarity: 0,
        trust_tone: 0,
        retention_impact: 0
      },
      outcomes: {} as Record<string, number>
    };

    let totalClarity = 0;
    let totalTrust = 0;
    let totalRetention = 0;
    let scoredRuns = 0;

    for (const run of runs) {
      // Count by task type
      stats.by_task_type[run.task_type] = (stats.by_task_type[run.task_type] || 0) + 1;

      // Sum scores
      if (run.self_scores) {
        totalClarity += run.self_scores.clarity;
        totalTrust += run.self_scores.trust_tone;
        totalRetention += run.self_scores.retention_impact;
        scoredRuns++;
      }

      // Count outcomes
      if (run.outcome) {
        stats.outcomes[run.outcome] = (stats.outcomes[run.outcome] || 0) + 1;
      }
    }

    // Calculate averages
    if (scoredRuns > 0) {
      stats.average_scores.clarity = Math.round(totalClarity / scoredRuns);
      stats.average_scores.trust_tone = Math.round(totalTrust / scoredRuns);
      stats.average_scores.retention_impact = Math.round(totalRetention / scoredRuns);
    }

    return stats;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get date string for file naming
   */
  private getDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }
}
