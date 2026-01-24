import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar, Target, AlertTriangle, Lightbulb, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface DailyReviewData {
  dateIso: string;
  completed: number;
  total: number;
  topBlocker?: string;
  topMust?: string;
  microStep: string;
}

interface DailyReviewCardProps {
  reviewData?: DailyReviewData | null;
  onClose?: () => void;
}

export function DailyReviewCard({ reviewData, onClose }: DailyReviewCardProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const queryClient = useQueryClient();

  const requestReviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/feedback/daily-review/request', {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });
    }
  });

  const handleRequestReview = async () => {
    setIsRequesting(true);
    try {
      await requestReviewMutation.mutateAsync();
    } finally {
      setIsRequesting(false);
    }
  };

  if (!reviewData) {
    return (
      <Card data-testid="daily-review-request-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            סיכום יום
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            בקש סיכום של הפעילות שלך היום
          </p>
          <Button 
            onClick={handleRequestReview}
            disabled={isRequesting || requestReviewMutation.isPending}
            className="w-full"
            data-testid="button-request-review"
          >
            {isRequesting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin ml-2" />
                מייצר סיכום...
              </>
            ) : (
              'תן סיכום יום'
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const completionRate = reviewData.total > 0 
    ? Math.round((reviewData.completed / reviewData.total) * 100) 
    : 100;

  return (
    <Card data-testid="daily-review-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5" />
          סיכום יום - {new Date(reviewData.dateIso).toLocaleDateString('he-IL')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <span>התקדמות היום</span>
            <span className="font-medium">{reviewData.completed} / {reviewData.total}</span>
          </div>
          <Progress value={completionRate} className="h-2" />
          <p className="text-sm text-muted-foreground mt-1">
            {completionRate}% הושלם
          </p>
        </div>

        {reviewData.topBlocker && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">הדבר הכי תקוע</p>
              <p className="text-sm">{reviewData.topBlocker}</p>
            </div>
          </div>
        )}

        {reviewData.topMust && (
          <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg">
            <Target className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-primary">המשימה הכי חשובה למחר</p>
              <p className="text-sm">{reviewData.topMust}</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
          <Lightbulb className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">הצעד הבא הכי קטן</p>
            <p className="text-sm">{reviewData.microStep}</p>
          </div>
        </div>

        {onClose && (
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="w-full"
            data-testid="button-close-review"
          >
            סגור
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
