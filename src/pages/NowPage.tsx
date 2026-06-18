import { useState, useEffect } from 'react';
import { Zap, Loader2, Inbox } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

interface NowTask {
  id: string;
  title: string;
  priority: string | null;
  status: string;
  duration: number;
}

interface NowResponse {
  ok: boolean;
  task: NowTask | null;
  reason: string;
  candidateCount: number;
}

export default function NowPage() {
  const [data, setData] = useState<NowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNow = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/now?userId=default-user');
      if (!res.ok) throw new Error('שגיאה בשרת');
      const json: NowResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה לא ידועה');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNow();
  }, []);

  return (
    <AppLayout title="עכשיו">
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <Zap className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">מה לעשות עכשיו?</h1>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>בוחר פעולה...</span>
          </div>
        )}

        {!loading && error && (
          <div className="text-destructive text-sm">{error}</div>
        )}

        {!loading && !error && data && !data.task && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Inbox className="w-8 h-8" />
            <p className="text-lg">אין משימות פתוחות כרגע.</p>
          </div>
        )}

        {!loading && !error && data?.task && (
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 text-right shadow-sm flex flex-col gap-4">
            <p className="text-lg font-semibold leading-snug">{data.task.title}</p>
            <p className="text-sm text-muted-foreground">{data.reason}</p>
            {data.candidateCount > 1 && (
              <p className="text-xs text-muted-foreground/60">
                נבחרה מתוך {data.candidateCount} משימות פתוחות
              </p>
            )}
          </div>
        )}

        {!loading && (
          <button
            onClick={fetchNow}
            className="text-sm text-primary underline underline-offset-4"
          >
            בחר שוב
          </button>
        )}
      </div>
    </AppLayout>
  );
}
