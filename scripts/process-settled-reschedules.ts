/**
 * Synco — Process Settled Reschedules (Phase 4a)
 *
 * Finds all task_rescheduled events that have settled (burst window closed,
 * no later movement) and writes exactly one factual Qdrant memory per event.
 *
 * Usage:
 *   npx tsx scripts/process-settled-reschedules.ts
 *   SYNCO_USER_ID=my-user npx tsx scripts/process-settled-reschedules.ts
 *
 * Output: safe summary only — no task content, no secrets.
 */

import { prisma } from '../server/lib/prisma.js';
import { processSettledReschedules } from '../server/brain/services/settledRescheduleDeriver.js';

async function main() {
  const userId = process.env.SYNCO_USER_ID ?? 'default-user';

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(' Synco — Process Settled Reschedules (Phase 4a)');
  console.log(`  userId: ${userId}`);
  console.log('══════════════════════════════════════════════════════════════════\n');

  if (process.env.SYNCO_SETTLED_DERIVATION_ENABLED === 'false') {
    console.log('  ⚠️  SYNCO_SETTLED_DERIVATION_ENABLED=false — skipping entirely.');
    return;
  }

  const result = await processSettledReschedules(userId);

  console.log(`  Status:     ${result.status}`);
  console.log(`  Candidates: ${result.candidates}`);
  console.log(`  Processed:  ${result.processed}`);
  console.log(`  Skipped:    ${result.skipped}`);
  console.log(`  Errors:     ${result.errors}`);
  console.log();

  if (result.errors > 0) {
    console.warn(`  ⚠️  ${result.errors} Qdrant write(s) failed — run again to retry.`);
  }
  if (result.processed === 0 && result.candidates === 0) {
    console.log('  ✅ No settled reschedule events pending — nothing to process.');
  } else if (result.processed > 0) {
    console.log(`  ✅ ${result.processed} settled reschedule memory(ies) written to Qdrant.`);
  }

  console.log('══════════════════════════════════════════════════════════════════\n');
}

main()
  .catch(e => { console.error('Script error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
