/**
 * Synco Life Rule Loader
 *
 * Loads active LifeRule rows from PostgreSQL and maps them into the
 * LifeRule format expected by the brain pipeline.
 *
 * Design principles:
 * - mapDbLifeRuleToEngineRule() is a pure function — testable without DB.
 * - loadLifeRulesForUser() always returns [] on any DB error (fail-open).
 * - Priority is validated against known values; unknown → "medium".
 * - If the LifeRule table does not yet exist (pre-migration), returns unavailable.
 */

import { prisma } from '../../lib/prisma.js';
import type { LifeRule } from './syncoThinkingLayer.js';

// ─── Priority validation ──────────────────────────────────────────────────────

const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'non_negotiable']);

function safePriority(raw: string): LifeRule['priority'] {
  return VALID_PRIORITIES.has(raw)
    ? (raw as LifeRule['priority'])
    : 'medium';
}

// ─── Pure mapping function ────────────────────────────────────────────────────

export interface RawLifeRule {
  id: string;
  userId: string;
  ruleType: string;
  title: string;
  priority: string;
  active: boolean;
}

/**
 * Pure function — maps one DB LifeRule row to the engine LifeRule type.
 * No DB call. Fully testable in isolation.
 */
export function mapDbLifeRuleToEngineRule(row: RawLifeRule): LifeRule {
  return {
    ruleId:   row.id,
    userId:   row.userId,
    ruleType: row.ruleType,
    title:    row.title,
    priority: safePriority(row.priority),
    active:   row.active,
  };
}

// ─── DB loader ────────────────────────────────────────────────────────────────

export interface LifeRuleLoadResult {
  rules: LifeRule[];
  count: number;
  source: 'real_db' | 'unavailable';
  error?: string;
}

/**
 * Loads all active LifeRule rows for a user from PostgreSQL.
 * Returns { rules: [], source: 'unavailable' } on any DB error — never throws.
 * Also returns unavailable if the LifeRule table has not yet been migrated.
 */
export async function loadLifeRulesForUser(userId: string): Promise<LifeRuleLoadResult> {
  try {
    // prisma.lifeRule is typed after prisma generate runs post-migration.
    // The cast is safe because we catch any runtime error (table not found).
    const rows = await (prisma as unknown as {
      lifeRule: {
        findMany(args: {
          where: { userId: string; active: boolean };
          orderBy: { priority: 'asc' };
          select: { id: boolean; userId: boolean; ruleType: boolean; title: boolean; priority: boolean; active: boolean };
        }): Promise<RawLifeRule[]>;
      };
    }).lifeRule.findMany({
      where:   { userId, active: true },
      orderBy: { priority: 'asc' },
      select:  { id: true, userId: true, ruleType: true, title: true, priority: true, active: true },
    });

    const rules = rows.map(mapDbLifeRuleToEngineRule);

    console.log(`[LifeRuleLoader] loaded ${rules.length} life rules for user ${userId}`);
    return { rules, count: rules.length, source: 'real_db' };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    // Table may not exist yet (pre-migration) — treat as unavailable, not fatal
    console.warn('[LifeRuleLoader] DB load failed (table may not exist yet):', error);
    return { rules: [], count: 0, source: 'unavailable', error };
  }
}
