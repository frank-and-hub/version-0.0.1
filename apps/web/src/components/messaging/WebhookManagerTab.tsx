'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import {
  Webhook,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  ExternalLink,
  Lock,
  Radio,
  FileText,
} from 'lucide-react';

interface WebhookEndpointData {
  endpoint_uuid: string;
  configuration_uuid: string;
  provider_name: string;
  provider_slug: string;
  configuration_name: string;
  webhook_url: string;
  is_active: boolean;
  verification_status: boolean;
  verification_secret: string | null;
  has_verification_secret: boolean;
  total_events_received: number;
  failed_events_count: number;
  last_received_at: string | null;
  last_processed_at: string | null;
  setup_instructions: string;
}

interface WebhookEventItem {
  event_uuid: string;
  provider_event_id: string;
  provider_event_type: string;
  normalized_event_type: string;
  processing_status: string;
  received_at: string;
  processed_at: string | null;
  error_message: string | null;
  payload: any;
  provider_configuration?: {
    configuration_name: string;
    provider: { name: string; slug: string };
  };
}

export const WebhookManagerTab: React.FC<{
  configurations: Array<{ configuration_uuid: string; configuration_name: string; provider: { name: string; slug: string } }>;
}> = ({ configurations }) => {
  const [selectedConfigUuid, setSelectedConfigUuid] = useState<string>(
    configurations[0]?.configuration_uuid || '',
  );
  const [endpointData, setEndpointData] = useState<WebhookEndpointData | null>(null);
  const [events, setEvents] = useState<WebhookEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [isSavingSecret, setIsSavingSecret] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedEventModal, setSelectedEventModal] = useState<WebhookEventItem | null>(null);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);

  useEffect(() => {
    if (configurations.length > 0 && !selectedConfigUuid) {
      setSelectedConfigUuid(configurations[0].configuration_uuid);
    }
  }, [configurations]);

  const loadEndpointAndEvents = async (configUuid: string) => {
    if (!configUuid) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      const [endRes, evRes] = await Promise.allSettled([
        api.get(`/messaging/webhook-endpoints/${configUuid}`),
        api.get(`/messaging/webhook-events?configuration_uuid=${configUuid}&limit=50`),
      ]);

      if (endRes.status === 'fulfilled') {
        const data = (endRes.value as any)?.data || endRes.value;
        setEndpointData(data);
      }
      if (evRes.status === 'fulfilled') {
        const data = (evRes.value as any)?.data?.items || [];
        setEvents(data);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to load webhook metadata' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedConfigUuid) {
      loadEndpointAndEvents(selectedConfigUuid);
    }
  }, [selectedConfigUuid]);

  const handleCopyUrl = () => {
    if (endpointData?.webhook_url) {
      navigator.clipboard.writeText(endpointData.webhook_url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleSaveSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretInput.trim() || !selectedConfigUuid) return;
    setIsSavingSecret(true);
    setFeedback(null);
    try {
      await api.put(`/messaging/webhook-endpoints/${selectedConfigUuid}/secret`, {
        secret: secretInput.trim(),
      });
      setFeedback({
        type: 'success',
        message: 'ECDSA Verification Key / Signing Secret saved successfully!',
      });
      setSecretInput('');
      loadEndpointAndEvents(selectedConfigUuid);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || err?.message || 'Failed to save verification secret',
      });
    } finally {
      setIsSavingSecret(false);
    }
  };

  const handleToggleActive = async (isActive: boolean) => {
    if (!selectedConfigUuid) return;
    try {
      await api.put(`/messaging/webhook-endpoints/${selectedConfigUuid}/status`, {
        is_active: isActive,
      });
      loadEndpointAndEvents(selectedConfigUuid);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Failed to toggle webhook endpoint status' });
    }
  };

  const handleRetryEvent = async (eventUuid: string) => {
    setIsRetrying(eventUuid);
    try {
      await api.post(`/messaging/webhook-events/${eventUuid}/retry`);
      setFeedback({ type: 'success', message: 'Webhook event re-queued and processed successfully!' });
      loadEndpointAndEvents(selectedConfigUuid);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.response?.data?.message || 'Failed to retry event' });
    } finally {
      setIsRetrying(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Provider Configuration Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Webhook className="w-5 h-5 text-indigo-600" />
            <span>Email Webhooks, Verification & Ingestion</span>
          </h3>
          <p className="text-xs text-slate-500">
            Real-time event tracking for SendGrid, delivery verification, and deduplicated logging
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            Active Provider:
          </label>
          <select
            value={selectedConfigUuid}
            onChange={(e) => setSelectedConfigUuid(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {configurations.map((c) => (
              <option key={c.configuration_uuid} value={c.configuration_uuid}>
                {c.configuration_name} ({c.provider.name})
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadEndpointAndEvents(selectedConfigUuid)}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
      )}

      {/* Webhook Endpoint Configuration Card */}
      {endpointData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Unique Dynamic Webhook URL
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={endpointData.is_active ? 'success' : 'default'}>
                  {endpointData.is_active ? 'Endpoint Active' : 'Disabled'}
                </Badge>
                {endpointData.verification_status ? (
                  <Badge variant="indigo">Signed & Verified</Badge>
                ) : (
                  <Badge variant="warning">Unverified</Badge>
                )}
              </div>
            </div>

            {/* URL Display with Copy Button */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                HTTP POST Target URL (SendGrid / Email Provider)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={endpointData.webhook_url}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleCopyUrl}
                  className="flex items-center gap-1.5 whitespace-nowrap"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                </Button>
              </div>
            </div>

            {/* Verification Secret Configuration */}
            <form onSubmit={handleSaveSecret} className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Provider Signing Secret / Verification Key (SendGrid ECDSA Public Key)
                </label>
                <span className="text-[11px] text-slate-400">
                  {endpointData.has_verification_secret ? 'Status: Key Registered (Protected)' : 'No key registered'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  placeholder={
                    endpointData.has_verification_secret
                      ? '•••••••••••••••••••••••••••••••• (Leave empty to keep current)'
                      : 'Paste SendGrid Verification Key / Public Key'
                  }
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={!secretInput.trim() || isSavingSecret}
                >
                  {isSavingSecret ? 'Saving...' : 'Save Key'}
                </Button>
              </div>
            </form>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => handleToggleActive(!endpointData.is_active)}
                className={`font-semibold underline ${
                  endpointData.is_active ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'
                }`}
              >
                {endpointData.is_active ? 'Disable this Webhook Endpoint' : 'Enable Webhook Endpoint'}
              </button>
            </div>
          </Card>

          {/* Quick Metrics & Provider Instructions */}
          <Card className="p-5 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
                Endpoint Performance
              </h4>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-500">Total Events Ingested:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {endpointData.total_events_received}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-500">Failed / Rejected:</span>
                  <span className="font-bold text-rose-600">
                    {endpointData.failed_events_count}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-slate-500">Last Received:</span>
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    {endpointData.last_received_at
                      ? new Date(endpointData.last_received_at).toLocaleTimeString()
                      : 'None'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
              <p className="font-bold">Setup Guide</p>
              <pre className="text-[11px] whitespace-pre-wrap font-sans opacity-90">
                {endpointData.setup_instructions}
              </pre>
            </div>
          </Card>
        </div>
      )}

      {/* Webhook Events Audit Log Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Ingested Webhook Events Log
            </h3>
            <p className="text-xs text-slate-500">
              Deduplicated and normalized provider delivery receipts, opens, clicks, and bounces
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadEndpointAndEvents(selectedConfigUuid)}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reload
          </Button>
        </div>

        {events.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">
            No webhook events received yet for this configuration.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 uppercase font-semibold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Event ID</th>
                  <th className="px-4 py-3">Provider Event</th>
                  <th className="px-4 py-3">Normalized Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Received At</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {events.map((ev) => (
                  <tr key={ev.event_uuid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {ev.provider_event_id.slice(0, 16)}...
                    </td>
                    <td className="px-4 py-3 font-semibold uppercase text-[11px]">
                      {ev.provider_event_type}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          ev.normalized_event_type === 'DELIVERED' ||
                          ev.normalized_event_type === 'OPENED' ||
                          ev.normalized_event_type === 'CLICKED'
                            ? 'success'
                            : ev.normalized_event_type === 'BOUNCED' ||
                              ev.normalized_event_type === 'DROPPED' ||
                              ev.normalized_event_type === 'FAILED'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {ev.normalized_event_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <span
                        className={`text-[11px] font-semibold ${
                          ev.processing_status === 'PROCESSED'
                            ? 'text-emerald-600'
                            : ev.processing_status === 'FAILED'
                            ? 'text-rose-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {ev.processing_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {new Date(ev.received_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedEventModal(ev)}
                        className="px-2 py-1 text-[11px]"
                      >
                        Inspect
                      </Button>
                      {ev.processing_status === 'FAILED' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleRetryEvent(ev.event_uuid)}
                          disabled={isRetrying === ev.event_uuid}
                          className="px-2 py-1 text-[11px]"
                        >
                          {isRetrying === ev.event_uuid ? 'Retrying...' : 'Retry'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Raw Event Inspector Modal */}
      {selectedEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Webhook Event Payload
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedEventModal.provider_event_id}
                </p>
              </div>
              <button
                onClick={() => setSelectedEventModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 pt-4 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                <div>
                  <span className="text-slate-400 block">Normalized Type:</span>
                  <span className="font-bold">{selectedEventModal.normalized_event_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Processing Status:</span>
                  <span className="font-bold">{selectedEventModal.processing_status}</span>
                </div>
              </div>

              {selectedEventModal.error_message && (
                <div className="p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-200">
                  <span className="font-bold block">Error details:</span>
                  <span>{selectedEventModal.error_message}</span>
                </div>
              )}

              <div>
                <span className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Raw Provider JSON Payload
                </span>
                <pre className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-60">
                  {JSON.stringify(selectedEventModal.payload, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedEventModal(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
