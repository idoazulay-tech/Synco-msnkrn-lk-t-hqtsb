import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TimelinePickerProps {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  onStartChange: (hour: number, minute: number) => void;
  onEndChange: (hour: number, minute: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_WIDTH = 60;

export const TimelinePicker = ({
  startHour,
  startMinute,
  endHour,
  endMinute,
  onStartChange,
  onEndChange,
}: TimelinePickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isDraggingRange, setIsDraggingRange] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialStartHour, setInitialStartHour] = useState(startHour);
  const [initialEndHour, setInitialEndHour] = useState(endHour);

  const startPosition = (startHour + startMinute / 60) * HOUR_WIDTH;
  const endPosition = (endHour + endMinute / 60) * HOUR_WIDTH;

  useEffect(() => {
    if (containerRef.current) {
      const scrollPosition = Math.max(0, startPosition - 100);
      containerRef.current.scrollLeft = scrollPosition;
    }
  }, []);

  const getHourFromPosition = (clientX: number): { hour: number; minute: number } => {
    if (!containerRef.current) return { hour: 0, minute: 0 };
    
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const x = clientX - rect.left + scrollLeft;
    
    const totalMinutes = Math.round((x / HOUR_WIDTH) * 60 / 15) * 15;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    
    return {
      hour: Math.max(0, Math.min(23, hour)),
      minute: Math.max(0, Math.min(45, minute)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'start' | 'end' | 'range') => {
    e.preventDefault();
    setDragStartX(e.clientX);
    setInitialStartHour(startHour);
    setInitialEndHour(endHour);
    
    if (type === 'start') setIsDraggingStart(true);
    else if (type === 'end') setIsDraggingEnd(true);
    else setIsDraggingRange(true);
  };

  const handleTouchStart = (e: React.TouchEvent, type: 'start' | 'end' | 'range') => {
    const touch = e.touches[0];
    setDragStartX(touch.clientX);
    setInitialStartHour(startHour);
    setInitialEndHour(endHour);
    
    if (type === 'start') setIsDraggingStart(true);
    else if (type === 'end') setIsDraggingEnd(true);
    else setIsDraggingRange(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingStart && !isDraggingEnd && !isDraggingRange) return;
      
      if (isDraggingStart) {
        const { hour, minute } = getHourFromPosition(e.clientX);
        if (hour < endHour || (hour === endHour && minute < endMinute)) {
          onStartChange(hour, minute);
        }
      } else if (isDraggingEnd) {
        const { hour, minute } = getHourFromPosition(e.clientX);
        if (hour > startHour || (hour === startHour && minute > startMinute)) {
          onEndChange(hour, minute);
        }
      } else if (isDraggingRange) {
        const deltaX = e.clientX - dragStartX;
        const deltaHours = Math.round(deltaX / HOUR_WIDTH);
        const newStartHour = Math.max(0, Math.min(22, initialStartHour + deltaHours));
        const newEndHour = Math.max(1, Math.min(23, initialEndHour + deltaHours));
        
        if (newEndHour > newStartHour) {
          onStartChange(newStartHour, startMinute);
          onEndChange(newEndHour, endMinute);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
      setIsDraggingRange(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingStart && !isDraggingEnd && !isDraggingRange) return;
      
      const touch = e.touches[0];
      
      if (isDraggingStart) {
        const { hour, minute } = getHourFromPosition(touch.clientX);
        if (hour < endHour || (hour === endHour && minute < endMinute)) {
          onStartChange(hour, minute);
        }
      } else if (isDraggingEnd) {
        const { hour, minute } = getHourFromPosition(touch.clientX);
        if (hour > startHour || (hour === startHour && minute > startMinute)) {
          onEndChange(hour, minute);
        }
      } else if (isDraggingRange) {
        const deltaX = touch.clientX - dragStartX;
        const deltaHours = Math.round(deltaX / HOUR_WIDTH);
        const newStartHour = Math.max(0, Math.min(22, initialStartHour + deltaHours));
        const newEndHour = Math.max(1, Math.min(23, initialEndHour + deltaHours));
        
        if (newEndHour > newStartHour) {
          onStartChange(newStartHour, startMinute);
          onEndChange(newEndHour, endMinute);
        }
      }
    };

    const handleTouchEnd = () => {
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
      setIsDraggingRange(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDraggingStart, isDraggingEnd, isDraggingRange, startHour, endHour, startMinute, endMinute, dragStartX, initialStartHour, initialEndHour]);

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">התחלה:</span>
          <span className="font-bold text-primary" data-testid="text-start-time">
            {formatTime(startHour, startMinute)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">סיום:</span>
          <span className="font-bold text-primary" data-testid="text-end-time">
            {formatTime(endHour, endMinute)}
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative overflow-x-auto pb-2 touch-pan-x"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div
          className="relative h-20"
          style={{ width: HOURS.length * HOUR_WIDTH }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 bg-border rounded-full" />

          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: hour * HOUR_WIDTH, width: HOUR_WIDTH }}
            >
              <div className="h-3 w-px bg-border" />
              <span className={cn(
                "text-xs mt-1",
                hour % 6 === 0 ? "font-medium text-foreground" : "text-muted-foreground"
              )}>
                {hour.toString().padStart(2, '0')}
              </span>
            </div>
          ))}

          <motion.div
            className="absolute top-1/2 -translate-y-1/2 h-3 bg-primary/30 rounded-full cursor-grab active:cursor-grabbing"
            style={{
              left: startPosition,
              width: Math.max(20, endPosition - startPosition),
            }}
            onMouseDown={(e) => handleMouseDown(e, 'range')}
            onTouchStart={(e) => handleTouchStart(e, 'range')}
            data-testid="timeline-range"
          />

          <motion.div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary border-4 border-background cursor-ew-resize shadow-lg",
              isDraggingStart && "ring-4 ring-primary/30"
            )}
            style={{ left: startPosition - 12 }}
            onMouseDown={(e) => handleMouseDown(e, 'start')}
            onTouchStart={(e) => handleTouchStart(e, 'start')}
            whileHover={{ scale: 1.1 }}
            data-testid="timeline-start-handle"
          />

          <motion.div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary border-4 border-background cursor-ew-resize shadow-lg",
              isDraggingEnd && "ring-4 ring-primary/30"
            )}
            style={{ left: endPosition - 12 }}
            onMouseDown={(e) => handleMouseDown(e, 'end')}
            onTouchStart={(e) => handleTouchStart(e, 'end')}
            whileHover={{ scale: 1.1 }}
            data-testid="timeline-end-handle"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        גרור את הנקודות כדי לבחור זמן התחלה וסיום
      </p>
    </div>
  );
};
