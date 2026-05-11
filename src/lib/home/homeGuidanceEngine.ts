import { Task } from '@/types/task';
import { isWithinInterval, differenceInMinutes, isSameDay } from 'date-fns';

export type HomeGuidanceState = 'active_now' | 'upcoming' | 'no_task' | 'day_done';

export type WhyNowSource = 'scheduled_time' | 'priority' | 'anchor' | 'learning' | 'fallback';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface WhyNow {
  text: string;
  confidence: ConfidenceLevel;
  source: WhyNowSource;
}

export interface HomeGuidanceContext {
  state: HomeGuidanceState;
  currentTask: Task | null;
  nextTask: Task | null;
  minutesRemaining: number | null;
  startsInMinutes: number | null;
  whyNow: WhyNow;
  settingsNotice?: string;
}

interface BuildHomeGuidanceContextParams {
  tasks: Task[];
  now: Date;
  settings?: {
    dayStart?: string;
    dayEnd?: string;
    timezone?: string;
    planningStyle?: string;
  };
  learningSummary?: unknown;
  planningContext?: unknown;
}

function parseDayBoundary(timeStr: string | undefined, now: Date): Date | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d;
}

function buildWhyNow(task: Task, source: WhyNowSource, confidence: ConfidenceLevel): WhyNow {
  let text: string;
  if (confidence === 'high') {
    text = 'זו המשימה שנמצאת בחלון הזמן הנוכחי.';
  } else if (confidence === 'medium') {
    text = 'נראה שזו המשימה הנכונה עכשיו לפי השיבוץ והעדיפות שלה.';
  } else {
    text = 'זו המשימה הקרובה ביותר בלוח שלך.';
  }
  void task;
  return { text, confidence, source };
}

export function buildHomeGuidanceContext({
  tasks,
  now,
  settings,
  learningSummary: _learningSummary,
  planningContext: _planningContext,
}: BuildHomeGuidanceContextParams): HomeGuidanceContext {
  const dayStartDate = parseDayBoundary(settings?.dayStart, now);
  const dayEndDate   = parseDayBoundary(settings?.dayEnd,   now);

  const isOutsideDayWindow =
    (dayStartDate && now < dayStartDate) || (dayEndDate && now > dayEndDate);

  const isDayDone = !!(dayEndDate && now > dayEndDate);

  let settingsNotice: string | undefined;
  if (isOutsideDayWindow) {
    settingsNotice = 'אתה מחוץ לשעות היום שהגדרת.';
  } else if (settings?.planningStyle === 'gentle') {
    settingsNotice = 'נשמור על קצב רגוע.';
  } else if (settings?.planningStyle === 'aggressive') {
    settingsNotice = 'ננסה להתקדם בצורה חדה יותר, בלי לשבץ בעבר.';
  }

  const todayTasks = tasks.filter((t) => {
    if (t.status === 'completed' || t.status === 'not_completed' || t.status === 'standby') return false;
    if (!isSameDay(t.startTime, now) && !isSameDay(t.endTime, now)) return false;
    return true;
  });

  const currentTask = todayTasks.find((t) =>
    isWithinInterval(now, { start: t.startTime, end: t.endTime })
  ) ?? null;

  if (currentTask) {
    const minutesRemaining = differenceInMinutes(currentTask.endTime, now);
    const whyNow = buildWhyNow(currentTask, 'scheduled_time', 'high');
    const futureTasks = todayTasks
      .filter((t) => t.id !== currentTask.id && t.startTime > now)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    return {
      state: 'active_now',
      currentTask,
      nextTask: futureTasks[0] ?? null,
      minutesRemaining,
      startsInMinutes: null,
      whyNow,
      settingsNotice,
    };
  }

  const upcomingTasks = todayTasks
    .filter((t) => t.startTime > now)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  if (upcomingTasks.length > 0) {
    const nextTask = upcomingTasks[0];
    const startsInMinutes = differenceInMinutes(nextTask.startTime, now);
    const confidence: ConfidenceLevel = nextTask.priority === 'high' ? 'high' : 'medium';
    const whyNow = buildWhyNow(nextTask, 'scheduled_time', confidence);
    return {
      state: 'upcoming',
      currentTask: null,
      nextTask,
      minutesRemaining: null,
      startsInMinutes,
      whyNow,
      settingsNotice,
    };
  }

  if (isDayDone) {
    const whyNow: WhyNow = {
      text: 'סיום היום שהגדרת הגיע. אפשר לתכנן ליום הבא.',
      confidence: 'high',
      source: 'scheduled_time',
    };
    return {
      state: 'day_done',
      currentTask: null,
      nextTask: null,
      minutesRemaining: null,
      startsInMinutes: null,
      whyNow,
      settingsNotice,
    };
  }

  const whyNow: WhyNow = {
    text: 'אין משימה פעילה ברגע זה.',
    confidence: 'high',
    source: 'fallback',
  };
  return {
    state: 'no_task',
    currentTask: null,
    nextTask: null,
    minutesRemaining: null,
    startsInMinutes: null,
    whyNow,
    settingsNotice,
  };
}
