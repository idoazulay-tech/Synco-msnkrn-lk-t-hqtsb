import { describe, test, expect } from '@jest/globals';
import { parseIntakeDeterministic } from '../intakeDeterministicParser.js';

const CHAOS_INPUT =
  'אני מוצף מהבנק, השכירות, החובות, סינקו, לדבר עם חיים, לבדוק ICP, ואני לא יודע מה לעשות קודם';

// ── Test 1: Main chaos input returns full structure ────────────────────────────

describe('main chaos input', () => {
  const preview = parseIntakeDeterministic(CHAOS_INPUT);

  test('returns nowAction', () => {
    expect(preview.nowAction).not.toBeNull();
  });

  test('nowAction.title is not an emotional phrase', () => {
    const forbidden = [
      'אני מוצף מהבנק',
      'השכירות',
      'החובות',
      'ואני לא יודע מה לעשות קודם',
      'אני לא יודע מה לעשות קודם',
      'לא יודע מה לעשות קודם',
    ];
    const title = preview.nowAction?.title ?? '';
    for (const f of forbidden) {
      expect(title).not.toBe(f);
    }
  });

  test('nowAction.title is non-empty and actionable (has verb)', () => {
    const title = preview.nowAction?.title ?? '';
    expect(title.length).toBeGreaterThan(3);
    // Should NOT be just a noun or emotional phrase
    expect(title).not.toMatch(/^אני/);
    expect(title).not.toMatch(/^ואני/);
  });

  test('notes includes at least one emotional/overload entry', () => {
    expect(preview.notes.length).toBeGreaterThan(0);
    const categories = preview.notes.map(n => n.category);
    const hasEmotionOrOverload = categories.some(
      c => c === 'emotion' || c === 'overload',
    );
    expect(hasEmotionOrOverload).toBe(true);
  });

  test('projects includes a finance-related project', () => {
    const financeProj = preview.projects.find(
      p => p.tempId === 'proj_finance' || p.title.includes('בנק') || p.title.includes('חוב'),
    );
    expect(financeProj).toBeDefined();
  });

  test('projects includes a Synco-related project', () => {
    const syncoProj = preview.projects.find(
      p => p.tempId === 'proj_synco' || p.title.includes('סינקו') || p.title.includes('מוצר'),
    );
    expect(syncoProj).toBeDefined();
  });

  test('each project has at least 3 steps', () => {
    for (const proj of preview.projects) {
      expect(proj.steps.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('each project has firstActionTitle', () => {
    for (const proj of preview.projects) {
      expect(proj.firstActionTitle).toBeTruthy();
      expect(proj.firstActionTitle.length).toBeGreaterThan(3);
    }
  });

  test('entities.topics includes בנק, שכירות, חובות, סינקו, ICP', () => {
    const topics = preview.entities.topics.map(t => t.toLowerCase());
    // At least 3 of these must appear
    const expected = ['בנק', 'שכירות', 'חובות', 'סינקו', 'icp'];
    const found = expected.filter(e => topics.includes(e));
    expect(found.length).toBeGreaterThanOrEqual(3);
  });

  test('entities.people includes חיים', () => {
    expect(preview.entities.people).toContain('חיים');
  });

  test('todayTasks includes "לדבר עם חיים" or "לבדוק ICP"', () => {
    const titles = preview.todayTasks.map(t => t.title.toLowerCase());
    const hasChaimOrICP =
      titles.some(t => t.includes('חיים')) ||
      titles.some(t => t.includes('icp') || t.includes('ICP'));
    expect(hasChaimOrICP).toBe(true);
  });
});

// ── Test 2: Emotional phrase becomes note, not task ────────────────────────────

describe('emotional phrases → notes not tasks', () => {
  test('"אני מוצף" is not a todayTask title', () => {
    const preview = parseIntakeDeterministic('אני מוצף, לדבר עם שני');
    const taskTitles = preview.todayTasks.map(t => t.title);
    expect(taskTitles).not.toContain('אני מוצף');
    expect(taskTitles.some(t => t.includes('מוצף'))).toBe(false);
  });

  test('"אני מוצף" becomes a note', () => {
    const preview = parseIntakeDeterministic('אני מוצף, לדבר עם שני');
    const noteTexts = preview.notes.map(n => n.text.toLowerCase());
    const hasOverloadNote = noteTexts.some(t => t.includes('מוצף'));
    expect(hasOverloadNote).toBe(true);
  });
});

// ── Test 3: Bare nouns → converted to actionable / assigned to project ─────────

describe('bare nouns → actionable or project', () => {
  test('"השכירות" is NOT a standalone task title', () => {
    const preview = parseIntakeDeterministic('השכירות, החובות');
    const taskTitles = preview.todayTasks.map(t => t.title);
    expect(taskTitles).not.toContain('השכירות');
    expect(taskTitles).not.toContain('החובות');
  });

  test('"השכירות" and "החובות" result in a finance project', () => {
    const preview = parseIntakeDeterministic('השכירות, החובות');
    const hasFinance = preview.projects.some(
      p => p.tempId === 'proj_finance' || p.title.includes('בנק') || p.title.includes('חוב'),
    );
    expect(hasFinance).toBe(true);
  });
});

// ── Test 4: Synco grouping ─────────────────────────────────────────────────────

describe('Synco / ICP / product grouping', () => {
  test('"סינקו, לדבר עם חיים, לבדוק ICP" creates Synco project', () => {
    const preview = parseIntakeDeterministic('סינקו, לדבר עם חיים, לבדוק ICP');
    const syncoProj = preview.projects.find(p => p.tempId === 'proj_synco');
    expect(syncoProj).toBeDefined();
  });

  test('"לדבר עם חיים" is a todayTask', () => {
    const preview = parseIntakeDeterministic('סינקו, לדבר עם חיים, לבדוק ICP');
    const titles = preview.todayTasks.map(t => t.title);
    expect(titles.some(t => t.includes('חיים'))).toBe(true);
  });

  test('חיים appears in entities.people', () => {
    const preview = parseIntakeDeterministic('לדבר עם חיים');
    expect(preview.entities.people).toContain('חיים');
  });
});

// ── Test 5: "כביסה" → multi-step routine project ──────────────────────────────

describe('כביסה → multi-step project', () => {
  const preview = parseIntakeDeterministic('כביסה');

  test('creates a house project', () => {
    const houseProj = preview.projects.find(p => p.tempId === 'proj_house');
    expect(houseProj).toBeDefined();
  });

  test('house project has steps that cover laundry phases', () => {
    const houseProj = preview.projects.find(p => p.tempId === 'proj_house');
    const stepTitles = (houseProj?.steps ?? []).map(s => s.title.toLowerCase());
    // At least one of these laundry keywords should appear in steps
    const laundryKeywords = ['כביסה', 'מכונה', 'להפריד', 'לאסוף', 'לאחסן'];
    const found = laundryKeywords.filter(kw => stepTitles.some(t => t.includes(kw)));
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  test('has at least 3 steps', () => {
    const houseProj = preview.projects.find(p => p.tempId === 'proj_house');
    expect((houseProj?.steps ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

// ── Test 6: Every project has 3–7 steps ───────────────────────────────────────

test('all projects have 3 to 7 steps', () => {
  const preview = parseIntakeDeterministic(CHAOS_INPUT);
  for (const proj of preview.projects) {
    expect(proj.steps.length).toBeGreaterThanOrEqual(3);
    expect(proj.steps.length).toBeLessThanOrEqual(7);
  }
});

// ── Test 7: Every project has firstActionTitle ─────────────────────────────────

test('all projects have non-empty firstActionTitle', () => {
  const preview = parseIntakeDeterministic(CHAOS_INPUT);
  for (const proj of preview.projects) {
    expect(proj.firstActionTitle).toBeTruthy();
    expect(typeof proj.firstActionTitle).toBe('string');
    expect(proj.firstActionTitle.length).toBeGreaterThan(3);
  }
});

// ── Test 8: nowAction exists for non-empty input ───────────────────────────────

test('nowAction is not null for non-empty input', () => {
  const preview = parseIntakeDeterministic('לדבר עם יוסי');
  expect(preview.nowAction).not.toBeNull();
});

// ── Test 9: nowAction is a concrete actionable item ───────────────────────────

test('nowAction title is actionable (not emotional, not noun-only)', () => {
  const preview = parseIntakeDeterministic(CHAOS_INPUT);
  const title = preview.nowAction?.title ?? '';
  expect(title).not.toMatch(/^אני/);
  expect(title).not.toMatch(/^מוצף/);
  expect(title.length).toBeGreaterThan(5);
});

// ── Test 10: Empty input returns ok:false equivalent ──────────────────────────

test('empty input returns preview with warning and null nowAction', () => {
  const preview = parseIntakeDeterministic('');
  expect(preview.nowAction).toBeNull();
  expect(preview.warnings.length).toBeGreaterThan(0);
  expect(preview.warnings[0]).toContain('ריק');
});

// ── Test 11: Output has required top-level keys ────────────────────────────────

test('preview has all required top-level keys', () => {
  const preview = parseIntakeDeterministic(CHAOS_INPUT);
  const requiredKeys: (keyof typeof preview)[] = [
    'nowAction', 'todayTasks', 'laterTasks', 'projects',
    'openQuestions', 'notes', 'entities', 'warnings',
  ];
  for (const key of requiredKeys) {
    expect(key in preview).toBe(true);
  }
});

// ── Test 12: entities has all required sub-keys ────────────────────────────────

test('entities has all required sub-keys', () => {
  const preview = parseIntakeDeterministic(CHAOS_INPUT);
  const requiredKeys: (keyof typeof preview.entities)[] = [
    'people', 'places', 'times', 'dates', 'priorities', 'topics', 'emotions',
  ];
  for (const key of requiredKeys) {
    expect(Array.isArray(preview.entities[key])).toBe(true);
  }
});

// ══ 4A.2 / 4A.3 — Intake quality + entity correctness ════════════════════════

const CHAOS = 'אני מוצף מהבנק, השכירות, החובות, סינקו, לדבר עם חיים, לבדוק ICP, ואני לא יודע מה לעשות קודם';

describe('multi-project detection (4A.2)', () => {
  const preview = parseIntakeDeterministic(CHAOS);

  test('creates a finance project', () => {
    const fp = preview.projects.find(p => p.tempId === 'proj_finance');
    expect(fp).toBeDefined();
    expect(fp!.steps.length).toBeGreaterThanOrEqual(3);
  });

  test('creates a Synco project', () => {
    const sp = preview.projects.find(p => p.tempId === 'proj_synco');
    expect(sp).toBeDefined();
    expect(sp!.steps.length).toBeGreaterThanOrEqual(3);
  });

  test('synco project steps cover ICP/ולידציה/לקוח or todayTasks cover חיים/ICP', () => {
    const sp = preview.projects.find(p => p.tempId === 'proj_synco');
    const syncoStepTitles = (sp?.steps ?? []).map(s => s.title.toLowerCase());
    const todayTaskTitles  = preview.todayTasks.map(t => t.title.toLowerCase());
    const hasSyncoContent  = [...syncoStepTitles, ...todayTaskTitles].some(
      t => t.includes('icp') || t.includes('חיים') || t.includes('ולידציה') || t.includes('לקוח'),
    );
    expect(hasSyncoContent).toBe(true);
  });
});

describe('entity classification — Synco is NOT a place (4A.2)', () => {
  const preview = parseIntakeDeterministic(CHAOS);

  test('entities.places does not contain "סינקו"', () => {
    const places = preview.entities.places.map(p => p.toLowerCase());
    expect(places).not.toContain('סינקו');
  });

  test('entities.places is empty for deterministic path', () => {
    expect(preview.entities.places).toHaveLength(0);
  });

  test('סינקו appears in entities.topics', () => {
    const topics = preview.entities.topics.map(t => t.toLowerCase());
    expect(topics).toContain('סינקו');
  });

  test('חיים appears in entities.people', () => {
    expect(preview.entities.people).toContain('חיים');
  });

  test('ICP appears in entities.topics', () => {
    const topics = preview.entities.topics.map(t => t.toLowerCase());
    expect(topics.some(t => t === 'icp')).toBe(true);
  });
});

describe('no noun-only tasks (4A.2)', () => {
  const preview = parseIntakeDeterministic(CHAOS);

  test('"השכירות" is not a standalone todayTask', () => {
    const titles = preview.todayTasks.map(t => t.title);
    expect(titles).not.toContain('השכירות');
    expect(titles).not.toContain('שכירות');
  });

  test('"החובות" is not a standalone todayTask', () => {
    const titles = preview.todayTasks.map(t => t.title);
    expect(titles).not.toContain('החובות');
    expect(titles).not.toContain('חובות');
  });

  test('notes include overload or emotion entry', () => {
    const categories = preview.notes.map(n => n.category);
    const hasOverload = categories.some(c => c === 'overload' || c === 'emotion');
    expect(hasOverload).toBe(true);
  });
});

// ══ Person-task → Synco project linking (4A.3 quality fix) ═══════════════════

describe('person-contact task linking to Synco project (4A.3)', () => {
  const SYNCO_CONTEXT =
    'אני מוצף מהבנק, השכירות, החובות, סינקו, לדבר עם חיים, לבדוק ICP, ואני לא יודע מה לעשות קודם';
  const preview = parseIntakeDeterministic(SYNCO_CONTEXT);

  test('creates a Synco project when Synco and ICP are mentioned', () => {
    const sp = preview.projects.find(p => p.tempId === 'proj_synco');
    expect(sp).toBeDefined();
    expect(sp!.steps.length).toBeGreaterThanOrEqual(3);
  });

  test('"לדבר עם חיים" is linked to the Synco project', () => {
    const chaimTask = preview.todayTasks.find(t => t.title.includes('חיים'));
    expect(chaimTask).toBeDefined();
    expect(chaimTask!.linkedProjectTempId).toBe('proj_synco');
  });

  test('"לבדוק ICP" is linked to the Synco project', () => {
    const icpTask = preview.todayTasks.find(t => t.title.toLowerCase().includes('icp'));
    expect(icpTask).toBeDefined();
    expect(icpTask!.linkedProjectTempId).toBe('proj_synco');
  });

  test('finance tasks remain linked to the finance project', () => {
    // The finance project should exist; nowAction links to it
    const financeProj = preview.projects.find(p => p.tempId === 'proj_finance');
    expect(financeProj).toBeDefined();
    // nowAction should be linked to finance (finance has higher priority)
    expect(preview.nowAction?.linkedProjectTempId).toBe('proj_finance');
  });

  test('"לדבר עם" without Synco context is NOT linked to Synco', () => {
    const noSynco = parseIntakeDeterministic('לדבר עם דני, לשלם שכירות');
    const daniTask = noSynco.todayTasks.find(t => t.title.includes('דני'));
    expect(daniTask).toBeDefined();
    expect(daniTask!.linkedProjectTempId).not.toBe('proj_synco');
  });
});
