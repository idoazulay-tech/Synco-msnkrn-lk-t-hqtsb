// Diagnostic A2: write confirmed timer duration and verify by direct point fetch
import { prisma }           from '../server/lib/prisma.js';
import { storeUserMessage } from '../server/brain/services/memory.js';
import { QdrantClient }     from '@qdrant/js-client-rest';

const USER_ID = 'default-user';
const TITLE   = 'בדיקת זמן מאושר סינקו V2';

const client = new QdrantClient({
  url:    process.env.QDRANT_URL    ?? '',
  apiKey: process.env.QDRANT_API_KEY ?? '',
  checkCompatibility: false,
});

// 1. Save to Postgres
const event = await prisma.learningEvent.create({
  data: {
    userId:            USER_ID,
    eventType:         'task_execution_completed',
    source:            'diagnostic_A2',
    taskTitleSnapshot: TITLE,
    dateIso:           new Date().toISOString().slice(0, 10),
    metadata: {
      plannedDurationMinutes: 30,
      actualDurationMinutes:  42,
      durationDeltaMinutes:   12,
      actualStartSource:      'execution_start',
    },
  },
});
console.log('DiagA2 — Postgres saved:', event.id);

// 2. Build memory text (confirmed path)
const meta        = event.metadata as Record<string, unknown>;
const actualMins  = meta.actualDurationMinutes as number;
const memoryText  = `המשתמש סיים ביצוע של המשימה: ${TITLE}. משך הביצוע בפועל שאושר באמצעות טיימר: ${actualMins} דקות.`;
console.log('DiagA2 — memoryText contains "טיימר":', memoryText.includes('טיימר'));

// 3. Write to Qdrant with evidence fields
const pointId = await storeUserMessage(USER_ID, memoryText, {
  type:               'task_execution_completed',
  source:             'learning_event',
  learningEventId:    event.id,
  evidenceType:       'timer_confirmed',
  durationConfidence: 'confirmed',
  integrityStatus:    'accepted_fact',
});
console.log('DiagA2 — Qdrant write OK — pointId:', pointId);

// 4. Fetch the specific point by ID to verify payload
const retrieved = await client.retrieve('user_events', {
  ids:          [pointId],
  with_payload: true,
  with_vector:  false,
});

if (retrieved.length === 0) {
  console.error('DiagA2 FAIL — point not found by ID');
  process.exit(1);
}

const p = (retrieved[0].payload ?? {}) as Record<string, unknown>;
console.log('DiagA2 — point retrieved by ID: ✓');
console.log('DiagA2 — type:',               p.type);
console.log('DiagA2 — source:',             p.source);
console.log('DiagA2 — evidenceType:',       p.evidenceType       ?? 'MISSING');
console.log('DiagA2 — durationConfidence:', p.durationConfidence ?? 'MISSING');
console.log('DiagA2 — integrityStatus:',    p.integrityStatus    ?? 'MISSING');
console.log('DiagA2 — learningEventId:',    p.learningEventId    ?? 'MISSING');
console.log('DiagA2 — isFallback:',         p.isFallbackEmbedding);

// 5. Verify text field contains correct content
const storedText = typeof p.text === 'string' ? p.text : '';
console.log('DiagA2 — stored text contains "טיימר":', storedText.includes('טיימר'));
console.log('DiagA2 — stored text contains "42 דקות":', storedText.includes('42'));

// Final pass/fail
const passed =
  p.evidenceType       === 'timer_confirmed' &&
  p.durationConfidence === 'confirmed'        &&
  p.integrityStatus    === 'accepted_fact'    &&
  storedText.includes('טיימר');

console.log('\nDiagA2 — RESULT:', passed ? '✓ PASS' : '✗ FAIL');

await prisma.$disconnect();
