"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { UserProviderConfiguration } from "./types";
import { ConnectedProviderCard } from "./ConnectedProviderCard";
import {
  Smartphone,
  Send,
  RefreshCw,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  FileText,
  Plus,
  Search,
  Copy,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Trash2,
  Key,
  Ban,
  UserX,
  MessageSquare,
  Calendar,
  Zap,
  Info,
  Layers,
  Sparkles,
  PhoneCall,
  XCircle,
  Hash,
} from "lucide-react";

interface SmsMessage {
  message_uuid: string;
  conversation_uuid?: string;
  direction: "INBOUND" | "OUTBOUND";
  recipient_phone: string;
  sender_phone?: string;
  body: string;
  segment_count: number;
  encoding: "GSM_7BIT" | "UCS2";
  status:
    "QUEUED" | "PROCESSING" | "SENT" | "DELIVERED" | "FAILED" | "CANCELLED";
  provider_message_id?: string;
  scheduled_at?: string;
  sent_at?: string;
  delivered_at?: string;
  last_error?: string;
  created_at: string;
  provider_configuration?: {
    configuration_name: string;
    sender_name: string;
    sender_phone?: string;
  };
}

interface SmsConversation {
  conversation_uuid: string;
  contact_phone: string;
  contact_name?: string;
  last_message_at?: string;
  last_message_direction?: "INBOUND" | "OUTBOUND";
  created_at: string;
  latest_message?: SmsMessage;
}

interface SmsTemplate {
  template_uuid: string;
  name: string;
  description?: string;
  body: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
}

interface SmsOptOut {
  opt_out_uuid: string;
  phone_number: string;
  reason?: string;
  source: string;
  created_at: string;
}

interface SmsMessagingTabProps {
  configurations: UserProviderConfiguration[];
  onOpenConnectModal: (channel?: "EMAIL" | "WHATSAPP" | "SMS") => void;
  onEditConfig: (config: UserProviderConfiguration) => void;
  onRefresh: () => Promise<void>;
}

// GSM 7-bit default alphabet + extension table characters
const GSM_7BIT_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_7BIT_EXTENDED = "|^€{}[]~\\";

function calculateSmsSegments(text: string) {
  if (!text || text.length === 0) {
    return {
      encoding: "GSM_7BIT" as const,
      charCount: 0,
      segmentCount: 1,
      maxCharsPerSegment: 160,
      charsRemaining: 160,
      hasUnicode: false,
    };
  }

  let isGsm = true;
  let gsmCharCount = 0;

  for (const char of text) {
    if (GSM_7BIT_BASIC.includes(char)) {
      gsmCharCount += 1;
    } else if (GSM_7BIT_EXTENDED.includes(char)) {
      gsmCharCount += 2;
    } else {
      isGsm = false;
      break;
    }
  }

  if (isGsm) {
    const charCount = gsmCharCount;
    if (charCount <= 160) {
      return {
        encoding: "GSM_7BIT" as const,
        charCount,
        segmentCount: 1,
        maxCharsPerSegment: 160,
        charsRemaining: 160 - charCount,
        hasUnicode: false,
      };
    }
    const segmentCount = Math.ceil(charCount / 153);
    const charsInLastSegment = charCount % 153 || 153;
    return {
      encoding: "GSM_7BIT" as const,
      charCount,
      segmentCount,
      maxCharsPerSegment: 153,
      charsRemaining: 153 - charsInLastSegment,
      hasUnicode: false,
    };
  }

  // UCS-2 / Unicode
  const charCount = text.length;
  if (charCount <= 70) {
    return {
      encoding: "UCS2" as const,
      charCount,
      segmentCount: 1,
      maxCharsPerSegment: 70,
      charsRemaining: 70 - charCount,
      hasUnicode: true,
    };
  }
  const segmentCount = Math.ceil(charCount / 67);
  const charsInLastSegment = charCount % 67 || 67;
  return {
    encoding: "UCS2" as const,
    charCount,
    segmentCount,
    maxCharsPerSegment: 67,
    charsRemaining: 67 - charsInLastSegment,
    hasUnicode: true,
  };
}

export function SmsMessagingTab({
  configurations,
  onOpenConnectModal,
  onEditConfig,
  onRefresh,
}: SmsMessagingTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    "compose" | "messages" | "conversations" | "opt-outs" | "templates"
  >("compose");

  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // SMS data state
  const [stats, setStats] = useState<any>(null);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [conversations, setConversations] = useState<SmsConversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<SmsConversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<
    SmsMessage[]
  >([]);
  const [optOuts, setOptOuts] = useState<SmsOptOut[]>([]);
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);

  // Composer State
  const [selectedConfigUuid, setSelectedConfigUuid] = useState<string>("");
  const [recipientsInput, setRecipientsInput] = useState<string>("");
  const [messageBody, setMessageBody] = useState<string>("");
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [selectedTemplateUuid, setSelectedTemplateUuid] = useState<string>("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Opt-Out manual add modal state
  const [isAddOptOutOpen, setIsAddOptOutOpen] = useState(false);
  const [optOutPhone, setOptOutPhone] = useState("");
  const [optOutReason, setOptOutReason] = useState("");

  // Template create modal state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [templateBody, setTemplateBody] = useState("");

  // Search & Filter
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>("ALL");
  const [historySearch, setHistorySearch] = useState<string>("");
  const [conversationReply, setConversationReply] = useState<string>("");

  // Filter SMS configurations
  const smsConfigs = useMemo(() => {
    return configurations.filter((c) => c.type === "SMS");
  }, [configurations]);

  // Set default selected config
  useEffect(() => {
    if (smsConfigs.length > 0 && !selectedConfigUuid) {
      const def = smsConfigs.find((c) => c.is_default) || smsConfigs[0];
      setSelectedConfigUuid(def.configuration_uuid);
    }
  }, [smsConfigs, selectedConfigUuid]);

  // Segment calculation
  const segmentStats = useMemo(() => {
    return calculateSmsSegments(messageBody);
  }, [messageBody]);

  // Load all SMS data
  const loadSmsData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, msgRes, convRes, optRes, tmplRes] =
        await Promise.allSettled([
          api.get("/messaging/sms/stats"),
          api.get("/messaging/sms?limit=50"),
          api.get("/messaging/sms/conversations"),
          api.get("/messaging/sms/opt-outs"),
          api.get("/messaging/sms/templates"),
        ]);

      if (statsRes.status === "fulfilled")
        setStats((statsRes.value as any)?.data);
      if (msgRes.status === "fulfilled")
        setMessages((msgRes.value as any)?.data?.items || []);
      if (convRes.status === "fulfilled")
        setConversations((convRes.value as any)?.data || []);
      if (optRes.status === "fulfilled")
        setOptOuts((optRes.value as any)?.data || []);
      if (tmplRes.status === "fulfilled")
        setTemplates((tmplRes.value as any)?.data || []);
    } catch (err: any) {
      console.error("Error loading SMS data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSmsData();
  }, []);

  // When a conversation is selected, fetch its messages
  useEffect(() => {
    if (selectedConversation) {
      api
        .get(
          `/messaging/sms/conversations/${selectedConversation.conversation_uuid}/messages`,
        )
        .then((res: any) => {
          setConversationMessages(res.data || []);
        })
        .catch((err) =>
          console.error("Error loading conversation messages:", err),
        );
    }
  }, [selectedConversation]);

  // Handle template selection in composer
  const handleSelectTemplate = (templateUuid: string) => {
    setSelectedTemplateUuid(templateUuid);
    if (!templateUuid) return;
    const t = templates.find((tpl) => tpl.template_uuid === templateUuid);
    if (t) {
      setMessageBody(t.body);
    }
  };

  // Dispatch SMS
  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConfigUuid) {
      setFeedback({
        type: "error",
        message: "Please select an active SMS provider configuration.",
      });
      return;
    }
    if (!recipientsInput.trim()) {
      setFeedback({
        type: "error",
        message: "Please enter at least one recipient phone number.",
      });
      return;
    }
    if (!messageBody.trim()) {
      setFeedback({ type: "error", message: "Message body cannot be empty." });
      return;
    }

    const recipients = recipientsInput
      .split(/[\n,;]+/)
      .map((r) => r.trim())
      .filter(Boolean);

    setActionLoading("sending_sms");
    setFeedback(null);

    try {
      if (recipients.length === 1) {
        // Single SMS
        const payload: any = {
          provider_configuration_uuid: selectedConfigUuid,
          to: recipients[0],
          body: messageBody,
        };
        if (isScheduled && scheduledAt) {
          payload.scheduled_at = new Date(scheduledAt).toISOString();
        }
        await api.post("/messaging/sms/send", payload);
        setFeedback({
          type: "success",
          message: isScheduled
            ? `SMS successfully scheduled for ${new Date(scheduledAt).toLocaleString()}`
            : "SMS successfully dispatched!",
        });
      } else {
        // Bulk SMS
        const payload: any = {
          provider_configuration_uuid: selectedConfigUuid,
          recipients: recipients.map((r) => ({ to: r })),
          body: messageBody,
        };
        const res = (await api.post("/messaging/sms/bulk", payload)) as any;
        setFeedback({
          type: "success",
          message: `Bulk SMS job queued: ${res.data?.dispatched_count || recipients.length} recipients.`,
        });
      }

      setRecipientsInput("");
      setMessageBody("");
      setIsScheduled(false);
      setScheduledAt("");
      setSelectedTemplateUuid("");
      await loadSmsData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to dispatch SMS",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Cancel scheduled message
  const handleCancelScheduled = async (messageUuid: string) => {
    if (
      !confirm("Are you sure you want to cancel this scheduled SMS dispatch?")
    )
      return;
    setActionLoading(`cancel_${messageUuid}`);
    try {
      await api.post(`/messaging/sms/${messageUuid}/cancel`);
      setFeedback({ type: "success", message: "Scheduled message cancelled." });
      await loadSmsData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message || "Failed to cancel scheduled message.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Send conversation reply
  const handleSendConversationReply = async () => {
    if (
      !selectedConversation ||
      !conversationReply.trim() ||
      !selectedConfigUuid
    )
      return;
    setActionLoading("replying");
    try {
      await api.post("/messaging/sms/send", {
        provider_configuration_uuid: selectedConfigUuid,
        to: selectedConversation.contact_phone,
        body: conversationReply,
      });
      setConversationReply("");
      // Refresh messages
      const res: any = await api.get(
        `/messaging/sms/conversations/${selectedConversation.conversation_uuid}/messages`,
      );
      setConversationMessages(res.data || []);
      await loadSmsData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || "Failed to send SMS reply.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Add Opt-Out
  const handleAddOptOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!optOutPhone.trim()) return;
    setActionLoading("add_opt_out");
    try {
      await api.post("/messaging/sms/opt-outs", {
        phone: optOutPhone.trim(),
        reason: optOutReason.trim() || "Manual admin addition",
      });
      setFeedback({
        type: "success",
        message: `Number ${optOutPhone} added to opt-out suppression list.`,
      });
      setIsAddOptOutOpen(false);
      setOptOutPhone("");
      setOptOutReason("");
      await loadSmsData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message ||
          "Failed to add phone to opt-out list.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Remove Opt-Out
  const handleRemoveOptOut = async (phone: string) => {
    if (
      !confirm(
        `Are you sure you want to re-opt-in ${phone}? They will receive future SMS dispatches.`,
      )
    )
      return;
    setActionLoading(`remove_opt_${phone}`);
    try {
      await api.delete(`/messaging/sms/opt-outs/${encodeURIComponent(phone)}`);
      setFeedback({
        type: "success",
        message: `Number ${phone} removed from opt-out list.`,
      });
      await loadSmsData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message ||
          "Failed to remove phone from opt-out list.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Create Template
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !templateBody.trim()) return;
    setActionLoading("create_template");
    try {
      // Find variables in body: {{var}}
      const matches = templateBody.match(/\{\{([^}]+)\}\}/g) || [];
      const vars = Array.from(
        new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "").trim())),
      );

      await api.post("/messaging/sms/templates", {
        name: templateName.trim(),
        description: templateDesc.trim() || undefined,
        body: templateBody,
        variables: vars,
      });
      setFeedback({
        type: "success",
        message: "SMS Template created successfully.",
      });
      setIsTemplateModalOpen(false);
      setTemplateName("");
      setTemplateDesc("");
      setTemplateBody("");
      await loadSmsData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message || "Failed to create SMS template.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (templateUuid: string) => {
    if (!confirm("Are you sure you want to delete this SMS template?")) return;
    setActionLoading(`del_tpl_${templateUuid}`);
    try {
      await api.delete(`/messaging/sms/templates/${templateUuid}`);
      setFeedback({
        type: "success",
        message: "Template deleted successfully.",
      });
      await loadSmsData();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || "Failed to delete template.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(label);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  // Filtered Messages
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      const matchesStatus =
        historyFilterStatus === "ALL" || msg.status === historyFilterStatus;
      const matchesSearch =
        !historySearch.trim() ||
        msg.recipient_phone
          .toLowerCase()
          .includes(historySearch.toLowerCase()) ||
        msg.body.toLowerCase().includes(historySearch.toLowerCase()) ||
        (msg.provider_message_id &&
          msg.provider_message_id
            .toLowerCase()
            .includes(historySearch.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [messages, historyFilterStatus, historySearch]);

  const activeConfig = smsConfigs.find(
    (c) => c.configuration_uuid === selectedConfigUuid,
  );

  return (
    <div className="space-y-6">
      {/* Header & Connection Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              SMS Messaging Platform
            </h3>
            <Badge variant="indigo" className="text-xs">
              Multi-Provider
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Send, schedule, and track SMS messages with automated TCPA/CTIA
            compliance, live segment counting, and multi-provider routing (Twilio, AWS SNS, MessageBird, Vonage, Plivo, Telnyx, Infobip).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSmsData}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => onOpenConnectModal("SMS")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Connect</span>
          </Button>
        </div>
      </div>

      {/* Global Alerts */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
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

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total SMS
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {stats?.total ?? 0}
            </span>
            <Smartphone className="w-4 h-4 text-indigo-500" />
          </div>
        </Card>

        <Card className="p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Delivered
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats?.delivered ?? 0}
            </span>
            <CheckCheck className="w-4 h-4 text-emerald-500" />
          </div>
        </Card>

        <Card className="p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Sent / In Flight
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {(stats?.sent ?? 0) + (stats?.processing ?? 0)}
            </span>
            <Send className="w-4 h-4 text-blue-500" />
          </div>
        </Card>

        <Card className="p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
            Scheduled / Queued
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {stats?.queued ?? 0}
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
        </Card>

        <Card className="p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            Failed
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {stats?.failed ?? 0}
            </span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
        </Card>

        <Card className="p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Opt-Outs
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
              {stats?.opt_outs ?? optOuts.length}
            </span>
            <UserX className="w-4 h-4 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Connected Provider Overview Cards */}
      {smsConfigs.length === 0 ? (
        <Card className="p-8 text-center bg-slate-50/50 dark:bg-slate-900/50 border-dashed border-2 border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mx-auto text-indigo-600">
            <Smartphone className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-3">
            No SMS Providers Connected
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Connect Twilio, AWS SNS, MessageBird, Vonage, Plivo, Telnyx, or Infobip to send and receive text messages.
          </p>
          {/* <Button
            size="sm"
            onClick={() => onOpenConnectModal("SMS")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Connect SMS Provider
          </Button> */}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {smsConfigs.map((cfg) => {
            const origin =
              typeof window !== "undefined" ? window.location.origin : "";
            const providerSlug = cfg.provider?.slug?.replace("-sms", "") || "twilio";
            const statusWebhookUrl = `${origin}/api/webhooks/messaging/sms/${providerSlug}/${cfg.configuration_uuid}/status`;
            const inboundWebhookUrl = `${origin}/api/webhooks/messaging/sms/${providerSlug}/${cfg.configuration_uuid}/inbound`;

            return (
              <Card
                key={cfg.configuration_uuid}
                className={`p-4 border transition-all ${
                  selectedConfigUuid === cfg.configuration_uuid
                    ? "ring-2 ring-indigo-500 border-indigo-500 dark:ring-indigo-400"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200 dark:border-indigo-800 text-xs">
                      {cfg.provider?.name ? cfg.provider.name.slice(0, 2).toUpperCase() : "SMS"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {cfg.configuration_name}
                        </h4>
                        {cfg.is_default && (
                          <Badge variant="indigo" className="text-[10px]">
                            Default
                          </Badge>
                        )}
                        <Badge
                          variant={cfg.is_verified ? "emerald" : "amber"}
                          className="text-[10px]"
                        >
                          {cfg.is_verified ? "Verified" : "Unverified"}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        {cfg.provider?.name} • Sender:{" "}
                        {cfg.sender_phone || "Messaging Service"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditConfig(cfg)}
                      className="h-8 px-2 text-xs text-slate-600 dark:text-slate-300"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedConfigUuid(cfg.configuration_uuid)
                      }
                      className={`h-8 px-2.5 text-xs ${
                        selectedConfigUuid === cfg.configuration_uuid
                          ? "bg-indigo-600 text-white border-transparent hover:bg-indigo-700"
                          : ""
                      }`}
                    >
                      {selectedConfigUuid === cfg.configuration_uuid
                        ? "Active"
                        : "Select"}
                    </Button>
                  </div>
                </div>

                {/* Webhook URLs toggleable / preview */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] space-y-2">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500" />
                      Twilio Status Callback:
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          statusWebhookUrl,
                          `status_${cfg.configuration_uuid}`,
                        )
                      }
                      className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      {copiedUrl === `status_${cfg.configuration_uuid}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy URL
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-1.5 bg-slate-50 dark:bg-slate-900 rounded font-mono text-[10px] text-slate-600 dark:text-slate-400 break-all select-all">
                    {statusWebhookUrl}
                  </div>

                  <div className="flex items-center justify-between text-slate-500 pt-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-indigo-500" />
                      Twilio Inbound SMS Webhook:
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          inboundWebhookUrl,
                          `inbound_${cfg.configuration_uuid}`,
                        )
                      }
                      className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      {copiedUrl === `inbound_${cfg.configuration_uuid}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy URL
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-1.5 bg-slate-50 dark:bg-slate-900 rounded font-mono text-[10px] text-slate-600 dark:text-slate-400 break-all select-all">
                    {inboundWebhookUrl}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Sub Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {[
          { id: "compose", label: "Compose & Send", icon: Send },
          { id: "messages", label: "Message History", icon: Clock },
          { id: "conversations", label: "2-Way Inbound", icon: MessageSquare },
          { id: "opt-outs", label: "TCPA Opt-Outs", icon: UserX },
          { id: "templates", label: "Templates", icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
                isActive
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUBTAB 1: COMPOSE & SEND */}
      {activeSubTab === "compose" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <form onSubmit={handleSendSms} className="space-y-4">
                {/* Provider selection dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SMS Sender Configuration *
                  </label>
                  <select
                    value={selectedConfigUuid}
                    onChange={(e) => setSelectedConfigUuid(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 "
                  >
                    {smsConfigs.length === 0 ? (
                      <option value="">No SMS provider connected</option>
                    ) : (
                      smsConfigs.map((c) => (
                        <option
                          key={c.configuration_uuid}
                          value={c.configuration_uuid}
                        >
                          {c.configuration_name} (
                          {c.sender_phone || "Messaging Service"}
                          {c.is_default ? " — Default" : ""})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Template quick fill */}
                {templates.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Apply SMS Template (Optional)
                    </label>
                    <select
                      value={selectedTemplateUuid}
                      onChange={(e) => handleSelectTemplate(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 "
                    >
                      <option value="">-- Do not use a template --</option>
                      {templates.map((tpl) => (
                        <option
                          key={tpl.template_uuid}
                          value={tpl.template_uuid}
                        >
                          {tpl.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Recipient(s) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Recipient Phone Number(s) *
                    </label>
                    <span className="text-[11px] text-slate-400">
                      E.164 format (e.g. +14155552671). Supports multiple
                      separated by comma or newline.
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={recipientsInput}
                    onChange={(e) => setRecipientsInput(e.target.value)}
                    placeholder="+14155552671, +12025550143"
                    required
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-200  font-mono"
                  />
                  {recipientsInput.trim() && (
                    <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                      Total Recipients:{" "}
                      {
                        recipientsInput
                          .split(/[\n,;]+/)
                          .map((r) => r.trim())
                          .filter(Boolean).length
                      }
                    </p>
                  )}
                </div>

                {/* Message Body */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Message Body *
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Variables:{" "}
                      <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                        {"{{name}}"}
                      </code>
                      ,{" "}
                      <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                        {"{{code}}"}
                      </code>
                    </span>
                  </div>
                  <textarea
                    rows={5}
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    placeholder="Hello {{name}}, your verification code is {{code}}. Reply STOP to unsubscribe."
                    required
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-slate-800 dark:text-slate-200 "
                  />

                  {/* Character & Segment Counter Bar */}
                  <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {segmentStats.charCount} characters
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {segmentStats.segmentCount} segment
                        {segmentStats.segmentCount > 1 ? "s" : ""}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500">
                        {segmentStats.charsRemaining} remaining in segment
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          segmentStats.encoding === "GSM_7BIT"
                            ? "emerald"
                            : "amber"
                        }
                        className="text-[10px]"
                      >
                        {segmentStats.encoding === "GSM_7BIT"
                          ? "GSM 7-bit"
                          : "UCS-2 Unicode"}
                      </Badge>
                    </div>
                  </div>

                  {segmentStats.hasUnicode && (
                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-300">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        Message contains non-GSM characters (e.g. emojis or
                        special accents). Twilio uses UCS-2 encoding (70 chars
                        max per segment instead of 160).
                      </span>
                    </div>
                  )}
                </div>

                {/* Scheduling Option */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="scheduleCheckbox"
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label
                      htmlFor="scheduleCheckbox"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      Schedule this message for future dispatch
                    </label>
                  </div>

                  {isScheduled && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Dispatch Date & Time *
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        required={isScheduled}
                        min={new Date().toISOString().slice(0, 16)}
                        className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-slate-800 dark:text-slate-200 "
                      />
                    </div>
                  )}
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={
                      actionLoading === "sending_sms" || smsConfigs.length === 0
                    }
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2"
                  >
                    {actionLoading === "sending_sms" ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending SMS via Twilio...</span>
                      </>
                    ) : isScheduled ? (
                      <>
                        <Calendar className="w-4 h-4" />
                        <span>Schedule SMS Message</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send SMS Now</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Right sidebar info */}
          <div className="space-y-4">
            <Card className="p-4 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-100 dark:border-indigo-900/40">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                TCPA / CTIA Compliance Built-in
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Our SMS subsystem enforces carrier guidelines automatically:
              </p>
              <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5 mt-2">
                <li className="flex items-start gap-1.5">
                  <span className="text-indigo-600 font-bold">•</span>
                  <span>
                    <strong>STOP, UNSUBSCRIBE, CANCEL:</strong> Immediately
                    halts all further outgoing messages to that recipient.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-indigo-600 font-bold">•</span>
                  <span>
                    <strong>START, UNSTOP, YES:</strong> Reactivates sending
                    eligibility.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-indigo-600 font-bold">•</span>
                  <span>
                    <strong>Pre-flight check:</strong> All dispatch calls reject
                    opted-out recipients before calling Twilio APIs.
                  </span>
                </li>
              </ul>
            </Card>

            <Card className="p-4">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-600" />
                SMS Segment Guidelines
              </h4>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-2 mt-2">
                <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    GSM 7-bit Encoding:
                  </span>
                  <p className="mt-0.5">
                    1 segment: up to 160 characters. Concatenated segments: 153
                    characters per segment.
                  </p>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    UCS-2 Unicode Encoding:
                  </span>
                  <p className="mt-0.5">
                    1 segment: up to 70 characters. Concatenated segments: 67
                    characters per segment.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* SUBTAB 2: MESSAGE HISTORY */}
      {activeSubTab === "messages" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <Card className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                placeholder="Search phone, body, SID..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                Filter Status:
              </span>
              <select
                value={historyFilterStatus}
                onChange={(e) => setHistoryFilterStatus(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All Statuses</option>
                <option value="DELIVERED">Delivered</option>
                <option value="SENT">Sent</option>
                <option value="QUEUED">Queued / Scheduled</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </Card>

          {/* Table */}
          <Card className="overflow-hidden border border-slate-200 dark:border-slate-800">
            {filteredMessages.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-400" />
                <p className="text-sm font-semibold">
                  No SMS messages match your filters.
                </p>
                <p className="text-xs">
                  Dispatch a message or wait for inbound SMS events.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Direction / Status</th>
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">Message Body</th>
                      <th className="py-3 px-4">Segments / Encoding</th>
                      <th className="py-3 px-4">Twilio SID</th>
                      <th className="py-3 px-4">Created / Scheduled</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredMessages.map((msg) => {
                      const isQueued = msg.status === "QUEUED";
                      return (
                        <tr
                          key={msg.message_uuid}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant={
                                  msg.direction === "INBOUND"
                                    ? "indigo"
                                    : "blue"
                                }
                                className="text-[10px] font-bold"
                              >
                                {msg.direction}
                              </Badge>
                              <Badge
                                variant={
                                  msg.status === "DELIVERED"
                                    ? "emerald"
                                    : msg.status === "SENT"
                                      ? "blue"
                                      : msg.status === "QUEUED"
                                        ? "amber"
                                        : msg.status === "CANCELLED"
                                          ? "default"
                                          : "rose"
                                }
                                className="text-[10px] font-bold"
                              >
                                {msg.status}
                              </Badge>
                            </div>
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-900 dark:text-white">
                            {msg.recipient_phone}
                          </td>

                          <td
                            className="py-3 px-4 max-w-xs truncate text-slate-700 dark:text-slate-300"
                            title={msg.body}
                          >
                            {msg.body}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {msg.segment_count || 1} seg
                            </span>{" "}
                            <span className="text-[10px] text-slate-400">
                              ({msg.encoding === "UCS2" ? "UCS-2" : "GSM-7"})
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono text-[10px] text-slate-500">
                            {msg.provider_message_id ? (
                              <span title={msg.provider_message_id}>
                                {msg.provider_message_id.slice(0, 14)}...
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {msg.scheduled_at ? (
                              <div className="flex items-center gap-1 text-amber-600 font-semibold">
                                <Calendar className="w-3 h-3" />
                                <span>
                                  {new Date(msg.scheduled_at).toLocaleString()}
                                </span>
                              </div>
                            ) : (
                              new Date(msg.created_at).toLocaleString()
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            {isQueued && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleCancelScheduled(msg.message_uuid)
                                }
                                disabled={
                                  actionLoading === `cancel_${msg.message_uuid}`
                                }
                                className="h-7 px-2 text-[11px] text-rose-600 border-rose-200 hover:bg-rose-50"
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* SUBTAB 3: 2-WAY CONVERSATIONS */}
      {activeSubTab === "conversations" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
          {/* Conversation List */}
          <Card className="p-3 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 px-2 py-1">
              Conversations ({conversations.length})
            </h4>
            {conversations.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No conversations yet. Inbound or outbound messages create
                threads automatically.
              </div>
            ) : (
              conversations.map((c) => {
                const isSelected =
                  selectedConversation?.conversation_uuid ===
                  c.conversation_uuid;
                return (
                  <button
                    key={c.conversation_uuid}
                    onClick={() => setSelectedConversation(c)}
                    className={`w-full text-left p-3 rounded-xl transition-all ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800"
                        : "hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-white font-mono">
                        {c.contact_phone}
                      </span>
                      {c.last_message_at && (
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.last_message_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    {c.latest_message && (
                      <p className="text-[11px] text-slate-500 truncate mt-1">
                        {c.latest_message.direction === "INBOUND" ? "← " : "→ "}
                        {c.latest_message.body}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </Card>

          {/* Chat View */}
          <Card className="lg:col-span-2 p-4 flex flex-col justify-between border border-slate-200 dark:border-slate-800">
            {selectedConversation ? (
              <>
                <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                        {selectedConversation.contact_phone}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        2-Way SMS Thread
                      </p>
                    </div>
                  </div>
                </div>

                {/* Message bubble stream */}
                <div className="flex-1 overflow-y-auto py-4 space-y-3 px-2">
                  {conversationMessages.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No messages in this conversation.
                    </div>
                  ) : (
                    conversationMessages.map((msg) => {
                      const isOutbound = msg.direction === "OUTBOUND";
                      return (
                        <div
                          key={msg.message_uuid}
                          className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl p-3 text-xs ${
                              isOutbound
                                ? "bg-indigo-600 text-white rounded-br-none"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none"
                            }`}
                          >
                            <p className="whitespace-pre-wrap leading-relaxed">
                              {msg.body}
                            </p>
                            <div
                              className={`flex items-center justify-end gap-1.5 text-[9px] mt-1.5 ${
                                isOutbound
                                  ? "text-indigo-200"
                                  : "text-slate-400"
                              }`}
                            >
                              <span>
                                {new Date(msg.created_at).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                              {isOutbound && <span>• {msg.status}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reply bar */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <Input
                    placeholder="Type an SMS reply..."
                    value={conversationReply}
                    onChange={(e) => setConversationReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendConversationReply();
                      }
                    }}
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={handleSendConversationReply}
                    disabled={
                      actionLoading === "replying" || !conversationReply.trim()
                    }
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4"
                  >
                    {actionLoading === "replying" ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-semibold">
                  Select a conversation on the left to view messages.
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* SUBTAB 4: TCPA OPT-OUT LIST */}
      {activeSubTab === "opt-outs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <UserX className="w-4 h-4 text-purple-600" />
                TCPA / CTIA Opt-Out & Suppression List
              </h4>
              <p className="text-xs text-slate-500">
                Any phone number listed here is strictly blocked from receiving
                outbound SMS messages.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddOptOutOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Opt-Out Manually</span>
            </Button>
          </div>

          <Card className="overflow-hidden border border-slate-200 dark:border-slate-800">
            {optOuts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  No opted-out phone numbers recorded yet.
                </p>
                <p className="text-[11px]">
                  When a customer texts "STOP" or "UNSUBSCRIBE", they will
                  appear here automatically.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Opted Out At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {optOuts.map((opt) => (
                    <tr
                      key={opt.opt_out_uuid}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {opt.phone_number}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {opt.reason || "Keyword STOP"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="default" className="text-[10px]">
                          {opt.source}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {new Date(opt.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveOptOut(opt.phone_number)}
                          disabled={
                            actionLoading === `remove_opt_${opt.phone_number}`
                          }
                          className="h-7 px-2 text-[11px] text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        >
                          Opt Back In
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* SUBTAB 5: SMS TEMPLATES */}
      {activeSubTab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                Personalized SMS Templates
              </h4>
              <p className="text-xs text-slate-500">
                Create reusable message templates with dynamic {"{{variable}}"}{" "}
                interpolation.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsTemplateModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create SMS Template</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 space-y-2">
                <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  No SMS templates created yet.
                </p>
                <p className="text-[11px]">
                  Add templates for verification codes, dispatch alerts, and
                  marketing promos.
                </p>
              </div>
            ) : (
              templates.map((tpl) => (
                <Card
                  key={tpl.template_uuid}
                  className="p-4 flex flex-col justify-between border border-slate-200 dark:border-slate-800"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {tpl.name}
                      </h4>
                      <Badge variant="emerald" className="text-[10px]">
                        Active
                      </Badge>
                    </div>
                    {tpl.description && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        {tpl.description}
                      </p>
                    )}
                    <div className="mt-3 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap border border-slate-100 dark:border-slate-800">
                      {tpl.body}
                    </div>

                    {tpl.variables && tpl.variables.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {tpl.variables.map((v) => (
                          <span
                            key={v}
                            className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-mono"
                          >
                            {"{{" + v + "}}"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTemplate(tpl.template_uuid)}
                      disabled={
                        actionLoading === `del_tpl_${tpl.template_uuid}`
                      }
                      className="h-7 px-2 text-rose-600 hover:bg-rose-50 text-[11px]"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Manual Opt-Out Modal */}
      {isAddOptOutOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserX className="w-4 h-4 text-purple-600" />
              Add Phone Number to Opt-Out Suppression List
            </h3>
            <form onSubmit={handleAddOptOut} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number (E.164) *
                </label>
                <Input
                  placeholder="+14155552671"
                  value={optOutPhone}
                  onChange={(e) => setOptOutPhone(e.target.value)}
                  required
                  className="text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Opt-Out
                </label>
                <Input
                  placeholder="e.g. Verbal request, Support ticket #1234"
                  value={optOutReason}
                  onChange={(e) => setOptOutReason(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddOptOutOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={actionLoading === "add_opt_out"}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {actionLoading === "add_opt_out"
                    ? "Adding..."
                    : "Add to Opt-Out List"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Create Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-lg w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              Create SMS Template
            </h3>
            <form onSubmit={handleCreateTemplate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Template Name *
                </label>
                <Input
                  placeholder="Order Confirmation SMS"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <Input
                  placeholder="Sent when an order has been successfully placed"
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Template Body *
                </label>
                <textarea
                  rows={4}
                  placeholder="Hi {{name}}, your order #{{order_id}} is confirmed! Reply STOP to unsubscribe."
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  required
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-slate-800 dark:text-slate-200  font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Wrap dynamic tags in double curly braces, e.g.{" "}
                  <code className="text-indigo-600">{"{{name}}"}</code>.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTemplateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={actionLoading === "create_template"}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {actionLoading === "create_template"
                    ? "Saving..."
                    : "Save Template"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
