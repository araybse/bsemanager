'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface CostSummary {
  total: number;
  byCategory: Record<string, number>;
  byProject: Record<string, number>;
  count: number;
  trend: number;
  period: string;
}

export function APICostWidget() {
  const router = useRouter();
  
  const { data, isLoading } = useQuery<CostSummary>({
    queryKey: ['api-costs', 'month'],
    queryFn: () => fetch('/api/costs/summary?period=month').then(r => r.json()),
    refetchInterval: 30000 // 30 seconds
  });
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            API Costs - {new Date().toLocaleDateString('en-US', { month: 'long' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }
  
  const topCategories = Object.entries(data?.byCategory || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          API Costs - {new Date().toLocaleDateString('en-US', { month: 'long' })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Total */}
          <div>
            <div className="text-3xl font-bold">
              ${data?.total.toFixed(2) || '0.00'}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {data?.trend && data.trend > 0 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-red-500" />
                  <span className="text-red-500">↑ {Math.abs(data.trend).toFixed(1)}%</span>
                </>
              ) : data?.trend && data.trend < 0 ? (
                <>
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">↓ {Math.abs(data.trend).toFixed(1)}%</span>
                </>
              ) : (
                <span>No change from last week</span>
              )}
            </div>
          </div>
          
          {/* Top categories */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Top Categories</div>
            {topCategories.map(([category, cost]) => (
              <div key={category} className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground capitalize">
                  {category.replace('-', ' ')}
                </span>
                <span className="text-sm font-medium">
                  ${cost.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          
          {/* Call count */}
          <div className="text-xs text-muted-foreground">
            {data?.count || 0} API calls this month
          </div>
          
          {/* View details button */}
          <Button 
            variant="link" 
            className="p-0 h-auto text-sm"
            onClick={() => router.push('/admin/costs')}
          >
            View detailed breakdown →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
