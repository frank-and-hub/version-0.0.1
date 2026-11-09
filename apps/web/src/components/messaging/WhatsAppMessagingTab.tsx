"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { UserProviderConfiguration } from "./types";
import { WhatsAppTemplateModal } from "./WhatsAppTemplateModal";
import { ConnectedProviderCard } from "./ConnectedProviderCard";
import {
  MessageSquare,
  Send,
  RefreshCw,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  FileText,
  Plus,
  Phone,
  Search,
  Copy,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Image as ImageIcon,
  ChevronRight,
  Sparkles,
  Edit2,
  Trash2,
  Radio,
  Key,
} from "lucide-react";

interface WhatsAppMessage {
  message_uuid: string;
  conversation_uuid: string;
  direction: "INBOUND" | "OUTBOUND";
  message_type: string;
  provider_message_id?: string;
  recipient_phone: string;
  sender_phone: string;
  content?: string;
  media_url?: string;
  template_name?: string;
  status: "QUEUED" | "PROCESSING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  created_at: string;
}

interface WhatsAppConversation {
  conversation_uuid: string;
  contact_phone: string;
  contact_name?: string;
  last_message_at?: string;
  last_message_direction?: "INBOUND" | "OUTBOUND";
  window_expires_at?: string;
  session: {
    is_active: boolean;
    expires_at: string | null;
    hours_remaining: number;
  };
  latest_message?: WhatsAppMessage;
}

interface WhatsAppTemplate {
  template_uuid: string;
  meta_template_id?: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
}

interface WhatsAppMessagingTabProps {
  configurations: UserProviderConfiguration[];
  onOpenConnectModal: (channel?: "EMAIL" | "WHATSAPP") => void;
  onEditConfig?: (config: UserProviderConfiguration) => void;
  onRefresh?: () => void;
}

export const WhatsAppMessagingTab: React.FC<WhatsAppMessagingTabProps> = ({
  configurations,
  onOpenConnectModal,
  onEditConfig,
  onRefresh,
}) => {
  const whatsappConfigs = configurations.filter((c) => c.type === "WHATSAPP");
  const [selectedConfigUuid, setSelectedConfigUuid] = useState<string>(
    whatsappConfigs[0]?.configuration_uuid || "",
  );

  const [conversations, setConversations] = useState<WhatsAppConversation[]>(
    [],
  );
  const [activeConversation, setActiveConversation] =
    useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);

  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSyncingTemplates, setIsSyncingTemplates] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testHandshakeResult, setTestHandshakeResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);
  const [isTestingHandshake, setIsTestingHandshake] = useState(false);

  // Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

  // Message Sending Form State
  const [sendMode, setSendMode] = useState<"SESSION" | "TEMPLATE">("SESSION");
  const [messageText, setMessageText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [templateVariables, setTemplateVariables] = useState<
    Record<string, string>
  >({});

  // New Chat Modal / Popover
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<
    "chat" | "templates" | "webhooks" | "providers"
  >("chat");

  const selectedConfig =
    whatsappConfigs.find((c) => c.configuration_uuid === selectedConfigUuid) ||
    whatsappConfigs[0];

  useEffect(() => {
    if (whatsappConfigs.length > 0 && !selectedConfigUuid) {
      setSelectedConfigUuid(whatsappConfigs[0].configuration_uuid);
    }
  }, [whatsappConfigs, selectedConfigUuid]);

  const loadConversations = async () => {
    if (!selectedConfig) return;
    setIsLoadingConversations(true);
    try {
      const data = await api.get<WhatsAppConversation[]>(
        `/messaging/whatsapp/conversations?configuration_uuid=${selectedConfig.configuration_uuid}`,
      );
      setConversations(data || []);
      if (data && data.length > 0 && !activeConversation) {
        selectConversation(data[0]);
      }
    } catch (err) {
      console.error("Failed to load WhatsApp conversations", err);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadTemplates = async () => {
    if (!selectedConfig) return;
    try {
      const data = await api.get<WhatsAppTemplate[]>(
        `/messaging/whatsapp/templates?configuration_uuid=${selectedConfig.configuration_uuid}`,
      );
      setTemplates(data || []);
    } catch (err) {
      console.error("Failed to load WhatsApp templates", err);
    }
  };

  useEffect(() => {
    if (selectedConfig) {
      loadConversations();
      loadTemplates();
    }
  }, [selectedConfigUuid]);

  const selectConversation = async (conv: WhatsAppConversation) => {
    setActiveConversation(conv);
    setIsLoadingMessages(true);
    try {
      const res = await api.get<{
        conversation: WhatsAppConversation;
        messages: WhatsAppMessage[];
      }>(
        `/messaging/whatsapp/conversations/${conv.conversation_uuid}/messages`,
      );
      setMessages(res.messages || []);
      setActiveConversation(res.conversation);

      // Auto-switch mode based on 24-hr session window
      if (res.conversation.session?.is_active) {
        setSendMode("SESSION");
      } else {
        setSendMode("TEMPLATE");
      }
    } catch (err) {
      console.error("Failed to load conversation messages", err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSyncTemplates = async () => {
    if (!selectedConfig) return;
    setIsSyncingTemplates(true);
    try {
      await api.post(
        `/messaging/whatsapp/templates/sync/${selectedConfig.configuration_uuid}`,
        {},
      );
      await loadTemplates();
    } catch (err: any) {
      alert(
        `Template sync notice: ${err?.response?.data?.message || err?.message || "Templates synced"}`,
      );
    } finally {
      setIsSyncingTemplates(false);
    }
  };

  const handleDeleteTemplate = async (templateUuid: string) => {
    if (!confirm("Are you sure you want to delete this WhatsApp template?"))
      return;
    try {
      await api.delete(`/messaging/whatsapp/templates/${templateUuid}`);
      await loadTemplates();
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete template",
      );
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !selectedConfig) return;

    setIsSending(true);
    try {
      const payload: any = {
        configuration_uuid: selectedConfig.configuration_uuid,
        to: activeConversation.contact_phone,
        type:
          sendMode === "TEMPLATE" ? "TEMPLATE" : mediaUrl ? "IMAGE" : "TEXT",
      };

      if (sendMode === "TEMPLATE") {
        payload.template_name = selectedTemplateName;
        payload.template_variables = templateVariables;
      } else {
        payload.content = messageText;
        if (mediaUrl) payload.media_url = mediaUrl;
      }

      await api.post("/messaging/whatsapp/messages/send", payload);
      setMessageText("");
      setMediaUrl("");
      await selectConversation(activeConversation);
      await loadConversations();
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to dispatch message",
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleStartNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatPhone || !selectedConfig) return;

    setIsSending(true);
    try {
      const payload: any = {
        configuration_uuid: selectedConfig.configuration_uuid,
        to: newChatPhone,
        type: selectedTemplateName ? "TEMPLATE" : "TEXT",
      };

      if (selectedTemplateName) {
        payload.template_name = selectedTemplateName;
        payload.template_variables = templateVariables;
      } else {
        payload.content = messageText || "Hello from WhatsApp!";
      }

      await api.post("/messaging/whatsapp/messages/send", payload);
      setIsNewChatOpen(false);
      setNewChatPhone("");
      setMessageText("");
      await loadConversations();
    } catch (err: any) {
      alert(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to start conversation",
      );
    } finally {
      setIsSending(false);
    }
  };

  const testWebhookHandshake = async () => {
    if (!selectedConfig) return;
    setIsTestingHandshake(true);
    setTestHandshakeResult(null);
    try {
      const verifyToken =
        selectedConfig.credentials?.webhook_verify_token || "whsec_token";
      const challengeStr = `test_challenge_${Date.now()}`;
      const url = `/webhooks/messaging/whatsapp/${selectedConfig.configuration_uuid}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=${encodeURIComponent(challengeStr)}`;

      const res = await api.get<string>(url);
      if (res === challengeStr) {
        setTestHandshakeResult({
          tested: true,
          success: true,
          message:
            "GET Webhook Handshake Succeeded! Verification challenge matched successfully.",
        });
      } else {
        setTestHandshakeResult({
          tested: true,
          success: false,
          message: `Unexpected handshake response: ${String(res)}`,
        });
      }
    } catch (err: any) {
      setTestHandshakeResult({
        tested: true,
        success: false,
        message:
          err?.response?.data?.message ||
          err?.message ||
          "Webhook challenge failed.",
      });
    } finally {
      setIsTestingHandshake(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  if (whatsappConfigs.length === 0) {
    return (
      <Card className="p-12 text-center max-w-xl mx-auto space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-sm">
          <MessageSquare className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Connect WhatsApp Messaging Provider
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Connect Meta WhatsApp Cloud API, Interakt, WATI, or Twilio WhatsApp
            to start sending templates, handling two-way chats, and receiving
            webhook delivery receipts.
          </p>
        </div>
        {/* <Button
          onClick={() => onOpenConnectModal("WHATSAPP")}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 mx-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Connect WhatsApp Provider</span>
        </Button> */}
      </Card>
    );
  }

  const filteredConversations = conversations.filter((c) => {
    const q = searchFilter.toLowerCase();
    return (
      c.contact_phone.toLowerCase().includes(q) ||
      (c.contact_name && c.contact_name.toLowerCase().includes(q))
    );
  });

  const webhookCallbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/messaging/whatsapp/${selectedConfig?.configuration_uuid}`
      : `/api/webhooks/messaging/whatsapp/${selectedConfig?.configuration_uuid}`;

  return (
    <div className="space-y-6">
      {/* Top Profile & Navigation Sub-Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shadow-sm">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={selectedConfigUuid}
                onChange={(e) => setSelectedConfigUuid(e.target.value)}
                className="font-bold text-slate-900 dark:text-white bg-transparent border-none text-base cursor-pointer focus:ring-0 p-0"
              >
                {whatsappConfigs.map((c) => (
                  <option
                    key={c.configuration_uuid}
                    value={c.configuration_uuid}
                  >
                    {c.configuration_name} ({c.sender_phone || c.provider.name})
                  </option>
                ))}
              </select>
              <Badge
                variant="emerald"
                className="text-[10px] uppercase font-bold"
              >
                {selectedConfig?.provider?.name || "WhatsApp"}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Phone:{" "}
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {selectedConfig?.sender_phone || "Not configured"}
              </span>{" "}
              • Provider:{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {selectedConfig?.provider?.name}
              </span>
            </p>
          </div>
        </div>

        {/* View Toggle (Inbox vs Templates vs Webhook Setup vs Providers) */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSubTab("chat")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === "chat"
                ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Two-Way Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("templates")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === "templates"
                ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Templates ({templates.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("webhooks")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === "webhooks"
                ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Webhooks & Events
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("providers")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === "providers"
                ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Accounts ({whatsappConfigs.length})
          </button>
        </div>
      </div>

      {/* VIEW 1: TWO-WAY CHAT INBOX */}
      {activeSubTab === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px]">
          {/* Left Column: Conversations List (4 cols) */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Conversations
                </h4>
                <Button
                  size="sm"
                  onClick={() => setIsNewChatOpen(true)}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Chat</span>
                </Button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search contact phone or name..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* Conversation Feed */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[520px]">
              {isLoadingConversations ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                  Loading conversations...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                  <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p>No conversations yet.</p>
                  <button
                    onClick={() => setIsNewChatOpen(true)}
                    className="text-emerald-600 font-semibold hover:underline"
                  >
                    Start a new conversation
                  </button>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected =
                    activeConversation?.conversation_uuid ===
                    conv.conversation_uuid;
                  return (
                    <div
                      key={conv.conversation_uuid}
                      onClick={() => selectConversation(conv)}
                      className={`p-3.5 cursor-pointer transition-colors text-left flex items-start gap-3 ${
                        isSelected
                          ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-l-4 border-emerald-500"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-xs flex-shrink-0">
                        {conv.contact_name ? (
                          conv.contact_name.substring(0, 2).toUpperCase()
                        ) : (
                          <Phone className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {conv.contact_name || conv.contact_phone}
                          </h5>
                          {conv.last_message_at && (
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {new Date(
                                conv.last_message_at,
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </div>
                        {conv.contact_name && (
                          <p className="text-[11px] text-slate-400 font-mono truncate">
                            {conv.contact_phone}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {conv.latest_message?.content || "No message content"}
                        </p>

                        {/* 24-Hour Session Badge */}
                        <div className="mt-1.5">
                          {conv.session?.is_active ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              24h Window Active ({conv.session.hours_remaining}h
                              left)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Window Expired (Template Required)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Live Chat Pane (8 cols) */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-hidden">
            {activeConversation ? (
              <>
                {/* Chat Top Banner */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
                      {activeConversation.contact_name ? (
                        activeConversation.contact_name
                          .substring(0, 2)
                          .toUpperCase()
                      ) : (
                        <Phone className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {activeConversation.contact_name ||
                          activeConversation.contact_phone}
                      </h4>
                      <p className="text-xs font-mono text-slate-400">
                        {activeConversation.contact_phone}
                      </p>
                    </div>
                  </div>

                  {/* 24-Hour Customer Service Status Badge */}
                  <div>
                    {activeConversation.session?.is_active ? (
                      <Badge
                        variant="emerald"
                        className="flex items-center gap-1 py-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          Session Open (
                          {activeConversation.session.hours_remaining}h
                          remaining)
                        </span>
                      </Badge>
                    ) : (
                      <Badge
                        variant="amber"
                        className="flex items-center gap-1 py-1"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>24h Window Expired • Template Required</span>
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Chat Messages Body */}
                <div className="flex-1 p-5 overflow-y-auto space-y-3.5 bg-slate-50/50 dark:bg-slate-950/40 max-h-[420px] min-h-[360px]">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2 text-emerald-600" />
                      Loading message history...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-slate-400 text-xs py-12 space-y-1">
                      <p className="font-semibold text-slate-600 dark:text-slate-300">
                        No messages yet in this conversation.
                      </p>
                      <p>Send a message below to start chatting.</p>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isOutbound = m.direction === "OUTBOUND";
                      return (
                        <div
                          key={m.message_uuid}
                          className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
                        >
                          <div
                            className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                              isOutbound
                                ? "bg-emerald-600 text-white rounded-br-none"
                                : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-bl-none"
                            }`}
                          >
                            {m.template_name && (
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-85 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                <span>Template: {m.template_name}</span>
                              </div>
                            )}

                            {m.media_url && (
                              <div className="mb-2 rounded overflow-hidden">
                                <img
                                  src={m.media_url}
                                  alt="WhatsApp media"
                                  className="max-h-48 rounded object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display =
                                      "none";
                                  }}
                                />
                              </div>
                            )}

                            <p className="whitespace-pre-wrap leading-relaxed">
                              {m.content}
                            </p>

                            <div
                              className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                                isOutbound
                                  ? "text-emerald-100"
                                  : "text-slate-400"
                              }`}
                            >
                              <span>
                                {new Date(m.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {isOutbound && (
                                <span>
                                  {m.status === "READ" ? (
                                    <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                                  ) : m.status === "DELIVERED" ? (
                                    <CheckCheck className="w-3.5 h-3.5" />
                                  ) : m.status === "SENT" ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : m.status === "FAILED" ? (
                                    <span title={m.error_message || "Failed"}>
                                      <AlertCircle className="w-3.5 h-3.5 text-rose-300" />
                                    </span>
                                  ) : (
                                    <Clock className="w-3 h-3" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Message Composer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                  {/* Mode Selector Tabs (Session vs Template) */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSendMode("SESSION")}
                        disabled={!activeConversation.session?.is_active}
                        className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all ${
                          sendMode === "SESSION"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                            : !activeConversation.session?.is_active
                              ? "opacity-50 cursor-not-allowed text-slate-400"
                              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        Free-form Message
                      </button>
                      <button
                        type="button"
                        onClick={() => setSendMode("TEMPLATE")}
                        className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all ${
                          sendMode === "TEMPLATE"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        Approved Template
                      </button>
                    </div>

                    {!activeConversation.session?.is_active && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                        Session closed: Template message required
                      </span>
                    )}
                  </div>

                  {sendMode === "TEMPLATE" ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Select Template
                        </label>
                        <select
                          value={selectedTemplateName}
                          onChange={(e) =>
                            setSelectedTemplateName(e.target.value)
                          }
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                        >
                          <option value="">
                            -- Choose an approved template --
                          </option>
                          {templates.map((t) => (
                            <option key={t.template_uuid} value={t.name}>
                              {t.name} ({t.category} • {t.language})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Variable 1 (e.g. Customer Name)"
                          value={templateVariables["1"] || ""}
                          onChange={(e) =>
                            setTemplateVariables({
                              ...templateVariables,
                              "1": e.target.value,
                            })
                          }
                          className="text-xs"
                        />
                        <Input
                          placeholder="Variable 2 (e.g. Order ID / Link)"
                          value={templateVariables["2"] || ""}
                          onChange={(e) =>
                            setTemplateVariables({
                              ...templateVariables,
                              "2": e.target.value,
                            })
                          }
                          className="text-xs"
                        />
                        <Button
                          onClick={handleSendMessage}
                          disabled={isSending || !selectedTemplateName}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-4 flex-shrink-0"
                        >
                          {isSending ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span className="ml-1.5">Send Template</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSendMessage} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Type a message to your customer..."
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <Button
                          type="submit"
                          disabled={isSending || !messageText.trim()}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-10 px-4 flex-shrink-0"
                        >
                          {isSending ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span className="ml-1.5 hidden sm:inline">Send</span>
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-24 text-slate-400 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Select a conversation from the left to view messages
                </p>
                <p className="text-xs">
                  Or start a new chat with any WhatsApp phone number.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: TEMPLATES MANAGEMENT */}
      {activeSubTab === "templates" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                WhatsApp Message Templates
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create and manage pre-approved WhatsApp templates for
                out-of-session customer notifications.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSyncTemplates}
                disabled={isSyncingTemplates}
                className="flex items-center gap-1.5"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSyncingTemplates ? "animate-spin" : ""}`}
                />
                <span>Sync with Meta</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditingTemplate(null);
                  setIsTemplateModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create WhatsApp Template</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <Card className="col-span-full p-8 text-center text-slate-400 space-y-3">
                <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold">
                  No WhatsApp templates found.
                </p>
                <p className="text-xs max-w-sm mx-auto">
                  Click below to create a custom WhatsApp template or sync with
                  your provider.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingTemplate(null);
                      setIsTemplateModalOpen(true);
                    }}
                    className="bg-emerald-600 text-white"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Create Template
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSyncTemplates}
                    disabled={isSyncingTemplates}
                  >
                    Sync with Meta
                  </Button>
                </div>
              </Card>
            ) : (
              templates.map((tpl) => (
                <Card
                  key={tpl.template_uuid}
                  className="p-4 space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                          {tpl.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {tpl.category} • {tpl.language}
                        </p>
                      </div>
                      <Badge
                        variant={
                          tpl.status === "APPROVED"
                            ? "emerald"
                            : tpl.status === "REJECTED"
                              ? "rose"
                              : "amber"
                        }
                        className="text-[10px]"
                      >
                        {tpl.status}
                      </Badge>
                    </div>

                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      {Array.isArray(tpl.components) &&
                        tpl.components.map((c: any, idx: number) => (
                          <div key={idx} className="text-[11px]">
                            <span className="font-semibold text-slate-400 uppercase text-[9px] block">
                              {c.type}:
                            </span>
                            <span className="font-mono">
                              {c.text || "[Dynamic Component]"}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTemplate(tpl);
                        setIsTemplateModalOpen(true);
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-emerald-600 flex items-center gap-1 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/75 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tpl.template_uuid)}
                      className="text-xs font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-1 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800/75 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: WEBHOOK SETUP GUIDE */}
      {activeSubTab === "webhooks" && (
        <Card className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                WhatsApp Webhooks & Event Configuration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Configure these parameters in your Meta App Dashboard or BSP
                (Interakt, WATI, Twilio) settings.
              </p>
            </div>
            <Button
              size="sm"
              onClick={testWebhookHandshake}
              disabled={isTestingHandshake}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
            >
              <Radio
                className={`w-3.5 h-3.5 ${isTestingHandshake ? "animate-pulse" : ""}`}
              />
              <span>Test Webhook Handshake</span>
            </Button>
          </div>

          {testHandshakeResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                testHandshakeResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {testHandshakeResult.success ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span>{testHandshakeResult.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setTestHandshakeResult(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
          )}

          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                1. Webhook Callback URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookCallbackUrl}
                  className="flex-1 text-xs font-mono p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(webhookCallbackUrl, "cb_url")}
                  className="flex items-center gap-1.5"
                >
                  {copiedKey === "cb_url" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{copiedKey === "cb_url" ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                2. Verify Token
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={
                    selectedConfig?.credentials?.webhook_verify_token ||
                    "whsec_..."
                  }
                  className="flex-1 text-xs font-mono p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    copyToClipboard(
                      selectedConfig?.credentials?.webhook_verify_token || "",
                      "verify_tok",
                    )
                  }
                  className="flex items-center gap-1.5"
                >
                  {copiedKey === "verify_tok" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{copiedKey === "verify_tok" ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>3. Subscribed Webhook Fields</span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                In your Meta App Dashboard under WhatsApp Webhook Fields,
                subscribe to{" "}
                <code className="bg-emerald-100 dark:bg-emerald-900/80 px-1 py-0.5 rounded font-mono">
                  messages
                </code>
                . Incoming customer replies and real-time delivery status
                updates (<code className="font-mono">sent</code>,{" "}
                <code className="font-mono">delivered</code>,{" "}
                <code className="font-mono">read</code>,{" "}
                <code className="font-mono">failed</code>) are verified via
                HMAC-SHA256 (
                <code className="font-mono">X-Hub-Signature-256</code>) and
                delivered to your two-way inbox automatically.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* VIEW 4: CONNECTED WHATSAPP ACCOUNTS / PROVIDERS */}
      {activeSubTab === "providers" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Connected WhatsApp Profiles & BSPs
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage your Meta WhatsApp Business Accounts, Interakt, WATI, and
                Twilio phone numbers.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => onOpenConnectModal("WHATSAPP")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Another WhatsApp Provider</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {whatsappConfigs.map((config) => (
              <ConnectedProviderCard
                key={config.configuration_uuid}
                configuration={config}
                onEdit={(cfg) => {
                  if (onEditConfig) onEditConfig(cfg);
                  else onOpenConnectModal("WHATSAPP");
                }}
                onTest={async (uuid) => {
                  try {
                    const res: any = await api.post(
                      `/messaging/provider-configurations/${uuid}/test`,
                      {},
                    );
                    alert(res?.message || "Connection tested successfully!");
                  } catch (e: any) {
                    alert(
                      e?.response?.data?.message ||
                        e?.message ||
                        "Connection test failed",
                    );
                  }
                }}
                onSetDefault={async (uuid) => {
                  try {
                    await api.post(
                      `/messaging/provider-configurations/${uuid}/default`,
                      {},
                    );
                    if (onRefresh) onRefresh();
                  } catch (e: any) {
                    alert("Failed to set default profile");
                  }
                }}
                onDelete={async (uuid) => {
                  if (
                    !confirm(
                      "Are you sure you want to delete this WhatsApp configuration?",
                    )
                  )
                    return;
                  try {
                    await api.delete(
                      `/messaging/provider-configurations/${uuid}`,
                    );
                    if (onRefresh) onRefresh();
                  } catch (e: any) {
                    alert("Failed to delete configuration");
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* START NEW CHAT MODAL */}
      {isNewChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                <Phone className="w-5 h-5 text-emerald-600" />
                <span>Start New WhatsApp Chat</span>
              </div>
              <button
                type="button"
                onClick={() => setIsNewChatOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartNewChat} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Phone Number (with Country Code)
                </label>
                <Input
                  required
                  placeholder="+1 (555) 019-2834"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  className="text-xs font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Format in E.164 (e.g. +14155552671).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Initial Template Message (Recommended for new contacts)
                </label>
                <select
                  value={selectedTemplateName}
                  onChange={(e) => setSelectedTemplateName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">
                    -- Choose template (Required if outside 24h) --
                  </option>
                  {templates.map((t) => (
                    <option key={t.template_uuid} value={t.name}>
                      {t.name} ({t.category} • {t.language})
                    </option>
                  ))}
                </select>
              </div>

              {!selectedTemplateName && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Free-form Message Text (Only if within 24h window)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Type initial message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewChatOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSending || !newChatPhone}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                >
                  {isSending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Start Conversation</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WHATSAPP TEMPLATE CREATOR / EDITOR MODAL */}
      <WhatsAppTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => {
          setIsTemplateModalOpen(false);
          setEditingTemplate(null);
        }}
        onSuccess={loadTemplates}
        configurationUuid={selectedConfig?.configuration_uuid || ""}
        editingTemplate={editingTemplate}
      />
    </div>
  );
};
