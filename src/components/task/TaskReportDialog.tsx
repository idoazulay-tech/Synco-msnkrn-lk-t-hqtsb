import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, ChevronLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Task } from '@/types/task';
import { TASK_REPORT_OPTIONS } from '@/types/taskReport';
import { analyzeTaskReport } from '@/lib/taskReport/taskReportAnalyzer';
import { TaskReportAnalysis } from '@/types/taskReport';
import { logLearningEvent } from '@/lib/api/learningClient';
import { useTaskReportOptionsStore } from '@/store/taskReportOptionsStore';
import { useTaskStore } from '@/store/taskStore';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const USER_ID = 'default-user';

type DialogStep = 'select' | 'freetext' | 'result';

interface TaskReportDialogProps {
  task: Task;
  onClose: () => void;
  preselectedOption?: string;
}

export const TaskReportDialog = ({ task, onClose, preselectedOption }: TaskReportDialogProps) => {
  const [step, setStep] = useState<DialogStep>('select');
  const [selectedOption, setSelectedOption] = useState<string>(preselectedOption ?? '');
  const [freeText, setFreeText] = useState('');
  const [showSaveCustom, setShowSaveCustom] = useState(false);
  const [customSaved, setCustomSaved] = useState(false);
  const [analysis, setAnalysis] = useState<TaskReportAnalysis | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addedToDescription, setAddedToDescription] = useState(false);

  const { addCustomOption } = useTaskReportOptionsStore();
  const { updateTask } = useTaskStore();

  const selectedLabel = TASK_REPORT_OPTIONS.find((o) => o.id === selectedOption)?.label ?? selectedOption;

  const handleOptionSelect = (optionId: string) => {
    setSelectedOption(optionId);
    if (optionId === 'other') {
      setStep('freetext');
    }
  };

  const handleContinueToFreetext = () => {
    setStep('freetext');
  };

  const handleSkipFreetext = () => {
    submitReport('');
  };

  const handleSubmitFreetext = () => {
    if (selectedOption === 'other' && !freeText.trim()) return;
    submitReport(freeText);
  };

  const submitReport = (text: string) => {
    setSubmitting(true);
    const now = new Date();
    const result = analyzeTaskReport({
      task,
      selectedOption,
      freeText: text,
      now,
    });
    setAnalysis(result);

    const dateIso = now.toISOString().split('T')[0];

    logLearningEvent({
      userId: USER_ID,
      taskId: task.id,
      eventType: 'task_report_submitted' as never,
      source: 'task_report_dialog',
      taskTitleSnapshot: task.title,
      dateIso,
      metadata: {
        scope: 'task_only',
        selectedOption,
        selectedLabel,
        freeText: text || null,
        inputMode: text ? 'text' : 'list',
        normalizedCategory: result.normalizedCategory,
        userIntention: result.userIntention,
        confidence: result.confidence,
        immediateSuggestion: result.immediateSuggestion,
        suggestedActions: result.suggestedActions,
        taskMeaning: result.taskMeaning,
        consequenceIfNotDone: result.consequenceIfNotDone,
        suggestedBreakdown: result.suggestedBreakdown ?? null,
        operationalBlueprint: result.operationalBlueprint ?? null,
        currentTaskState: task.status,
        nowIso: now.toISOString(),
      },
    });

    if (
      selectedOption === 'unclear_first_step' ||
      selectedOption === 'too_big' ||
      selectedOption === 'dependency_missing'
    ) {
      logLearningEvent({
        userId: USER_ID,
        taskId: task.id,
        eventType: 'task_breakdown_requested' as never,
        source: 'task_report_dialog',
        taskTitleSnapshot: task.title,
        dateIso,
        metadata: {
          selectedOption,
          operationalBlueprint: result.operationalBlueprint ?? null,
        },
      });
    }

    if (selectedOption === 'other' && text.trim().length > 3) {
      setShowSaveCustom(true);
    }

    setSubmitting(false);
    setStep('result');
  };

  const handleSaveCustom = () => {
    addCustomOption(freeText.trim());
    setCustomSaved(true);
    setShowSaveCustom(false);
  };

  const handleAddToDescription = () => {
    if (!analysis) return;
    const blueprint = analysis.operationalBlueprint;
    if (!blueprint) return;
    const lines = [
      `פירוק שלבים:`,
      ...blueprint.steps.map((s, i) => `${i + 1}. ${s}`),
    ];
    const addition = lines.join('\n');
    const newDesc = task.description ? `${task.description}\n\n${addition}` : addition;
    try {
      updateTask(task.id, { description: newDesc });
      setAddedToDescription(true);
    } catch {
      logLearningEvent({
        userId: USER_ID,
        taskId: task.id,
        eventType: 'task_breakdown_requested' as never,
        source: 'task_report_dialog_add_desc_fallback',
        taskTitleSnapshot: task.title,
        metadata: { blueprintSteps: blueprint.steps },
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
      data-testid="task-report-dialog-overlay"
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="w-full max-w-lg bg-background rounded-t-2xl border-t border-border flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        data-testid="task-report-dialog"
        dir="rtl"
      >
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-3" />
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-bold">מה קורה עם המשימה הזאת?</h2>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{task.title}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-secondary transition-colors flex-shrink-0"
              data-testid="button-close-report"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          <AnimatePresence mode="wait">
            {step === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-2"
              >
                {TASK_REPORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleOptionSelect(opt.id)}
                    className={cn(
                      'w-full text-right px-4 py-3 rounded-xl border text-sm transition-all',
                      selectedOption === opt.id
                        ? 'border-primary bg-primary/5 text-primary font-medium'
                        : 'border-border hover:border-primary/40 hover:bg-secondary/50'
                    )}
                    data-testid={`report-option-${opt.id}`}
                  >
                    {opt.label}
                  </button>
                ))}

                {selectedOption && selectedOption !== 'other' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pt-2 space-y-2"
                  >
                    <p className="text-sm text-muted-foreground">
                      רוצה להוסיף עוד פרטים כדי שסינקו יבין טוב יותר?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={handleSkipFreetext}
                        data-testid="button-skip-freetext"
                      >
                        דלג
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleContinueToFreetext}
                        data-testid="button-add-details"
                      >
                        הקלד פרטים
                      </Button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {step === 'freetext' && (
              <motion.div
                key="freetext"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStep('select')}
                    className="p-1 rounded-full hover:bg-secondary transition-colors"
                    data-testid="button-back-to-select"
                  >
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <p className="text-sm font-medium">
                    דיווחת: <span className="text-primary">{selectedLabel}</span>
                  </p>
                </div>

                <Textarea
                  placeholder="ספר מה קורה... אין שיפוט, רק מידע שעוזר לסינקו להבין."
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  className="min-h-[100px] text-sm resize-none"
                  dir="rtl"
                  data-testid="input-free-text"
                  autoFocus
                />

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 opacity-50 cursor-not-allowed flex-shrink-0"
                    disabled
                    title="הקלטה תתווסף בקרוב"
                    data-testid="button-voice-disabled"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    הקלטה תתווסף בקרוב
                  </Button>
                </div>

                <div className="flex gap-2">
                  {selectedOption !== 'other' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={handleSkipFreetext}
                      data-testid="button-skip-freetext-2"
                    >
                      דלג
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleSubmitFreetext}
                    disabled={submitting || (selectedOption === 'other' && !freeText.trim())}
                    data-testid="button-submit-report"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'שלח דיווח'
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 'result' && analysis && (
              <motion.div
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-medium">
                      דיווחת: <span className="text-primary">{selectedLabel}</span>
                    </p>
                    <p className="text-sm text-foreground">{analysis.immediateSuggestion}</p>
                  </div>
                </div>

                {analysis.taskMeaning && (
                  <div className="text-xs text-muted-foreground px-1">
                    <span className="font-medium">הקשר המשימה: </span>
                    {analysis.taskMeaning}
                  </div>
                )}

                {analysis.consequenceIfNotDone && (
                  <div className="text-xs text-muted-foreground px-1">
                    <span className="font-medium">שים לב: </span>
                    {analysis.consequenceIfNotDone}
                  </div>
                )}

                {analysis.followUpQuestions && analysis.followUpQuestions.length > 0 && (
                  <div className="p-3 rounded-xl bg-secondary/50 border border-border space-y-1">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">שאלה להבהרה</p>
                    </div>
                    <p className="text-sm">{analysis.followUpQuestions[0]}</p>
                  </div>
                )}

                {analysis.operationalBlueprint && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">סינקו פירק את המשימה לצעד ראשון</p>
                    <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">מטרה</p>
                        <p className="text-sm">{analysis.operationalBlueprint.goal}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">צעד ראשון</p>
                        <p className="text-sm font-medium text-primary">
                          {analysis.operationalBlueprint.firstStep}
                        </p>
                      </div>
                      {analysis.operationalBlueprint.resourcesNeeded.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">צריך</p>
                          <p className="text-sm">
                            {analysis.operationalBlueprint.resourcesNeeded.join(' · ')}
                          </p>
                        </div>
                      )}
                      {analysis.suggestedBreakdown && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">שלבים מוצעים</p>
                          <ol className="space-y-1">
                            {analysis.suggestedBreakdown.steps.map((s, i) => (
                              <li key={i} className="text-xs text-foreground flex gap-1.5">
                                <span className="text-muted-foreground flex-shrink-0">{i + 1}.</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {analysis.operationalBlueprint.assumptions.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">הנחות</p>
                          <p className="text-xs text-muted-foreground">
                            {analysis.operationalBlueprint.assumptions.join(' · ')}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={handleAddToDescription}
                        disabled={addedToDescription}
                        data-testid="button-add-to-description"
                      >
                        {addedToDescription ? '✓ נוסף לתיאור' : 'הוסף לתיאור המשימה'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        onClick={onClose}
                        data-testid="button-blueprint-close"
                      >
                        זה לא מתאים, אשנה ידנית
                      </Button>
                    </div>
                  </div>
                )}

                {showSaveCustom && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl border border-border bg-secondary/30 space-y-2"
                    data-testid="save-custom-option-prompt"
                  >
                    <p className="text-sm">רוצה לשמור את זה כאפשרות קבועה לדיווח?</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowSaveCustom(false)}
                        data-testid="button-no-save-custom"
                      >
                        לא
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleSaveCustom}
                        data-testid="button-save-custom"
                      >
                        כן, שמור
                      </Button>
                    </div>
                  </motion.div>
                )}

                {customSaved && (
                  <p className="text-xs text-muted-foreground text-center" data-testid="text-custom-saved">
                    ✓ נשמר כאפשרות קבועה
                  </p>
                )}

                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground/60">
                    {format(new Date(), "d בMMM yyyy, HH:mm", { locale: he })} · task_only scope
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={onClose}
                  data-testid="button-close-result"
                >
                  סגור
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
