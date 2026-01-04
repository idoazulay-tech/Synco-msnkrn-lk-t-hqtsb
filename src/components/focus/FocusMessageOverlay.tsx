import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getZoneForPercentage, getRandomMessage, FocusZone } from '@/lib/focusMessages';

interface FocusMessageOverlayProps {
  percentage: number;
}

export function FocusMessageOverlay({ percentage }: FocusMessageOverlayProps) {
  const [currentMessage, setCurrentMessage] = useState('');
  const [currentZoneId, setCurrentZoneId] = useState<number | null>(null);
  const previousZoneIdRef = useRef<number | null>(null);

  useEffect(() => {
    const zone = getZoneForPercentage(percentage);
    
    if (zone.id !== currentZoneId) {
      if (previousZoneIdRef.current === null || zone.id > previousZoneIdRef.current) {
        setCurrentZoneId(zone.id);
        setCurrentMessage(getRandomMessage(zone));
        previousZoneIdRef.current = zone.id;
      }
    }
  }, [percentage, currentZoneId]);

  useEffect(() => {
    if (currentZoneId === null) {
      const zone = getZoneForPercentage(percentage);
      setCurrentZoneId(zone.id);
      setCurrentMessage(getRandomMessage(zone));
      previousZoneIdRef.current = zone.id;
    }
  }, []);

  if (!currentMessage) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentZoneId}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.3 }}
        className="w-full text-center px-4 py-3"
        data-testid="focus-message-overlay"
      >
        <p 
          className="text-sm font-medium text-primary/80 leading-relaxed"
          data-testid="focus-message-text"
        >
          {currentMessage}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
