import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, CheckCircle, Calendar, Info } from "lucide-react";

interface FeedbackMessage {
  id: string;
  tsIso: string;
  type: 'reflection' | 'post_action' | 'daily_review' | 'system';
  tone: 'neutral' | 'gentle' | 'direct';
  titleHebrew: string;
  bodyHebrew: string;
  microStepHebrew: string;
  related: {
    layer: string;
    entityType: string;
    entityId: string | null;
  };
  ui: {
    showAs: 'card' | 'toast' | 'modal';
    priority: 'low' | 'medium' | 'high';
  };
}

interface FeedbackFeedProps {
  onRefresh?: () => void;
}

export function FeedbackFeed({ onRefresh }: FeedbackFeedProps) {
  const { data, isLoading } = useQuery<{ feedbackFeed: FeedbackMessage[] }>({
    queryKey: ['/api/feedback'],
    refetchInterval: 5000
  });

  const feedbackFeed = data?.feedbackFeed || [];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'reflection':
        return <MessageSquare className="h-4 w-4" />;
      case 'post_action':
        return <CheckCircle className="h-4 w-4" />;
      case 'daily_review':
        return <Calendar className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'reflection':
        return <Badge variant="secondary">שיקוף</Badge>;
      case 'post_action':
        return <Badge variant="default">פעולה</Badge>;
      case 'daily_review':
        return <Badge variant="outline">סיכום יום</Badge>;
      default:
        return <Badge variant="outline">מערכת</Badge>;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-r-4 border-r-destructive';
      case 'medium':
        return 'border-r-4 border-r-yellow-500';
      default:
        return 'border-r-4 border-r-muted';
    }
  };

  const formatTime = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          פיד משוב
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">טוען...</div>
        ) : feedbackFeed.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            אין הודעות משוב עדיין
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {feedbackFeed.map((message) => (
                <Card 
                  key={message.id} 
                  className={`${getPriorityColor(message.ui.priority)}`}
                  data-testid={`feedback-message-${message.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(message.type)}
                        <span className="font-medium">{message.titleHebrew}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTypeBadge(message.type)}
                        <span className="text-xs text-muted-foreground">
                          {formatTime(message.tsIso)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {message.bodyHebrew}
                    </p>
                    {message.microStepHebrew && (
                      <div className="bg-muted/50 rounded p-2 text-sm">
                        <span className="font-medium">צעד הבא: </span>
                        {message.microStepHebrew}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
