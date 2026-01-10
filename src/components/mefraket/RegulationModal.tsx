import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Heart, 
  Eye, 
  MoreHorizontal,
  Play,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Exercise {
  id: string;
  type: 'emotional' | 'sensory' | 'other';
  title: string;
  titleHe: string;
  instructions: string;
  instructionsHe: string;
  duration: number;
}

interface RegulationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeInfo = {
  emotional: {
    label: 'עומס רגשי',
    icon: Heart,
    color: 'text-red-500 bg-red-500/10',
  },
  sensory: {
    label: 'עומס חושי',
    icon: Eye,
    color: 'text-blue-500 bg-blue-500/10',
  },
  other: {
    label: 'אחר',
    icon: MoreHorizontal,
    color: 'text-purple-500 bg-purple-500/10',
  },
};

export function RegulationModal({ isOpen, onClose }: RegulationModalProps) {
  const [selectedType, setSelectedType] = useState<'emotional' | 'sensory' | 'other' | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const fetchExercise = async (type: 'emotional' | 'sensory' | 'other') => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/regulation/exercises/${type}/random`);
      if (response.ok) {
        const data = await response.json();
        setExercise(data);
        setCountdown(data.duration);
      }
    } catch (error) {
      console.error('Error fetching exercise:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeSelect = (type: 'emotional' | 'sensory' | 'other') => {
    setSelectedType(type);
    fetchExercise(type);
  };

  const handleStart = () => {
    if (!exercise) return;
    
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsCompleted(true);
          logCompletion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const logCompletion = async () => {
    if (!exercise || !selectedType) return;
    
    try {
      await fetch('/api/regulation/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          exerciseId: exercise.id,
          userFeedback: { completed: true },
        }),
      });
    } catch (error) {
      console.error('Error logging regulation:', error);
    }
  };

  const handleReset = () => {
    setSelectedType(null);
    setExercise(null);
    setIsCompleted(false);
    setCountdown(0);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">ויסות</DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {!selectedType ? (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-3"
            >
              <p className="text-muted-foreground text-sm text-center mb-4">
                מה אתה מרגיש עכשיו?
              </p>
              
              {(Object.entries(typeInfo) as [keyof typeof typeInfo, typeof typeInfo.emotional][]).map(([type, info]) => {
                const Icon = info.icon;
                return (
                  <Button
                    key={type}
                    variant="outline"
                    className={cn(
                      "w-full h-16 justify-start gap-4",
                      "hover:bg-muted/50"
                    )}
                    onClick={() => handleTypeSelect(type)}
                    data-testid={`button-regulation-${type}`}
                  >
                    <div className={cn("p-2 rounded-full", info.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-lg">{info.label}</span>
                  </Button>
                );
              })}
            </motion.div>
          ) : isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-12"
            >
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </motion.div>
          ) : isCompleted ? (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8 space-y-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
              >
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              </motion.div>
              <h3 className="text-xl font-semibold">כל הכבוד!</h3>
              <p className="text-muted-foreground">סיימת את התרגיל</p>
              <Button onClick={handleClose} className="w-full">
                סיום
              </Button>
            </motion.div>
          ) : exercise ? (
            <motion.div
              key="exercise"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <Card className="p-4 text-center space-y-4">
                <h3 className="text-xl font-semibold">{exercise.titleHe}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {exercise.instructionsHe}
                </p>
                
                <div className="text-4xl font-bold text-primary">
                  {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                </div>
              </Card>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="flex-1"
                >
                  חזרה
                </Button>
                <Button
                  onClick={handleStart}
                  className="flex-1"
                  disabled={countdown === 0 || countdown !== exercise.duration}
                >
                  <Play className="h-4 w-4 ml-2" />
                  התחל
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
