"use client";

import React, { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import {
  Settings,
  Save,
  CheckCircle2,
  Mail,
  Smartphone,
  MessageSquare,
  ShieldCheck,
  RotateCcw,
  Sliders,
  AlertCircle,
} from "lucide-react";

export default function MessagingSettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [settings, setSettings] = useState({
    // Sender Identities
    defaultFromEmail: "notifications@example.com",
    defaultFromName: "Acme Platform Notifications",
    defaultSmsSenderId: "ACMEALERT",
    defaultWhatsAppPhoneId: "109847291847192",

    // Routing & Fallbacks
    primaryChannel: "EMAIL",
    enableFallback: true,
    fallbackChannel: "SMS",
    fallbackDelayMinutes: 60,

    // Queue & Worker Retry Policy
    maxRetryAttempts: 3,
    retryBackoffMultiplier: 2,
    enableDeadLetterQueue: true,

    // Security & Compliance
    enforceHmacVerification: true,
    autoAppendUnsubscribe: true,
    autoAppendSmsStop: true,
    alertEmailOnProviderFailure: "admin@example.com",
  });

  useEffect(() => {
    const stored = localStorage.getItem("monorepo_messaging_settings");
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      localStorage.setItem("monorepo_messaging_settings", JSON.stringify(settings));
      // In production also post to settings endpoint
      try {
        await api.post("/settings/bulk", { settings });
      } catch (ignored) {}

      setFeedback({ type: "success", message: "Messaging platform settings saved successfully." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to save settings." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Messaging Platform", href: "/admin/messaging" },
          { label: "Settings" },
        ]}
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Messaging Platform Settings
                <Badge variant="blue" className="text-xs">
                  Global Policy
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure default sender identities, fallback cascades, retry policies, and compliance headers.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            form="messaging-settings-form"
            variant="primary"
            size="sm"
            disabled={isSaving}
            className="flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500"
              : "bg-red-500/10 border border-red-500/20 text-red-500"
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      <form id="messaging-settings-form" onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Default Sender Identities */}
        <Card className="p-5 border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4 text-blue-500" />
            Default Sender Identities & Branding
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Default sender credentials used when an outbound request does not specify custom overrides.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Default From Email
              </label>
              <Input
                type="email"
                value={settings.defaultFromEmail}
                onChange={(e) => setSettings({ ...settings, defaultFromEmail: e.target.value })}
                required
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Default Sender Display Name
              </label>
              <Input
                value={settings.defaultFromName}
                onChange={(e) => setSettings({ ...settings, defaultFromName: e.target.value })}
                required
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Default SMS Sender ID / Alphanumeric Header
              </label>
              <Input
                value={settings.defaultSmsSenderId}
                onChange={(e) => setSettings({ ...settings, defaultSmsSenderId: e.target.value })}
                className="text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Default WhatsApp Business Phone Number ID
              </label>
              <Input
                value={settings.defaultWhatsAppPhoneId}
                onChange={(e) => setSettings({ ...settings, defaultWhatsAppPhoneId: e.target.value })}
                className="text-xs font-mono"
              />
            </div>
          </div>
        </Card>

        {/* Section 2: Channel Routing & Fallback Cascade */}
        <Card className="p-5 border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
            <Sliders className="w-4 h-4 text-purple-500" />
            Omnichannel Routing & Cascade Fallback
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Automatically re-route undelivered priority alerts through alternate communication channels.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Primary Preferred Channel
                </label>
                <select
                  value={settings.primaryChannel}
                  onChange={(e) => setSettings({ ...settings, primaryChannel: e.target.value })}
                  className="w-full h-9 px-3 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="EMAIL">Email Gateway First</option>
                  <option value="SMS">SMS Gateway First</option>
                  <option value="WHATSAPP">WhatsApp Cloud First</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Fallback Channel (if unread/bounced)
                </label>
                <select
                  value={settings.fallbackChannel}
                  onChange={(e) => setSettings({ ...settings, fallbackChannel: e.target.value })}
                  disabled={!settings.enableFallback}
                  className="w-full h-9 px-3 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                >
                  <option value="SMS">Fallback to SMS</option>
                  <option value="EMAIL">Fallback to Email</option>
                  <option value="WHATSAPP">Fallback to WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Fallback Delay (Minutes)
                </label>
                <Input
                  type="number"
                  value={settings.fallbackDelayMinutes}
                  onChange={(e) => setSettings({ ...settings, fallbackDelayMinutes: parseInt(e.target.value) || 0 })}
                  disabled={!settings.enableFallback}
                  min={5}
                  max={1440}
                  className="text-xs"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableFallback}
                onChange={(e) => setSettings({ ...settings, enableFallback: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary"
              />
              Enable Automatic Fallback Cascades for Critical Notifications
            </label>
          </div>
        </Card>

        {/* Section 3: Worker Queue & Retry Policy */}
        <Card className="p-5 border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
            <RotateCcw className="w-4 h-4 text-amber-500" />
            Queue Processing & Exponential Backoff
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Control worker pool behavior when upstream providers encounter temporary 5xx errors or network drops.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Max Retries Before Dead Letter Queue
              </label>
              <Input
                type="number"
                value={settings.maxRetryAttempts}
                onChange={(e) => setSettings({ ...settings, maxRetryAttempts: parseInt(e.target.value) || 1 })}
                min={1}
                max={10}
                className="text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Provider Alert Email (Incidents & Outages)
              </label>
              <Input
                type="email"
                value={settings.alertEmailOnProviderFailure}
                onChange={(e) => setSettings({ ...settings, alertEmailOnProviderFailure: e.target.value })}
                className="text-xs"
              />
            </div>
          </div>
        </Card>

        {/* Section 4: Compliance Safeguards */}
        <Card className="p-5 border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Regulatory Compliance Enforcements
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Ensure all outbound traffic adheres to international anti-spam legislation and carrier agreements.
          </p>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoAppendUnsubscribe}
                onChange={(e) => setSettings({ ...settings, autoAppendUnsubscribe: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary"
              />
              Automatically inject List-Unsubscribe headers & footer link in HTML emails
            </label>

            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoAppendSmsStop}
                onChange={(e) => setSettings({ ...settings, autoAppendSmsStop: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary"
              />
              Automatically append &ldquo;Reply STOP to unsubscribe&rdquo; to promotional SMS dispatches
            </label>

            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enforceHmacVerification}
                onChange={(e) => setSettings({ ...settings, enforceHmacVerification: e.target.checked })}
                className="rounded border-border text-primary focus:ring-primary"
              />
              Enforce strict HMAC signature verification on all inbound provider webhooks
            </label>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSaving}
            className="flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
