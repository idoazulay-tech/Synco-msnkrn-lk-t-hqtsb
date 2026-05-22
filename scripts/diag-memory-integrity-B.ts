// Diagnostic B: unconfirmed planned_fallback — must NOT write to Qdrant
import { prisma }       from '../server/lib/prisma.js';
import { searchMemory } from '../server/brain/services/memory.js';

const USER_ID = 'default-user';
const TITLE   = 'בדיקת זמן לא מאושר סינקו';

const event = await prisma.learningEvent.create({
  data: {
    userId:            USER_ID,
    eventType:         'task_execution_completed',
    source:            'diagnostic_B',
    taskTitleSnapshot: TITLE,
    dateIso:           new Date().toISOString().slice(0, 10),
    metadata: {
      plannedDurationMinutes: 30,
      actualDurationMinutes:  120,
      durationDeltaMinutes:   90,
      actualStartSource:      'planned_fallback',
    },
  },
});
console.log('DiagB — Postgres saved:', event.id, '| eventType:', event.eventType);

// Simulate buildMemoryTextFromLearningEvent (fallback path)
const meta        = event.metadata as Record<string, unknown>;
const startSource = meta.actualStartSource;
const actualMins  = meta.actualDurationMinutes as number;
const isConfirmed =
  startSource === 'execution_start' &&
  typeof actualMins === 'number' &&
  isFinite(actualMins) &&
  actualMins > 0;

const memoryText = isConfirmed ? 'confirmed-text' : '';

console.log('DiagB — memoryText empty (expected true):', memoryText === '');
console.log('DiagB — Qdrant write skipped:', !memoryText);

// Search Qdrant for any record mentioning this title or "120"
const results = await searchMemory('זמן לא מאושר סינקו', USER_ID, 'events', 5, 0.30);
console.log('DiagB — Qdrant search results near title:', results.length);
let found120 = false;
for (const r of results) {
  const content = ((r.payload as Record<string, unknown>).content as string) ?? '';
  if (content.includes('120') || content.includes('לא מאושר')) {
    found120 = true;
    console.error('DiagB FAIL — contaminating memory found:', content.slice(0, 100));
  }
}
if (!found120) console.log('DiagB — No 120-minute / unconfirmed duration memory in Qdrant ✓');

await prisma.$disconnect();
