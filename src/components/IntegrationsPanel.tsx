import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Link, Unlink, Calendar, Zap } from 'lucide-react';

interface Integration {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  accountEmail?: string;
}

interface IntegrationsState {
  mock: Integration;
  googleCalendar: Integration;
}

export default function IntegrationsPanel() {
  const [integrations, setIntegrations] = useState<IntegrationsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations');
      const data = await res.json();
      setIntegrations(data.integrations);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleConnect = async (provider: string) => {
    setConnecting(provider);
    try {
      const res = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      });
      const data = await res.json();
      
      if (data.success) {
        await fetchIntegrations();
      } else if (data.status === 'needs_user_action') {
        alert(data.message);
      }
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    setConnecting(provider);
    try {
      await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      });
      await fetchIntegrations();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    } finally {
      setConnecting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-600" data-testid="badge-connected">מחובר</Badge>;
      case 'disconnected':
        return <Badge variant="secondary" data-testid="badge-disconnected">לא מחובר</Badge>;
      case 'error':
        return <Badge variant="destructive" data-testid="badge-error">שגיאה</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-unknown">לא ידוע</Badge>;
    }
  };

  if (loading && !integrations) {
    return (
      <Card className="w-full" data-testid="card-integrations-loading">
        <CardContent className="p-6 text-center text-muted-foreground">
          טוען חיבורים...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full" data-testid="card-integrations">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link className="w-5 h-5" />
            חיבורים
          </CardTitle>
          <CardDescription>ניהול חיבורים לשירותים חיצוניים</CardDescription>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={fetchIntegrations}
          disabled={loading}
          data-testid="button-refresh-integrations"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {integrations && (
          <>
            <div 
              className="flex items-center justify-between p-3 border rounded-md"
              data-testid="integration-mock"
            >
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-yellow-500" />
                <div>
                  <div className="font-medium">Mock Connector</div>
                  <div className="text-sm text-muted-foreground">
                    {integrations.mock.accountEmail || 'לבדיקות בלבד'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(integrations.mock.status)}
                {integrations.mock.status === 'connected' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect('mock')}
                    disabled={connecting === 'mock'}
                    data-testid="button-disconnect-mock"
                  >
                    <Unlink className="w-4 h-4 ml-1" />
                    נתק
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleConnect('mock')}
                    disabled={connecting === 'mock'}
                    data-testid="button-connect-mock"
                  >
                    <Link className="w-4 h-4 ml-1" />
                    חבר
                  </Button>
                )}
              </div>
            </div>

            <div 
              className="flex items-center justify-between p-3 border rounded-md"
              data-testid="integration-google-calendar"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="font-medium">Google Calendar</div>
                  <div className="text-sm text-muted-foreground">
                    {integrations.googleCalendar.accountEmail || 'סנכרון אירועים עם גוגל'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(integrations.googleCalendar.status)}
                {integrations.googleCalendar.status === 'connected' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect('googleCalendar')}
                    disabled={connecting === 'googleCalendar'}
                    data-testid="button-disconnect-google"
                  >
                    <Unlink className="w-4 h-4 ml-1" />
                    נתק
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleConnect('googleCalendar')}
                    disabled={connecting === 'googleCalendar'}
                    data-testid="button-connect-google"
                  >
                    <Link className="w-4 h-4 ml-1" />
                    חבר
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
