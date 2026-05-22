// Diagnostic A: confirmed timer duration
import { prisma }           from '../server/lib/prisma.js';
import { storeUserMessage } from '../server/brain/services/memory.js';
import { searchMemory }     from '../server/brain/services/memory.js';

const USER_ID = 'default-user';
const TITLE   = 'בדיקת זמן מאושר סינקו';

const event = await prisma.learningEvent.create({
  data: {
    userId:            USER_ID,
    eventType:         'task_execution_completed',
    source:            'diagnostic_A',
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
console.log('DiagA — Postgres saved:', event.id, '| eventType:', event.eventType);

const meta        = event.metadata as Record<string, unknown>;
const startSource = meta.actualStartSource;
const actualMins  = meta.actualDurationMinutes as number;
const isConfirmed =
  startSource === 'execution_start' &&
  typeof actualMins === 'number' &&
  isFinite(actualMins) &&
  actualMins > 0;

const memoryText = isConfirmed
  ? `המשתמש סיים ביצוע של המשימה: ${TITLE}. משך הביצוע בפועל שאושר באמצעות טיימר: ${actualMins} דקות.`
  : '';

console.log('DiagA — memoryText non-empty:', memoryText.length > 0);
console.log('DiagA — contains "טיימר":', memoryText.includes('טיימר'));
if (!memoryText) { console.error('DiagA FAIL — empty text'); process.exit(1); }

const pointId = await storeUserMessage(USER_ID, memoryText, {
  type:               'task_execution_completed',
  source:             'learning_event',
  learningEventId:    event.id,
  evidenceType:       'timer_confirmed',
  durationConfidence: 'confirmed',
  integrityStatus:    'accepted_fact',
});
console.log('DiagA — Qdrant write OK — pointId:', pointId);

const results = await searchMemory('זמן מאושר סינקו', USER_ID, 'events', 5, 0.35);
console.log('DiagA — search results:', results.length);
if (results.length > 0) {
  const p = results[0].payload as Record<string, unknown>;
  console.log('DiagA — score:',            results[0].score);
  console.log('DiagA — evidenceType:',     p.evidenceType     ?? 'MISSING');
  console.log('DiagA — durationConf:',     p.durationConfidence ?? 'MISSING');
  console.log('DiagA — integrityStatus:',  p.integrityStatus  ?? 'MISSING');
  console.log('DiagA — isFallback:',       p.isFallbackEmbedding);
}

await prisma.$disconnect();
