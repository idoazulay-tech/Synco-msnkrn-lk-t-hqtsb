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

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="fixed bottom-0 inset-x-0 z-40">
      {/* Sunset FAB - positioned above nav, half hidden like sun touching water */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-16 z-50 pointer-events-none">
        {/* Clip container - shows only top half of the sun */}
        <div className="relative overflow-hidden" style={{ height: '32px' }}>
          <motion.button
            onClick={() => navigate('/add')}
            className="pointer-events-auto w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(180deg, #FF6B35 0%, #F7931E 30%, #FFD93D 70%, #FFF8DC 100%)',
              boxShadow: '0 -4px 20px rgba(255, 107, 53, 0.5), 0 0 30px rgba(247, 147, 30, 0.3)',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            data-testid="button-add-task"
          >
            <Plus className="w-7 h-7 text-white drop-shadow-md" style={{ marginTop: '-16px' }} />
          </motion.button>
        </div>
        
        {/* Reflection effect on the "water" */}
        <div 
          className="absolute left-1/2 -translate-x-1/2 w-12 h-4 blur-sm opacity-30"
          style={{
            background: 'linear-gradient(180deg, #FFD93D 0%, transparent 100%)',
            top: '32px',
          }}
        />
      </div>

      {/* Navigation bar - the "water" */}
      <nav className="bg-card/95 backdrop-blur-lg border-t border-border safe-area-pb">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
          {navItems.slice(0, 2).map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'relative flex flex-col items-center justify-center w-16 h-full gap-1',
                  'transition-colors duration-200',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
                data-testid={`nav-${item.path.slice(1) || 'home'}`}
              >
                {isActive && (
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
          
          {/* Empty space for the FAB */}
          <div className="w-16 h-full" />
          
          {navItems.slice(2).map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'relative flex flex-col items-center justify-center w-16 h-full gap-1',
                  'transition-colors duration-200',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
                data-testid={`nav-${item.path.slice(1)}`}
              >
                {isActive && (
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
