import { describe, test, expect } from '@jest/globals';
import { detectProjectDomain, buildProjectTempIdRemap } from '../intakeUnderstandingService.js';

// Minimal project shape for testing (steps are required by SyncoProject but not
// used by the normalizer helpers, so we keep them minimal here)
function proj(tempId: string, title: string, goal = '', firstActionTitle = '') {
  return { tempId, title, goal, firstActionTitle };
}

// ── detectProjectDomain ──────────────────────────────────────────────────────

describe('detectProjectDomain', () => {
  test('detects finance from title containing חובות', () => {
    expect(detectProjectDomain(proj('p1', 'ניהול כספים וחובות'))).toBe('finance');
  });

  test('detects finance from title containing בנק', () => {
    expect(detectProjectDomain(proj('p2', 'סידור חשבון הבנק'))).toBe('finance');
  });

  test('detects finance from title containing שכירות', () => {
    expect(detectProjectDomain(proj('p3', 'תשלום שכירות ומינוס'))).toBe('finance');
  });

  test('detects finance from goal field', () => {
    expect(detectProjectDomain(proj('p4', 'נושא כספי', 'לטפל בחובות ובבנק'))).toBe('finance');
  });

  test('detects synco from title containing ICP', () => {
    expect(detectProjectDomain(proj('p5', 'הבנת ה-ICP'))).toBe('synco');
  });

  test('detects synco from title containing סינקו', () => {
    expect(detectProjectDomain(proj('p6', 'קידום סינקו'))).toBe('synco');
  });

  test('detects synco from title containing MVP', () => {
    expect(detectProjectDomain(proj('p7', 'בניית MVP ראשוני'))).toBe('synco');
  });

  test('detects synco from firstActionTitle containing ולידציה', () => {
    expect(detectProjectDomain(proj('p8', 'פרויקט מוצר', '', 'לקיים שיחות ולידציה'))).toBe('synco');
  });

  test('returns undefined for unrelated project', () => {
    expect(detectProjectDomain(proj('pX', 'תחביבים ובילוי', 'לבלות עם המשפחה'))).toBeUndefined();
  });
});

// ── buildProjectTempIdRemap ──────────────────────────────────────────────────

describe('buildProjectTempIdRemap — AI duplicate project normalization (4A.3)', () => {
  test('maps AI finance-like project to proj_finance', () => {
    const remap = buildProjectTempIdRemap([proj('proj1', 'ניהול כספים וחובות')]);
    expect(remap['proj1']).toBe('proj_finance');
  });

  test('maps AI synco-like project to proj_synco', () => {
    const remap = buildProjectTempIdRemap([proj('proj2', 'הבנת ה-ICP')]);
    expect(remap['proj2']).toBe('proj_synco');
  });

  test('maps both AI duplicate projects simultaneously', () => {
    const remap = buildProjectTempIdRemap([
      proj('proj1', 'ניהול כספים וחובות'),
      proj('proj2', 'הבנת ה-ICP'),
    ]);
    expect(remap['proj1']).toBe('proj_finance');
    expect(remap['proj2']).toBe('proj_synco');
  });

  test('no duplicate finance project after normalization (both map to same canonical)', () => {
    const remap = buildProjectTempIdRemap([
      proj('proj1', 'ניהול כספים וחובות'),
      proj('proj_finance', 'סידור בנק וחובות'),
    ]);
    // Both are finance → both remap to proj_finance, deduplicated downstream
    expect(remap['proj1']).toBe('proj_finance');
    expect(remap['proj_finance']).toBe('proj_finance');
  });

  test('unrecognized projects are not included in remap', () => {
    const remap = buildProjectTempIdRemap([proj('projX', 'תחביבים ובילוי')]);
    expect('projX' in remap).toBe(false);
  });

  test('already-canonical proj_synco still maps to proj_synco (identity)', () => {
    const remap = buildProjectTempIdRemap([proj('proj_synco', 'קידום סינקו')]);
    expect(remap['proj_synco']).toBe('proj_synco');
  });
});

// ── Deterministic output: no duplicates for standard chaos input ─────────────

import { parseIntakeDeterministic } from '../intakeDeterministicParser.js';

const CHAOS =
  'אני מוצף מהבנק, השכירות, החובות, סינקו, לדבר עם חיים, לבדוק ICP, ואני לא יודע מה לעשות קודם';

describe('deterministic output — canonical projects only (4A.3)', () => {
  const preview = parseIntakeDeterministic(CHAOS);

  test('produces exactly 2 projects for the standard chaos input', () => {
    expect(preview.projects.length).toBe(2);
  });

  test('the 2 projects are proj_finance and proj_synco', () => {
    const ids = preview.projects.map(p => p.tempId).sort();
    expect(ids).toEqual(['proj_finance', 'proj_synco']);
  });

  test('no duplicate finance project (only proj_finance, no aliases)', () => {
    const financeProjects = preview.projects.filter(
      p => p.tempId === 'proj_finance' || detectProjectDomain(p) === 'finance',
    );
    expect(financeProjects.length).toBe(1);
  });

  test('no duplicate synco/ICP project (only proj_synco, no aliases)', () => {
    const syncoProjects = preview.projects.filter(
      p => p.tempId === 'proj_synco' || detectProjectDomain(p) === 'synco',
    );
    expect(syncoProjects.length).toBe(1);
  });

  test('"לבדוק ICP" task is linked to proj_synco', () => {
    const icpTask = preview.todayTasks.find(t => t.title.toLowerCase().includes('icp'));
    expect(icpTask).toBeDefined();
    expect(icpTask!.linkedProjectTempId).toBe('proj_synco');
  });

  test('"לדבר עם חיים" task is linked to proj_synco', () => {
    const chaimTask = preview.todayTasks.find(t => t.title.includes('חיים'));
    expect(chaimTask).toBeDefined();
    expect(chaimTask!.linkedProjectTempId).toBe('proj_synco');
  });
});
