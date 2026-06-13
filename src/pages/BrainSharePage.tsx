import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Home, Send, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignalItem {
  signalType:        string;
  title:             string;
  summary:           string;
  confidence:        number;
  shouldCreateTask:  boolean;
  shouldUpdateWiki:  boolean;
  shouldUpdateGraph: boolean;
}

interface OpenQuestionItem {
  questionText:      string;
  questionType:      string;
  relatedEntityName?: string;
}

interface WikiCandidate {
  topic:        string;
  action:       string;
  newKeyPoints: string[];
  confidence:   number;
}

interface GraphCandidate {
  nodesToCreate: { nodeType: string; label: string; confidence: number }[];
  edgesToCreate: { fromLabel: string; toLabel: string; relationType: string }[];
}

interface ShareResponse {
  ok:                   boolean;
  message:              string;
  rawEventId?:          string;
  signals:              SignalItem[];
  suggestedTasks:       { title: string; urgency: string }[];
  openQuestions:        OpenQuestionItem[];
  wikiUpdateCandidates: WikiCandidate[];
  graphUpdateCandidates: GraphCandidate[];
  persisted: {
    rawEvent:          boolean;
    signalsCount:      number;
    wikiUpdatesCount:  number;
    graphNodesCount:   number;
    graphEdgesCount:   number;
    openQuestionsCount: number;
  };
  diagnostics?: { brain: string[]; persist: string[] };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  task_signal:         'משימה',
  commitment_signal:   'התחייבות',
  knowledge_signal:    'ידע',
  emotional_signal:    'רגש',
  behavior_signal:     'התנהגות',
  interest_signal:     'עניין',
  risk_signal:         'סיכון',
  opportunity_signal:  'הזדמנות',
  relationship_signal: 'קשר',
  financial_signal:    'כלכלה',
  project_signal:      'פרויקט',
};

const SIGNAL_COLORS: Record<string, string> = {
  task_signal:         'bg-blue-100 text-blue-800',
  commitment_signal:   'bg-orange-100 text-orange-800',
  knowledge_signal:    'bg-green-100 text-green-800',
  emotional_signal:    'bg-purple-100 text-purple-800',
  financial_signal:    'bg-red-100 text-red-800',
  relationship_signal: 'bg-yellow-100 text-yellow-800',
  interest_signal:     'bg-teal-100 text-teal-800',
  risk_signal:         'bg-rose-100 text-rose-800',
};

function SignalBadge({ type }: { type: string }) {
  const label = SIGNAL_TYPE_LABELS[type] ?? type;
  const color = SIGNAL_COLORS[type] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-green-400' : pct >= 45 ? 'bg-yellow-400' : 'bg-gray-300';
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <div className="h-1.5 w-16 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span>{pct}%</span>
    </div>
  );
}

function Collapsible({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(count > 0);
  if (count === 0) return null;
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span>{title} <span className="text-gray-400 font-normal">({count})</span></span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrainSharePage() {
  const [text, setText]       = useState('');
  const [persist, setPersist] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<ShareResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const userId = 'default-user'; // same as rest of the app

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/brain/share', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId, text: text.trim(), persist, devMode }),
      });
      const data = await res.json() as ShareResponse;
      if (data.ok) {
        setResult(data);
      } else {
        setError(data.message ?? 'שגיאה לא ידועה');
      }
    } catch {
      setError('לא הצלחתי להתחבר לשרת. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={20} className="text-indigo-600" />
          <h1 className="font-bold text-gray-800 text-lg">מוח שיתוף — Synco Brain Share</h1>
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
            DEV
          </span>
        </div>
        <Link to="/" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <Home size={16} />
          <span>בית</span>
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Input card */}
        <div className="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              הדבק טקסט, מאמר, הודעה, או מחשבה
            </label>
            <textarea
              className="w-full rounded-xl border border-gray-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
              rows={5}
              placeholder="לדוגמה: &#10;• תחזור לדני מחר לגבי החזר כסף&#10;• קראתי מאמר מעניין על שינה ויצירתיות&#10;• ראיתי 5 סרטונים על חובות..."
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded text-indigo-600"
                checked={persist}
                onChange={e => setPersist(e.target.checked)}
              />
              <span className="text-gray-700">שמור ל-DB</span>
              <span className="text-gray-400 text-xs">(persist=true)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded text-indigo-600"
                checked={devMode}
                onChange={e => setDevMode(e.target.checked)}
              />
              <span className="text-gray-700">מצב פיתוח</span>
              <span className="text-gray-400 text-xs">(devMode=true)</span>
            </label>
          </div>

          <button
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl py-3 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
          >
            <Send size={16} />
            {loading ? 'מעבד...' : 'שלח לסריקה'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Summary message */}
            <div className={`rounded-xl p-4 text-sm font-medium ${result.persisted.rawEvent ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-indigo-50 border border-indigo-200 text-indigo-800'}`}>
              {result.message}
            </div>

            {/* Persist summary */}
            {persist && (
              <div className="bg-gray-50 border rounded-xl p-4 text-xs text-gray-600 flex flex-wrap gap-4">
                <span>RawEvent: {result.persisted.rawEvent ? '✅' : '❌'}</span>
                <span>אותות: {result.persisted.signalsCount}</span>
                <span>ויקי: {result.persisted.wikiUpdatesCount}</span>
                <span>גרף: {result.persisted.graphNodesCount} קשרים</span>
                <span>שאלות: {result.persisted.openQuestionsCount}</span>
              </div>
            )}

            {/* Signals */}
            <Collapsible title="אותות שזוהו" count={result.signals.length}>
              {result.signals.map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SignalBadge type={s.signalType} />
                    <span className="text-sm text-gray-700 font-medium">{s.summary}</span>
                  </div>
                  <ConfidenceBar value={s.confidence} />
                  <div className="flex gap-2 text-xs text-gray-400">
                    {s.shouldCreateTask  && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">משימה</span>}
                    {s.shouldUpdateWiki  && <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded">ויקי</span>}
                    {s.shouldUpdateGraph && <span className="bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded">גרף</span>}
                  </div>
                </div>
              ))}
            </Collapsible>

            {/* Open Questions */}
            <Collapsible title="שאלות פתוחות" count={result.openQuestions.length}>
              {result.openQuestions.map((q, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-indigo-500 mt-0.5">?</span>
                  <div>
                    <p className="text-gray-800 font-medium">{q.questionText}</p>
                    {q.relatedEntityName && (
                      <p className="text-gray-400 text-xs mt-0.5">על: {q.relatedEntityName}</p>
                    )}
                  </div>
                </div>
              ))}
            </Collapsible>

            {/* Suggested tasks */}
            <Collapsible title="משימות מוצעות" count={result.suggestedTasks.length}>
              {result.suggestedTasks.map((task, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-gray-800">{task.title}</span>
                  <span className="text-gray-400 text-xs mr-auto">{task.urgency}</span>
                </div>
              ))}
            </Collapsible>

            {/* Wiki */}
            <Collapsible title="עדכוני ויקי מוצעים" count={result.wikiUpdateCandidates.length}>
              {result.wikiUpdateCandidates.map((w, i) => (
                <div key={i} className="bg-green-50 rounded-lg p-3 space-y-1">
                  <p className="text-sm font-semibold text-green-800">{w.topic}</p>
                  <p className="text-xs text-green-600">פעולה: {w.action}</p>
                  {w.newKeyPoints.map((pt, j) => (
                    <p key={j} className="text-xs text-gray-600 pr-3">• {pt}</p>
                  ))}
                </div>
              ))}
            </Collapsible>

            {/* Graph */}
            <Collapsible title="עדכוני גרף מוצעים" count={result.graphUpdateCandidates.reduce((a, g) => a + g.nodesToCreate.length + g.edgesToCreate.length, 0)}>
              {result.graphUpdateCandidates.map((g, i) => (
                <div key={i} className="space-y-2">
                  {g.nodesToCreate.map((n, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs">
                      <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">{n.nodeType}</span>
                      <span className="text-gray-700">{n.label}</span>
                      <span className="text-gray-400 mr-auto">{Math.round(n.confidence * 100)}%</span>
                    </div>
                  ))}
                  {g.edgesToCreate.map((e, j) => (
                    <div key={j} className="flex items-center gap-1 text-xs text-gray-500">
                      <span>{e.fromLabel}</span>
                      <span className="text-gray-300">→</span>
                      <span className="text-indigo-600">{e.relationType}</span>
                      <span className="text-gray-300">→</span>
                      <span>{e.toLabel}</span>
                    </div>
                  ))}
                </div>
              ))}
            </Collapsible>

            {/* Diagnostics (dev mode only) */}
            {devMode && result.diagnostics && (
              <div className="space-y-3">
                <Collapsible title="Brain diagnostics" count={result.diagnostics.brain.length}>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {result.diagnostics.brain.join('\n')}
                  </pre>
                </Collapsible>
                <Collapsible title="Persist diagnostics" count={result.diagnostics.persist.length}>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                    {result.diagnostics.persist.join('\n')}
                  </pre>
                </Collapsible>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
