import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  MessageSquare, 
  HelpCircle, 
  GitBranch, 
  CheckCircle2, 
  ArrowRight, 
  X, 
  Clock, 
  Lightbulb,
  Home,
  RefreshCw,
  Bot,
  User,
  Send,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'wouter';
import { useMAStore, MAMessage } from '@/store/maStore';
import { useTaskStore } from '@/store/taskStore';
import { addMinutes } from 'date-fns';

interface CheckInRequest {
  id: string;
  tsIso: string;
  reason: 'duration_mismatch' | 'wrong_intent' | 'stress_signal' | 'automation_failed';
  questionHebrew: string;
  expectedAnswerType: 'choice' | 'free_text' | 'confirm';
  options: string[];
  relatedEntityId?: string;
}

interface PlanOption {
  planId: 'A' | 'B';
  titleHebrew: string;
  summaryHebrew: string;
  changes: Array<{
    entityType: 'task' | 'event';
    entityId: string;
    change: 'shorten' | 'move' | 'cancel';
    details: { newDuration?: number; newStartTime?: string; reason?: string };
  }>;
}

interface PendingPlanProposal {
  id: string;
  createdAtIso: string;
  reason: 'reshuffle';
  plans: PlanOption[];
  expiresAtIso: string;
}

interface FeedbackMessage {
  id: string;
  type: 'reflection' | 'post_action' | 'daily_review';
  priority: 'high' | 'medium' | 'low';
  titleHebrew: string;
  bodyHebrew: string;
  microStepHebrew: string;
  tsIso: string;
  dismissed: boolean;
  ui: {
    showAs: 'toast' | 'card' | 'modal';
    autoDismissMs: number | null;
    priority: 'high' | 'medium' | 'low';
  };
}

interface FeedbackResponse {
  feedbackFeed: FeedbackMessage[];
  pendingCheckIn: CheckInRequest | null;
  stats: {
    todayCompleted: number;
    todayTotal: number;
    weeklyAvgCompletion: number;
  };
}

interface StateResponse {
  tasks: unknown[];
  scheduleBlocks: unknown[];
  pendingPlanProposal: PendingPlanProposal | null;
}

interface OrgQuestion {
  id: string;
  textHebrew: string;
  options?: string[];
  expectedAnswerType: 'choice' | 'confirm' | 'duration' | 'free_text' | 'plan_choice' | 'time' | 'date';
  relatedEntityId?: string;
}

interface OrgInquiry {
  id: string;
  createdAtIso: string;
  status: 'pending' | 'resolved';
  reason: 'missing_info' | 'conflict' | 'related_tasks' | 'time_clarification';
  entity: {
    type: 'task' | 'event';
    id: string;
    title: string;
  };
  message: {
    titleHebrew: string;
    bodyHebrew: string;
  };
  question: OrgQuestion;
  meta: {
    missingInfo: string[];
    conflictId?: string;
    relatedIds?: string[];
  };
}

interface OrgFeedResponse {
  pendingInquiries: OrgInquiry[];
  pendingQuestion: OrgQuestion | null;
  summary: {
    pendingCount: number;
    hasActiveQuestion: boolean;
  };
}

const API_BASE = '/api';

export default function ShikulPage() {
  const queryClient = useQueryClient();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  
  // Local MA Store
  const maMessages = useMAStore((state) => state.messages);
  const answerMessage = useMAStore((state) => state.answerMessage);
  const addTask = useTaskStore((state) => state.addTask);
  
  const unansweredMessages = maMessages.filter(m => !m.answered);

  const { data: feedbackData, isLoading: feedbackLoading, refetch: refetchFeedback } = useQuery<FeedbackResponse>({
    queryKey: ['/api/feedback', 20],
    refetchInterval: 5000,
  });

  const { data: stateData, isLoading: stateLoading } = useQuery<StateResponse>({
    queryKey: ['/api/state'],
    refetchInterval: 5000,
  });

  const { data: orgData, isLoading: orgLoading, refetch: refetchOrg } = useQuery<OrgFeedResponse>({
    queryKey: ['/api/org/feed'],
    refetchInterval: 3000,
  });

  const allOrgInquiries = orgData?.pendingInquiries || [];
  const orgInquiries = allOrgInquiries.length > 0 ? [allOrgInquiries[0]] : [];

  const handleCheckInResponse = useCallback(async (checkIn: CheckInRequest, response: string) => {
    setSubmitting(checkIn.id);
    try {
      await fetch(`${API_BASE}/feedback/checkin/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkInId: checkIn.id, response }),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });
    } catch (err) {
      console.error('Failed to respond to check-in:', err);
    } finally {
      setSubmitting(null);
    }
  }, [queryClient]);

  const handlePlanChoice = useCallback(async (planId: 'A' | 'B') => {
    setSubmitting(planId);
    try {
      await fetch(`${API_BASE}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType: 'confirm_plan', planId }),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/state'] });
      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });
    } catch (err) {
      console.error('Failed to confirm plan:', err);
    } finally {
      setSubmitting(null);
    }
  }, [queryClient]);

  const updateResponse = (id: string, text: string) => {
    setResponses(prev => ({ ...prev, [id]: text }));
  };

  const isLoading = feedbackLoading || stateLoading || orgLoading;
  const pendingCheckIn = feedbackData?.pendingCheckIn;
  const pendingPlan = stateData?.pendingPlanProposal;
  const highPriorityFeedback = feedbackData?.feedbackFeed?.filter(f => f.priority === 'high' && !f.dismissed) || [];
  const otherFeedback = feedbackData?.feedbackFeed?.filter(f => f.priority !== 'high' && !f.dismissed).slice(0, 5) || [];

  const hasItems = pendingCheckIn || pendingPlan || highPriorityFeedback.length > 0 || otherFeedback.length > 0 || unansweredMessages.length > 0 || orgInquiries.length > 0;

  const handleOrgInquiryResponse = useCallback(async (inquiry: OrgInquiry, response: string) => {
    if (!response.trim()) return;
    
    setSubmitting(inquiry.id);
    
    try {
      const apiResponse = await fetch('/api/org/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryId: inquiry.id,
          answer: response,
        }),
      });
      
      const result = await apiResponse.json();
      
      if (result.resolved) {
        if (result.entity && result.entity.schedulingStatus === 'scheduled') {
          const now = new Date();
          let startTime = now;
          let endTime = addMinutes(now, 30);
          
          if (result.entity.date) {
            const dateStr = result.entity.date;
            const timeStr = result.entity.time || '12:00';
            startTime = new Date(`${dateStr}T${timeStr}`);
            const duration = result.entity.duration || 30;
            endTime = addMinutes(startTime, duration);
          }
          
          addTask({
            title: result.entity.title,
            startTime,
            endTime,
            duration: result.entity.duration || 30,
            status: startTime > now ? 'pending' : 'in_progress',
            tags: [],
          });
        }
        
        queryClient.invalidateQueries({ queryKey: ['/api/org/feed'] });
        setResponses(prev => ({ ...prev, [inquiry.id]: '' }));
      } else if (result.stillPending) {
        queryClient.invalidateQueries({ queryKey: ['/api/org/feed'] });
        setResponses(prev => ({ ...prev, [inquiry.id]: '' }));
      }
    } catch (err) {
      console.error('Failed to respond to org inquiry:', err);
    } finally {
      setSubmitting(null);
    }
  }, [queryClient, addTask]);

  // Handle answering a local MA message (e.g., providing missing info for task creation)
  const handleMAMessageResponse = async (message: MAMessage, response: string) => {
    if (!response.trim()) return;
    
    setSubmitting(message.id);
    
    try {
      // Send the response back to MA for proper parsing
      // Combine original task context with user response
      const combinedInput = message.taskTitle 
        ? `${message.taskTitle} ${response}` 
        : response;
      
      const apiResponse = await fetch('/api/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: combinedInput }),
      });
      
      if (apiResponse.ok) {
        const result = await apiResponse.json();
        
        // If MA successfully created a task or it's now clear enough
        if (result.action?.type === 'TASK_CREATED' || (result.task && !result.task.needs_clarification)) {
          const now = new Date();
          let startTime: Date = now;
          let endTime: Date = addMinutes(now, 30);
          let taskStatus: 'pending' | 'in_progress' = 'in_progress';
          
          if (result.task?.start_date) {
            const dateParts = result.task.start_date.split('-').map(Number);
            if (dateParts.length === 3) {
              const [year, month, day] = dateParts;
              if (result.task.start_time) {
                const timeParts = result.task.start_time.split(':').map(Number);
                const [hours, minutes] = timeParts;
                startTime = new Date(year, month - 1, day, hours, minutes);
                taskStatus = startTime > now ? 'pending' : 'in_progress';
              } else {
                startTime = new Date(year, month - 1, day, 12, 0);
                taskStatus = 'pending';
              }
              
              // Use end_time from result if available
              if (result.task.end_time) {
                const endTimeParts = result.task.end_time.split(':').map(Number);
                const [endHours, endMinutes] = endTimeParts;
                endTime = new Date(year, month - 1, day, endHours, endMinutes);
              } else {
                endTime = addMinutes(startTime, 30);
              }
            }
          }
          
          const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
          
          addTask({
            title: result.task?.title || message.taskTitle || response,
            startTime,
            endTime,
            duration,
            status: taskStatus,
            tags: [],
            location: result.task?.location || undefined,
          });
          
          // Mark original as answered - task was created
          answerMessage(message.id, response);
        } else if (result.task?.needs_clarification && result.task.clarifying_question) {
          // Still needs more info - add new question to MA store and mark old one answered
          answerMessage(message.id, response);
          useMAStore.getState().addMessage({
            type: 'question',
            text: result.task.clarifying_question,
            taskTitle: result.task.title,
          });
        } else {
          // Just mark as answered even if something unexpected happened
          answerMessage(message.id, response);
        }
      } else {
        // API error - mark as answered but don't create task
        answerMessage(message.id, response);
      }
      
    } catch (err) {
      console.error('Failed to process MA response:', err);
    } finally {
      setSubmitting(null);
      // Clear the response input
      setResponses(prev => ({ ...prev, [message.id]: '' }));
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">ארגון</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                refetchFeedback();
                refetchOrg();
              }}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
            <Link to="/">
              <Button variant="ghost" size="icon" data-testid="button-home">
                <Home className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !hasItems ? (
          <Card className="text-center py-12">
            <CardContent className="flex flex-col items-center gap-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <h3 className="text-lg font-medium">הכל מסודר!</h3>
              <p className="text-muted-foreground">אין הודעות חדשות מ-MA</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Local MA Questions (from input parsing) */}
            {unansweredMessages.length > 0 && (
              <div className="space-y-3">
                {unansweredMessages.map((message) => {
                  const isConflict = message.type === 'conflict';
                  
                  return (
                    <Card 
                      key={message.id} 
                      className={`border-r-4 ${isConflict ? 'border-r-orange-500 bg-orange-50/50 dark:bg-orange-950/20' : 'border-r-blue-500'}`} 
                      data-testid={`card-ma-message-${message.id}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge 
                            variant="secondary" 
                            className={`gap-1 ${isConflict 
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}
                          >
                            {isConflict ? (
                              <>
                                <AlertTriangle className="h-3 w-3" />
                                חפיפה
                              </>
                            ) : (
                              <>
                                <Bot className="h-3 w-3" />
                                MA
                              </>
                            )}
                          </Badge>
                          <CardTitle className="text-base flex-1 text-right">
                            {message.taskTitle ? `לגבי: ${message.taskTitle}` : 'שאלה'}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Show conflict details if available */}
                        {isConflict && message.conflict && (
                          <div className="bg-orange-100/50 dark:bg-orange-900/30 rounded-lg p-3 space-y-2">
                            <div className="text-sm font-medium text-orange-800 dark:text-orange-200">
                              {message.conflict.isRelated ? (
                                <span>{message.conflict.relationReason}</span>
                              ) : (
                                <span>משימות חופפות:</span>
                              )}
                            </div>
                            <ul className="text-sm space-y-1 text-orange-700 dark:text-orange-300">
                              {message.conflict.conflictingTasks.map((task) => (
                                <li key={task.id} className="flex items-center gap-2">
                                  <Clock className="h-3 w-3" />
                                  <span>{task.title}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({new Date(task.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {new Date(task.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })})
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <p className="text-foreground leading-relaxed whitespace-pre-line">{message.text}</p>
                        
                        <div className="flex gap-2">
                          <Input
                            value={responses[message.id] || ''}
                            onChange={(e) => updateResponse(message.id, e.target.value)}
                            placeholder={isConflict ? "למשל: לקפל קודם, 20 דק. אחכ להכניס לארון 15 דק" : "הקלד תשובה..."}
                            className="flex-1"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && responses[message.id]?.trim()) {
                                handleMAMessageResponse(message, responses[message.id]);
                              }
                            }}
                            data-testid={`input-ma-response-${message.id}`}
                          />
                          <Button
                            size="icon"
                            onClick={() => handleMAMessageResponse(message, responses[message.id] || '')}
                            disabled={!responses[message.id]?.trim() || submitting === message.id}
                            data-testid={`button-send-ma-response-${message.id}`}
                          >
                            {submitting === message.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Org Inquiries (from API - persistent pending tasks/events) */}
            {orgInquiries.length > 0 && (
              <div className="space-y-3">
                {allOrgInquiries.length > 1 && (
                  <div className="text-sm text-muted-foreground text-center">
                    שאלה 1 מתוך {allOrgInquiries.length}
                  </div>
                )}
                {orgInquiries.map((inquiry) => {
                  const isConflict = inquiry.reason === 'conflict' || inquiry.reason === 'related_tasks';
                  const isMissingInfo = inquiry.reason === 'missing_info';
                  
                  return (
                    <Card 
                      key={inquiry.id} 
                      className={`border-r-4 ${isConflict 
                        ? 'border-r-orange-500 bg-orange-50/50 dark:bg-orange-950/20' 
                        : isMissingInfo 
                          ? 'border-r-purple-500 bg-purple-50/50 dark:bg-purple-950/20'
                          : 'border-r-blue-500'
                      }`} 
                      data-testid={`card-org-inquiry-${inquiry.id}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge 
                            variant="secondary" 
                            className={`gap-1 ${isConflict 
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' 
                              : isMissingInfo
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}
                          >
                            {isConflict ? (
                              <>
                                <AlertTriangle className="h-3 w-3" />
                                {inquiry.reason === 'related_tasks' ? 'משימות קשורות' : 'חפיפה'}
                              </>
                            ) : isMissingInfo ? (
                              <>
                                <HelpCircle className="h-3 w-3" />
                                חסר מידע
                              </>
                            ) : (
                              <>
                                <Bot className="h-3 w-3" />
                                MA
                              </>
                            )}
                          </Badge>
                          <CardTitle className="text-base flex-1 text-right">
                            {inquiry.message.titleHebrew}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-foreground leading-relaxed">{inquiry.message.bodyHebrew}</p>
                        
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="font-medium text-sm mb-2">{inquiry.question.textHebrew}</p>
                          
                          {inquiry.question.options && inquiry.question.options.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {inquiry.question.options.map((option, idx) => (
                                <Button
                                  key={idx}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    updateResponse(inquiry.id, option);
                                    handleOrgInquiryResponse(inquiry, option);
                                  }}
                                  disabled={submitting === inquiry.id}
                                  data-testid={`button-org-option-${inquiry.id}-${idx}`}
                                >
                                  {option}
                                </Button>
                              ))}
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            <Input
                              value={responses[inquiry.id] || ''}
                              onChange={(e) => updateResponse(inquiry.id, e.target.value)}
                              placeholder="או הקלד תשובה חופשית..."
                              className="flex-1"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && responses[inquiry.id]?.trim()) {
                                  handleOrgInquiryResponse(inquiry, responses[inquiry.id]);
                                }
                              }}
                              data-testid={`input-org-response-${inquiry.id}`}
                            />
                            <Button
                              size="icon"
                              onClick={() => handleOrgInquiryResponse(inquiry, responses[inquiry.id] || '')}
                              disabled={!responses[inquiry.id]?.trim() || submitting === inquiry.id}
                              data-testid={`button-send-org-response-${inquiry.id}`}
                            >
                              {submitting === inquiry.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Pending Check-in */}
            {pendingCheckIn && (
              <Card className="border-r-4 border-r-primary" data-testid="card-checkin">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="gap-1">
                      <HelpCircle className="h-3 w-3" />
                      שאלה
                    </Badge>
                    <CardTitle className="text-base">צריך את התשובה שלך</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-foreground leading-relaxed">{pendingCheckIn.questionHebrew}</p>

                  {pendingCheckIn.expectedAnswerType === 'choice' && (
                    <div className="space-y-2">
                      {pendingCheckIn.options.map((option, idx) => (
                        <Button
                          key={idx}
                          variant={idx === 0 ? 'default' : 'outline'}
                          className="w-full justify-center"
                          onClick={() => handleCheckInResponse(pendingCheckIn, option)}
                          disabled={submitting === pendingCheckIn.id}
                          data-testid={`button-option-${idx}`}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  )}

                  {pendingCheckIn.expectedAnswerType === 'free_text' && (
                    <div className="space-y-3">
                      <Textarea
                        value={responses[pendingCheckIn.id] || ''}
                        onChange={(e) => updateResponse(pendingCheckIn.id, e.target.value)}
                        placeholder="הקלד תשובה..."
                        className="resize-none"
                        data-testid="textarea-response"
                      />
                      <Button
                        onClick={() => handleCheckInResponse(pendingCheckIn, responses[pendingCheckIn.id] || '')}
                        disabled={!responses[pendingCheckIn.id]?.trim() || submitting === pendingCheckIn.id}
                        className="w-full"
                        data-testid="button-submit-response"
                      >
                        שלח
                      </Button>
                    </div>
                  )}

                  {pendingCheckIn.expectedAnswerType === 'confirm' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleCheckInResponse(pendingCheckIn, 'כן')}
                        disabled={submitting === pendingCheckIn.id}
                        className="flex-1"
                        data-testid="button-yes"
                      >
                        כן
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleCheckInResponse(pendingCheckIn, 'לא')}
                        disabled={submitting === pendingCheckIn.id}
                        className="flex-1"
                        data-testid="button-no"
                      >
                        לא
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Pending Plan Proposal */}
            {pendingPlan && (
              <Card className="border-r-4 border-r-amber-500" data-testid="card-plan">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      <GitBranch className="h-3 w-3" />
                      בחירת תוכנית
                    </Badge>
                    <CardTitle className="text-base">התנגשות בלוח הזמנים</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">יש התנגשות בלוח הזמנים. בחר איך לפתור:</p>

                  {pendingPlan.plans.map((plan) => (
                    <Card 
                      key={plan.planId} 
                      className="cursor-pointer hover-elevate"
                      onClick={() => handlePlanChoice(plan.planId)}
                      data-testid={`card-plan-${plan.planId}`}
                    >
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge className="bg-amber-500">{plan.planId}</Badge>
                          <span className="font-medium">{plan.titleHebrew}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{plan.summaryHebrew}</p>
                        
                        {plan.changes.length > 0 && (
                          <div className="border-t pt-3 space-y-2">
                            {plan.changes.map((change, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                                {change.change === 'cancel' && <X className="h-4 w-4 text-red-500" />}
                                {change.change === 'move' && <ArrowRight className="h-4 w-4 text-blue-500" />}
                                {change.change === 'shorten' && <Clock className="h-4 w-4 text-amber-500" />}
                                <span>{change.details.reason || `${change.entityType} - ${change.change}`}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* High Priority Feedback */}
            {highPriorityFeedback.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  פריטים חשובים
                </h2>
                {highPriorityFeedback.map((feedback) => (
                  <Card key={feedback.id} className="border-r-4 border-r-red-500" data-testid={`card-feedback-${feedback.id}`}>
                    <CardContent className="pt-4 space-y-2">
                      <p className="font-medium">{feedback.titleHebrew}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{feedback.bodyHebrew}</p>
                      {feedback.microStepHebrew && (
                        <div className="bg-muted rounded-md p-3 mt-2">
                          <p className="text-sm">
                            <span className="font-medium">צעד הבא: </span>
                            {feedback.microStepHebrew}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Other Feedback */}
            {otherFeedback.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">הודעות נוספות</h2>
                {otherFeedback.map((feedback) => (
                  <Card 
                    key={feedback.id} 
                    className={`border-r-4 ${feedback.priority === 'medium' ? 'border-r-amber-400' : 'border-r-border'}`}
                    data-testid={`card-feedback-${feedback.id}`}
                  >
                    <CardContent className="pt-4 space-y-2">
                      <p className="font-medium text-sm">{feedback.titleHebrew}</p>
                      <p className="text-sm text-muted-foreground">{feedback.bodyHebrew}</p>
                      {feedback.microStepHebrew && (
                        <p className="text-xs text-primary mt-1">
                          צעד הבא: {feedback.microStepHebrew}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
