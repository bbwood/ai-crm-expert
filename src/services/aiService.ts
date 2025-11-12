import Anthropic from '@anthropic-ai/sdk';
import { Context, TaskType, MessageGenerationResponse } from '../models/types';
import { PromptComposerService } from './promptComposer';

/**
 * AI Service
 * Handles message generation using Claude API
 */
export class AIService {
  public client: Anthropic;
  private promptComposer: PromptComposerService;
  private model: string;

  constructor(apiKey: string, promptComposer: PromptComposerService, model: string = 'claude-sonnet-4-5-20250929') {
    this.client = new Anthropic({ apiKey });
    this.promptComposer = promptComposer;
    // Use Claude Sonnet 4.5
    this.model = 'claude-sonnet-4-5-20250929';
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

      // Call Claude API
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // Extract the response text
      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      console.log('=== Claude Response ===');
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
   * Test the prompt composition without calling the API
   */
  async testPromptComposition(context: Context, taskType: TaskType): Promise<string> {
    return this.promptComposer.composePrompt(context, taskType);
  }

  /**
   * Generate multiple message variants for A/B testing
   */
  async generateVariants(
    context: Context,
    taskType: TaskType,
    count: number = 3
  ): Promise<MessageGenerationResponse[]> {
    const variants: MessageGenerationResponse[] = [];

    for (let i = 0; i < count; i++) {
      const variant = await this.generateMessage(context, taskType);
      variants.push(variant);
    }

    return variants;
  }
}
