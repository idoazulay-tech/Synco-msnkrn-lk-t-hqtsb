import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { GitBranch, Clock, ArrowRight, X } from "lucide-react";

interface PlanChange {
  entityType: 'task' | 'event';
  entityId: string;
  change: 'shorten' | 'move' | 'cancel';
  details: {
    newDuration?: number;
    newStartTime?: string;
    reason?: string;
  };
}

interface PlanOption {
  planId: 'A' | 'B';
  titleHebrew: string;
  summaryHebrew: string;
  changes: PlanChange[];
}

interface PendingPlanProposal {
  id: string;
  createdAtIso: string;
  reason: 'reshuffle';
  plans: PlanOption[];
  expiresAtIso: string;
}

interface PlanChoiceModalProps {
  proposal: PendingPlanProposal | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PlanChoiceModal({ proposal, isOpen, onClose }: PlanChoiceModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'A' | 'B' | null>(null);
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async (planId: 'A' | 'B') => {
      return apiRequest('/api/answer', {
        method: 'POST',
        body: JSON.stringify({
          questionId: 'plan_choice',
          answer: planId
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/state'] });
      onClose();
    }
  });

  const handleSelectPlan = (planId: 'A' | 'B') => {
    setSelectedPlan(planId);
    submitMutation.mutate(planId);
  };

  const getChangeIcon = (change: string) => {
    switch (change) {
      case 'shorten':
        return <Clock className="h-4 w-4" />;
      case 'move':
        return <ArrowRight className="h-4 w-4" />;
      case 'cancel':
        return <X className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getChangeBadge = (change: string) => {
    switch (change) {
      case 'shorten':
        return <Badge variant="secondary">קיצור</Badge>;
      case 'move':
        return <Badge variant="outline">הזזה</Badge>;
      case 'cancel':
        return <Badge variant="destructive">ביטול</Badge>;
      default:
        return null;
    }
  };

  if (!proposal) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="plan-choice-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            בחירת תכנית
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            יש התנגשות בלוח הזמנים. בחר איך לפתור:
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {proposal.plans.map((plan) => (
            <Card 
              key={plan.planId}
              className={`cursor-pointer transition-all ${
                selectedPlan === plan.planId 
                  ? 'ring-2 ring-primary' 
                  : 'hover-elevate'
              }`}
              onClick={() => handleSelectPlan(plan.planId)}
              data-testid={`plan-option-${plan.planId}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="text-lg">{plan.titleHebrew}</span>
                  <Badge variant="outline" className="text-lg">
                    {plan.planId}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3">{plan.summaryHebrew}</p>
                
                {plan.changes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">שינויים:</p>
                    {plan.changes.map((change, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center gap-2 text-sm bg-muted/50 rounded p-2"
                      >
                        {getChangeIcon(change.change)}
                        {getChangeBadge(change.change)}
                        <span className="text-muted-foreground">
                          {change.details.reason || `${change.entityType} ${change.entityId}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button 
            variant="ghost" 
            onClick={onClose}
            disabled={submitMutation.isPending}
            data-testid="button-plan-cancel"
          >
            בטל
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
