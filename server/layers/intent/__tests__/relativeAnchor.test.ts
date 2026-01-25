import { extractRelativeAnchor } from '../pipeline/extractEntities';

describe('extractRelativeAnchor', () => {
  describe('after_current_block_end patterns', () => {
    it('should detect "מהרגע שהמשימה הנוכחית נגמרת"', () => {
      const result = extractRelativeAnchor('תוסיף משימה להתקלח מהרגע שהמשימה הנוכחית נגמרת');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('after_current_block_end');
      expect(result?.confidence).toBeGreaterThan(0.8);
    });

    it('should detect "אחרי המשימה הנוכחית"', () => {
      const result = extractRelativeAnchor('אני רוצה להתקלח אחרי המשימה הנוכחית');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('after_current_block_end');
    });

    it('should detect "כשאני מסיים את מה שעכשיו"', () => {
      const result = extractRelativeAnchor('תזמן לי התקלחות כשאני מסיים את מה שעכשיו');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('after_current_block_end');
    });

    it('should detect "כשזה נגמר"', () => {
      const result = extractRelativeAnchor('תוסיף משימה כשזה נגמר');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('after_current_block_end');
    });
  });

  describe('at_next_block_start patterns', () => {
    it('should detect "מתחילת המשימה הבאה"', () => {
      const result = extractRelativeAnchor('תוסיף משימה להתקלח מתחילת המשימה הבאה');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('at_next_block_start');
    });

    it('should detect "מההתחלה של המשימה הבאה"', () => {
      const result = extractRelativeAnchor('אני רוצה מההתחלה של המשימה הבאה');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('at_next_block_start');
    });

    it('should detect "בתחילת המשימה הבאה"', () => {
      const result = extractRelativeAnchor('תשבץ בתחילת המשימה הבאה');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('at_next_block_start');
    });
  });

  describe('after_next_block_end patterns', () => {
    it('should detect "אחרי המשימה הבאה"', () => {
      const result = extractRelativeAnchor('תוסיף משימה להתקלח אחרי המשימה הבאה');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('after_next_block_end');
    });

    it('should detect "כשהמשימה הבאה מסתיימת"', () => {
      const result = extractRelativeAnchor('תזמן לי כשהמשימה הבאה מסתיימת');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('after_next_block_end');
    });

    it('should detect "בסוף המשימה הבאה"', () => {
      const result = extractRelativeAnchor('תשבץ בסוף המשימה הבאה');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('after_next_block_end');
    });
  });

  describe('no anchor', () => {
    it('should return null for regular task text', () => {
      const result = extractRelativeAnchor('תוסיף משימה להתקלח מחר בשעה 10');
      expect(result).toBeNull();
    });

    it('should return null for empty text', () => {
      const result = extractRelativeAnchor('');
      expect(result).toBeNull();
    });
  });
});
