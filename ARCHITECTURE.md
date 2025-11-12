# System Architecture

## High-Level Flow

```
PDF Invoice
    ↓
[PDF Parser Service]
    ↓
Parsed Invoice Data (customer, vehicle, service)
    ↓
[Context Generator Service]
    ↓
Structured Context JSON
    ↓
[Task Selector Service] ←─── Business Rules
    ↓
Selected Task Type
    ↓
[Prompt Composer Service] ←─── System/Task/Meta Prompts
    ↓
Complete 4-Layer Prompt
    ↓
[AI Service (Claude API)]
    ↓
Generated Message + Self-Review Scores
    ↓
[Logger Service]
    ↓
Stored in logs/ai_runs_YYYY-MM-DD.jsonl
```

## The 4-Layer Prompt Composition

```
┌─────────────────────────────────────────────┐
│  LAYER 1: SYSTEM                            │
│  "Who am I?"                                │
│  • Personality: Trusted advisor             │
│  • Values: Safety, transparency, trust      │
│  • Style: Friendly, clear, no pressure     │
└─────────────────────────────────────────────┘
                    +
┌─────────────────────────────────────────────┐
│  LAYER 2: CONTEXT (Runtime)                 │
│  "What do I know?"                          │
│  • Customer: Bruce Wood, +1707...           │
│  • Vehicle: 2020 Ram 1500, 90,500 mi        │
│  • History: Battery replaced 8/20/24        │
│  • Recommendations: Tire replacement        │
└─────────────────────────────────────────────┘
                    +
┌─────────────────────────────────────────────┐
│  LAYER 3: TASK                              │
│  "What am I doing?"                         │
│  • Goal: Follow up on declined work        │
│  • Instructions: Mention tires, explain    │
│    why it matters, offer two options       │
│  • Tone: Helpful, not pushy                │
└─────────────────────────────────────────────┘
                    +
┌─────────────────────────────────────────────┐
│  LAYER 4: META                              │
│  "Did I do this well?"                      │
│  • Rate: Clarity, Trust/Tone, Retention    │
│  • Threshold: All scores must be 8+        │
│  • Action: Revise if below threshold       │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  FINAL MESSAGE                              │
│  "Hi Bruce, at your last visit in August   │
│   we recommended replacing your four        │
│   tires. With winter coming up and about   │
│   3,000 more miles on them..."             │
└─────────────────────────────────────────────┘
```

## Task Selection Decision Tree

```
                    [Customer Context]
                           |
                  ┌────────┴────────┐
                  │                 │
         Has Declined Work?    No   │
                  │                 │
                 Yes                │
                  │                 │
         30-90 days since?          │
                  │                 │
                 Yes                │
                  │                 │
    ┌─────────────┘                 │
    │                               │
    v                               v
[Followup              [Check Maintenance]
 Declined                      |
 Work]              ┌──────────┴──────────┐
                    │                     │
           Overdue by time/miles?    No   │
                    │                     │
                   Yes                    │
                    │                     │
    ┌───────────────┘                     │
    │                                     │
    v                                     v
[Overdue                        [Check Last Visit]
 Maintenance                           |
 Reminder]                  ┌──────────┴──────────┐
                            │                     │
                    365+ days ago?           No   │
                            │                     │
                           Yes                    │
                            │                     │
            ┌───────────────┘                     │
            │                                     │
            v                                     v
    [Inactive                          [Check Recent]
     Customer                                 |
     Reconnect]                    ┌──────────┴──────┐
                                   │                 │
                              <= 7 days?        No   │
                                   │                 │
                                  Yes                │
                                   │                 │
                   ┌───────────────┘                 │
                   │                                 │
                   v                                 v
            [Post-Service                    [Review Request]
             Check-in]
```

## Service Dependencies

```
┌─────────────────────────────────────────────────────────┐
│                      API Layer                          │
│  (Express Routes - routes.ts)                           │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        v              v              v
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ PDF Parser  │ │   Context   │ │    Task     │
│   Service   │ │  Generator  │ │  Selector   │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
       └───────────────┼───────────────┘
                       │
                       v
              ┌─────────────────┐
              │     Prompt      │
              │    Composer     │
              └────────┬────────┘
                       │
                       v
              ┌─────────────────┐
              │   AI Service    │
              │  (Claude API)   │
              └────────┬────────┘
                       │
                       v
              ┌─────────────────┐
              │     Logger      │
              │    Service      │
              └─────────────────┘
```

## Data Flow Example

### Input: PDF Invoice
```
Shop-Ware Invoice #2761
Customer: Bruce Wood
Phone: 707-962-7159
Vehicle: 2020 Ram 1500 Classic
VIN: 1C6RR7TT8LS106319
Mileage: 87,500
Date: 08/20/2024

Work Performed:
- Battery Replacement: $181.07

Recommendations:
- Tire Replacement (4): $1,063.96
```

### Step 1: PDF Parser Output
```json
{
  "customer_name": "Bruce Wood",
  "customer_phone": "+17079627159",
  "vehicle_year": 2020,
  "vehicle_make": "Ram",
  "vehicle_model": "1500 Classic",
  "vin": "1C6RR7TT8LS106319",
  "mileage": 87500,
  "service_date": "2024-08-20",
  "work_items": [
    { "description": "Battery Replacement", "cost": 181.07 }
  ],
  "recommendations": [
    {
      "description": "Tire Replacement (4)",
      "estimated_cost": 1063.96,
      "category": "tires",
      "urgency": "soon",
      "status": "recommended"
    }
  ]
}
```

### Step 2: Context Generator Output
```json
{
  "customer": {
    "id": "cust_bruce_wood",
    "name": "Bruce Wood",
    "phone": "+17079627159",
    "visit_count": 1,
    "last_visit_date": "2024-08-20"
  },
  "vehicle": {
    "id": "veh_1C6RR7TT8LS106319",
    "year": 2020,
    "make": "Ram",
    "model": "1500 Classic",
    "vin": "1C6RR7TT8LS106319",
    "current_est_mileage": 90500
  },
  "service_history": {
    "recent_visit": {
      "date": "2024-08-20",
      "mileage": 87500,
      "work_done": ["Battery Replacement"],
      "amount": 181.07
    },
    "past_recommendations": [
      {
        "description": "Tire Replacement (4)",
        "estimated_cost": 1063.96,
        "urgency": "soon",
        "status": "recommended"
      }
    ]
  }
}
```

### Step 3: Task Selector Output
```
Selected: "followup_declined_work"
Reason: "Customer has declined work and it's been 90 days since last visit"
```

### Step 4: AI Service Output
```json
{
  "message": "Hi Bruce, at your last visit in August we recommended replacing your four tires. With winter coming up and about 3,000 more miles on them since then, they're getting close to the safety limit for wet roads.\n\nWant to schedule a time this week, or would you prefer I check back with you next month?",
  "scores": {
    "clarity": 9,
    "trust_tone": 10,
    "retention_impact": 9
  }
}
```

### Step 5: Logger Output
```json
{
  "id": "run_1699889234_x7k2p",
  "customer_id": "cust_bruce_wood",
  "task_type": "followup_declined_work",
  "context_snapshot": { /* full context */ },
  "final_message": "Hi Bruce, at your last visit...",
  "self_scores": { "clarity": 9, "trust_tone": 10, "retention_impact": 9 },
  "created_at": "2024-11-11T15:23:45.123Z"
}
```

## Scalability Considerations

### Current MVP Architecture
- **File-based logging** (JSONL)
- **In-memory prompt caching**
- **Synchronous processing**
- **Single-instance deployment**

**Suitable for:** 1-50 shops, <1,000 messages/day

### Production Scaling Path

#### Phase 1: Database Integration
- Replace JSONL with PostgreSQL
- Add connection pooling
- Enable multi-instance deployment

**Suitable for:** 50-500 shops, <10,000 messages/day

#### Phase 2: Queue-Based Processing
- Add Redis/RabbitMQ for async processing
- Worker pools for PDF parsing
- Rate limiting for Claude API

**Suitable for:** 500-5,000 shops, <100,000 messages/day

#### Phase 3: Distributed Architecture
- Microservices for each component
- S3 for PDF storage
- Elasticsearch for log analysis
- Load balancing

**Suitable for:** 5,000+ shops, 1M+ messages/day

## Security Considerations

### Current Implementation
- Environment-based secrets
- File upload validation (PDF only)
- File size limits
- Basic error handling

### Production Requirements
- [ ] API authentication (JWT/OAuth)
- [ ] Rate limiting per customer
- [ ] Input sanitization for all endpoints
- [ ] Encrypted storage for PII
- [ ] Audit logging
- [ ] HTTPS/TLS
- [ ] CORS restrictions
- [ ] SQL injection prevention (when using DB)
- [ ] XSS prevention
- [ ] File upload scanning

## Monitoring & Observability

### Current Capabilities
- File-based logging
- Basic error console output
- Health check endpoint
- Statistics endpoint

### Production Needs
- [ ] Structured logging (Winston/Pino)
- [ ] Application metrics (Prometheus)
- [ ] API performance tracking
- [ ] Claude API usage monitoring
- [ ] Error tracking (Sentry)
- [ ] Uptime monitoring
- [ ] Dashboard (Grafana)

## Cost Considerations

### Claude API Usage
- Model: claude-3-5-sonnet-20241022
- Tokens per message: ~2,000-4,000 (varies by context size)
- Cost: ~$0.01-0.02 per message
- Monthly (10,000 messages): ~$100-200

### Infrastructure (AWS Example)
- EC2 t3.small: ~$15/month
- RDS PostgreSQL (db.t3.micro): ~$15/month
- S3 storage: ~$1/month
- Total: ~$130-230/month for 10,000 messages

### Alternative: Serverless
- Lambda + API Gateway + DynamoDB
- Pay-per-use model
- ~$50-100/month for 10,000 messages
