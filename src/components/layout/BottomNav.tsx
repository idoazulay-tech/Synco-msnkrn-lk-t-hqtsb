import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Calendar, CalendarDays, MessageSquare, Settings, Archive } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { MefraketButton } from '@/components/mefraket';

const navItems = [
  { icon: Home, label: 'בית', path: '/' },
  { icon: Calendar, label: 'יום', path: '/day' },
  { icon: CalendarDays, label: 'חודש', path: '/month' },
  { icon: Archive, label: 'ארון', path: '/standby' },
  { icon: MessageSquare, label: 'ארגון', path: '/shikul', comingSoon: true },
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
        <div className="flex items-center justify-evenly h-16 w-full px-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isComingSoon = 'comingSoon' in item && item.comingSoon;
            
            return (
              <button
                key={item.path}
                onClick={() => !isComingSoon && navigate(item.path)}
                className={cn(
                  'relative flex flex-col items-center justify-center h-full gap-0.5 px-2',
                  'transition-colors duration-200',
                  isComingSoon
                    ? 'text-muted-foreground/50 cursor-default'
                    : isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                data-testid={`nav-${item.path.slice(1) || 'home'}`}
              >
                {isActive && !isComingSoon && item.path === '/' && (
                  <motion.div
                    layoutId="home-highlight"
                    className="absolute inset-1 rounded-xl border-2 border-primary/60"
                  />
                )}
                {isActive && !isComingSoon && item.path !== '/' && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-px inset-x-2 h-0.5 bg-primary rounded-full"
                  />
                )}
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
                {isComingSoon && (
                  <span className="text-[8px] font-medium text-muted-foreground/60 leading-none mt-0.5">
                    coming soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
