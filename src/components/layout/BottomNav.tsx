import { Fragment } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Calendar, CalendarDays, Archive, Settings, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'בית', path: '/' },
  { icon: Calendar, label: 'יום', path: '/day' },
  { icon: CalendarDays, label: 'חודש', path: '/month' },
  { icon: Archive, label: 'ארון', path: '/standby' },
  { icon: Settings, label: 'הגדרות', path: '/settings' },
];

const FAB_SIZE = 56;
const NAV_HEIGHT = 64;
const FAB_OVERLAP = FAB_SIZE * 0.1;

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="fixed bottom-0 inset-x-0">
      <motion.button
        onClick={() => navigate('/add')}
        className="absolute left-1/2 -translate-x-1/2 rounded-full flex items-center justify-center z-30"
        style={{
          width: `${FAB_SIZE}px`,
          height: `${FAB_SIZE}px`,
          bottom: `${NAV_HEIGHT - FAB_OVERLAP}px`,
          background: 'linear-gradient(180deg, #FF6B35 0%, #F7931E 40%, #FFD93D 80%, #FFF8DC 100%)',
          boxShadow: '0 -4px 20px rgba(255, 107, 53, 0.5), 0 0 30px rgba(247, 147, 30, 0.3)',
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        data-testid="button-add-task"
      >
        <Plus className="w-7 h-7 text-white drop-shadow-md" />
      </motion.button>

      <nav className="relative bg-card/95 backdrop-blur-lg border-t border-border safe-area-pb z-40">
        <div className="flex items-center justify-evenly h-16 w-full px-2">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            const insertFabAfter = index === 2;
            
            return (
              <Fragment key={item.path}>
                <button
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
                {insertFabAfter && (
                  <div className="w-14 h-full flex-shrink-0" />
                )}
              </Fragment>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
