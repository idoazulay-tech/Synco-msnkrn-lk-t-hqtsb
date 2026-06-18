import { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, Loader2, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { NowActionCard } from '@/components/now/NowActionCard';
import { NowResultReflection } from '@/components/now/NowResultReflection';
import { useTaskStore } from '@/store/taskStore';
import { logLearningEvent } from '@/lib/api/learningClient';
import type { ResultType } from '@/lib/now/nowReflectionCopy';

const USER_ID = 'default-user';

async function serverCompleteTask(taskId: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/user-tasks/${taskId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: true }),
  });
  return { ok: res.ok };
}

interface NowTask {
  id: string;
  title: string;
  priority: string | null;
  status: string;
  startTime: string;
  duration: number;
}

interface NowResponse {
  ok: boolean;
  task: NowTask | null;
  reason: string;
  candidateCount: number;
  staleCount: number;
}

type PageState = 'loading' | 'selecting' | 'focusing' | 'reflecting' | 'empty';

export default function NowPage() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [nowData, setNowData] = useState<NowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [resultType, setResultType] = useState<ResultType | null>(null);
  const [lastTaskTitle, setLastTaskTitle] = useState<string | null>(null);
  const excludedIdsRef = useRef<Set<string>>(new Set());

  const { startTaskExecution } = useTaskStore();
  const navigate = useNavigate();

  const fetchNow = useCallback(async () => {
    setPageState('loading');
    setError(null);
    try {
      const excluded = [...excludedIdsRef.current].join(',');
      const url = `/api/now?userId=${USER_ID}${excluded ? `&excludedTaskIds=${excluded}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('שגיאה בשרת');
      const json: NowResponse = await res.json();
      setNowData(json);
      setPageState(json.task ? 'selecting' : 'empty');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה לא ידועה');
      setPageState('selecting');
    }
  }, []);

  useEffect(() => {
    fetchNow();
  }, [fetchNow]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleStart = useCallback(() => {
    if (!nowData?.task) return;
    startTaskExecution(nowData.task.id);
    setPageState('focusing');
  }, [nowData, startTaskExecution]);

  // Card-level "לא עכשיו" (task not started yet)
  const handleSkipFromCard = useCallback(() => {
    if (!nowData?.task) return;
    const task = nowData.task;
    excludedIdsRef.current.add(task.id);
    logLearningEvent({
      taskId: task.id,
      eventType: 'task_postponed',
      source: 'now_flow',
      taskTitleSnapshot: task.title,
      metadata: { reasonCategory: 'not_now', reasonLabel: 'לא עכשיו', source: 'now_flow' },
    });
    setLastTaskTitle(task.title);
    setResultType('not_now');
    setPageState('reflecting');
  }, [nowData]);

  // Focus: "סיימתי"
  const handleDone = useCallback(async () => {
    if (!nowData?.task) return;
    const task = nowData.task;
    setCompletionError(null);

    try {
      const { ok } = await serverCompleteTask(task.id);
      if (!ok) {
        setCompletionError('לא הצלחתי לסמן את המשימה כהושלמה. נסה שוב.');
        return;
      }
    } catch {
      setCompletionError('לא הצלחתי לסמן את המשימה כהושלמה. נסה שוב.');
      return;
    }

    logLearningEvent({
      taskId: task.id,
      eventType: 'task_completed',
      source: 'now_flow',
      taskTitleSnapshot: task.title,
      metadata: { source: 'now_flow', completionSource: 'server_fallback' },
    });

    excludedIdsRef.current.add(task.id);
    setLastTaskTitle(task.title);
    setResultType('done');
    setPageState('reflecting');
  }, [nowData]);

  // Focus: "נתקעתי"
  const handleStuck = useCallback(() => {
    if (!nowData?.task) return;
    const task = nowData.task;
    excludedIdsRef.current.add(task.id);
    logLearningEvent({
      taskId: task.id,
      eventType: 'task_postponed',
      source: 'now_flow',
      taskTitleSnapshot: task.title,
      metadata: { reasonCategory: 'stuck', reasonLabel: 'נתקעתי', source: 'now_flow' },
    });
    setLastTaskTitle(task.title);
    setResultType('stuck');
    setPageState('reflecting');
  }, [nowData]);

  // Focus: "לא עכשיו"
  const handleNotNowFromFocus = useCallback(() => {
    if (!nowData?.task) return;
    const task = nowData.task;
    excludedIdsRef.current.add(task.id);
    logLearningEvent({
      taskId: task.id,
      eventType: 'task_postponed',
      source: 'now_flow',
      taskTitleSnapshot: task.title,
      metadata: { reasonCategory: 'not_now', reasonLabel: 'לא עכשיו', source: 'now_flow' },
    });
    setLastTaskTitle(task.title);
    setResultType('not_now');
    setPageState('reflecting');
  }, [nowData]);

  // Reflection: "הצג פעולה הבאה / אחרת"
  const handleNext = useCallback(() => {
    fetchNow();
  }, [fetchNow]);

  // Reflection: "סיים כרגע"
  const handleClose = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const headerTitle = (() => {
    if (pageState === 'focusing') return 'עכשיו רק זה';
    if (pageState === 'reflecting') return '';
    return 'מה לעשות עכשיו?';
  })();

  return (
    <AppLayout title="עכשיו">
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-6" dir="rtl">

        {/* Header — hidden in reflecting to let card breathe */}
        {pageState !== 'reflecting' && (
          <div className="flex flex-col items-center gap-2">
            <Zap className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold">{headerTitle}</h1>
          </div>
        )}

        {/* Loading */}
        {pageState === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>בוחר פעולה...</span>
          </div>
        )}

        {/* Fetch error */}
        {error && pageState !== 'loading' && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        {/* Empty */}
        {pageState === 'empty' && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Inbox className="w-8 h-8" />
            <p className="text-lg">אין משימות פתוחות רלוונטיות כרגע.</p>
            {(nowData?.staleCount ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground/60">
                {nowData!.staleCount} משימות ישנות לא נכללו כי כנראה כבר לא רלוונטיות.
              </p>
            )}
            <button
              onClick={() => { excludedIdsRef.current.clear(); fetchNow(); }}
              className="text-sm text-primary underline underline-offset-4 mt-2"
            >
              נסה שוב
            </button>
          </div>
        )}

        {/* Selecting — action card */}
        {pageState === 'selecting' && nowData?.task && (
          <NowActionCard
            task={nowData.task}
            reason={nowData.reason}
            candidateCount={nowData.candidateCount}
            staleCount={nowData.staleCount}
            onStart={handleStart}
            onSkip={handleSkipFromCard}
          />
        )}

        {/* Focusing — focus mode */}
        {pageState === 'focusing' && nowData?.task && (
          <div className="w-full max-w-sm flex flex-col gap-6 text-right">
            <div className="bg-card border border-primary/40 rounded-2xl p-6 shadow-sm flex flex-col gap-3">
              <p className="text-lg font-semibold leading-snug">{nowData.task.title}</p>
              <p className="text-sm text-muted-foreground">
                לא צריך לפתור הכל. רק את הפעולה הזאת.
              </p>
            </div>

            {completionError && (
              <p className="text-destructive text-sm text-right">{completionError}</p>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={handleDone}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 active:opacity-80 transition-opacity"
              >
                סיימתי
              </button>
              <button
                onClick={handleStuck}
                className="w-full py-2.5 rounded-xl border border-border text-foreground text-sm hover:bg-muted transition-colors"
              >
                נתקעתי
              </button>
              <button
                onClick={handleNotNowFromFocus}
                className="w-full py-2.5 rounded-xl text-muted-foreground text-sm hover:text-foreground transition-colors"
              >
                לא עכשיו
              </button>
            </div>
          </div>
        )}

        {/* Reflecting — post-result reflection card */}
        {pageState === 'reflecting' && resultType && lastTaskTitle && (
          <NowResultReflection
            resultType={resultType}
            taskTitle={lastTaskTitle}
            onNext={handleNext}
            onClose={handleClose}
          />
        )}

      </div>
    </AppLayout>
  );
}
