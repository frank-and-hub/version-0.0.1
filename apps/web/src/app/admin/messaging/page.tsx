"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import {
  ConnectProviderButton,
  ProviderSelectionModal,
  ConnectedProviderCard,
  UserProviderConfiguration,
  WebhookManagerTab,
  EmailMessageDetailsModal,
  EmailAnalyticsDashboardTab,
  WhatsAppMessagingTab,
  SmsMessagingTab,
  MessagingTemplatesTab,
} from "@/components/messaging";
import {
  Mail,
  Send,
  Server,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  RefreshCw,
  Key,
  Trash2,
  Star,
  Settings,
  Webhook,
  TrendingUp,
  Eye,
  X,
  MessageSquare,
  Smartphone,
} from "lucide-react";

interface EmailTemplate {
  template_uuid: string;
  name: string;
  description?: string;
  subject: string;
  html_content: string;
  text_content?: string;
  variables: string[];
  is_active: boolean;
}

interface EmailMessage {
  message_uuid: string;
  subject: string;
  sender_email: string;
  status: string;
  provider_message_id?: string;
  created_at: string;
  last_error?: string;
  recipients: Array<{
    email: string;
    name?: string;
    type: string;
    status: string;
  }>;
  provider?: {
    name: string;
    slug: string;
  };
}

export default function MessagingPage() {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "providers"
    | "whatsapp"
    | "sms"
    | "webhooks"
    | "analytics"
    | "templates"
    | "compose"
    | "history"
  >("overview");
  const [selectedInspectMessageUuid, setSelectedInspectMessageUuid] = useState<
    string | null
  >(null);
  const [stats, setStats] = useState<any>(null);
  const [configurations, setConfigurations] = useState<
    UserProviderConfiguration[]
  >([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Unified Connect Provider Modal State
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] =
    useState<UserProviderConfiguration | null>(null);
  const [modalChannel, setModalChannel] = useState<
    "EMAIL" | "WHATSAPP" | "SMS"
  >("EMAIL");

  // Template Modal state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    subject: "",
    html_content: "",
    text_content: "",
  });

  // Compose State
  const [composeForm, setComposeForm] = useState({
    provider_configuration_uuid: "",
    template_uuid: "",
    recipients: "",
    subject: "",
    html_content: "",
    text_content: "",
    send_async: true,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, configRes, tempRes, histRes] = await Promise.allSettled([
        api.get("/messaging/stats"),
        api.get("/messaging/provider-configurations"),
        api.get("/messaging/templates"),
        api.get("/messaging/emails?limit=50"),
      ]);

      if (statsRes.status === "fulfilled")
        setStats((statsRes.value as any)?.data);
      if (configRes.status === "fulfilled")
        setConfigurations((configRes.value as any)?.data || []);
      if (tempRes.status === "fulfilled")
        setTemplates((tempRes.value as any)?.data || []);
      if (histRes.status === "fulfilled")
        setMessages((histRes.value as any)?.data?.items || []);
    } catch (err: any) {
      console.error("Error fetching messaging state:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openConnectModal = (
    channel: "EMAIL" | "WHATSAPP" | "SMS" = "EMAIL",
  ) => {
    setModalChannel(channel);
    setEditingConfig(null);
    setIsConnectModalOpen(true);
  };

  const handleEditConfig = (config: UserProviderConfiguration) => {
    setModalChannel(
      (config.type as any) === "WHATSAPP"
        ? "WHATSAPP"
        : (config.type as any) === "SMS"
          ? "SMS"
          : "EMAIL",
    );
    setEditingConfig(config);
    setIsConnectModalOpen(true);
  };

  const handleTestConnection = async (configUuid: string) => {
    setActionLoading(`test_${configUuid}`);
    setFeedback(null);
    try {
      const res = (await api.post(
        `/messaging/configurations/${configUuid}/test`,
      )) as any;
      if (res.data?.success) {
        setFeedback({
          type: "success",
          message: res.data?.message || "Connection test succeeded!",
        });
      } else {
        setFeedback({
          type: "error",
          message: res.data?.message || "Connection test failed.",
        });
      }
      await loadData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message ||
          err?.message ||
          "Connection test failed",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetDefault = async (configUuid: string) => {
    setActionLoading(`default_${configUuid}`);
    try {
      await api.patch(
        `/messaging/provider-configurations/${configUuid}/default`,
      );
      setFeedback({
        type: "success",
        message: "Default email provider updated",
      });
      await loadData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: "Failed to set default configuration",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConfig = async (configUuid: string) => {
    if (
      !confirm("Are you sure you want to delete this provider configuration?")
    )
      return;
    setActionLoading(`del_${configUuid}`);
    try {
      await api.delete(`/messaging/provider-configurations/${configUuid}`);
      setFeedback({
        type: "success",
        message: "Configuration deleted successfully",
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: "error", message: "Failed to delete configuration" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("save_template");
    try {
      await api.post("/messaging/templates", templateForm);
      setFeedback({ type: "success", message: "Template saved successfully!" });
      setIsTemplateModalOpen(false);
      setTemplateForm({
        name: "",
        description: "",
        subject: "",
        html_content: "",
        text_content: "",
      });
      await loadData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || "Failed to save template",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("send_email");
    setFeedback(null);
    try {
      const recipientEmails = composeForm.recipients
        .split(/[,;\n]/)
        .map((r) => r.trim())
        .filter(Boolean)
        .map((email) => ({ email, type: "TO" }));

      if (recipientEmails.length === 0) {
        throw new Error("Please enter at least one recipient email address");
      }

      const payload: any = {
        recipients: recipientEmails,
        subject: composeForm.subject,
        html_content: composeForm.html_content,
        text_content: composeForm.text_content || undefined,
        send_async: composeForm.send_async,
      };

      if (composeForm.provider_configuration_uuid) {
        payload.provider_configuration_uuid =
          composeForm.provider_configuration_uuid;
      }
      if (composeForm.template_uuid) {
        payload.template_uuid = composeForm.template_uuid;
      }

      const res = (await api.post("/messaging/emails/send", payload)) as any;
      setFeedback({
        type: "success",
        message: res.data?.message || "Email successfully dispatched / queued!",
      });
      setComposeForm({
        provider_configuration_uuid: "",
        template_uuid: "",
        recipients: "",
        subject: "",
        html_content: "",
        text_content: "",
        send_async: true,
      });
      await loadData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to dispatch email",
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Unified Connect Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Multi-Provider Messaging Platform
            </h1>
            {/* <Badge variant="indigo">
              Phase 1, 2 & 3: Email + Webhooks + WhatsApp
            </Badge> */}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Unified dynamic messaging with Meta WhatsApp Business Cloud API,
            SendGrid/SMTP, AES-256-GCM encryption, Valkey queues, and templates.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <ConnectProviderButton
            onClick={() => openConnectModal("EMAIL")}
            size="sm"
            channel="EMAIL"
          />
          <ConnectProviderButton
            onClick={() => openConnectModal("WHATSAPP")}
            size="sm"
            channel="WHATSAPP"
          />
          <ConnectProviderButton
            onClick={() => openConnectModal("SMS")}
            size="sm"
            channel="SMS"
          />
        </div>
      </div>

      {/* Global Alerts / Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs (Pill / Segmented Controls - No Horizontal Scroll) */}
      <div className="bg-slate-100/80 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-1.5">
          {[
            { id: "overview", label: "Overview", icon: Server },
            { id: "providers", label: "Providers", icon: Key },
            { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
            { id: "sms", label: "SMS", icon: Smartphone },
            { id: "webhooks", label: "Webhooks", icon: Webhook },
            { id: "analytics", label: "Analytics", icon: TrendingUp },
            { id: "templates", label: "Templates", icon: FileText },
            { id: "compose", label: "Compose", icon: Send },
            { id: "history", label: "History", icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold ring-1 ring-slate-200/60 dark:ring-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/50 shadow-none"
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500"}`}
                />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 flex items-center gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Total Emails Sent
                </p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {stats?.total ?? 0}
                </h3>
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Delivered / Accepted
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats?.delivered ?? 0}
                  </h3>
                  <span className="text-xs font-bold text-emerald-600">
                    ({stats?.delivery_rate ?? 100}%)
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-600 dark:text-amber-400">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Valkey Queue Waiting
                </p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {stats?.queue?.waiting ?? 0}
                </h3>
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 rounded-xl text-rose-600 dark:text-rose-400">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Failed Deliveries
                </p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {stats?.failed ?? 0}
                </h3>
              </div>
            </Card>
          </div>

          {/* Connected Providers Section */}
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Connected Email Providers
                </h3>
                <p className="text-xs text-slate-500">
                  Manage your verified SMTP servers and SendGrid API
                  integrations
                </p>
              </div>

              <ConnectProviderButton
                onClick={() => openConnectModal("EMAIL")}
                size="sm"
                channel="EMAIL"
              />
            </div>

            {configurations.filter((c) => c.type === "EMAIL").length === 0 ? (
              <div className="py-10 text-center space-y-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mx-auto text-indigo-600">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    No Email Providers Connected
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Connect your SMTP server or SendGrid account with a single
                    click to enable outbound notifications.
                  </p>
                </div>
                {/* <ConnectProviderButton
                  onClick={() => openConnectModal("EMAIL")}
                  size="sm"
                  channel="EMAIL"
                /> */}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {configurations
                  .filter((c) => c.type === "EMAIL")
                  .map((config) => (
                    <ConnectedProviderCard
                      key={config.configuration_uuid}
                      configuration={config}
                      onEdit={handleEditConfig}
                      onTest={handleTestConnection}
                      onSetDefault={handleSetDefault}
                      onDelete={handleDeleteConfig}
                      isActionLoading={actionLoading?.includes(
                        config.configuration_uuid,
                      )}
                    />
                  ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: PROVIDERS CATALOG / MANAGER */}
      {activeTab === "providers" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Email Provider Connections
              </h3>
              <p className="text-xs text-slate-500">
                Add and manage multi-tenant SMTP and SendGrid API credentials
                with zero plaintext exposure.
              </p>
            </div>

            <ConnectProviderButton
              onClick={() => openConnectModal("EMAIL")}
              size="sm"
              channel="EMAIL"
            />
          </div>

          {/* Cards for configured email providers */}
          {configurations.filter((c) => c.type === "EMAIL").length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {configurations
                .filter((c) => c.type === "EMAIL")
                .map((config) => (
                  <ConnectedProviderCard
                    key={config.configuration_uuid}
                    configuration={config}
                    onEdit={handleEditConfig}
                    onTest={handleTestConnection}
                    onSetDefault={handleSetDefault}
                    onDelete={handleDeleteConfig}
                    isActionLoading={actionLoading?.includes(
                      config.configuration_uuid,
                    )}
                  />
                ))}
            </div>
          )}

          {configurations.filter((c) => c.type === "EMAIL").length === 0 && (
            <Card className="p-8 text-center space-y-3">
              <p className="text-sm text-slate-500">
                No active email provider configurations found. Click below to
                connect your first email provider.
              </p>
              {/* <ConnectProviderButton
                onClick={() => openConnectModal("EMAIL")}
                channel="EMAIL"
              /> */}
            </Card>
          )}
        </div>
      )}

      {/* TAB: WHATSAPP BUSINESS PLATFORM */}
      {activeTab === "whatsapp" && (
        <WhatsAppMessagingTab
          configurations={configurations}
          onOpenConnectModal={(ch) => openConnectModal(ch || "WHATSAPP")}
          onEditConfig={handleEditConfig}
          onRefresh={loadData}
        />
      )}

      {/* TAB: SMS PLATFORM */}
      {activeTab === "sms" && (
        <SmsMessagingTab
          configurations={configurations}
          onOpenConnectModal={(ch) => openConnectModal(ch || "SMS")}
          onEditConfig={handleEditConfig}
          onRefresh={loadData}
        />
      )}

      {/* TAB: WEBHOOKS & DELIVERY EVENTS */}
      {activeTab === "webhooks" && (
        <WebhookManagerTab configurations={configurations} />
      )}

      {/* TAB: ENGAGEMENT ANALYTICS DASHBOARD */}
      {activeTab === "analytics" && (
        <EmailAnalyticsDashboardTab configurations={configurations} />
      )}

      {/* TAB: TEMPLATES STUDIO (EMAIL, WHATSAPP, SMS WITH REAL-TIME PREVIEWS) */}
      {activeTab === "templates" && (
        <MessagingTemplatesTab
          configurations={configurations}
          onUseInComposer={(channel, tpl) => {
            if (channel === "EMAIL") {
              setComposeForm((prev) => ({
                ...prev,
                template_uuid: tpl.template_uuid,
                subject: tpl.subject,
                html_content: tpl.html_content,
              }));
              setActiveTab("compose");
            } else if (channel === "WHATSAPP") {
              setActiveTab("whatsapp");
            } else if (channel === "SMS") {
              setActiveTab("sms");
            }
          }}
        />
      )}

      {/* TAB 4: COMPOSE & SEND */}
      {activeTab === "compose" && (
        <Card className="p-6 max-w-4xl mx-auto">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Send Email Message
            </h3>
            <p className="text-xs text-slate-500">
              Deliver emails immediately or background queue via Valkey with
              automatic exponential backoff
            </p>
          </div>

          <form onSubmit={handleSendEmail} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Select Provider Configuration
                </label>
                <select
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white "
                  value={composeForm.provider_configuration_uuid}
                  onChange={(e) =>
                    setComposeForm({
                      ...composeForm,
                      provider_configuration_uuid: e.target.value,
                    })
                  }
                >
                  <option value="">Default Provider (Auto-resolved)</option>
                  {configurations.map((c) => (
                    <option
                      key={c.configuration_uuid}
                      value={c.configuration_uuid}
                    >
                      {c.configuration_name} ({c.provider.name}){" "}
                      {c.is_default ? "★ Default" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Load From Template (Optional)
                </label>
                <select
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white "
                  value={composeForm.template_uuid}
                  onChange={(e) => {
                    const tpl = templates.find(
                      (t) => t.template_uuid === e.target.value,
                    );
                    setComposeForm({
                      ...composeForm,
                      template_uuid: e.target.value,
                      subject: tpl ? tpl.subject : composeForm.subject,
                      html_content: tpl
                        ? tpl.html_content
                        : composeForm.html_content,
                    });
                  }}
                >
                  <option value="">Select a template...</option>
                  {templates.map((t) => (
                    <option key={t.template_uuid} value={t.template_uuid}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Input
                label="Recipients (Comma or line separated)"
                placeholder="alice@example.com, bob@example.com"
                value={composeForm.recipients}
                onChange={(e) =>
                  setComposeForm({ ...composeForm, recipients: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Input
                label="Subject Line"
                placeholder="Important: Update on your account"
                value={composeForm.subject}
                onChange={(e) =>
                  setComposeForm({ ...composeForm, subject: e.target.value })
                }
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                HTML Content
              </label>
              <textarea
                rows={6}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white "
                placeholder="<p>Hello world! This is a transactional notification.</p>"
                value={composeForm.html_content}
                onChange={(e) =>
                  setComposeForm({
                    ...composeForm,
                    html_content: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sendAsync"
                checked={composeForm.send_async}
                onChange={(e) =>
                  setComposeForm({
                    ...composeForm,
                    send_async: e.target.checked,
                  })
                }
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="sendAsync"
                className="text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Send asynchronously via Valkey background queue (recommended for
                high throughput)
              </label>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <Button
                type="submit"
                variant="primary"
                disabled={actionLoading === "send_email"}
                className="flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                {actionLoading === "send_email"
                  ? "Dispatching..."
                  : "Send Message"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* TAB 5: DELIVERY HISTORY */}
      {activeTab === "history" && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Email Delivery Log
              </h3>
              <p className="text-xs text-slate-500">
                Audit trail of all dispatched and queued email messages
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-1" /> Reload
            </Button>
          </div>

          {messages.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">
              No email delivery history found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/50 uppercase font-semibold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Recipients</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Provider Message ID / Error</th>
                    <th className="px-4 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {messages.map((m) => (
                    <tr
                      key={m.message_uuid}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {m.subject}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {m.recipients.map((r, i) => (
                            <div
                              key={i}
                              className="text-slate-600 dark:text-slate-300 font-mono text-[11px]"
                            >
                              {r.email}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {m.provider?.name || "SMTP"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            m.status === "ACCEPTED" || m.status === "DELIVERED"
                              ? "success"
                              : m.status === "FAILED"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {m.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-[11px]">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500 max-w-xs truncate">
                        {m.last_error ? (
                          <span className="text-rose-600 font-sans">
                            {m.last_error}
                          </span>
                        ) : (
                          m.provider_message_id || "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedInspectMessageUuid(m.message_uuid)
                          }
                          className="px-2 py-1 text-[11px]"
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* UNIFIED DYNAMIC PROVIDER CONNECTION MODAL (EMAIL / WHATSAPP) */}
      <ProviderSelectionModal
        isOpen={isConnectModalOpen}
        onClose={() => {
          setIsConnectModalOpen(false);
          setEditingConfig(null);
        }}
        editConfig={editingConfig}
        channel={modalChannel}
        onSuccess={(saved) => {
          setFeedback({
            type: "success",
            message: editingConfig
              ? `${modalChannel === "WHATSAPP" ? "WhatsApp" : "Email"} configuration updated successfully!`
              : `${modalChannel === "WHATSAPP" ? "WhatsApp" : "Email"} provider connected and credentials encrypted successfully!`,
          });
          loadData();
        }}
      />

      {/* DETAILED MESSAGE & TIMELINE INSPECTOR MODAL */}
      <EmailMessageDetailsModal
        messageUuid={selectedInspectMessageUuid}
        onClose={() => setSelectedInspectMessageUuid(null)}
      />

      {/* TEMPLATE CREATION MODAL */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Create Email Template
              </h3>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4 pt-4">
              <Input
                label="Template Name"
                placeholder="User Password Reset"
                value={templateForm.name}
                onChange={(e) =>
                  setTemplateForm({ ...templateForm, name: e.target.value })
                }
                required
              />

              <Input
                label="Description"
                placeholder="Sent when user requests a new password token"
                value={templateForm.description}
                onChange={(e) =>
                  setTemplateForm({
                    ...templateForm,
                    description: e.target.value,
                  })
                }
              />

              <Input
                label="Subject Line (use {{variable}})"
                placeholder="Reset your {{company_name}} account password"
                value={templateForm.subject}
                onChange={(e) =>
                  setTemplateForm({ ...templateForm, subject: e.target.value })
                }
                required
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  HTML Body (supports &#123;&#123;variable&#125;&#125;
                  placeholders)
                </label>
                <textarea
                  rows={6}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white "
                  placeholder="<p>Hi {{first_name}}, please use this code: <b>{{token}}</b></p>"
                  value={templateForm.html_content}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      html_content: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={actionLoading === "save_template"}
                >
                  {actionLoading === "save_template"
                    ? "Saving..."
                    : "Create Template"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
