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
  MessageSquare,
  Smartphone,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  BarChart2,
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
  omnichannel?: {
    total_sent: number;
    delivered: number;
    opened_or_read: number;
    clicked: number;
    failed: number;
    bounced: number;
    unsubscribes: number;
    rates: {
      delivery_rate: number;
      open_read_rate: number;
      click_rate: number;
    };
  };
  channels?: {
    email: {
      total_sent: number;
      delivered: number;
      opened: number;
      clicked: number;
      bounced: number;
      failed: number;
      delivery_rate: number;
      open_rate: number;
      click_rate: number;
    };
    whatsapp: {
      total_sent: number;
      delivered: number;
      read: number;
      failed: number;
      delivery_rate: number;
      read_rate: number;
    };
    sms: {
      total_sent: number;
      delivered: number;
      failed: number;
      opt_outs: number;
      delivery_rate: number;
    };
  };
  time_series: Array<{
    date: string;
    sent: number;
    delivered: number;
    opens: number;
    clicks: number;
    email_sent?: number;
    whatsapp_sent?: number;
    sms_sent?: number;
  }>;
}

type ChannelFilter = 'ALL' | 'EMAIL' | 'WHATSAPP' | 'SMS';

export const EmailAnalyticsDashboardTab: React.FC<{
  configurations: Array<{
    configuration_uuid: string;
    configuration_name: string;
    type?: string;
    provider: { name: string; slug: string };
  }>;
}> = ({ configurations }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelFilter>('ALL');
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const filteredConfigurations = configurations.filter((c) => {
    if (activeChannel === 'ALL') return true;
    return c.type?.toUpperCase() === activeChannel;
  });

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const url = selectedConfig
        ? `/messaging/analytics?provider_configuration_uuid=${selectedConfig}`
        : '/messaging/analytics';
      const res = (await api.get(url)) as any;
      setData(res?.data || res);
    } catch (err: any) {
      console.error('Failed to load messaging analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [selectedConfig]);

  // When changing channel filter, clear config if it doesn't match channel
  const handleChannelChange = (ch: ChannelFilter) => {
    setActiveChannel(ch);
    if (selectedConfig && ch !== 'ALL') {
      const current = configurations.find((c) => c.configuration_uuid === selectedConfig);
      if (current && current.type?.toUpperCase() !== ch) {
        setSelectedConfig('');
      }
    }
  };

  const emailData = data?.channels?.email || {
    total_sent: data?.counters?.total_sent || 0,
    delivered: data?.counters?.delivered || 0,
    opened: data?.counters?.unique_opens || 0,
    clicked: data?.counters?.unique_clicks || 0,
    bounced: data?.counters?.bounced || 0,
    failed: data?.counters?.failed || 0,
    delivery_rate: data?.rates?.delivery_rate || 0,
    open_rate: data?.rates?.open_rate || 0,
    click_rate: data?.rates?.click_rate || 0,
  };

  const waData = data?.channels?.whatsapp || {
    total_sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    delivery_rate: 100,
    read_rate: 0,
  };

  const smsData = data?.channels?.sms || {
    total_sent: 0,
    delivered: 0,
    failed: 0,
    opt_outs: 0,
    delivery_rate: 100,
  };

  const omniData = data?.omnichannel || {
    total_sent: emailData.total_sent + waData.total_sent + smsData.total_sent,
    delivered: emailData.delivered + waData.delivered + smsData.delivered,
    opened_or_read: emailData.opened + waData.read,
    clicked: emailData.clicked,
    failed: emailData.failed + waData.failed + smsData.failed,
    bounced: emailData.bounced,
    unsubscribes: (data?.counters?.unsubscribes || 0) + smsData.opt_outs,
    rates: {
      delivery_rate:
        emailData.total_sent + waData.total_sent + smsData.total_sent > 0
          ? Math.round(
              ((emailData.delivered + waData.delivered + smsData.delivered) /
                (emailData.total_sent + waData.total_sent + smsData.total_sent)) *
                100,
            )
          : 100,
      open_read_rate:
        emailData.delivered + waData.delivered > 0
          ? Math.round(
              ((emailData.opened + waData.read) / (emailData.delivered + waData.delivered)) * 100,
            )
          : 0,
      click_rate: emailData.click_rate,
    },
  };

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <span>Omnichannel Delivery & Engagement Telemetry</span>
          </h3>
          <p className="text-xs text-slate-500">
            Real-time delivery confirmation, open & read tracking, clicks, and bounce telemetry across Email, WhatsApp & SMS
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Channel Tabs Filter */}
          <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => handleChannelChange('ALL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeChannel === 'ALL'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Channels</span>
            </button>
            <button
              onClick={() => handleChannelChange('EMAIL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeChannel === 'EMAIL'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>
            <button
              onClick={() => handleChannelChange('WHATSAPP')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeChannel === 'WHATSAPP'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={() => handleChannelChange('SMS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeChannel === 'SMS'
                  ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>SMS</span>
            </button>
          </div>

          {/* Configuration selector */}
          <select
            value={selectedConfig}
            onChange={(e) => setSelectedConfig(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
          >
            <option value="">All Configurations ({filteredConfigurations.length})</option>
            {filteredConfigurations.map((c) => (
              <option key={c.configuration_uuid} value={c.configuration_uuid}>
                {c.configuration_name} ({c.provider.name} - {c.type || 'EMAIL'})
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
          {/* Main Telemetry Rates */}
          {activeChannel === 'ALL' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5 border-l-4 border-l-emerald-500">
                <div className="flex items-center justify-between text-emerald-600">
                  <span className="text-xs font-bold uppercase tracking-wider">Omnichannel Delivery</span>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {omniData.rates.delivery_rate}%
                  </span>
                  <span className="text-xs text-slate-400">
                    ({omniData.delivered} / {omniData.total_sent} messages)
                  </span>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-indigo-500">
                <div className="flex items-center justify-between text-indigo-600">
                  <span className="text-xs font-bold uppercase tracking-wider">Open / Read Rate</span>
                  <Eye className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {omniData.rates.open_read_rate}%
                  </span>
                  <span className="text-xs text-slate-400">
                    ({omniData.opened_or_read} reads & opens)
                  </span>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-cyan-500">
                <div className="flex items-center justify-between text-cyan-600">
                  <span className="text-xs font-bold uppercase tracking-wider">Click-Through Rate</span>
                  <MousePointer className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {omniData.rates.click_rate}%
                  </span>
                  <span className="text-xs text-slate-400">
                    ({omniData.clicked} unique clicks)
                  </span>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-rose-500">
                <div className="flex items-center justify-between text-rose-600">
                  <span className="text-xs font-bold uppercase tracking-wider">Bounce & Failure</span>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {omniData.failed + omniData.bounced}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({omniData.bounced} bounces, {omniData.failed} errors)
                  </span>
                </div>
              </Card>
            </div>
          )}

          {activeChannel === 'EMAIL' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5 border-l-4 border-l-emerald-500">
                <div className="flex items-center justify-between text-emerald-600">
                  <span className="text-xs font-bold uppercase tracking-wider">Email Delivery Rate</span>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {emailData.delivery_rate}%
                  </span>
                  <span className="text-xs text-slate-400">
                    ({emailData.delivered} / {emailData.total_sent})
                  </span>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-indigo-500">
                <div className="flex items-center justify-between text-indigo-600">
                  <span className="text-xs font-bold uppercase tracking-wider">Verified Open Rate</span>
                  <Eye className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {emailData.open_rate}%
                  </span>
                  <span className="text-xs text-slate-400">
                    ({emailData.opened} unique recipients)
                  </span>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-cyan-500">
                <div className="flex items-center justify-between text-cyan-600">
                  <span className="text-xs font-bold uppercase tracking-wider">Email Click Rate</span>
                  <MousePointer className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {emailData.click_rate}%
                  </span>
                  <span className="text-xs text-slate-400">
                    ({emailData.clicked} unique clicks)
                  </span>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-rose-500">
                <div className="flex items-center justify-between text-rose-600">
                  <span className="text-xs font-bold uppercase tracking-wider">Bounces & Spam</span>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {emailData.bounced}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({data.counters.spam_reports} spam reports)
                  </span>
                </div>
              </Card>
            </div>
          )}

          {activeChannel === 'WHATSAPP' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5 border-l-4 border-l-emerald-500">
                <div className="flex items-center justify-between text-emerald-600">
                  <span className="text-xs font-bold uppercase tracking-wider">WhatsApp Delivery Rate</span>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {waData.delivery_rate}%
                  </span>
                  <span className="text-xs text-slate-400">
                    ({waData.delivered} / {waData.total_sent})
                  </span>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-emerald-600">
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="text-xs font-bold uppercase tracking-wider">Read Receipts Rate</span>
                  <Eye className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {waData.read_rate}%
                  </span>
                  <span className="text-xs text-slate-400">
                    ({waData.read} blue check read receipts)
                  </span>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-teal-500">
                <div className="flex items-center justify-between text-teal-600">
                  <span className="text-xs font-bold uppercase tracking-wider">In-Flight / Pending</span>
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {Math.max(0, waData.total_sent - waData.delivered - waData.failed)}
                  </span>
                  <span className="text-xs text-slate-400">
                    dispatched
                  </span>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-rose-500">
                <div className="flex items-center justify-between text-rose-600">
                  <span className="text-xs font-bold uppercase tracking-wider">WhatsApp Errors</span>
                  <XCircle className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {waData.failed}
                  </span>
                  <span className="text-xs text-slate-400">
                    failed dispatches
                  </span>
                </div>
              </Card>
            </div>
          )}

          {activeChannel === 'SMS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5 border-l-4 border-l-cyan-500">
                <div className="flex items-center justify-between text-cyan-600">
                  <span className="text-xs font-bold uppercase tracking-wider">SMS Delivery Rate</span>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {smsData.delivery_rate}%
                  </span>
                  <span className="text-xs text-slate-400">
                    ({smsData.delivered} / {smsData.total_sent})
                  </span>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-blue-500">
                <div className="flex items-center justify-between text-blue-600">
                  <span className="text-xs font-bold uppercase tracking-wider">Carrier Delivered</span>
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {smsData.delivered}
                  </span>
                  <span className="text-xs text-slate-400">
                    handset receipts
                  </span>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-amber-500">
                <div className="flex items-center justify-between text-amber-600">
                  <span className="text-xs font-bold uppercase tracking-wider">TCPA STOP Opt-Outs</span>
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {smsData.opt_outs}
                  </span>
                  <span className="text-xs text-slate-400">
                    inbound opt-outs
                  </span>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-rose-500">
                <div className="flex items-center justify-between text-rose-600">
                  <span className="text-xs font-bold uppercase tracking-wider">Carrier Failures</span>
                  <XCircle className="w-5 h-5" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {smsData.failed}
                  </span>
                  <span className="text-xs text-slate-400">
                    undelivered / rejected
                  </span>
                </div>
              </Card>
            </div>
          )}

          {/* Channel Summary Breakdown Cards when ALL is active */}
          {activeChannel === 'ALL' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 rounded-lg">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase">Email Channel</h4>
                      <p className="text-[10px] text-slate-400">SMTP, SendGrid, Resend, etc.</p>
                    </div>
                  </div>
                  <Badge variant="slate" className="text-[10px]">
                    {emailData.delivery_rate}% Deliv.
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Sent / Deliv.</span>
                    <span className="font-bold text-slate-900 dark:text-white">{emailData.total_sent} / {emailData.delivered}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Unique Opens</span>
                    <span className="font-bold text-indigo-600">{emailData.opened} ({emailData.open_rate}%)</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Unique Clicks</span>
                    <span className="font-bold text-cyan-600">{emailData.clicked} ({emailData.click_rate}%)</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Bounces</span>
                    <span className="font-bold text-rose-600">{emailData.bounced}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 rounded-lg">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase">WhatsApp Channel</h4>
                      <p className="text-[10px] text-slate-400">Meta Cloud API, Interakt, etc.</p>
                    </div>
                  </div>
                  <Badge variant="emerald" className="text-[10px] text-emerald-600 border-emerald-300">
                    {waData.delivery_rate}% Deliv.
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Sent / Deliv.</span>
                    <span className="font-bold text-slate-900 dark:text-white">{waData.total_sent} / {waData.delivered}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Read Receipts</span>
                    <span className="font-bold text-emerald-600">{waData.read} ({waData.read_rate}%)</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block">In-Flight</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {Math.max(0, waData.total_sent - waData.delivered - waData.failed)}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Failed</span>
                    <span className="font-bold text-rose-600">{waData.failed}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 rounded-lg">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase">SMS Channel</h4>
                      <p className="text-[10px] text-slate-400">Twilio, AWS SNS, Vonage, etc.</p>
                    </div>
                  </div>
                  <Badge variant="blue" className="text-[10px] text-cyan-600 border-cyan-300">
                    {smsData.delivery_rate}% Deliv.
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Sent / Deliv.</span>
                    <span className="font-bold text-slate-900 dark:text-white">{smsData.total_sent} / {smsData.delivered}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Carrier Delivered</span>
                    <span className="font-bold text-cyan-600">{smsData.delivered}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block">TCPA STOP</span>
                    <span className="font-bold text-amber-600">{smsData.opt_outs}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block">Undelivered</span>
                    <span className="font-bold text-rose-600">{smsData.failed}</span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* 7-Day Multi-Channel Volume Bar Chart */}
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-600" />
                <span>7-Day Dispatch & Delivery Activity</span>
              </h4>
              <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-indigo-600 rounded-sm" />
                  <span>Email</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                  <span>WhatsApp</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-cyan-500 rounded-sm" />
                  <span>SMS</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 sm:gap-4 h-48 items-end pt-4 border-b border-slate-200 dark:border-slate-800">
              {data.time_series.map((item) => {
                const totalItemSent = (item.email_sent || 0) + (item.whatsapp_sent || 0) + (item.sms_sent || 0) || item.sent || 0;
                const maxSent = Math.max(...data.time_series.map((t) => (t.email_sent || 0) + (t.whatsapp_sent || 0) + (t.sms_sent || 0) || t.sent || 0), 10);
                const heightPct = Math.round((totalItemSent / maxSent) * 100);

                const emailShare = totalItemSent > 0 ? ((item.email_sent || 0) / totalItemSent) * 100 : 0;
                const waShare = totalItemSent > 0 ? ((item.whatsapp_sent || 0) / totalItemSent) * 100 : 0;
                const smsShare = totalItemSent > 0 ? ((item.sms_sent || 0) / totalItemSent) * 100 : 0;

                return (
                  <div key={item.date} className="flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                      {totalItemSent}
                    </span>
                    <div
                      className="w-full max-w-[42px] bg-slate-100 dark:bg-slate-800 rounded-t-lg relative overflow-hidden flex flex-col justify-end"
                      style={{ height: `${Math.max(12, heightPct)}%` }}
                    >
                      {/* Stacked Bars */}
                      <div className="w-full bg-indigo-600 transition-all" style={{ height: `${emailShare}%` }} />
                      <div className="w-full bg-emerald-500 transition-all" style={{ height: `${waShare}%` }} />
                      <div className="w-full bg-cyan-500 transition-all" style={{ height: `${smsShare}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 mt-4 text-xs text-slate-500">
              <span className="text-[11px] text-slate-400">
                Data refreshed dynamically from verified provider webhooks and delivery logs
              </span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-emerald-600 font-semibold">✓ Live Telemetry Connected</span>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
