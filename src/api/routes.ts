import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { PDFParserService } from '../services/pdfParser';
import { ContextGeneratorService } from '../services/contextGenerator';
import { PromptComposerService } from '../services/promptComposer';
import { TaskSelectorService } from '../services/taskSelector';
import { AIService } from '../services/aiService';
import { GeminiService } from '../services/geminiService';
import { LoggerService } from '../services/logger';
import { Context, TaskType, Shop } from '../models/types';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'uploads'),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Initialize services
const contextGenerator = new ContextGeneratorService();
const promptComposer = new PromptComposerService();
const taskSelector = new TaskSelectorService();
const logger = new LoggerService();

// Determine which AI provider to use
const aiProvider = process.env.AI_PROVIDER || 'anthropic';
let aiService: AIService | GeminiService | null = null;
let pdfParser: PDFParserService;

if (aiProvider === 'gemini') {
  if (process.env.GEMINI_API_KEY) {
    console.log('Using Gemini AI provider');
    aiService = new GeminiService(process.env.GEMINI_API_KEY, promptComposer);
    pdfParser = new PDFParserService(
      process.env.ANTHROPIC_API_KEY,
      process.env.OPENAI_API_KEY,
      aiService
    );
  } else {
    console.warn('GEMINI_API_KEY not set - AI generation will not work');
    pdfParser = new PDFParserService(
      process.env.ANTHROPIC_API_KEY,
      process.env.OPENAI_API_KEY
    );
  }
} else {
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('Using Anthropic AI provider');
    aiService = new AIService(process.env.ANTHROPIC_API_KEY, promptComposer);
    pdfParser = new PDFParserService(
      process.env.ANTHROPIC_API_KEY,
      process.env.OPENAI_API_KEY
    );
  } else {
    console.warn('ANTHROPIC_API_KEY not set - AI generation will not work');
    pdfParser = new PDFParserService(
      undefined,
      process.env.OPENAI_API_KEY
    );
  }
}

/**
 * POST /api/upload-invoice
 * Upload and parse a PDF invoice
 */
router.post('/upload-invoice', upload.single('invoice'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse the PDF
    const parsedInvoice = await pdfParser.parsePDF(req.file.path);

    // Generate context
    const context = contextGenerator.generateContext(parsedInvoice);

    res.json({
      success: true,
      parsed_invoice: parsedInvoice,
      context
    });
  } catch (error) {
    console.error('Error processing invoice:', error);
    res.status(500).json({
      error: 'Failed to process invoice',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/generate-message
 * Generate a customer engagement message from context
 */
router.post('/generate-message', async (req: Request, res: Response) => {
  try {
    if (!aiService) {
      return res.status(503).json({
        error: 'AI service not configured',
        message: 'ANTHROPIC_API_KEY not set'
      });
    }

    const { context, task_type } = req.body as {
      context: Context;
      task_type?: TaskType;
    };

    if (!context) {
      return res.status(400).json({ error: 'Context is required' });
    }

    // Auto-select task if not provided
    const selectedTask = task_type || taskSelector.selectTask(context);
    const selectionReason = taskSelector.getTaskSelectionReason(context, selectedTask);

    // Generate message
    const result = await aiService.generateMessage(context, selectedTask);

    // Log the run
    const runId = await logger.logRun({
      customer_id: context.customer.id,
      task_type: selectedTask,
      system_name: '00_system_automotive_retention_expert',
      task_name: selectedTask,
      meta_name: '30_meta_self_review_trust_clarity',
      context_snapshot: context,
      final_message: result.message,
      self_scores: result.scores
    });

    res.json({
      success: true,
      message: result.message,
      task_type: selectedTask,
      task_selection_reason: selectionReason,
      scores: result.scores,
      run_id: runId
    });
  } catch (error) {
    console.error('Error generating message:', error);
    res.status(500).json({
      error: 'Failed to generate message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/process-invoice
 * Complete pipeline: upload PDF -> parse -> generate context -> generate message
 */
router.post('/process-invoice', upload.single('invoice'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!aiService) {
      return res.status(503).json({
        error: 'AI service not configured',
        message: 'ANTHROPIC_API_KEY not set'
      });
    }

    // Step 1: Parse PDF
    const parsedInvoice = await pdfParser.parsePDF(req.file.path);

    // Step 2: Generate context
    const context = contextGenerator.generateContext(parsedInvoice);

    // Step 3: Select task
    const taskType = taskSelector.selectTask(context);
    const selectionReason = taskSelector.getTaskSelectionReason(context, taskType);

    // Step 4: Generate message
    const result = await aiService.generateMessage(context, taskType);

    // Step 5: Log the run
    const runId = await logger.logRun({
      customer_id: context.customer.id,
      task_type: taskType,
      system_name: '00_system_automotive_retention_expert',
      task_name: taskType,
      meta_name: '30_meta_self_review_trust_clarity',
      context_snapshot: context,
      final_message: result.message,
      self_scores: result.scores
    });

    res.json({
      success: true,
      parsed_invoice: parsedInvoice,
      context,
      message: result.message,
      task_type: taskType,
      task_selection_reason: selectionReason,
      scores: result.scores,
      run_id: runId
    });
  } catch (error) {
    console.error('Error processing invoice:', error);
    res.status(500).json({
      error: 'Failed to process invoice',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/log-outcome
 * Log the outcome of a sent message
 */
router.post('/log-outcome', async (req: Request, res: Response) => {
  try {
    const { run_id, outcome, outcome_data } = req.body;

    if (!run_id || !outcome) {
      return res.status(400).json({ error: 'run_id and outcome are required' });
    }

    await logger.logOutcome(run_id, outcome, outcome_data);

    res.json({ success: true });
  } catch (error) {
    console.error('Error logging outcome:', error);
    res.status(500).json({
      error: 'Failed to log outcome',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/customer-history/:customerId
 * Get all AI runs for a customer
 */
router.get('/customer-history/:customerId', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const runs = await logger.getCustomerRuns(customerId);

    res.json({
      success: true,
      customer_id: customerId,
      runs
    });
  } catch (error) {
    console.error('Error fetching customer history:', error);
    res.status(500).json({
      error: 'Failed to fetch customer history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/stats
 * Get statistics about AI performance
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await logger.getTaskStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/chat
 * Free-form chat about the invoice
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    if (!aiService) {
      return res.status(503).json({
        error: 'AI service not configured',
        message: `${aiProvider.toUpperCase()}_API_KEY not set`
      });
    }

    const { message, contexts, parsedInvoices } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Support both single and multiple invoices
    const invoiceData = contexts || parsedInvoices
      ? { contexts: contexts || [], parsedInvoices: parsedInvoices || [] }
      : { contexts: [], parsedInvoices: [] };

    let responseText: string;

    if (aiService instanceof GeminiService) {
      // Use Gemini's chat method with all invoices
      const model = (aiService as GeminiService).client.getGenerativeModel({
        model: 'gemini-2.5-flash',
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

      const userPrompt = `The user has uploaded ${invoiceData.contexts.length} invoice(s). Here's all the data:

${JSON.stringify(invoiceData, null, 2)}

User question: ${message}

CRITICAL: Your response MUST start with "📋 Summary:" followed by sections with emoji headers. DO NOT write a paragraph response.`;

      const result = await model.generateContent(userPrompt);
      const response = await result.response;
      responseText = response.text();

      console.log('=== GEMINI CHAT RAW RESPONSE ===');
      console.log(responseText);
      console.log('=== END RAW RESPONSE ===');
    } else {
      // Use Anthropic's chat with all invoices
      const systemPrompt = `You are an expert automotive service invoice analyzer.

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

NEVER write prose paragraphs. ALWAYS use the structured format above.`;

      const userPrompt = `The user has uploaded ${invoiceData.contexts.length} invoice(s). Here's all the data:

${JSON.stringify(invoiceData, null, 2)}

User question: ${message}

CRITICAL: Your response MUST start with "📋 Summary:" followed by sections with emoji headers. DO NOT write a paragraph response.`;

      const response = await (aiService as AIService).client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt
        }]
      });

      responseText = response.content[0].type === 'text' ? response.content[0].text : '';

      console.log('=== CLAUDE CHAT RAW RESPONSE ===');
      console.log(responseText);
      console.log('=== END RAW RESPONSE ===');
    }

    res.json({
      success: true,
      response: responseText
    });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({
      error: 'Failed to get chat response',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    ai_configured: !!aiService
  });
});

export default router;
