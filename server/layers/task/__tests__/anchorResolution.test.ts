import { resolveAnchorStartIso, TimelineBlock } from '../index';

describe('resolveAnchorStartIso', () => {
  const baseDate = '2024-01-25';
  
  const createIso = (time: string) => `${baseDate}T${time}:00.000Z`;
  
  const sampleTimeline: TimelineBlock[] = [
    { id: '1', startIso: createIso('13:00'), endIso: createIso('14:15'), title: 'משימה נוכחית' },
    { id: '2', startIso: createIso('14:30'), endIso: createIso('15:00'), title: 'המשימה הבאה' },
    { id: '3', startIso: createIso('16:00'), endIso: createIso('17:00'), title: 'משימה שלישית' },
  ];

  describe('after_current_block_end', () => {
    it('should return endIso of current block when inside a task', () => {
      const nowIso = createIso('13:30'); // Inside task 1
      const result = resolveAnchorStartIso('after_current_block_end', sampleTimeline, nowIso);
      
      expect(result.startIso).toBe(createIso('14:15'));
      expect(result.resolvedFrom).toBe('current_block');
      expect(result.blockTitle).toBe('משימה נוכחית');
    });

    it('should fallback to now when not inside any block', () => {
      const nowIso = createIso('14:20'); // Between task 1 and 2
      const result = resolveAnchorStartIso('after_current_block_end', sampleTimeline, nowIso);
      
      expect(result.startIso).toBe(nowIso);
      expect(result.resolvedFrom).toBe('fallback_now');
    });
  });

  describe('at_next_block_start', () => {
    it('should return startIso of next block', () => {
      const nowIso = createIso('13:30'); // Inside task 1
      const result = resolveAnchorStartIso('at_next_block_start', sampleTimeline, nowIso);
      
      expect(result.startIso).toBe(createIso('14:30'));
      expect(result.resolvedFrom).toBe('next_block');
      expect(result.blockTitle).toBe('המשימה הבאה');
    });

    it('should fallback to now when no next block exists', () => {
      const nowIso = createIso('17:30'); // After all tasks
      const result = resolveAnchorStartIso('at_next_block_start', sampleTimeline, nowIso);
      
      expect(result.startIso).toBe(nowIso);
      expect(result.resolvedFrom).toBe('fallback_now');
    });
  });

  describe('after_next_block_end', () => {
    it('should return endIso of next block', () => {
      const nowIso = createIso('13:30'); // Inside task 1
      const result = resolveAnchorStartIso('after_next_block_end', sampleTimeline, nowIso);
      
      expect(result.startIso).toBe(createIso('15:00'));
      expect(result.resolvedFrom).toBe('next_block');
      expect(result.blockTitle).toBe('המשימה הבאה');
    });

    it('should fallback to now when no next block exists', () => {
      const nowIso = createIso('17:30'); // After all tasks
      const result = resolveAnchorStartIso('after_next_block_end', sampleTimeline, nowIso);
      
      expect(result.startIso).toBe(nowIso);
      expect(result.resolvedFrom).toBe('fallback_now');
    });
  });

  describe('empty timeline', () => {
    it('should fallback to now with no_timeline reason', () => {
      const nowIso = createIso('13:30');
      const result = resolveAnchorStartIso('after_current_block_end', [], nowIso);
      
      expect(result.startIso).toBe(nowIso);
      expect(result.resolvedFrom).toBe('no_timeline');
    });
  });

  describe('E2E scenario', () => {
    it('should correctly schedule task after current task ends', () => {
      const timeline: TimelineBlock[] = [
        { id: '1', startIso: createIso('13:00'), endIso: createIso('14:15'), title: 'עבודה' },
        { id: '2', startIso: createIso('14:30'), endIso: createIso('15:00'), title: 'הפסקה' },
      ];
      const nowIso = createIso('13:45'); // During 'עבודה'
      
      // "תוסיף משימה להתקלח מהרגע שהמשימה הנוכחית נגמרת" => start 14:15
      const result1 = resolveAnchorStartIso('after_current_block_end', timeline, nowIso);
      expect(result1.startIso).toBe(createIso('14:15'));
      
      // "תוסיף משימה להתקלח מתחילת המשימה הבאה" => start 14:30
      const result2 = resolveAnchorStartIso('at_next_block_start', timeline, nowIso);
      expect(result2.startIso).toBe(createIso('14:30'));
      
      // "תוסיף משימה להתקלח אחרי המשימה הבאה" => start 15:00
      const result3 = resolveAnchorStartIso('after_next_block_end', timeline, nowIso);
      expect(result3.startIso).toBe(createIso('15:00'));
    });
  });
});
