# AI CRM Expert - Automotive Retention System

A multi-layer prompt system that transforms PDF service invoices into actionable AI customer engagement messages for independent auto repair shops.

## Overview

This MVP enables automotive service retention through:
1. **PDF Invoice Ingestion** - Upload and parse service invoices
2. **Structured Data Extraction** - Extract customer, vehicle, and service data
3. **Context Generation** - Build comprehensive JSON context layers
4. **Multi-Layer Prompt System** - Generate personal, high-trust messages
5. **Performance Tracking** - Log and analyze message effectiveness

## Architecture

### Four-Layer Prompt System

Each AI message is composed of four modular layers:

| Layer | Purpose |
|-------|---------|
| **System** | Defines personality, reasoning, and tone |
| **Context** | Injects customer, vehicle, and service data |
| **Task** | Defines what to say and why |
| **Meta** | Performs self-review and improvement |

### Task Types

1. **followup_declined_work** - Re-engage customers who declined recommendations
2. **overdue_maintenance_reminder** - Remind about overdue service
3. **post_service_checkin** - Check in after recent visit
4. **inactive_customer_reconnect** - Re-engage customers not seen in 365+ days
5. **review_request** - Request reviews from satisfied customers

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Anthropic API key

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and add your Anthropic API key
# ANTHROPIC_API_KEY=your_key_here
```

### Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### Health Check
```bash
GET /api/health
```

### Upload and Parse Invoice
```bash
POST /api/upload-invoice
Content-Type: multipart/form-data

invoice: [PDF file]
```

### Generate Message from Context
```bash
POST /api/generate-message
Content-Type: application/json

{
  "context": { /* Context object */ },
  "task_type": "followup_declined_work" // optional - auto-selects if not provided
}
```

### Complete Pipeline (Upload → Parse → Generate)
```bash
POST /api/process-invoice
Content-Type: multipart/form-data

invoice: [PDF file]
```

Returns complete pipeline output including:
- Parsed invoice data
- Generated context
- AI-generated message
- Task selection reasoning
- Self-review scores

### Log Message Outcome
```bash
POST /api/log-outcome
Content-Type: application/json

{
  "run_id": "run_123...",
  "outcome": "replied",
  "outcome_data": { /* optional metadata */ }
}
```

### Get Customer History
```bash
GET /api/customer-history/:customerId
```

### Get Performance Statistics
```bash
GET /api/stats
```

## Example Usage

### Using cURL

```bash
# Upload and process an invoice (complete pipeline)
curl -X POST http://localhost:3000/api/process-invoice \
  -F "invoice=@path/to/invoice.pdf"

# Generate message from existing context
curl -X POST http://localhost:3000/api/generate-message \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "customer": {
        "id": "cust_bruce",
        "name": "Bruce Wood",
        "phone": "+17079627159",
        "visit_count": 1,
        "last_visit_date": "2024-08-20"
      },
      "vehicle": {
        "id": "veh_1",
        "year": 2020,
        "make": "Ram",
        "model": "1500 Classic",
        "current_est_mileage": 87500
      },
      "shop": {
        "name": "Sport Auto Center",
        "address": "200 E Chestnut St, Fort Bragg, CA 95437",
        "phone": "707-964-5915"
      },
      "service_history": {
        "recent_visit": {
          "visit_id": "inv_2761",
          "date": "2024-08-20",
          "mileage": 87500,
          "advisor": "Andrea",
          "technician": "Danny",
          "work_done": ["Battery replacement", "Tire inspection"],
          "amount": 181.07,
          "status": "paid"
        },
        "past_recommendations": [
          {
            "description": "Tire replacement - 4",
            "estimated_cost": 1063.96,
            "category": "tires",
            "urgency": "soon",
            "status": "recommended"
          }
        ]
      },
      "current_findings": []
    }
  }'
```

### JavaScript Example

```javascript
// Upload and process invoice
const formData = new FormData();
formData.append('invoice', pdfFile);

const response = await fetch('http://localhost:3000/api/process-invoice', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Generated message:', result.message);
console.log('Task type:', result.task_type);
console.log('Scores:', result.scores);
```

## Project Structure

```
ai-crm-expert/
├── prompts/                    # Multi-layer prompt templates
│   ├── system/                 # System layer prompts
│   │   └── 00_system_automotive_retention_expert.md
│   ├── task/                   # Task layer prompts
│   │   ├── 20_task_followup_declined_work.md
│   │   ├── 21_task_overdue_maintenance_reminder.md
│   │   ├── 22_task_post_service_checkin.md
│   │   ├── 23_task_inactive_customer_reconnect.md
│   │   └── 24_task_review_request.md
│   └── meta/                   # Meta layer prompts
│       └── 30_meta_self_review_trust_clarity.md
├── src/
│   ├── api/                    # API routes
│   │   └── routes.ts
│   ├── models/                 # TypeScript types
│   │   └── types.ts
│   ├── services/               # Core services
│   │   ├── pdfParser.ts        # PDF parsing
│   │   ├── contextGenerator.ts # Context generation
│   │   ├── promptComposer.ts   # Prompt composition
│   │   ├── taskSelector.ts     # Task selection logic
│   │   ├── aiService.ts        # AI message generation
│   │   ├── logger.ts           # Run logging
│   │   └── database.sql        # Database schema
│   └── index.ts                # Main server
├── uploads/                    # Uploaded PDFs (gitignored)
├── logs/                       # JSON logs (gitignored)
├── package.json
├── tsconfig.json
└── .env                        # Environment variables
```

## Task Selection Logic

The system automatically selects the most appropriate task based on customer context:

1. **Follow-up on declined work** - If customer declined work 30-90 days ago
2. **Overdue maintenance reminder** - If maintenance is overdue by time/mileage
3. **Inactive customer reconnect** - If no visit in 365+ days
4. **Post-service check-in** - If visit was within last 7 days
5. **Review request** - If 8-30 days after positive visit

## Logging and Analytics

All AI runs are logged to `logs/ai_runs_YYYY-MM-DD.jsonl` with:
- System, task, and meta layer names
- Complete context snapshot
- Final message generated
- Self-review scores (clarity, trust, retention impact)
- Customer outcomes

Use `/api/stats` to get performance analytics:
- Total runs by task type
- Average self-review scores
- Outcome tracking

## Philosophy

> Customers should *feel advised, not sold.*
> The shop should *earn the next visit through trust, not discounts.*

This layered system ensures AI messages stay personal, ethical, and effective.

## Future Enhancements

- Database integration (PostgreSQL schema provided)
- SMS/Email integration for sending messages
- A/B testing framework
- Web dashboard for monitoring
- Custom prompt variant management
- Automated outcome tracking

## License

MIT
