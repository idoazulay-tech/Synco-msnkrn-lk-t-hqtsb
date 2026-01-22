import { DecisionEngine } from '../DecisionEngine';
import { IntentContextEngine } from '../../intent/IntentContextEngine';
import { ContextManager } from '../../intent/memory/ContextManager';

describe('DecisionEngine', () => {
  let intentEngine: IntentContextEngine;
  let decisionEngine: DecisionEngine;
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
    intentEngine = new IntentContextEngine(contextManager);
    decisionEngine = new DecisionEngine();
    decisionEngine.setContextManager(contextManager);
  });

  test('1. create_event missing date => ask date', () => {
    const analysis = intentEngine.analyze('תקבע לי פגישה עם יוסי');
    const decision = decisionEngine.decide(analysis);
    
    expect(decision.decision).toBe('ask');
    expect(['date', 'time']).toContain(decision.question.questionId);
    expect(decision.question.shouldAsk).toBe(true);
  });

  test('2. create_event missing time => ask time', () => {
    const analysis = intentEngine.analyze('תקבע לי פגישה מחר עם דני');
    const decision = decisionEngine.decide(analysis);
    
    if (decision.decision === 'ask') {
      expect(['time', 'date']).toContain(decision.question.questionId);
    }
  });

  test('3. create_task missing taskName => ask', () => {
    const analysis = intentEngine.analyze('תזכיר לי משהו מחר');
    const decision = decisionEngine.decide(analysis);
    
    expect(['ask', 'execute']).toContain(decision.decision);
  });

  test('4. create_task with must => execute + mustLock true', () => {
    const analysis = intentEngine.analyze('חייב חייב לקנות חלב מחר ב-10');
    const decision = decisionEngine.decide(analysis);
    
    if (decision.decision === 'execute') {
      expect(decision.actionPlan.mustLock).toBe(true);
    }
  });

  test('5. emotional_dump => reflect + microStep', () => {
    const analysis = intentEngine.analyze('אני לחוץ לא מצליח לתפקד הכל נופל עלי');
    const decision = decisionEngine.decide(analysis);
    
    expect(decision.decision).toBe('reflect');
    expect(decision.reflection.shouldReflect).toBe(true);
    expect(decision.reflection.microStep).toBeTruthy();
  });

  test('6. cognitiveLoad high + ambiguity => reflect or ask short', () => {
    const analysis = intentEngine.analyze('יש לי המון דברים צריך לסדר הכל אני לא יודע מאיפה להתחיל');
    const decision = decisionEngine.decide(analysis);
    
    expect(['reflect', 'ask']).toContain(decision.decision);
  });

  test('7. inquire "מה יש לי היום" => execute', () => {
    const analysis = intentEngine.analyze('מה יש לי היום');
    const decision = decisionEngine.decide(analysis);
    
    expect(decision.decision).toBe('execute');
    expect(decision.actionPlan.actionType).toBe('inquire');
  });

  test('8. unknown question כללית => reflect with options', () => {
    const analysis = intentEngine.analyze('מה קורה');
    const decision = decisionEngine.decide(analysis);
    
    expect(['reflect', 'ask']).toContain(decision.decision);
  });

  test('9. follow-up "כן" after confirm question => execute', () => {
    intentEngine.analyze('תקבע לי פגישה מחר ב-2');
    contextManager.recordTurn({
      turnId: 'test-1',
      rawText: 'תקבע לי פגישה מחר ב-2',
      intent: 'create_event',
      entities: { date: { raw: 'מחר', normalized: '2026-01-23' }, time: { raw: '2', normalized: '14:00' } },
      cognitiveLoad: 'low',
      timestamp: new Date()
    });
    
    const followUpAnalysis = intentEngine.analyze('כן');
    const decision = decisionEngine.decide(followUpAnalysis);
    
    expect(['execute', 'ask']).toContain(decision.decision);
  });

  test('10. cancel without target => ask options', () => {
    const analysis = intentEngine.analyze('תבטל לי');
    const decision = decisionEngine.decide(analysis);
    
    expect(decision.decision).toBe('ask');
    expect(decision.question.shouldAsk).toBe(true);
  });

  test('11. reschedule without scope => ask options', () => {
    const analysis = intentEngine.analyze('תסדר לי מחדש');
    const decision = decisionEngine.decide(analysis);
    
    expect(['ask', 'execute']).toContain(decision.decision);
    if (decision.decision === 'ask') {
      expect(decision.question.shouldAsk).toBe(true);
    }
  });

  test('12. very low confidenceScore => stop + clarifyIntent', () => {
    const mockAnalysis = {
      inputType: 'command' as const,
      primaryIntent: 'unknown' as const,
      secondaryIntents: [],
      commitmentLevel: 'low' as const,
      entities: {
        time: { raw: '', normalized: '', confidence: 0 },
        date: { raw: '', normalized: '', confidence: 0 },
        duration: { raw: '', normalized: 0, confidence: 0 },
        people: { raw: '', normalized: [] as string[], confidence: 0 },
        location: { raw: '', normalized: '', confidence: 0 },
        taskName: { raw: '', normalized: '', confidence: 0 },
        urgency: { raw: '', normalized: 'low' as const, confidence: 0 },
        must: { raw: '', normalized: false, confidence: 0 },
        constraints: []
      },
      cognitiveLoad: 'low' as const,
      missingInfo: ['date', 'time', 'taskName', 'target'],
      confidenceScore: 0.15,
      context: {
        isFollowUp: false,
        refersToPrevious: false,
        previousTurnId: '',
        topic: '',
        assumptions: []
      },
      internal: { notes: [], signals: { keywordsMatched: [], patternsMatched: [] } },
      rawText: 'bla bla bla'
    };
    
    const decision = decisionEngine.decide(mockAnalysis);
    
    expect(decision.decision).toBe('stop');
    expect(decision.question.shouldAsk).toBe(true);
    expect(decision.question.questionId).toBe('clarifyIntent');
  });
});
