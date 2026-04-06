'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Failed to fetch');
  return r.json();
});

interface AutoProcessorStatus {
  status: 'healthy' | 'warning' | 'error' | 'stopped';
  lastProcessed?: string;
  minutesSinceLastCheck?: number;
  stats: {
    emails: {
      total: number;
      sent: number;
      received: number;
    };
    transcripts: number;
    confidence: {
      average: number;
      high: number;
      medium: number;
      low: number;
    };
  };
}

export function AutoProcessorStatusCard() {
  const { data, error, isLoading } = useQuery<AutoProcessorStatus>({
    queryKey: ['auto-processor-status'],
    queryFn: () => fetcher('/api/admin/auto-processor-status'),
    refetchInterval: 30000 // Refresh every 30 seconds
  });
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📡 Auto-Processor Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-48" />
            <div className="h-4 bg-muted rounded w-32" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📡 Auto-Processor Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Failed to load status</div>
        </CardContent>
      </Card>
    );
  }
  
  if (!data) return null;
  
  const statusConfig = {
    healthy: { icon: '🟢', text: 'Running Smoothly', color: 'text-green-600' },
    warning: { icon: '🟡', text: 'Warning', color: 'text-yellow-600' },
    error: { icon: '🔴', text: 'Error', color: 'text-red-600' },
    stopped: { icon: '⚫', text: 'Stopped', color: 'text-gray-600' }
  };
  
  const config = statusConfig[data.status];
  
  const lastProcessedText = data.lastProcessed && data.minutesSinceLastCheck !== undefined
    ? `${Math.round(data.minutesSinceLastCheck)} minutes ago`
    : 'Never';
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📡 Auto-Processor Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div>
          <div className={`text-lg font-semibold ${config.color}`}>
            {config.icon} {config.text}
          </div>
          <div className="text-sm text-muted-foreground">
            Last processed: {lastProcessedText}
          </div>
        </div>
        
        {/* Stats */}
        <div>
          <div className="text-sm font-medium mb-2">
            📊 Recent Activity (Last 24 Hours)
          </div>
          <div className="border-t pt-3 space-y-3">
            {/* Emails */}
            <div>
              <div className="text-sm font-medium">
                📧 Emails Processed: {data.stats.emails.total}
              </div>
              <div className="text-xs text-muted-foreground ml-4">
                ↗️ Sent: {data.stats.emails.sent} · ↙️ Received: {data.stats.emails.received}
              </div>
            </div>
            
            {/* Transcripts */}
            <div className="text-sm">
              🎙️ Meeting Transcripts: {data.stats.transcripts}
            </div>
            
            {/* Confidence */}
            <div>
              <div className="text-sm font-medium">
                🎯 Avg Confidence: {data.stats.confidence.average}%
              </div>
              <div className="text-xs text-muted-foreground ml-4">
                High (&gt;80%): {data.stats.confidence.high} · 
                Medium: {data.stats.confidence.medium} · 
                Low: {data.stats.confidence.low}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
