# Quick Reference Card

## 🚀 Installation (First Time)

```bash
npm install
cp .env.example .env
# Edit .env and add: ANTHROPIC_API_KEY=your-key-here
npm run dev
```

## 🔧 Daily Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Run production build
```

## 📡 API Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/generate-message` | POST | Generate message from context |
| `/api/process-invoice` | POST | **Full pipeline** (recommended) |
| `/api/stats` | GET | Performance statistics |

## 💬 Generate Message (cURL)

```bash
curl -X POST http://localhost:3000/api/generate-message \
  -H "Content-Type: application/json" \
  -d @examples/sample_context.json
```

## 📄 Process PDF Invoice (cURL)

```bash
curl -X POST http://localhost:3000/api/process-invoice \
  -F "invoice=@path/to/invoice.pdf"
```

## 🧪 Test Commands

```bash
# Test with TypeScript
npx tsx examples/test_generate_message.ts

# Test with cURL
./examples/test_api.sh

# Test health
curl http://localhost:3000/api/health
```

## 📁 Key File Locations

```
prompts/system/        # Edit personality & values
prompts/task/          # Edit specific task instructions
prompts/meta/          # Edit quality review criteria

src/services/
  - pdfParser.ts       # Customize PDF parsing
  - taskSelector.ts    # Adjust selection rules
  - contextGenerator.ts # Modify context building

logs/                  # View AI run logs
examples/              # Sample data & tests
```

## 🎯 Task Types

1. **followup_declined_work** - 30-90 days after declined work
2. **overdue_maintenance_reminder** - Maintenance overdue
3. **inactive_customer_reconnect** - 365+ days no visit
4. **post_service_checkin** - Within 7 days of visit
5. **review_request** - 8-30 days after good visit

## 📊 Understanding Output

```json
{
  "message": "The actual message text...",
  "task_type": "followup_declined_work",
  "scores": {
    "clarity": 9,           // 1-10 scale
    "trust_tone": 10,       // 1-10 scale
    "retention_impact": 9   // 1-10 scale
  }
}
```

**Good scores**: 8+ on all dimensions
**Needs work**: Any score below 8

## 🔍 Viewing Logs

```bash
# Today's logs
cat logs/ai_runs_$(date +%Y-%m-%d).jsonl | jq

# Stats
curl http://localhost:3000/api/stats | jq

# Customer history
curl http://localhost:3000/api/customer-history/cust_bruce_wood | jq
```

## ⚙️ Common Customizations

### Change Shop Info
Edit `src/services/contextGenerator.ts` line 7:
```typescript
private defaultShop: Shop = {
  name: 'Your Shop Name',
  address: 'Your Address',
  phone: 'Your Phone'
};
```

### Adjust Task Selection
Edit `src/services/taskSelector.ts` method `selectTask()`

### Customize Message Tone
Edit `prompts/system/00_system_automotive_retention_expert.md`

### Modify Task Instructions
Edit files in `prompts/task/`

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "AI service not configured" | Add ANTHROPIC_API_KEY to .env |
| Port 3000 in use | Change PORT in .env |
| PDF parsing incomplete | Customize regex in pdfParser.ts |
| Wrong task selected | Adjust rules in taskSelector.ts |
| Generic messages | Add more context, edit system prompt |

## 📖 Documentation Files

- **README.md** - Complete API documentation
- **GETTING_STARTED.md** - Step-by-step setup guide
- **PROJECT_SUMMARY.md** - What was built
- **ARCHITECTURE.md** - How it works
- **MVP_CHECKLIST.md** - Deployment checklist
- **QUICK_REFERENCE.md** - This file

## 💡 Best Practices

1. ✅ Start with sample context before using PDF
2. ✅ Review first 10-20 messages manually
3. ✅ Log all outcomes for learning
4. ✅ Iterate on prompts based on feedback
5. ✅ Keep messages personal, never templated

## 🎨 Prompt Editing Tips

**System Layer** (personality)
- Sets overall tone and values
- Changes affect ALL messages
- Edit carefully

**Task Layer** (specific instructions)
- Safe to experiment
- Only affects one task type
- Test each change

**Meta Layer** (quality control)
- Controls self-review strictness
- Higher standards = more revisions
- Balance quality vs. speed

## 📞 Quick Support

**API Issues**: Check logs/ directory
**Prompt Issues**: Review scores in output
**PDF Issues**: Check parsed_invoice in response
**Connection Issues**: Verify ANTHROPIC_API_KEY

## 🚀 Production Checklist

Before going live:
- [ ] Set ANTHROPIC_API_KEY
- [ ] Test with 10+ real invoices
- [ ] Customize all prompts
- [ ] Set up database (optional)
- [ ] Add authentication
- [ ] Configure monitoring
- [ ] Set up backups

## 🔗 Useful Links

- Anthropic API: https://docs.anthropic.com/
- Claude Models: https://docs.anthropic.com/en/docs/models-overview
- Project GitHub: (add your repo)

---

**Remember**: The goal is trust-building, not sales. Keep it personal! 🚗✨
