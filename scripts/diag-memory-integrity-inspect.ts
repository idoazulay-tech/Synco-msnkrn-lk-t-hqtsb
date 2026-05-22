// Inspect Qdrant for contaminated pre-fix task_execution_completed memories
import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({
  url:    process.env.QDRANT_URL    ?? '',
  apiKey: process.env.QDRANT_API_KEY ?? '',
  checkCompatibility: false,
});

const COLLECTION = 'user_events';
const PAGE_SIZE  = 100;

let offset: string | number | null | undefined = undefined;
let totalScanned = 0;
let contaminated = 0;
const contaminatedIds: string[] = [];

do {
  const resp = await client.scroll(COLLECTION, {
    limit:        PAGE_SIZE,
    offset:       offset ?? undefined,
    with_payload: true,
    with_vector:  false,
    filter: {
      must: [{ key: 'type', match: { value: 'task_execution_completed' } }],
    },
  });

  for (const point of resp.points) {
    totalScanned++;
    const p             = (point.payload ?? {}) as Record<string, unknown>;
    const content       = typeof p.content === 'string' ? p.content : '';
    const evidenceType  = p.evidenceType;

    const hasDurationClaim = /\d+\s*דקות/.test(content);
    const isTimerConfirmed = evidenceType === 'timer_confirmed';

    if (hasDurationClaim && !isTimerConfirmed) {
      contaminated++;
      contaminatedIds.push(String(point.id));
      console.log(`  CONTAMINATED id=${point.id}`);
      console.log(`    content: "${content.slice(0, 100)}"`);
      console.log(`    evidenceType: ${evidenceType ?? 'none'}`);
    }
  }

  offset = resp.next_page_offset;
} while (offset !== null && offset !== undefined);

console.log(`\nScanned task_execution_completed records: ${totalScanned}`);
console.log(`Contaminated (duration claim without timer_confirmed): ${contaminated}`);

if (contaminated === 0) {
  console.log('✓ No contaminated memories found.');
} else {
  console.log('Contaminated IDs:', contaminatedIds);
  console.log([
    '',
    'Safe cleanup recommendation:',
    `  client.delete("${COLLECTION}", { points: [${contaminatedIds.map(id => `"${id}"`).join(', ')}] })`,
    '  These Qdrant points can be deleted safely:',
    '  • The Postgres LearningEvent records are intact.',
    '  • Completion facts are preserved by separate task_completed memories.',
    '  • No user-facing data is affected.',
    '  Suggested: implement a one-off cleanup route POST /api/admin/memory-cleanup',
    '  that runs this delete and returns the count removed.',
  ].join('\n'));
}
