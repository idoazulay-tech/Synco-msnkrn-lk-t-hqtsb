import { Router, Request, Response } from 'express';
import { chatCompletion } from '../brain/utils/openai-client.js';
import { prisma } from '../lib/prisma.js';
import { buildSchedule } from '../layers/task/planners/schedulePlanner.js';
import { adaptUserTasksToScheduleTasks } from '../layers/task/adapters/userTaskToScheduleAdapter.js';
import type { ScheduleConfig } from '../layers/task/types/scheduleTypes.js';

const router = Router();

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
- location: מיקום אם צוין (שם מקום, כתובת), null אם לא צוין
- notes: הערה קצרה אם יש מידע נוסף רלוונטי

החזר אך ורק JSON תקין בפורמט:
{ "tasks": [ { "title": "...", "date": "...", "hour": ..., "minute": ..., "duration": ..., "priority": "...", "flexibility": "...", "location": "...", "notes": "..." } ] }

חוקים:
- אם משתמש אומר "בוקר" = בין 8-10, "צהריים" = 12-13, "אחה"צ" = 14-16, "ערב" = 18-20
- אם משתמש אומר "דחוף" / "חשוב" = priority high
- פגישות/התחייבויות חיצוניות = flexibility fixed
- משימות עצמאיות = flexibility flexible
- אם צוין מיקום ("ב...", "ב-...", "אצל...", "ב..." + שם מקום) חלץ אותו ל-location
- "פגישה" ללא הגדרת משך = 60 דקות, "שיחה" = 30 דקות`;

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

    const content = await chatCompletion(SYSTEM_PROMPT, userMessage, {
      temperature: 0.3,
      jsonMode: true,
    });

    const parsed = JSON.parse(content || '{"tasks":[]}');

    res.json({ tasks: parsed.tasks || [] });
  } catch (error: any) {
    console.error('Planner parse error:', error);
    res.status(500).json({ error: 'Failed to parse tasks', details: error.message });
  }
});

// POST /api/planner/schedule — suggest a schedule for the day (read-only, no DB writes)
router.post('/schedule', async (req: Request, res: Response) => {
  try {
    const {
      userId = 'default-user',
      date,
      dayStart = '08:00',
      dayEnd = '22:00',
      tasks: bodyTasks,
    } = req.body;

    const dateIso: string = date || new Date().toISOString().split('T')[0];

    const startHour = parseInt((dayStart as string).split(':')[0], 10);
    const endHour   = parseInt((dayEnd   as string).split(':')[0], 10);

    let rawTasks: any[];

    if (Array.isArray(bodyTasks) && bodyTasks.length > 0) {
      rawTasks = bodyTasks;
    } else {
      const dayStartDt = new Date(`${dateIso}T00:00:00.000Z`);
      const dayEndDt   = new Date(`${dateIso}T23:59:59.999Z`);
      rawTasks = await prisma.userTask.findMany({
        where: {
          userId,
          deletedAt: null,
          startTime: { gte: dayStartDt, lte: dayEndDt },
        },
      });
    }

    const scheduleTasks = adaptUserTasksToScheduleTasks(rawTasks);

    const config: ScheduleConfig = {
      dayStartHour: isNaN(startHour) ? 8  : startHour,
      dayEndHour:   isNaN(endHour)   ? 22 : endHour,
      bufferMinutes: 5,
      minTaskMinutes: 10,
    };

    const result = buildSchedule(dateIso, scheduleTasks, [], config);

    const scheduledTasks = result.blocks
      .filter(b => b.type === 'task' && b.refId)
      .map(b => {
        const task = scheduleTasks.find(t => t.id === b.refId);
        return {
          id: b.refId!,
          title: b.title,
          startTime: b.startTimeIso.substring(11, 16),
          endTime:   b.endTimeIso.substring(11, 16),
          durationMinutes: task?.durationMinutes ?? 0,
          priority: task?.urgency ?? 'medium',
          reason: 'שובץ בזמן פנוי מתאים',
          confidence: 0.8,
        };
      });

    const unscheduledTasks = result.unscheduledTasks.map(t => {
      const conflict = result.conflicts.find(c => c.entityId === t.id);
      return {
        id: t.id,
        title: t.title,
        reason: conflict?.message ?? 'לא נמצא חלון זמן מתאים',
      };
    });

    const dayLoadMinutes = result.blocks
      .filter(b => b.type === 'task')
      .reduce((sum, b) => {
        const ms = new Date(b.endTimeIso).getTime() - new Date(b.startTimeIso).getTime();
        return sum + Math.round(ms / 60000);
      }, 0);

    res.json({
      ok: true,
      date: dateIso,
      userId,
      scheduledTasks,
      unscheduledTasks,
      warnings: result.conflicts.map(c => c.message),
      summary: {
        totalTasks:       scheduleTasks.length,
        scheduledCount:   scheduledTasks.length,
        unscheduledCount: unscheduledTasks.length,
        dayLoadMinutes,
      },
    });
  } catch (error: any) {
    console.error('POST /api/planner/schedule error:', error);
    res.status(500).json({ error: 'Failed to schedule tasks', details: error.message });
  }
});

export default router;
