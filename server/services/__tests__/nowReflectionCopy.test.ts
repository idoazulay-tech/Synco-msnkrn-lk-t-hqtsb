import { describe, test, expect } from '@jest/globals';
import { getReflectionCopy } from '../../../src/lib/now/nowReflectionCopy.js';

describe('getReflectionCopy', () => {

  test('done — returns correct title', () => {
    const copy = getReflectionCopy('done');
    expect(copy.title).toBe('מעולה, סיימת פעולה אחת');
  });

  test('done — returns correct primary button', () => {
    const copy = getReflectionCopy('done');
    expect(copy.primaryButton).toBe('הצג פעולה הבאה');
  });

  test('done — message mentions completion', () => {
    const copy = getReflectionCopy('done');
    expect(copy.message).toContain('הושלם');
  });

  test('stuck — returns correct title', () => {
    const copy = getReflectionCopy('stuck');
    expect(copy.title).toBe('סבבה, סימנתי שנתקעת');
  });

  test('stuck — returns correct primary button', () => {
    const copy = getReflectionCopy('stuck');
    expect(copy.primaryButton).toBe('הצג פעולה אחרת');
  });

  test('stuck — message mentions learning', () => {
    const copy = getReflectionCopy('stuck');
    expect(copy.message).toContain('למידה');
  });

  test('not_now — returns correct title', () => {
    const copy = getReflectionCopy('not_now');
    expect(copy.title).toBe('הבנתי, לא עכשיו');
  });

  test('not_now — returns correct primary button', () => {
    const copy = getReflectionCopy('not_now');
    expect(copy.primaryButton).toBe('הצג פעולה אחרת');
  });

  test('not_now — message mentions choosing something else', () => {
    const copy = getReflectionCopy('not_now');
    expect(copy.message).toContain('משהו אחר');
  });

  test('all result types return a secondary button', () => {
    for (const type of ['done', 'stuck', 'not_now'] as const) {
      const copy = getReflectionCopy(type);
      expect(copy.secondaryButton).toBeTruthy();
    }
  });

  test('stuck and not_now share the same primary button label', () => {
    expect(getReflectionCopy('stuck').primaryButton).toBe(
      getReflectionCopy('not_now').primaryButton,
    );
  });

  test('done primary button differs from stuck/not_now', () => {
    expect(getReflectionCopy('done').primaryButton).not.toBe(
      getReflectionCopy('stuck').primaryButton,
    );
  });
});
