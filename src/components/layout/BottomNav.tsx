import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Calendar, CalendarDays, Archive, Settings, Keyboard, Mic } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useState } from 'react';
import { MefraketButton } from '@/components/mefraket';

const navItems = [
  { icon: Home, label: 'בית', path: '/' },
  { icon: Calendar, label: 'יום', path: '/day' },
  { icon: CalendarDays, label: 'חודש', path: '/month' },
  { icon: Archive, label: 'ארון', path: '/standby' },
  { icon: Settings, label: 'הגדרות', path: '/settings' },
];

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="fixed bottom-0 inset-x-0 z-40">
      <MefraketButton />
      
      <nav className="relative bg-card/95 backdrop-blur-lg border-t border-border safe-area-pb">
        <div className="absolute top-2 left-2 z-10">
          <NotificationCenter />
        </div>
        <div className="flex items-center justify-evenly h-16 w-full px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'relative flex flex-col items-center justify-center h-full gap-1 px-3',
                  'transition-colors duration-200',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
                data-testid={`nav-${item.path.slice(1) || 'home'}`}
              >
                {isActive && item.path === '/' && (
                  <motion.div
                    layoutId="home-highlight"
                    className="absolute inset-1 rounded-xl border-2 border-primary/60"
                  />
                )}
                {isActive && item.path !== '/' && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-px inset-x-2 h-0.5 bg-primary rounded-full"
                  />
                )}
                <item.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
