import { Bell, Check, Trash2, AlertCircle, CheckCircle, Info, AlertTriangle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNotificationStore, Notification, NotificationType } from '@/store/notificationStore';

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'conflict':
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'reminder':
      return <Clock className="w-4 h-4 text-blue-500" />;
    default:
      return <Info className="w-4 h-4 text-muted-foreground" />;
  }
};

const NotificationItem = ({ notification }: { notification: Notification }) => {
  const { markAsRead, removeNotification } = useNotificationStore();

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className={`p-3 border-b last:border-b-0 ${!notification.read ? 'bg-muted/30' : ''}`}
    >
      <div className="flex gap-2">
        <div className="mt-0.5">
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-sm">{notification.title}</div>
            {!notification.read && (
              <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {notification.message}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true, locale: he })}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {!notification.read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => markAsRead(notification.id)}
              data-testid={`button-mark-read-${notification.id}`}
            >
              <Check className="w-3 h-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={() => removeNotification(notification.id)}
            data-testid={`button-remove-notification-${notification.id}`}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export const NotificationCenter = () => {
  const { notifications, unreadCount, markAllAsRead, clearAll } = useNotificationStore();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold">התראות</div>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                data-testid="button-mark-all-read"
              >
                סמן הכל כנקרא
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <div>אין התראות</div>
            </div>
          ) : (
            <AnimatePresence>
              {notifications.map(notification => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </AnimatePresence>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-muted-foreground"
              onClick={clearAll}
              data-testid="button-clear-all-notifications"
            >
              <Trash2 className="w-4 h-4 ml-2" />
              נקה הכל
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
