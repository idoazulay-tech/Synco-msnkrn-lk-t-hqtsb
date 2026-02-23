import { chatCompletion } from "../utils/openai-client.js";
import type { BrainContext, BrainAction, BrainInsight } from "../types/index.js";
import { v4 as uuid } from "uuid";

const SYSTEM_PROMPT = `אתה Synco Brain - מערכת AI שמלמדת את עצמה על המשתמש כדי לעזור לו לנהל את הזמן שלו.
אתה מתמחה בעבודה עם אנשים עם ADHD ומבין את האתגרים שלהם.

הנחיות:
- דבר בעברית פשוטה ותומכת
- התבסס רק על מה שאתה יודע על המשתמש מההקשר שניתן לך
- אל תניח הנחות בלי ראיות
- כשאתה מזהה תבנית - ציין את רמת הביטחון שלך
- הצע פעולות קונקרטיות ומעשיות

כשאתה מנתח, החזר JSON בפורמט:
{
  "understanding": "מה הבנת מהקלט",
  "insights": [{ "type": "pattern|preference|struggle|strength|habit", "title": "כותרת", "description": "תיאור", "confidence": 0.0-1.0 }],
  "suggestedActions": [{ "type": "create_task|update_task|suggest_schedule|store_preference|send_reminder|ask_clarification", "description": "תיאור", "payload": {}, "priority": "high|medium|low" }],
  "response": "תגובה למשתמש",
  "curiosityQuestions": ["שאלות שתרצה לשאול את המשתמש בהמשך"]
}`;

function safeParseJson(str: unknown): Record<string, unknown> | null {
  if (typeof str !== 'string') return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function formatContext(context: BrainContext): string {
  const parts: string[] = [];

  if (context._userMemories && context._userMemories.length > 0) {
    parts.push("הודעות קודמות של המשתמש:");
    context._userMemories.forEach(m => {
      parts.push(`  - "${m.text}" (${m.timestamp})`);
    });
  }

  if (context.userProfile.length > 0) {
    parts.push("\nפרופיל המשתמש:");
    context.userProfile.forEach(p => {
      const cat = p.payload.category || '';
      const key = p.payload.key || '';
      const val = p.payload.value || '';
      parts.push(`  - ${cat}: ${key} = ${val}`);
    });
  }

  if (context.relevantInsights.length > 0) {
    parts.push("\nתובנות רלוונטיות:");
    context.relevantInsights.forEach(i => {
      parts.push(`  - [${i.payload.insightType}] ${i.payload.title}: ${i.payload.description} (ביטחון: ${i.payload.confidence})`);
    });
  }

  if (context.recentEvents.length > 0) {
    parts.push("\nאירועים אחרונים:");
    context.recentEvents.forEach(e => {
      const text = e.payload.text || e.payload.type;
      parts.push(`  - ${text} (${e.payload.timestamp})`);
    });
  }

  if (context.knowledgeHints.length > 0) {
    parts.push("\nידע רלוונטי:");
    context.knowledgeHints.forEach(k => {
      parts.push(`  - ${k.payload.title || k.payload.domain}: ${k.payload.content || ''}`);
    });
  }

  return parts.join('\n') || 'אין הקשר זמין';
}

export interface UnderstandingResult {
  understanding: string;
  insights: BrainInsight[];
  suggestedActions: BrainAction[];
  response: string;
  curiosityQuestions: string[];
}

const VALID_INSIGHT_TYPES = new Set(['pattern', 'preference', 'struggle', 'strength', 'habit']);
const VALID_ACTION_TYPES = new Set(['create_task', 'update_task', 'suggest_schedule', 'store_preference', 'send_reminder', 'ask_clarification']);
const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);

export async function analyzeWithContext(
  input: string,
  context: BrainContext
): Promise<UnderstandingResult> {
  const contextText = formatContext(context);

  const userMessage = `הקשר על המשתמש:
${contextText}

קלט חדש מהמשתמש:
"${input}"

נתח את הקלט בהתאם להקשר והחזר JSON.`;

  const rawResponse = await chatCompletion(SYSTEM_PROMPT, userMessage, {
    temperature: 0.4,
    maxTokens: 2048,
    jsonMode: true,
  });

  try {
    const parsed = JSON.parse(rawResponse);

    const insights: BrainInsight[] = (Array.isArray(parsed.insights) ? parsed.insights : [])
      .filter((i: any) => i && typeof i === 'object')
      .map((i: any) => ({
        id: uuid(),
        userId: context.userId,
        insightType: VALID_INSIGHT_TYPES.has(i.type) ? i.type : 'pattern',
        title: String(i.title || ''),
        description: String(i.description || ''),
        confidence: typeof i.confidence === 'number' ? Math.max(0, Math.min(1, i.confidence)) : 0.5,
        evidence: [input],
        createdAt: new Date(),
        status: 'active' as const,
      }));

    const suggestedActions: BrainAction[] = (Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [])
      .filter((a: any) => a && typeof a === 'object')
      .map((a: any) => ({
        type: VALID_ACTION_TYPES.has(a.type) ? a.type as BrainAction['type'] : 'ask_clarification',
        payload: (a.payload && typeof a.payload === 'object') ? a.payload : {},
        priority: VALID_PRIORITIES.has(a.priority) ? a.priority as BrainAction['priority'] : 'medium',
      }));

    return {
      understanding: String(parsed.understanding || ''),
      insights,
      suggestedActions,
      response: String(parsed.response || ''),
      curiosityQuestions: Array.isArray(parsed.curiosityQuestions)
        ? parsed.curiosityQuestions.filter((q: any) => typeof q === 'string')
        : [],
    };
  } catch {
    console.warn("Brain: Failed to parse AI response as JSON, returning raw");
    return {
      understanding: '',
      insights: [],
      suggestedActions: [],
      response: rawResponse || 'לא הצלחתי לעבד את הבקשה, נסה שוב',
      curiosityQuestions: [],
    };
  }
}
