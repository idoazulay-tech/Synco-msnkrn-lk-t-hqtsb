import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  User
} from 'lucide-react';
import { Link } from 'react-router-dom';

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

const API_BASE = '/api';

export default function ShikulPage() {
  const queryClient = useQueryClient();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const { data: feedbackData, isLoading: feedbackLoading, refetch: refetchFeedback } = useQuery<FeedbackResponse>({
    queryKey: ['/api/feedback', 20],
    refetchInterval: 5000,
  });

  const { data: stateData, isLoading: stateLoading } = useQuery<StateResponse>({
    queryKey: ['/api/state'],
    refetchInterval: 5000,
  });

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

  const isLoading = feedbackLoading || stateLoading;
  const pendingCheckIn = feedbackData?.pendingCheckIn;
  const pendingPlan = stateData?.pendingPlanProposal;
  const highPriorityFeedback = feedbackData?.feedbackFeed?.filter(f => f.priority === 'high' && !f.dismissed) || [];
  const otherFeedback = feedbackData?.feedbackFeed?.filter(f => f.priority !== 'high' && !f.dismissed).slice(0, 5) || [];

  const hasItems = pendingCheckIn || pendingPlan || highPriorityFeedback.length > 0 || otherFeedback.length > 0;

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
              onClick={() => refetchFeedback()}
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
