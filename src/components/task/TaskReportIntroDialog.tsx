import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, ChevronDown } from 'lucide-react';

const DISMISSED_KEY = 'synco_task_report_intro_dismissed';

export function isTaskReportIntroDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

interface TaskReportIntroDialogProps {
  onClose: () => void;
}

export const TaskReportIntroDialog = ({ onClose }: TaskReportIntroDialogProps) => {
  const [showLearnMore, setShowLearnMore] = useState(false);

  const handleShowAgain = () => {
    onClose();
  };

  const handleNeverShow = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {}
    onClose();
  };

  const handleLearnMore = () => {
    setShowLearnMore(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
      data-testid="task-report-intro-dialog-overlay"
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="w-full max-w-lg bg-background rounded-t-2xl p-6 space-y-4 border-t border-border"
        onClick={(e) => e.stopPropagation()}
        data-testid="task-report-intro-dialog"
        dir="rtl"
      >
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" />
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold">למה לדווח?</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-secondary transition-colors"
            data-testid="button-close-intro"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="text-sm text-muted-foreground space-y-3">
          <p>
            הדיווח עוזר לסינקו להבין מה באמת קורה עם המשימה הזאת: האם חסר זמן, אנרגיה, בהירות,
            משאב, אדם אחר, או החלטה.
          </p>
          <p>
            ככל שתדווח בצורה יותר אמיתית ומדויקת, סינקו ילמד לעזור לך לתכנן טוב יותר, לפרק
            משימות טוב יותר, לזהות דפוסים, ולסנכרן אותך עם המציאות בצורה שמתאימה לך.
          </p>
          <p className="font-medium text-foreground">אין כאן שיפוט. יש כאן מידע שעוזר לסדר את המציאות.</p>
        </div>

        <AnimatePresence>
          {showLearnMore && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="text-sm text-muted-foreground space-y-3 pt-2 border-t border-border">
                <p>סינקו לא משתמש בדיווח כדי לשפוט אותך. הוא משתמש בו כדי להבין מה באמת קורה.</p>
                <p>
                  אם כתבת "אין לי זמן", אבל בפועל לא ברור הצעד הראשון, סינקו יתכנן פתרון לא נכון.
                </p>
                <p>
                  אם כתבת "אין לי כוח", אבל בפועל אתה מחכה למישהו אחר, סינקו צריך לדעת שזו תלות
                  חיצונית ולא בעיית אנרגיה.
                </p>
                <p className="font-medium text-foreground">
                  הדיווח הכי טוב הוא דיווח פשוט ואמיתי: מה קרה? מה חסר? מה עוצר? מה המחיר אם לא
                  עושים? מה הצעד הבא?
                </p>
                <p>
                  ככל שהמידע אמיתי יותר, גם אם הוא לא נעים, סינקו יכול לעזור לך לסנכרן את עצמך
                  טוב יותר עם המציאות.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!showLearnMore && (
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleLearnMore}
            data-testid="button-learn-more"
          >
            <ChevronDown className="w-3 h-3" />
            תרחיב לי ואבין יותר
          </button>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleShowAgain}
            data-testid="button-intro-show-again"
          >
            הבנתי, תראה לי בפעם הבאה
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleNeverShow}
            data-testid="button-intro-never-show"
          >
            הבנתי, אל תראה לי יותר
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
