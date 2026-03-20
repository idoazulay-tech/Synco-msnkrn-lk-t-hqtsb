import { Router } from 'express';
import OpenAI from 'openai';

const router = Router();
const openai = new OpenAI();

const SYSTEM_PROMPT = `אתה עוזר תכנון משימות חכם בעברית. המשתמש יתאר משימות שהוא צריך לבצע היום.
עליך לחלץ כל משימה בנפרד ולהחזיר JSON מובנה.

לכל משימה החזר:
- title: שם המשימה (עברית, קצר וברור)
- date: תאריך ISO (YYYY-MM-DD), ברירת מחדל: היום
- hour: שעת התחלה (0-23), null אם לא צוין
- minute: דקות (0, 15, 30, 45), null אם לא צוין
- duration: משך בדקות (ברירת מחדל: 30)
- priority: "high" / "medium" / "low" (הסק לפי דחיפות/חשיבות)
- flexibility: "fixed" (נעוץ בזמן) / "flexible" (גמיש) / "anytime" (בכל זמן)
- notes: הערה קצרה אם יש מידע נוסף רלוונטי

החזר אך ורק JSON תקין בפורמט:
{ "tasks": [ { "title": "...", "date": "...", "hour": ..., "minute": ..., "duration": ..., "priority": "...", "flexibility": "...", "notes": "..." } ] }

חוקים:
- אם משתמש אומר "בוקר" = בין 8-10, "צהריים" = 12-13, "אחה"צ" = 14-16, "ערב" = 18-20
- אם משתמש אומר "דחוף" / "חשוב" = priority high
- פגישות/התחייבויות חיצוניות = flexibility fixed
- משימות עצמאיות = flexibility flexible`;

router.post('/parse', async (req, res) => {
  try {
    const { text, todayDate, existingTasks } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }

    const today = todayDate || new Date().toISOString().split('T')[0];

    const userMessage = `היום: ${today}
${existingTasks && existingTasks.length > 0 ? `\nמשימות קיימות ביומן:\n${existingTasks.map((t: any) => `- ${t.title} (${t.hour}:${String(t.minute || 0).padStart(2, '0')}, ${t.duration} דקות)`).join('\n')}` : ''}

המשתמש אמר:
"${text}"

חלץ את כל המשימות:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content || '{"tasks":[]}';
    const parsed = JSON.parse(content);

    res.json({ tasks: parsed.tasks || [] });
  } catch (error: any) {
    console.error('Planner parse error:', error);
    res.status(500).json({ error: 'Failed to parse tasks', details: error.message });
  }
});

export default router;
