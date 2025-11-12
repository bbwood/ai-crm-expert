# Installation Guide

## Quick Install

```bash
# 1. Install dependencies
npm install

# 2. Add your Anthropic API key to .env
# Edit the .env file and add your key:
# ANTHROPIC_API_KEY=sk-ant-your-key-here

# 3. Start the development server
npm run dev
```

## Detailed Installation Steps

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher
- **Anthropic API Key**: Get one from [console.anthropic.com](https://console.anthropic.com/)

Check your versions:

```bash
node --version  # Should be v18.x or higher
npm --version   # Should be 8.x or higher
```

### Step 1: Install Dependencies

```bash
npm install
```

This installs:
- `express` - Web server framework
- `@anthropic-ai/sdk` - Claude AI SDK
- `pdf-parse` - PDF parsing library
- `multer` - File upload handling
- `dotenv` - Environment variable management
- `date-fns` - Date utilities
- `typescript` - TypeScript compiler
- `tsx` - TypeScript execution engine

### Step 2: Configure Environment

The `.env` file has been created for you. Open it and add your Anthropic API key:

```bash
# Edit .env
nano .env

# Or with your preferred editor
code .env
```

Add your API key:

```
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

To get an API key:
1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new key
5. Copy and paste it into your `.env` file

### Step 3: Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Step 4: Start the Server

For development (with auto-reload):

```bash
npm run dev
```

For production:

```bash
npm start
```

You should see:

```
🚗 AI CRM Expert server running on port 3000
📝 API documentation: http://localhost:3000
🏥 Health check: http://localhost:3000/api/health
```

If you see:

```
⚠️  ANTHROPIC_API_KEY not set - AI generation will not work
```

Go back to Step 2 and add your API key.

## Verify Installation

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

If `ai_configured` is `false`, check your `.env` file.

### Test 2: Generate a Message

```bash
curl -X POST http://localhost:3000/api/generate-message \
  -H "Content-Type: application/json" \
  -d @examples/sample_context.json
```

This should return a generated message with scores.

### Test 3: Run TypeScript Test

```bash
npx tsx examples/test_generate_message.ts
```

This will generate a message and display it with scores.

## Troubleshooting

### Error: "Cannot find module '@anthropic-ai/sdk'"

**Solution**: Run `npm install` again.

### Error: "AI service not configured"

**Solution**: Add `ANTHROPIC_API_KEY` to your `.env` file.

### Error: "Port 3000 already in use"

**Solution**: Change the port in `.env`:

```
PORT=3001
```

### Error: TypeScript compilation errors

**Solution**: Make sure you have TypeScript 5.x installed:

```bash
npm install -D typescript@^5.3.3
```

### Error: Permission denied on uploads/ or logs/

**Solution**: Create the directories if they don't exist:

```bash
mkdir -p uploads logs
chmod 755 uploads logs
```

## Development Workflow

```bash
# Start development server (auto-reloads on file changes)
npm run dev

# In another terminal, test your changes
curl http://localhost:3000/api/health

# Build for production
npm run build

# Run production build
npm start
```

## Production Deployment

### 1. Build the project

```bash
npm run build
```

### 2. Set environment variables

On your production server, set:

```bash
export NODE_ENV=production
export ANTHROPIC_API_KEY=your-key
export PORT=3000
```

### 3. Start the server

```bash
npm start
```

Or use a process manager like PM2:

```bash
npm install -g pm2
pm2 start dist/index.js --name ai-crm-expert
```

## Database Setup (Optional)

If you want to use PostgreSQL instead of file-based logging:

### 1. Install PostgreSQL

```bash
# macOS
brew install postgresql@16

# Ubuntu
sudo apt install postgresql-16
```

### 2. Create Database

```bash
createdb ai_crm_expert
```

### 3. Run Schema

```bash
psql ai_crm_expert < src/services/database.sql
```

### 4. Update .env

```
DATABASE_URL=postgresql://username:password@localhost:5432/ai_crm_expert
```

### 5. Update Code

You'll need to implement database integration in the logger and other services. The schema is ready in `src/services/database.sql`.

## Next Steps

- Read [GETTING_STARTED.md](GETTING_STARTED.md) for usage guide
- See [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for common commands
- Check [README.md](README.md) for full API documentation

## Support

If you run into issues:

1. Check the logs in `logs/` directory
2. Verify all environment variables are set
3. Ensure ports are not blocked by firewall
4. Check Node.js and npm versions

Happy building! 🚗✨
