import { Bell, Volume2, Vibrate, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotificationStore } from '@/store/notificationStore';

export const NotificationSettings = () => {
  const { settings, updateSettings } = useNotificationStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          הגדרות התראות
        </CardTitle>
        <CardDescription>
          בחר אילו התראות תרצה לקבל
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">סוגי התראות</h4>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <Label htmlFor="conflict-alerts" className="cursor-pointer">
                התראות על חפיפות
              </Label>
            </div>
            <Switch
              id="conflict-alerts"
              checked={settings.conflictAlerts}
              onCheckedChange={(checked) => updateSettings({ conflictAlerts: checked })}
              data-testid="switch-conflict-alerts"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <Label htmlFor="task-reminders" className="cursor-pointer">
                תזכורות משימות
              </Label>
            </div>
            <Switch
              id="task-reminders"
              checked={settings.taskReminders}
              onCheckedChange={(checked) => updateSettings({ taskReminders: checked })}
              data-testid="switch-task-reminders"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <Label htmlFor="completion-alerts" className="cursor-pointer">
                התראות על השלמה
              </Label>
            </div>
            <Switch
              id="completion-alerts"
              checked={settings.completionAlerts}
              onCheckedChange={(checked) => updateSettings({ completionAlerts: checked })}
              data-testid="switch-completion-alerts"
            />
          </div>
        </div>

        <div className="pt-4 border-t space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">אופן ההתראה</h4>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              <Label htmlFor="sound-enabled" className="cursor-pointer">
                צלילים
              </Label>
            </div>
            <Switch
              id="sound-enabled"
              checked={settings.soundEnabled}
              onCheckedChange={(checked) => updateSettings({ soundEnabled: checked })}
              data-testid="switch-sound-enabled"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Vibrate className="w-4 h-4" />
              <Label htmlFor="vibration-enabled" className="cursor-pointer">
                רטט
              </Label>
            </div>
            <Switch
              id="vibration-enabled"
              checked={settings.vibrationEnabled}
              onCheckedChange={(checked) => updateSettings({ vibrationEnabled: checked })}
              data-testid="switch-vibration-enabled"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
