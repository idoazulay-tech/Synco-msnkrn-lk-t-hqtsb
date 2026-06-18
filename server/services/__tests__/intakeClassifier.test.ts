import { describe, test, expect } from '@jest/globals';
import {
  classifyIntentText,
  extractTasksFromText,
  decomposeProjectText,
  buildIntakePreview,
} from '../intakeClassifier.js';

// ── classifyIntentText ─────────────────────────────────────────────────────────

describe('classifyIntentText', () => {
  test('single short line → single_task', () => {
    expect(classifyIntentText('לקנות חלב')).toBe('single_task');
  });

  test('multiple lines → multi_task', () => {
    const input = 'לקנות חלב\nלשלוח מייל\nלהתקשר לרופא';
    expect(classifyIntentText(input)).toBe('multi_task');
  });

  test('comma-separated items → multi_task', () => {
    expect(classifyIntentText('לקנות חלב, לקנות לחם, לקנות גבינה')).toBe('multi_task');
  });

  test('text with "פרויקט" keyword → project', () => {
    expect(classifyIntentText('פרויקט בניית אתר')).toBe('project');
  });

  test('text with "לבנות" keyword → project', () => {
    expect(classifyIntentText('לבנות מערכת ניהול')).toBe('project');
  });

  test('text with "מיזם" keyword → project', () => {
    expect(classifyIntentText('מיזם שיווקי חדש')).toBe('project');
  });

  test('empty string → single_task (graceful)', () => {
    expect(classifyIntentText('')).toBe('single_task');
  });
});

// ── extractTasksFromText ────────────────────────────────────────────────────────

describe('extractTasksFromText', () => {
  test('single line → one task with correct title', () => {
    const tasks = extractTasksFromText('לשלוח מייל ללקוח');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('לשלוח מייל ללקוח');
  });

  test('multi-line → multiple tasks', () => {
    const tasks = extractTasksFromText('לקנות חלב\nלשלוח מייל\nלהתקשר');
    expect(tasks.length).toBeGreaterThanOrEqual(2);
  });

  test('task with "דחוף" → priority high', () => {
    const tasks = extractTasksFromText('לשלוח חוזה דחוף');
    expect(tasks[0].priority).toBe('high');
  });

  test('regular task → no explicit priority (defaults omitted)', () => {
    const tasks = extractTasksFromText('לקנות חלב');
    expect(tasks[0].priority).toBeUndefined();
  });
});

// ── decomposeProjectText ────────────────────────────────────────────────────────

describe('decomposeProjectText', () => {
  test('returns a project title', () => {
    const result = decomposeProjectText('פרויקט בניית אתר\nעיצוב\nפיתוח\nבדיקות');
    expect(result.title.length).toBeGreaterThan(0);
  });

  test('returns at least 2 steps', () => {
    const result = decomposeProjectText('פרויקט בניית אתר\nשלב א\nשלב ב');
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
  });

  test('steps have ordered orderIndex starting at 0', () => {
    const result = decomposeProjectText('פרויקט\nשלב א\nשלב ב\nשלב ג');
    const indices = result.steps.map(s => s.orderIndex);
    expect(indices[0]).toBe(0);
    expect(indices[1]).toBe(1);
  });

  test('single-line project → generates generic steps', () => {
    const result = decomposeProjectText('מיזם חדש');
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
  });
});

// ── buildIntakePreview ──────────────────────────────────────────────────────────

describe('buildIntakePreview', () => {
  test('project type → preview has project field', () => {
    const preview = buildIntakePreview('פרויקט בניית אפליקציה');
    expect(preview.type).toBe('project');
    expect(preview.project).toBeDefined();
  });

  test('multi_task → preview tasks array has multiple items', () => {
    const preview = buildIntakePreview('לקנות חלב\nלשלוח מייל\nלהתקשר לרופא');
    expect(preview.type).toBe('multi_task');
    expect(preview.tasks.length).toBeGreaterThanOrEqual(2);
  });

  test('single_task → preview tasks has exactly one item', () => {
    const preview = buildIntakePreview('לשלוח מייל');
    expect(preview.type).toBe('single_task');
    expect(preview.tasks).toHaveLength(1);
  });

  test('preserves rawText in preview', () => {
    const text = 'לקנות חלב';
    const preview = buildIntakePreview(text);
    expect(preview.rawText).toBe(text);
  });

  test('project type → tasks array is empty (steps used instead)', () => {
    const preview = buildIntakePreview('פרויקט בניית מערכת');
    expect(preview.tasks).toHaveLength(0);
  });
});
