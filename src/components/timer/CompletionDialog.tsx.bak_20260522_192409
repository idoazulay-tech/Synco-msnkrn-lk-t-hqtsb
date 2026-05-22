import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CompletionDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onDeny: () => void;
  onDismiss?: () => void;
  isFinal?: boolean;
  taskTitle: string;
}

export const CompletionDialog = ({
  isOpen,
  onConfirm,
  onDeny,
  onDismiss,
  isFinal = false,
  taskTitle,
}: CompletionDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={isFinal ? undefined : (open) => !open && onDismiss?.()}>
      <DialogContent 
        className="sm:max-w-md"
        onInteractOutside={isFinal ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={isFinal ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-bold text-center">
            {isFinal ? 'הזמן נגמר!' : 'סיימת?'}
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            <span className="font-medium text-foreground">{taskTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex justify-center py-6"
        >
          <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
            isFinal ? 'bg-destructive/10' : 'bg-primary/10'
          }`}>
            <span className="text-5xl">
              {isFinal ? '⏰' : '✓'}
            </span>
          </div>
        </motion.div>

        <DialogFooter className="flex gap-3 sm:justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={onDeny}
            className="flex-1 gap-2"
          >
            <X className="w-5 h-5" />
            לא
          </Button>
          <Button
            size="lg"
            onClick={onConfirm}
            className="flex-1 gap-2 bg-success hover:bg-success/90"
          >
            <Check className="w-5 h-5" />
            כן
          </Button>
        </DialogFooter>

        {!isFinal && (
          <p className="text-center text-sm text-muted-foreground mt-2">
            תישאל שוב בעוד מספר דקות
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
