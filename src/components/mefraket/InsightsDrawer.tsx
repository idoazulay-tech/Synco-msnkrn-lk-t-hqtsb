import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface InsightsDrawerProps {
  isOpen: boolean;
  insights: {
    summary: string;
    detected: Record<string, unknown>;
  };
  onClose: () => void;
}

export function InsightsDrawer({ isOpen, insights, onClose }: InsightsDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <Card className="p-4 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Brain className="h-4 w-4" />
                תובנות
              </h4>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="summary" className="flex-1">סיכום</TabsTrigger>
                <TabsTrigger value="detected" className="flex-1">נתונים</TabsTrigger>
              </TabsList>
              
              <TabsContent value="summary" className="mt-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {insights.summary}
                </p>
              </TabsContent>
              
              <TabsContent value="detected" className="mt-4">
                <div className="space-y-2">
                  {Object.entries(insights.detected).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Code className="h-3 w-3 mt-1 text-muted-foreground flex-shrink-0" />
                      <div>
                        <span className="font-mono text-muted-foreground">{key}:</span>
                        <span className="mr-2 font-medium">
                          {typeof value === 'object' 
                            ? JSON.stringify(value) 
                            : String(value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
