import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, Mic, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QuickInputPanel } from './QuickInputPanel';

interface MefraketButtonProps {
  className?: string;
}

export function MefraketButton({ className }: MefraketButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'voice' | null>(null);

  const handleTextClick = () => {
    setInputMode('text');
    setIsOpen(true);
  };

  const handleVoiceClick = () => {
    setInputMode('voice');
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setInputMode(null);
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn(
              "fixed bottom-20 left-1/2 -translate-x-1/2 z-50",
              className
            )}
          >
            <div className="flex items-center gap-1 p-1 rounded-full bg-background/80 backdrop-blur-lg shadow-lg border">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="lg"
                  onClick={handleTextClick}
                  className="rounded-full h-14 w-14 bg-blue-500 hover:bg-blue-600 text-white shadow-lg"
                  data-testid="button-mefraket-text"
                >
                  <Keyboard className="h-6 w-6" />
                </Button>
              </motion.div>
              
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="lg"
                  onClick={handleVoiceClick}
                  className="rounded-full h-14 w-14 bg-orange-500 hover:bg-orange-600 text-white shadow-lg"
                  data-testid="button-mefraket-voice"
                >
                  <Mic className="h-6 w-6" />
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">המפרקט</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  data-testid="button-close-mefraket"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              <QuickInputPanel
                mode={inputMode || 'text'}
                onClose={handleClose}
                onModeChange={setInputMode}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
