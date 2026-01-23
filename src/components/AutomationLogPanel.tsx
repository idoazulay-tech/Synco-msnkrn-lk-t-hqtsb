import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Activity, CheckCircle, XCircle, AlertTriangle, RotateCcw } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  tsIso: string;
  provider: string;
  operation: string;
  entityType: string;
  entityId: string;
  status: 'success' | 'failed' | 'needs_user_action';
  summaryHebrew: string;
  details: any;
}

interface Job {
  id: string;
  createdAtIso: string;
  status: string;
  provider: string;
  operation: string;
  entityType: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
}

export default function AutomationLogPanel() {
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'audit' | 'jobs'>('audit');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [auditRes, jobsRes] = await Promise.all([
        fetch('/api/automation/audit?limit=50'),
        fetch('/api/automation/jobs?limit=20')
      ]);
      const auditData = await auditRes.json();
      const jobsData = await jobsRes.json();
      setAuditLog(auditData.entries || []);
      setJobs(jobsData.jobs || []);
    } catch (error) {
      console.error('Failed to fetch automation data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = async (jobId: string) => {
    try {
      await fetch(`/api/automation/retry/${jobId}`, {
        method: 'POST'
      });
      await fetchData();
    } catch (error) {
      console.error('Failed to retry job:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'needs_user_action':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'queued':
        return <Activity className="w-4 h-4 text-blue-500" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      success: 'default',
      failed: 'destructive',
      needs_user_action: 'outline',
      queued: 'secondary',
      running: 'secondary'
    };
    const labels: Record<string, string> = {
      success: 'הצלחה',
      failed: 'נכשל',
      needs_user_action: 'נדרשת פעולה',
      queued: 'בתור',
      running: 'רץ'
    };
    
    return (
      <Badge 
        variant={variants[status] || 'outline'}
        className={status === 'success' ? 'bg-green-600' : ''}
        data-testid={`badge-status-${status}`}
      >
        {labels[status] || status}
      </Badge>
    );
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Card className="w-full" data-testid="card-automation-log">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5" />
            יומן פעילות
          </CardTitle>
          <CardDescription>מעקב אחר פעולות אוטומטיות</CardDescription>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={fetchData}
          disabled={loading}
          data-testid="button-refresh-log"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button
            variant={activeTab === 'audit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('audit')}
            data-testid="button-tab-audit"
          >
            יומן ({auditLog.length})
          </Button>
          <Button
            variant={activeTab === 'jobs' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('jobs')}
            data-testid="button-tab-jobs"
          >
            משימות ({jobs.length})
          </Button>
        </div>

        <ScrollArea className="h-64">
          {activeTab === 'audit' ? (
            <div className="space-y-2">
              {auditLog.length === 0 ? (
                <div className="text-center text-muted-foreground py-8" data-testid="text-no-audit">
                  אין רשומות ביומן
                </div>
              ) : (
                auditLog.map((entry) => (
                  <div 
                    key={entry.id}
                    className="flex items-start gap-3 p-2 border rounded-md"
                    data-testid={`audit-entry-${entry.id}`}
                  >
                    {getStatusIcon(entry.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(entry.status)}
                        <span className="text-xs text-muted-foreground">
                          {formatTime(entry.tsIso)}
                        </span>
                      </div>
                      <div className="text-sm mt-1 truncate" dir="rtl">
                        {entry.summaryHebrew}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.provider} / {entry.operation} / {entry.entityType}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8" data-testid="text-no-jobs">
                  אין משימות בתור
                </div>
              ) : (
                jobs.map((job) => (
                  <div 
                    key={job.id}
                    className="flex items-start gap-3 p-2 border rounded-md"
                    data-testid={`job-entry-${job.id}`}
                  >
                    {getStatusIcon(job.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(job.status)}
                        <span className="text-xs text-muted-foreground">
                          {formatTime(job.createdAtIso)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({job.attempts}/{job.maxAttempts} ניסיונות)
                        </span>
                      </div>
                      <div className="text-sm mt-1">
                        {job.provider} / {job.operation} / {job.entityType}
                      </div>
                      {job.lastError && (
                        <div className="text-xs text-destructive mt-1 truncate">
                          {job.lastError}
                        </div>
                      )}
                    </div>
                    {(job.status === 'failed' || job.status === 'needs_user_action') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRetry(job.id)}
                        data-testid={`button-retry-${job.id}`}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
