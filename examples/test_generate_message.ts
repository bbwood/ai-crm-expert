/**
 * Example script to test message generation
 * Run with: npx tsx examples/test_generate_message.ts
 */
import dotenv from 'dotenv';
import { PromptComposerService } from '../src/services/promptComposer';
import { AIService } from '../src/services/aiService';
import { TaskSelectorService } from '../src/services/taskSelector';
import { Context, TaskType } from '../src/models/types';

// Load environment variables
dotenv.config();

// Sample context
const sampleContext: Context = {
  customer: {
    id: "cust_bruce_wood",
    name: "Bruce Wood",
    phone: "+17079627159",
    email: "bruce@example.com",
    visit_count: 3,
    last_visit_date: "2024-08-20"
  },
  vehicle: {
    id: "veh_1C6RR7TT8LS106319",
    year: 2020,
    make: "Ram",
    model: "1500 Classic",
    vin: "1C6RR7TT8LS106319",
    plate: "48846V3",
    current_est_mileage: 90500
  },
  shop: {
    name: "Sport Auto Center",
    address: "200 E Chestnut St, Fort Bragg, CA 95437",
    phone: "707-964-5915"
  },
  service_history: {
    recent_visit: {
      visit_id: "inv_2761",
      date: "2024-08-20",
      mileage: 87500,
      advisor: "Andrea Schnetgoecke",
      technician: "Danny Freitas",
      work_done: [
        "Check tire tread and set pressure",
        "Replace 12V battery"
      ],
      amount: 181.07,
      status: "paid"
    },
    past_recommendations: [
      {
        description: "Tire replacement - 4",
        estimated_cost: 1063.96,
        category: "tires",
        urgency: "soon",
        status: "recommended",
        date_recommended: "2024-08-20"
      }
    ]
  },
  current_findings: [
    {
      system: "battery",
      description: "12V battery replaced; terminals cleaned",
      status: "completed"
    },
    {
      system: "tires",
      description: "Recommended 4-tire replacement",
      status: "recommended",
      urgency: "soon"
    }
  ]
};

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set in .env file');
    process.exit(1);
  }

  console.log('🚗 AI CRM Expert - Message Generation Test\n');

  // Initialize services
  const promptComposer = new PromptComposerService();
  const taskSelector = new TaskSelectorService();
  const aiService = new AIService(process.env.ANTHROPIC_API_KEY, promptComposer);

  // Select task
  const taskType = taskSelector.selectTask(sampleContext);
  const reason = taskSelector.getTaskSelectionReason(sampleContext, taskType);

  console.log(`📋 Selected Task: ${taskType}`);
  console.log(`🎯 Reason: ${reason}\n`);

  // Generate message
  console.log('🤖 Generating message...\n');
  const result = await aiService.generateMessage(sampleContext, taskType);

  console.log('✅ Generated Message:');
  console.log('─'.repeat(60));
  console.log(result.message);
  console.log('─'.repeat(60));
  console.log('\n📊 Self-Review Scores:');
  console.log(`  Clarity: ${result.scores.clarity}/10`);
  console.log(`  Trust & Tone: ${result.scores.trust_tone}/10`);
  console.log(`  Retention Impact: ${result.scores.retention_impact}/10`);

  console.log('\n✨ Test complete!');
}

main().catch(console.error);
