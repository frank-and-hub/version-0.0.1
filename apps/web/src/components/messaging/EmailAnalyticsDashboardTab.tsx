'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import {
  TrendingUp,
  Mail,
  CheckCircle2,
  XCircle,
  Eye,
  MousePointer,
  RefreshCw,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';

interface AnalyticsData {
  counters: {
    total_sent: number;
    delivered: number;
    failed: number;
    bounced: number;
    total_opens: number;
    unique_opens: number;
    total_clicks: number;
    unique_clicks: number;
    spam_reports: number;
    unsubscribes: number;
  };
  rates: {
    delivery_rate: number;
    bounce_rate: number;
    open_rate: number;
    click_rate: number;
  };
  time_series: Array<{
    date: string;
    sent: number;
    delivered: number;
    opens: number;
    clicks: number;
  }>;
}

export const EmailAnalyticsDashboardTab: React.FC<{
  configurations: Array<{ configuration_uuid: string; configuration_name: string; provider: { name: string; slug: string } }>;
}> = ({ configurations }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const url = selectedConfig
        ? `/messaging/analytics?provider_configuration_uuid=${selectedConfig}`
        : '/messaging/analytics';
      const res = (await api.get(url)) as any;
      setData(res?.data || res);
    } catch (err: any) {
      console.error('Failed to load email analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [selectedConfig]);

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <span>Email Analytics & Engagement Telemetry</span>
          </h3>
          <p className="text-xs text-slate-500">
            Real-time delivery rates, verified open/click tracking, and 7-day volume trends
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedConfig}
            onChange={(e) => setSelectedConfig(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
          >
            <option value="">All Providers & Configurations</option>
            {configurations.map((c) => (
              <option key={c.configuration_uuid} value={c.configuration_uuid}>
                {c.configuration_name} ({c.provider.name})
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={loadAnalytics} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {data && (
        <>
          {/* Key Rates Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between text-emerald-600">
                <span className="text-xs font-bold uppercase tracking-wider">Delivery Rate</span>
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {data.rates.delivery_rate}%
                </span>
                <span className="text-xs text-slate-400">
                  ({data.counters.delivered} / {data.counters.total_sent})
                </span>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between text-indigo-600">
                <span className="text-xs font-bold uppercase tracking-wider">Open Rate</span>
                <Eye className="w-5 h-5" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {data.rates.open_rate}%
                </span>
                <span className="text-xs text-slate-400">
                  ({data.counters.unique_opens} unique recipients)
                </span>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between text-cyan-600">
                <span className="text-xs font-bold uppercase tracking-wider">Click Rate</span>
                <MousePointer className="w-5 h-5" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {data.rates.click_rate}%
                </span>
                <span className="text-xs text-slate-400">
                  ({data.counters.unique_clicks} unique recipients)
                </span>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between text-rose-600">
                <span className="text-xs font-bold uppercase tracking-wider">Bounce Rate</span>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {data.rates.bounce_rate}%
                </span>
                <span className="text-xs text-slate-400">
                  ({data.counters.bounced} bounces)
                </span>
              </div>
            </Card>
          </div>

          {/* Time Series Bar Chart Simulation */}
          <Card className="p-6">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
              7-Day Sending & Delivery Volume
            </h4>

            <div className="grid grid-cols-7 gap-2 h-44 items-end pt-4 border-b border-slate-200 dark:border-slate-800">
              {data.time_series.map((item) => {
                const maxSent = Math.max(...data.time_series.map((t) => t.sent), 10);
                const heightPct = Math.round((item.sent / maxSent) * 100);

                return (
                  <div key={item.date} className="flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                      {item.sent}
                    </span>
                    <div className="w-full max-w-[40px] bg-indigo-100 dark:bg-indigo-950/60 rounded-t-lg relative overflow-hidden flex flex-col justify-end" style={{ height: `${Math.max(12, heightPct)}%` }}>
                      <div
                        className="w-full bg-indigo-600 rounded-t-lg transition-all"
                        style={{ height: `${item.sent > 0 ? (item.delivered / item.sent) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-6 mt-4 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-indigo-600 rounded-sm" />
                <span>Delivered Emails</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-indigo-200 dark:bg-indigo-900 rounded-sm" />
                <span>Dispatched / In-Transit</span>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
