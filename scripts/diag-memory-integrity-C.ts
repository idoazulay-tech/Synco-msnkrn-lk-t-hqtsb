// Diagnostic C: task_completed stores completion fact only — no duration claim
import { prisma }           from '../server/lib/prisma.js';
import { storeUserMessage } from '../server/brain/services/memory.js';
import { searchMemory }     from '../server/brain/services/memory.js';

const USER_ID = 'default-user';
const TITLE   = 'בדיקת השלמה ללא זמן סינקו';

const event = await prisma.learningEvent.create({
  data: {
    userId:            USER_ID,
    eventType:         'task_completed',
    source:            'diagnostic_C',
    taskTitleSnapshot: TITLE,
    dateIso:           new Date().toISOString().slice(0, 10),
    metadata:          { duration: 45, priority: 'high' },
  },
});
console.log('DiagC — Postgres saved:', event.id, '| eventType:', event.eventType);

const memoryText = `המשתמש השלים משימה: ${TITLE}. זהו סימן ביצוע בפועל.`;
const pointId = await storeUserMessage(USER_ID, memoryText, {
  type:            'task_completed',
  source:          'learning_event',
  learningEventId: event.id,
  importance:      'high',
});
console.log('DiagC — Qdrant write OK — pointId:', pointId);

const results = await searchMemory('השלמה ללא זמן סינקו', USER_ID, 'events', 5, 0.35);
console.log('DiagC — search results:', results.length);
if (results.length > 0) {
  const content = ((results[0].payload as Record<string, unknown>).content as string) ?? '';
  const hasDuration = /\d+\s*דקות|duration|actualDuration/.test(content);
  console.log('DiagC — memory contains duration claim (expected false):', hasDuration);
  console.log('DiagC — content preview:', content.slice(0, 100));
}

await prisma.$disconnect();
