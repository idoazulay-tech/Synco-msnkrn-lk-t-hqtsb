import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { Clock, HelpCircle, Heart, AlertTriangle, MessageCircle } from "lucide-react";

interface CheckInRequest {
  id: string;
  tsIso: string;
  reason: 'duration_mismatch' | 'wrong_intent' | 'stress_signal' | 'automation_failed';
  questionHebrew: string;
  expectedAnswerType: 'choice' | 'free_text' | 'confirm';
  options: string[];
  relatedEntityId?: string;
}

interface CheckInModalProps {
  checkIn: CheckInRequest | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CheckInModal({ checkIn, isOpen, onClose }: CheckInModalProps) {
  const [freeTextAnswer, setFreeTextAnswer] = useState("");
  const queryClient = useQueryClient();

  const respondMutation = useMutation({
    mutationFn: async (response: string) => {
      return apiRequest('/api/feedback/checkin/respond', {
        method: 'POST',
        body: JSON.stringify({
          response,
          checkInId: checkIn?.id
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });
      onClose();
    }
  });

  const handleResponse = (response: string) => {
    respondMutation.mutate(response);
  };

  const handleFreeTextSubmit = () => {
    if (freeTextAnswer.trim()) {
      respondMutation.mutate(freeTextAnswer.trim());
      setFreeTextAnswer("");
    }
  };

  if (!checkIn) return null;

  const getReasonIcon = () => {
    switch (checkIn.reason) {
      case 'duration_mismatch':
        return <Clock className="h-5 w-5" />;
      case 'wrong_intent':
        return <HelpCircle className="h-5 w-5" />;
      case 'stress_signal':
        return <Heart className="h-5 w-5" />;
      case 'automation_failed':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <MessageCircle className="h-5 w-5" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="checkin-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getReasonIcon()}
            שאלה קצרה
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            {checkIn.questionHebrew}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {checkIn.expectedAnswerType === 'choice' && (
            <div className="flex flex-col gap-2">
              {checkIn.options.map((option, index) => (
                <Button
                  key={index}
                  variant={index === 0 ? "default" : "outline"}
                  onClick={() => handleResponse(option)}
                  disabled={respondMutation.isPending}
                  data-testid={`button-checkin-option-${index}`}
                >
                  {option}
                </Button>
              ))}
            </div>
          )}

          {checkIn.expectedAnswerType === 'free_text' && (
            <div className="space-y-3">
              <Textarea
                value={freeTextAnswer}
                onChange={(e) => setFreeTextAnswer(e.target.value)}
                placeholder="הקלד את התשובה שלך..."
                className="min-h-[100px]"
                data-testid="input-checkin-freetext"
              />
              <Button
                onClick={handleFreeTextSubmit}
                disabled={!freeTextAnswer.trim() || respondMutation.isPending}
                className="w-full"
                data-testid="button-checkin-submit"
              >
                שלח
              </Button>
            </div>
          )}

          {checkIn.expectedAnswerType === 'confirm' && (
            <div className="flex gap-2">
              <Button
                onClick={() => handleResponse('כן')}
                disabled={respondMutation.isPending}
                className="flex-1"
                data-testid="button-checkin-confirm"
              >
                כן
              </Button>
              <Button
                variant="outline"
                onClick={() => handleResponse('לא')}
                disabled={respondMutation.isPending}
                className="flex-1"
                data-testid="button-checkin-decline"
              >
                לא
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="ghost" 
            onClick={onClose}
            disabled={respondMutation.isPending}
            data-testid="button-checkin-dismiss"
          >
            דלג
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
