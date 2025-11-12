# Getting Started with AI CRM Expert

This guide will help you get the MVP up and running quickly.

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your Anthropic API key
# Get your API key from: https://console.anthropic.com/
```

Your `.env` file should look like:
```
PORT=3000
NODE_ENV=development
ANTHROPIC_API_KEY=sk-ant-...your-key-here...
```

## Step 3: Start the Development Server

```bash
npm run dev
```

You should see:
```
🚗 AI CRM Expert server running on port 3000
📝 API documentation: http://localhost:3000
🏥 Health check: http://localhost:3000/api/health
```

## Step 4: Test the API

### Test 1: Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "success": true,
  "status": "healthy",
  "ai_configured": true
}
```

### Test 2: Generate a Message

```bash
curl -X POST http://localhost:3000/api/generate-message \
  -H "Content-Type: application/json" \
  -d @examples/sample_context.json
```

This will:
1. Auto-select the best task type based on context
2. Generate a personalized message using Claude
3. Return the message with self-review scores

### Test 3: Process a PDF Invoice

```bash
curl -X POST http://localhost:3000/api/process-invoice \
  -F "invoice=@path/to/your/invoice.pdf"
```

This runs the complete pipeline:
1. Parse the PDF
2. Extract structured data
3. Generate context
4. Select appropriate task
5. Generate personalized message
6. Log the run

## Understanding the Output

When you generate a message, you'll receive:

```json
{
  "success": true,
  "message": "Hi Bruce, at your last visit in August...",
  "task_type": "followup_declined_work",
  "task_selection_reason": "Customer has declined work and it's been 90 days...",
  "scores": {
    "clarity": 9,
    "trust_tone": 10,
    "retention_impact": 9
  },
  "run_id": "run_1234567890_abc123"
}
```

### Understanding Task Selection

The system automatically selects tasks based on:

- **followup_declined_work** - Customer declined service 30-90 days ago
- **overdue_maintenance_reminder** - Maintenance overdue by time/mileage
- **inactive_customer_reconnect** - No visit in 365+ days
- **post_service_checkin** - Visit within last 7 days
- **review_request** - 8-30 days after good visit

### Understanding Scores

The AI self-reviews each message on three dimensions (1-10 scale):

- **Clarity** - Is the message easy to understand? Is the action clear?
- **Trust & Tone** - Does it sound like advice from a trusted friend?
- **Retention Impact** - Does it strengthen the relationship?

Messages scoring 8+ on all dimensions are considered ready to send.

## Next Steps

### Customize Prompts

Edit the prompt files in `prompts/` to match your shop's voice:

```
prompts/
├── system/          # Overall personality and approach
├── task/            # Specific communication types
└── meta/            # Quality review criteria
```

### View Logs

All AI runs are logged to `logs/ai_runs_YYYY-MM-DD.jsonl`:

```bash
# View today's logs
cat logs/ai_runs_$(date +%Y-%m-%d).jsonl | jq

# Get statistics
curl http://localhost:3000/api/stats
```

### Log Outcomes

Track what happens after sending messages:

```bash
curl -X POST http://localhost:3000/api/log-outcome \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "run_1234567890_abc123",
    "outcome": "replied",
    "outcome_data": { "booked_appointment": true }
  }'
```

Outcome types:
- `replied` - Customer responded
- `booked` - Customer scheduled service
- `ignored` - No response
- `unsubscribed` - Customer opted out

### Production Deployment

For production use:

1. **Add a Database** - Use the schema in `src/services/database.sql`
2. **Add Authentication** - Protect API endpoints
3. **Add SMS/Email Integration** - Send messages automatically
4. **Set up Monitoring** - Track performance and errors
5. **Configure CORS** - Restrict API access

## Testing Without PDF

You can test the system without uploading PDFs by using the sample context:

```bash
# Using the test script
npx tsx examples/test_generate_message.ts

# Or using the sample context directly
curl -X POST http://localhost:3000/api/generate-message \
  -H "Content-Type: application/json" \
  -d @examples/sample_context.json
```

## Troubleshooting

### "AI service not configured" error

Make sure `ANTHROPIC_API_KEY` is set in your `.env` file.

### PDF parsing issues

The PDF parser uses basic pattern matching. For production, you may need to:
- Customize regex patterns for your invoice format
- Use OCR for scanned invoices
- Integrate with your shop management system API

### Port already in use

Change the port in `.env`:
```
PORT=3001
```

## Getting Help

- Check the [README.md](README.md) for full API documentation
- Review prompt files in `prompts/` for customization examples
- Check logs in `logs/` for debugging

## Philosophy

Remember: The goal is to help customers feel **advised, not sold**.

Every message should:
- Sound personal and genuine
- Explain the "why" behind recommendations
- Respect the customer's timeline and budget
- Build trust for the next visit

Happy building! 🚗✨
