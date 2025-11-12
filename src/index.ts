import dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
dotenv.config();

import express from 'express';
import path from 'path';
import routes from './api/routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(process.cwd(), 'public')));

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Routes
app.use('/api', routes);

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'AI CRM Expert - Automotive Retention System',
    version: '1.0.0',
    description: 'Multi-layer prompt system for automotive service retention',
    endpoints: {
      health: 'GET /api/health',
      upload_invoice: 'POST /api/upload-invoice',
      generate_message: 'POST /api/generate-message',
      process_invoice: 'POST /api/process-invoice (full pipeline)',
      log_outcome: 'POST /api/log-outcome',
      customer_history: 'GET /api/customer-history/:customerId',
      stats: 'GET /api/stats'
    }
  });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚗 AI CRM Expert server running on port ${PORT}`);
  console.log(`🌐 Web Interface: http://localhost:${PORT}`);
  console.log(`📝 API documentation: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);

  const aiProvider = process.env.AI_PROVIDER || 'anthropic';
  if (aiProvider === 'gemini' && !process.env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY not set - AI generation will not work');
  } else if (aiProvider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY not set - AI generation will not work');
  }
});

export default app;
