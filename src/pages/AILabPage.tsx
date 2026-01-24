import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Send, RefreshCw, Trash2, Clock, CheckCircle2, XCircle, Lock, Unlock, Brain, MessageSquare, Zap, Calendar, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import LearningPanel from '@/components/LearningPanel';
import IntegrationsPanel from '@/components/IntegrationsPanel';
import AutomationLogPanel from '@/components/AutomationLogPanel';
import { FeedbackFeed } from '@/components/FeedbackFeed';
import { DailyReviewCard } from '@/components/DailyReviewCard';
import { CheckInModal } from '@/components/CheckInModal';
import { PlanChoiceModal } from '@/components/PlanChoiceModal';

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'done' | 'canceled';
  mustLock: boolean;
  urgency: 'low' | 'medium' | 'high';
  durationMinutes: number;
  scheduled: { dateIso: string; startTimeIso: string; endTimeIso: string } | null;
}

interface ScheduleBlock {
  id: string;
  type: 'task' | 'event' | 'buffer' | 'free';
  refId: string | null;
  title: string;
  startTimeIso: string;
  endTimeIso: string;
}

interface IntentAnalysis {
  inputType: string;
  primaryIntent: string;
  entities: Record<string, unknown>;
  missingInfo: string[];
  confidenceScore: number;
}

interface DecisionOutput {
  decision: 'execute' | 'ask' | 'reflect' | 'stop';
  reason: string;
  confidence: number;
  actionPlan: { actionType: string };
  question: { shouldAsk: boolean; text: string; questionId: string };
  reflection: { shouldReflect: boolean; text: string; microStep: string };
}

interface UIInstructions {
  showQuestionModal: boolean;
  showReflectionCard: boolean;
  showPlanChoiceModal?: boolean;
  refreshTimeline: boolean;
  refreshTaskList: boolean;
  message: string | null;
  messageType: 'success' | 'warning' | 'error' | 'info' | null;
}

interface PendingPlanProposal {
  id: string;
  createdAtIso: string;
  reason: 'reshuffle';
  plans: Array<{
    planId: 'A' | 'B';
    titleHebrew: string;
    summaryHebrew: string;
    changes: Array<{
      entityType: 'task' | 'event';
      entityId: string;
      change: 'shorten' | 'move' | 'cancel';
      details: { newDuration?: number; newStartTime?: string; reason?: string };
    }>;
  }>;
  expiresAtIso: string;
}

interface CheckInRequest {
  id: string;
  tsIso: string;
  reason: 'duration_mismatch' | 'wrong_intent' | 'stress_signal' | 'automation_failed';
  questionHebrew: string;
  expectedAnswerType: 'choice' | 'free_text' | 'confirm';
  options: string[];
  relatedEntityId?: string;
}

interface DailyReviewData {
  dateIso: string;
  completed: number;
  total: number;
  topBlocker?: string;
  topMust?: string;
  microStep: string;
}

interface AnalyzeResponse {
  input: { text: string };
  intent: IntentAnalysis;
  decision: DecisionOutput;
  state: {
    tasks: Task[];
    scheduleBlocks: ScheduleBlock[];
    pendingPlanProposal?: PendingPlanProposal | null;
  };
  uiInstructions: UIInstructions;
}

interface FeedbackState {
  pendingCheckIns: CheckInRequest[];
  latestDailyReview?: DailyReviewData | null;
}

const API_BASE = '/api';

export default function AILabPage() {
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AnalyzeResponse | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [showQuestion, setShowQuestion] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [questionId, setQuestionId] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [showReflection, setShowReflection] = useState(false);
  const [reflectionText, setReflectionText] = useState('');
  const [message, setMessage] = useState<{ text: string; type: string } | null>(null);
  
  const [pendingPlanProposal, setPendingPlanProposal] = useState<PendingPlanProposal | null>(null);
  const [showPlanChoice, setShowPlanChoice] = useState(false);
  const [currentCheckIn, setCurrentCheckIn] = useState<CheckInRequest | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [dailyReview, setDailyReview] = useState<DailyReviewData | null>(null);

  const { data: feedbackData } = useQuery<FeedbackState>({
    queryKey: ['/api/feedback'],
    refetchInterval: 5000
  });

  useEffect(() => {
    if (feedbackData) {
      if (feedbackData.pendingCheckIns?.length > 0 && !showCheckIn) {
        setCurrentCheckIn(feedbackData.pendingCheckIns[0]);
        setShowCheckIn(true);
      }
      if (feedbackData.latestDailyReview) {
        setDailyReview(feedbackData.latestDailyReview);
      }
    }
  }, [feedbackData, showCheckIn]);

  const showMessage = useCallback((text: string, type: string) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, source: 'text' })
      });
      
      const data: AnalyzeResponse = await response.json();
      setLastAnalysis(data);
      
      if (data.state) {
        setTasks(data.state.tasks || []);
        setBlocks(data.state.scheduleBlocks || []);
        
        if (data.state.pendingPlanProposal) {
          setPendingPlanProposal(data.state.pendingPlanProposal);
          setShowPlanChoice(true);
        }
      }

      if (data.uiInstructions?.showQuestionModal && data.decision.question.shouldAsk) {
        setQuestionText(data.decision.question.text);
        setQuestionId(data.decision.question.questionId);
        setShowQuestion(true);
      }

      if (data.uiInstructions?.showReflectionCard && data.decision.reflection.shouldReflect) {
        setReflectionText(data.decision.reflection.text);
        setShowReflection(true);
      }

      if (data.uiInstructions?.message) {
        showMessage(data.uiInstructions.message, data.uiInstructions.messageType || 'info');
      }

      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });
      setInputText('');
    } catch (error) {
      console.error('Error analyzing:', error);
      showMessage('שגיאה בעיבוד', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = async () => {
    if (!answerText.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answerText, questionId })
      });
      
      const data: AnalyzeResponse = await response.json();
      setLastAnalysis(data);
      
      if (data.state) {
        setTasks(data.state.tasks || []);
        setBlocks(data.state.scheduleBlocks || []);
      }

      setShowQuestion(false);
      setAnswerText('');
      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });

      if (data.uiInstructions?.message) {
        showMessage(data.uiInstructions.message, data.uiInstructions.messageType || 'info');
      }
    } catch (error) {
      console.error('Error answering:', error);
      showMessage('שגיאה בשליחת תשובה', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (action: string, id?: string, entityType?: string, value?: unknown) => {
    try {
      const response = await fetch(`${API_BASE}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id, entityType, value })
      });
      
      const data = await response.json();
      
      if (data.state) {
        setTasks(data.state.tasks || []);
        setBlocks(data.state.scheduleBlocks || []);
      }

      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });

      if (data.uiInstructions?.message) {
        showMessage(data.uiInstructions.message, data.uiInstructions.messageType || 'info');
      }
    } catch (error) {
      console.error('Error performing action:', error);
      showMessage('שגיאה בביצוע פעולה', 'error');
    }
  };

  const loadState = async () => {
    try {
      const response = await fetch(`${API_BASE}/state`);
      const data = await response.json();
      
      if (data.state) {
        setTasks(data.state.tasks || []);
        setBlocks(data.state.scheduleBlocks || []);
        if (data.state.pendingPlanProposal) {
          setPendingPlanProposal(data.state.pendingPlanProposal);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });
    } catch (error) {
      console.error('Error loading state:', error);
    }
  };

  const handleClosePlanChoice = () => {
    setShowPlanChoice(false);
    setPendingPlanProposal(null);
    loadState();
  };

  const handleCloseCheckIn = () => {
    setShowCheckIn(false);
    setCurrentCheckIn(null);
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-red-500/20 text-red-700 dark:text-red-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
      default: return 'bg-green-500/20 text-green-700 dark:text-green-400';
    }
  };

  const getBlockColor = (type: string) => {
    switch (type) {
      case 'task': return 'bg-blue-500/20 border-blue-500';
      case 'event': return 'bg-purple-500/20 border-purple-500';
      case 'buffer': return 'bg-gray-500/10 border-gray-400';
      default: return 'bg-gray-500/10 border-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">AI Lab - המפרקט</h1>
          </div>
          <div className="flex gap-2">
            <Link to="/">
              <Button variant="outline" size="sm" data-testid="button-home">
                <Home className="h-4 w-4 ml-1" />
                בית
              </Button>
            </Link>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadState}
              data-testid="button-refresh-state"
            >
              <RefreshCw className="h-4 w-4 ml-1" />
              רענן
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleAction('reset')}
              data-testid="button-reset"
            >
              <Trash2 className="h-4 w-4 ml-1" />
              אפס
            </Button>
          </div>
        </header>

        {message && (
          <div 
            className={`p-3 rounded-md text-sm ${
              message.type === 'success' ? 'bg-green-500/20 text-green-700' :
              message.type === 'error' ? 'bg-red-500/20 text-red-700' :
              message.type === 'warning' ? 'bg-yellow-500/20 text-yellow-700' :
              'bg-blue-500/20 text-blue-700'
            }`}
            data-testid="text-message"
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  קלט
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="הקלד משהו... למשל: תקבע לי פגישה מחר ב-2"
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    disabled={isLoading}
                    data-testid="input-text"
                  />
                  <Button 
                    onClick={handleAnalyze} 
                    disabled={isLoading || !inputText.trim()}
                    data-testid="button-send"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {lastAnalysis && (
              <>
                <Card data-testid="card-analysis">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      ניתוח כוונה (Intent)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">סוג קלט: </span>
                        <Badge variant="outline" data-testid="badge-input-type">{lastAnalysis.intent.inputType}</Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">כוונה: </span>
                        <Badge data-testid="badge-primary-intent">{lastAnalysis.intent.primaryIntent}</Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">ביטחון: </span>
                        <span className="font-medium" data-testid="text-confidence">{Math.round(lastAnalysis.intent.confidenceScore * 100)}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">חסר: </span>
                        {lastAnalysis.intent.missingInfo.length > 0 
                          ? lastAnalysis.intent.missingInfo.map((m, i) => (
                              <Badge key={i} variant="secondary" className="ml-1" data-testid={`badge-missing-${i}`}>{m}</Badge>
                            ))
                          : <span className="text-green-600" data-testid="text-complete">הכל קיים</span>
                        }
                      </div>
                    </div>
                    {Object.keys(lastAnalysis.intent.entities).length > 0 && (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
                        <div className="text-muted-foreground mb-1">ישויות שזוהו:</div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(lastAnalysis.intent.entities).map(([key, value]) => (
                            value && (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </Badge>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-decision">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      החלטה (Decision)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 flex-wrap">
                      <Badge 
                        data-testid="badge-decision"
                        className={`text-base px-3 py-1 ${
                          lastAnalysis.decision.decision === 'execute' ? 'bg-green-500' :
                          lastAnalysis.decision.decision === 'ask' ? 'bg-blue-500' :
                          lastAnalysis.decision.decision === 'reflect' ? 'bg-purple-500' :
                          'bg-red-500'
                        }`}
                      >
                        {lastAnalysis.decision.decision}
                      </Badge>
                      <span className="text-sm text-muted-foreground" data-testid="text-decision-reason">{lastAnalysis.decision.reason}</span>
                    </div>
                    {lastAnalysis.decision.actionPlan.actionType !== 'none' && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">פעולה: </span>
                        <Badge variant="outline" data-testid="badge-action-type">{lastAnalysis.decision.actionPlan.actionType}</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            <Card data-testid="card-timeline">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  טיימליין
                </CardTitle>
              </CardHeader>
              <CardContent>
                {blocks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-blocks">
                    אין בלוקים מתוזמנים
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blocks.map((block) => (
                      <div 
                        key={block.id}
                        className={`p-3 rounded-md border-r-4 ${getBlockColor(block.type)}`}
                        data-testid={`block-${block.id}`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="font-medium">{block.title}</span>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{formatTime(block.startTimeIso)} - {formatTime(block.endTimeIso)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <FeedbackFeed />
          </div>

          <div className="space-y-4">
            <Card data-testid="card-tasks">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">רשימת משימות</CardTitle>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-tasks">
                    אין משימות
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div 
                        key={task.id}
                        className={`p-3 rounded-md border ${task.status === 'done' ? 'bg-muted/50 opacity-60' : 'bg-card'}`}
                        data-testid={`task-${task.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={task.status === 'done' ? 'line-through' : ''}>
                                {task.title}
                              </span>
                              {task.mustLock && (
                                <Lock className="h-3 w-3 text-red-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge className={`text-xs ${getUrgencyColor(task.urgency)}`}>
                                {task.urgency}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {task.durationMinutes} דק׳
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {task.status === 'pending' && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleAction('mark_done', task.id)}
                                  data-testid={`button-done-${task.id}`}
                                >
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleAction('toggle_must_lock', task.id)}
                                  data-testid={`button-lock-${task.id}`}
                                >
                                  {task.mustLock ? (
                                    <Unlock className="h-4 w-4" />
                                  ) : (
                                    <Lock className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleAction('cancel', task.id, 'task')}
                                  data-testid={`button-cancel-${task.id}`}
                                >
                                  <XCircle className="h-4 w-4 text-red-500" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <DailyReviewCard 
              reviewData={dailyReview} 
              onClose={() => setDailyReview(null)}
            />

            <LearningPanel />
            
            <IntegrationsPanel />
            
            <AutomationLogPanel />
          </div>
        </div>
      </div>

      <Dialog open={showQuestion} onOpenChange={setShowQuestion}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>שאלה</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-lg mb-4">{questionText}</p>
            <Input
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="הקלד את תשובתך..."
              onKeyDown={(e) => e.key === 'Enter' && handleAnswer()}
              data-testid="input-answer"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleAnswer} disabled={!answerText.trim()} data-testid="button-submit-answer">
              שלח
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReflection} onOpenChange={setShowReflection}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              רפלקציה
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-lg">{reflectionText}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowReflection(false)} data-testid="button-close-reflection">
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PlanChoiceModal
        proposal={pendingPlanProposal}
        isOpen={showPlanChoice}
        onClose={handleClosePlanChoice}
      />

      <CheckInModal
        checkIn={currentCheckIn}
        isOpen={showCheckIn}
        onClose={handleCloseCheckIn}
      />
    </div>
  );
}
