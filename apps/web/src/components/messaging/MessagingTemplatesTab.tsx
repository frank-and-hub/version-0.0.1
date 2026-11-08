"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { UserProviderConfiguration } from "./types";
import {
  Mail,
  MessageSquare,
  Smartphone,
  Plus,
  Search,
  Trash2,
  Edit2,
  Eye,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Layers,
  Phone,
  FileText,
  X,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Hash,
} from "lucide-react";

// Types
export interface EmailTemplateItem {
  template_uuid: string;
  channel: "EMAIL";
  name: string;
  description?: string;
  subject: string;
  html_content: string;
  text_content?: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
}

export interface WhatsAppTemplateItem {
  template_uuid: string;
  channel: "WHATSAPP";
  provider_configuration_uuid: string;
  meta_template_id?: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
  created_at: string;
}

export interface SmsTemplateItem {
  template_uuid: string;
  channel: "SMS";
  name: string;
  description?: string;
  body: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
}

export type UnifiedTemplateItem =
  | EmailTemplateItem
  | WhatsAppTemplateItem
  | SmsTemplateItem;

interface MessagingTemplatesTabProps {
  configurations: UserProviderConfiguration[];
  onUseInComposer?: (channel: "EMAIL" | "WHATSAPP" | "SMS", template: any) => void;
}

// GSM 7-bit charset constants for SMS calculation
const GSM_7BIT_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_7BIT_EXTENDED = '|^€{}[]~\\';

function calculateSmsSegments(text: string) {
  if (!text || text.length === 0) {
    return { encoding: "GSM_7BIT" as const, charCount: 0, segmentCount: 1, charsRemaining: 160, hasUnicode: false };
  }
  let isGsm = true;
  let gsmCount = 0;
  for (const char of text) {
    if (GSM_7BIT_BASIC.includes(char)) {
      gsmCount += 1;
    } else if (GSM_7BIT_EXTENDED.includes(char)) {
      gsmCount += 2;
    } else {
      isGsm = false;
      break;
    }
  }
  if (isGsm) {
    if (gsmCount <= 160) {
      return { encoding: "GSM_7BIT" as const, charCount: gsmCount, segmentCount: 1, charsRemaining: 160 - gsmCount, hasUnicode: false };
    }
    const segmentCount = Math.ceil(gsmCount / 153);
    const inLast = gsmCount % 153 || 153;
    return { encoding: "GSM_7BIT" as const, charCount: gsmCount, segmentCount, charsRemaining: 153 - inLast, hasUnicode: false };
  }
  const charCount = text.length;
  if (charCount <= 70) {
    return { encoding: "UCS2" as const, charCount, segmentCount: 1, charsRemaining: 70 - charCount, hasUnicode: true };
  }
  const segmentCount = Math.ceil(charCount / 67);
  const inLast = charCount % 67 || 67;
  return { encoding: "UCS2" as const, charCount, segmentCount, charsRemaining: 67 - inLast, hasUnicode: true };
}

// Variable replacer helper
function substituteVariables(text: string, vars: Record<string, string>) {
  if (!text) return "";
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return vars[key] !== undefined && vars[key] !== "" ? vars[key] : `{{${key}}}`;
  });
}

// Extract variables from text
function extractVariables(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
  return Array.from(new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "").trim())));
}

export function MessagingTemplatesTab({
  configurations,
  onUseInComposer,
}: MessagingTemplatesTabProps) {
  const [activeChannel, setActiveChannel] = useState<"ALL" | "EMAIL" | "WHATSAPP" | "SMS">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Template lists
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateItem[]>([]);
  const [whatsAppTemplates, setWhatsAppTemplates] = useState<WhatsAppTemplateItem[]>([]);
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplateItem[]>([]);

  // Modal states
  const [createModalChannel, setCreateModalChannel] = useState<"EMAIL" | "WHATSAPP" | "SMS" | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<UnifiedTemplateItem | null>(null);
  const [sampleVariables, setSampleVariables] = useState<Record<string, string>>({});
  const [previewDeviceMode, setPreviewDeviceMode] = useState<"DESKTOP" | "MOBILE">("DESKTOP");
  const [copiedText, setCopiedText] = useState(false);

  // Form states for creation
  // 1. Email Form
  const [emailForm, setEmailForm] = useState({
    name: "",
    description: "",
    subject: "",
    html_content: "",
    text_content: "",
  });

  // 2. WhatsApp Form
  const [waForm, setWaForm] = useState<{
    configuration_uuid: string;
    name: string;
    language: string;
    category: string;
    header_text: string;
    body_text: string;
    footer_text: string;
    buttons: Array<{ type: string; text: string; url?: string }>;
  }>({
    configuration_uuid: "",
    name: "",
    language: "en_US",
    category: "MARKETING",
    header_text: "",
    body_text: "",
    footer_text: "",
    buttons: [],
  });

  // 3. SMS Form
  const [smsForm, setSmsForm] = useState({
    name: "",
    description: "",
    body: "",
  });

  // Load all templates
  const loadAllTemplates = async () => {
    setIsLoading(true);
    try {
      const [emailRes, waRes, smsRes] = await Promise.allSettled([
        api.get("/messaging/templates"),
        api.get("/messaging/whatsapp/templates"),
        api.get("/messaging/sms/templates"),
      ]);

      if (emailRes.status === "fulfilled") {
        const items = ((emailRes.value as any)?.data || []).map((t: any) => ({
          ...t,
          channel: "EMAIL" as const,
        }));
        setEmailTemplates(items);
      }

      if (waRes.status === "fulfilled") {
        const items = ((waRes.value as any)?.data || []).map((t: any) => ({
          ...t,
          channel: "WHATSAPP" as const,
        }));
        setWhatsAppTemplates(items);
      }

      if (smsRes.status === "fulfilled") {
        const items = ((smsRes.value as any)?.data || []).map((t: any) => ({
          ...t,
          channel: "SMS" as const,
        }));
        setSmsTemplates(items);
      }
    } catch (err: any) {
      console.error("Error loading templates:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllTemplates();
  }, []);

  // Filtered list
  const filteredTemplates = useMemo(() => {
    let list: UnifiedTemplateItem[] = [];
    if (activeChannel === "ALL" || activeChannel === "EMAIL") list = list.concat(emailTemplates);
    if (activeChannel === "ALL" || activeChannel === "WHATSAPP") list = list.concat(whatsAppTemplates);
    if (activeChannel === "ALL" || activeChannel === "SMS") list = list.concat(smsTemplates);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        const nameMatches = item.name.toLowerCase().includes(q);
        if (item.channel === "EMAIL") {
          return nameMatches || item.subject.toLowerCase().includes(q) || item.html_content.toLowerCase().includes(q);
        }
        if (item.channel === "SMS") {
          return nameMatches || item.body.toLowerCase().includes(q);
        }
        if (item.channel === "WHATSAPP") {
          let body = "";
          for (const c of item.components || []) {
            if (c.type === "BODY") body = c.text || "";
          }
          return nameMatches || body.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
        }
        return nameMatches;
      });
    }

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [activeChannel, emailTemplates, whatsAppTemplates, smsTemplates, searchQuery]);

  // Handle Save Email Template
  const handleSaveEmailTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("save_email");
    setFeedback(null);
    try {
      const vars = extractVariables(`${emailForm.subject} ${emailForm.html_content}`);
      await api.post("/messaging/templates", {
        ...emailForm,
        variables: vars,
      });
      setFeedback({ type: "success", message: "Email template saved successfully!" });
      setCreateModalChannel(null);
      setEmailForm({ name: "", description: "", subject: "", html_content: "", text_content: "" });
      await loadAllTemplates();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.message || "Failed to save email template." });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Save WhatsApp Template
  const handleSaveWhatsAppTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("save_wa");
    setFeedback(null);
    try {
      await api.post("/messaging/whatsapp/templates", waForm);
      setFeedback({ type: "success", message: "WhatsApp message template created successfully!" });
      setCreateModalChannel(null);
      setWaForm({
        configuration_uuid: "",
        name: "",
        language: "en_US",
        category: "MARKETING",
        header_text: "",
        body_text: "",
        footer_text: "",
        buttons: [],
      });
      await loadAllTemplates();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.message || "Failed to save WhatsApp template." });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Save SMS Template
  const handleSaveSmsTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("save_sms");
    setFeedback(null);
    try {
      const vars = extractVariables(smsForm.body);
      await api.post("/messaging/sms/templates", {
        ...smsForm,
        variables: vars,
      });
      setFeedback({ type: "success", message: "SMS message template saved successfully!" });
      setCreateModalChannel(null);
      setSmsForm({ name: "", description: "", body: "" });
      await loadAllTemplates();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.message || "Failed to save SMS template." });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Delete Template
  const handleDeleteTemplate = async (item: UnifiedTemplateItem) => {
    if (!confirm(`Are you sure you want to delete template "${item.name}"?`)) return;
    setActionLoading(`del_${item.template_uuid}`);
    try {
      if (item.channel === "EMAIL") {
        await api.delete(`/messaging/templates/${item.template_uuid}`);
      } else if (item.channel === "WHATSAPP") {
        await api.delete(`/messaging/whatsapp/templates/${item.template_uuid}`);
      } else if (item.channel === "SMS") {
        await api.delete(`/messaging/sms/templates/${item.template_uuid}`);
      }
      setFeedback({ type: "success", message: "Template deleted successfully." });
      await loadAllTemplates();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.message || "Failed to delete template." });
    } finally {
      setActionLoading(null);
    }
  };

  // Open Preview Modal with auto-populated sample variables
  const handleOpenPreview = (item: UnifiedTemplateItem) => {
    setPreviewTemplate(item);
    const vars: Record<string, string> = {};
    if (item.channel === "EMAIL") {
      for (const v of item.variables || []) {
        vars[v] = v === "name" ? "Alex Taylor" : v === "company" ? "Acme Corp" : v === "code" ? "482091" : `Sample ${v}`;
      }
    } else if (item.channel === "SMS") {
      for (const v of item.variables || []) {
        vars[v] = v === "name" ? "Alex" : v === "code" ? "739104" : `Sample ${v}`;
      }
    } else if (item.channel === "WHATSAPP") {
      let bodyText = "";
      for (const comp of item.components || []) {
        if (comp.type === "BODY") bodyText = comp.text || "";
      }
      const extracted = extractVariables(bodyText);
      for (const v of extracted) {
        vars[v] = v === "1" ? "Alex" : v === "2" ? "20% OFF" : `Sample ${v}`;
      }
    }
    setSampleVariables(vars);
  };

  // Calculations for live SMS in modal
  const liveSmsStats = useMemo(() => {
    return calculateSmsSegments(smsForm.body);
  }, [smsForm.body]);

  // Extract variables for live modal editing
  const liveEmailVariables = useMemo(() => {
    return extractVariables(`${emailForm.subject} ${emailForm.html_content}`);
  }, [emailForm.subject, emailForm.html_content]);

  const liveWaVariables = useMemo(() => {
    return extractVariables(waForm.body_text);
  }, [waForm.body_text]);

  const liveSmsVariables = useMemo(() => {
    return extractVariables(smsForm.body);
  }, [smsForm.body]);

  return (
    <div className="space-y-6">
      {/* Top Header & Channel Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Unified Messaging Template Studio
            </h3>
            <Badge variant="indigo" className="text-xs">
              Multi-Channel
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Design, preview, and test reusable templates for Email, WhatsApp, and SMS with real-time interactive previews.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllTemplates}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          {/* Create Template Dropdown / Group */}
          <div className="inline-flex rounded-xl shadow-sm">
            <Button
              size="sm"
              onClick={() => {
                setSampleVariables({});
                setCreateModalChannel("EMAIL");
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-r-none border-r border-indigo-500 text-xs flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>+ Email</span>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSampleVariables({});
                setCreateModalChannel("WHATSAPP");
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-none border-r border-emerald-500 text-xs flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>+ WhatsApp</span>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSampleVariables({});
                setCreateModalChannel("SMS");
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-l-none text-xs flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>+ SMS</span>
            </Button>
          </div>
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

      {/* Channel Segment Controls & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-100/80 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-1 w-full sm:w-auto">
          {[
            { id: "ALL", label: "All Templates", count: emailTemplates.length + whatsAppTemplates.length + smsTemplates.length, icon: Layers },
            { id: "EMAIL", label: "Email", count: emailTemplates.length, icon: Mail },
            { id: "WHATSAPP", label: "WhatsApp", count: whatsAppTemplates.length, icon: MessageSquare },
            { id: "SMS", label: "SMS", count: smsTemplates.length, icon: Smartphone },
          ].map((ch) => {
            const Icon = ch.icon;
            const isActive = activeChannel === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id as any)}
                className={`flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold ring-1 ring-slate-200/60 dark:ring-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{ch.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600" : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"}`}>
                  {ch.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <Input
            placeholder="Search template name, content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs py-1.5 h-8"
          />
        </div>
      </div>

      {/* Template Grid */}
      {filteredTemplates.length === 0 ? (
        <Card className="py-16 text-center text-slate-400 border-dashed border-2 border-slate-200 dark:border-slate-800 space-y-3">
          <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
          <div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No messaging templates found
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Create your first Email, WhatsApp, or SMS template to reuse personalized copy across all channels.
            </p>
          </div>
          <div className="flex justify-center gap-2 pt-2">
            <Button size="sm" onClick={() => setCreateModalChannel("EMAIL")} className="bg-indigo-600 text-white text-xs">
              + New Email Template
            </Button>
            <Button size="sm" onClick={() => setCreateModalChannel("WHATSAPP")} className="bg-emerald-600 text-white text-xs">
              + New WhatsApp Template
            </Button>
            <Button size="sm" onClick={() => setCreateModalChannel("SMS")} className="bg-purple-600 text-white text-xs">
              + New SMS Template
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((item) => {
            const isEmail = item.channel === "EMAIL";
            const isWhatsApp = item.channel === "WHATSAPP";
            const isSms = item.channel === "SMS";

            // Extract body snippet for display
            let bodySnippet = "";
            let categoryOrSubject = "";
            let vars: string[] = [];

            if (isEmail) {
              const email = item as EmailTemplateItem;
              bodySnippet = email.html_content.replace(/<[^>]*>?/gm, "").slice(0, 120);
              categoryOrSubject = email.subject;
              vars = email.variables || [];
            } else if (isWhatsApp) {
              const wa = item as WhatsAppTemplateItem;
              categoryOrSubject = `${wa.category} • ${wa.language}`;
              for (const comp of wa.components || []) {
                if (comp.type === "BODY") bodySnippet = comp.text || "";
              }
              vars = extractVariables(bodySnippet);
            } else if (isSms) {
              const sms = item as SmsTemplateItem;
              bodySnippet = sms.body;
              categoryOrSubject = sms.description || "SMS Broadcast";
              vars = sms.variables || [];
            }

            return (
              <Card
                key={`${item.channel}_${item.template_uuid}`}
                className="p-4 flex flex-col justify-between border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all group"
              >
                <div>
                  {/* Channel & Status Bar */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={isEmail ? "indigo" : isWhatsApp ? "emerald" : "default"}
                        className="text-[10px] font-bold"
                      >
                        {isEmail ? "EMAIL" : isWhatsApp ? "WHATSAPP" : "SMS"}
                      </Badge>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <Badge variant="emerald" className="text-[10px]">
                      {isWhatsApp ? (item as WhatsAppTemplateItem).status || "APPROVED" : "Active"}
                    </Badge>
                  </div>

                  {/* Template Name & Subject */}
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {item.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                    {categoryOrSubject}
                  </p>

                  {/* Body Preview */}
                  <div className="mt-2.5 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 line-clamp-3 font-mono leading-relaxed border border-slate-100 dark:border-slate-800">
                    {bodySnippet || "(No body content)"}
                  </div>

                  {/* Dynamic Variables Chips */}
                  {vars.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {vars.slice(0, 4).map((v) => (
                        <span
                          key={v}
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                          {"{{" + v + "}}"}
                        </span>
                      ))}
                      {vars.length > 4 && (
                        <span className="text-[9px] text-slate-400 font-mono">
                          +{vars.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenPreview(item)}
                    className="h-7 px-2.5 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Real-time Preview</span>
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTemplate(item)}
                      disabled={actionLoading === `del_${item.template_uuid}`}
                      className="h-7 px-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                      title="Delete Template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. EMAIL TEMPLATE CREATION MODAL WITH SIDE-BY-SIDE REAL-TIME PREVIEW      */}
      {/* ========================================================================= */}
      {createModalChannel === "EMAIL" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Create Email Template with Real-Time Preview
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Edit HTML and subject line with live rendered browser preview and test variables.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalChannel(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 overflow-y-auto flex-1">
              {/* Left Column: Form Editor */}
              <form onSubmit={handleSaveEmailTemplate} className="p-5 space-y-3.5 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Template Name *
                    </label>
                    <Input
                      placeholder="Order Confirmation Receipt"
                      value={emailForm.name}
                      onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })}
                      required
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Description
                    </label>
                    <Input
                      placeholder="Sent when customer payment succeeds"
                      value={emailForm.description}
                      onChange={(e) => setEmailForm({ ...emailForm, description: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Subject Line * (supports {"{{variable}}"})
                    </label>
                    <Input
                      placeholder="Receipt for order #{{order_id}} from {{company}}"
                      value={emailForm.subject}
                      onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                      required
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        HTML Email Content *
                      </label>
                      <span className="text-[10px] text-slate-400">
                        HTML + {"{{tags}}"}
                      </span>
                    </div>
                    <textarea
                      rows={9}
                      value={emailForm.html_content}
                      onChange={(e) => setEmailForm({ ...emailForm, html_content: e.target.value })}
                      placeholder={`<div style="font-family: sans-serif; padding: 20px;">
  <h2>Hi {{name}},</h2>
  <p>Thank you for your order! Your confirmation code is <strong>{{code}}</strong>.</p>
  <a href="https://example.com" style="background:#4F46E5; color:#fff; padding:10px 20px; text-decoration:none; border-radius:6px;">View Order</a>
</div>`}
                      required
                      className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Detected Variables Bar */}
                  {liveEmailVariables.length > 0 && (
                    <div className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                      <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 block mb-1.5">
                        Detected Dynamic Variables ({liveEmailVariables.length}):
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {liveEmailVariables.map((v) => (
                          <div key={v}>
                            <span className="text-[10px] text-slate-500 font-mono">{"{{" + v + "}}"}:</span>
                            <input
                              type="text"
                              placeholder={`Sample ${v}`}
                              value={sampleVariables[v] || ""}
                              onChange={(e) => setSampleVariables({ ...sampleVariables, [v]: e.target.value })}
                              className="w-full text-[11px] px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => setCreateModalChannel(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    disabled={actionLoading === "save_email"}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {actionLoading === "save_email" ? "Saving Template..." : "Save Email Template"}
                  </Button>
                </div>
              </form>

              {/* Right Column: Real-Time Live Preview */}
              <div className="p-5 bg-slate-50 dark:bg-slate-950 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      Real-Time Email Client Preview
                    </span>
                    <Badge variant="indigo" className="text-[10px]">
                      Live Render
                    </Badge>
                  </div>

                  {/* Browser mockup window */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                    {/* Browser top header */}
                    <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono truncate">
                        Subject: {substituteVariables(emailForm.subject, sampleVariables) || "(Subject line)"}
                      </span>
                    </div>

                    {/* Email Headers Mock */}
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 text-[11px] space-y-1 bg-slate-50/50 dark:bg-slate-950/40">
                      <div className="flex items-center gap-2 text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">From:</span>
                        <span>Acme Notifications &lt;no-reply@yourdomain.com&gt;</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">To:</span>
                        <span>Alex Taylor &lt;alex@example.com&gt;</span>
                      </div>
                    </div>

                    {/* Rendered HTML Body */}
                    <div className="p-4 max-h-[350px] overflow-y-auto">
                      {emailForm.html_content ? (
                        <div
                          className="prose prose-xs dark:prose-invert max-w-none text-xs"
                          dangerouslySetInnerHTML={{
                            __html: substituteVariables(emailForm.html_content, sampleVariables),
                          }}
                        />
                      ) : (
                        <div className="py-12 text-center text-slate-400 text-xs">
                          Start typing HTML content on the left to see live rendering.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 text-center mt-3">
                  Variables wrapped in {"{{...}}"} update instantly above as you type.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. WHATSAPP TEMPLATE CREATION MODAL WITH REAL-TIME PHONE PREVIEW          */}
      {/* ========================================================================= */}
      {createModalChannel === "WHATSAPP" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-950/40">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Create WhatsApp Message Template with Live Phone Preview
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Compliant with Meta WhatsApp Business rules (Header, Body with parameters, Footer, and Quick Reply / URL buttons).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalChannel(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 overflow-y-auto flex-1">
              {/* Left Column: Form Editor */}
              <form onSubmit={handleSaveWhatsAppTemplate} className="p-5 space-y-3.5 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Template Name * (lowercase + underscores)
                      </label>
                      <Input
                        placeholder="order_confirmation_v1"
                        value={waForm.name}
                        onChange={(e) =>
                          setWaForm({
                            ...waForm,
                            name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                          })
                        }
                        required
                        className="text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Category *
                      </label>
                      <select
                        value={waForm.category}
                        onChange={(e) => setWaForm({ ...waForm, category: e.target.value })}
                        className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-slate-800 dark:text-slate-200"
                      >
                        <option value="MARKETING">MARKETING</option>
                        <option value="UTILITY">UTILITY</option>
                        <option value="AUTHENTICATION">AUTHENTICATION</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Header Text (Optional)
                    </label>
                    <Input
                      placeholder="Special Announcement"
                      value={waForm.header_text}
                      onChange={(e) => setWaForm({ ...waForm, header_text: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Body Text * (supports {"{{1}}"}, {"{{2}}"} or {"{{name}}"})
                    </label>
                    <textarea
                      rows={5}
                      value={waForm.body_text}
                      onChange={(e) => setWaForm({ ...waForm, body_text: e.target.value })}
                      placeholder="Hi {{name}}, your order #{{order_id}} is confirmed and will ship soon!"
                      required
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Footer Text (Optional)
                    </label>
                    <Input
                      placeholder="Reply STOP to unsubscribe"
                      value={waForm.footer_text}
                      onChange={(e) => setWaForm({ ...waForm, footer_text: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  {/* Interactive Buttons */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Interactive Buttons (Up to 3)
                      </label>
                      {waForm.buttons.length < 3 && (
                        <button
                          type="button"
                          onClick={() =>
                            setWaForm({
                              ...waForm,
                              buttons: [...waForm.buttons, { type: "QUICK_REPLY", text: "Track Order" }],
                            })
                          }
                          className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold"
                        >
                          + Add Button
                        </button>
                      )}
                    </div>
                    {waForm.buttons.map((btn, idx) => (
                      <div key={idx} className="flex items-center gap-2 mb-2">
                        <select
                          value={btn.type}
                          onChange={(e) => {
                            const updated = [...waForm.buttons];
                            updated[idx].type = e.target.value;
                            setWaForm({ ...waForm, buttons: updated });
                          }}
                          className="text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1"
                        >
                          <option value="QUICK_REPLY">Quick Reply</option>
                          <option value="URL">Visit Website (URL)</option>
                          <option value="PHONE_NUMBER">Call Phone</option>
                        </select>
                        <Input
                          placeholder="Button Label"
                          value={btn.text}
                          onChange={(e) => {
                            const updated = [...waForm.buttons];
                            updated[idx].text = e.target.value;
                            setWaForm({ ...waForm, buttons: updated });
                          }}
                          className="text-[11px] h-7"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = waForm.buttons.filter((_, i) => i !== idx);
                            setWaForm({ ...waForm, buttons: updated });
                          }}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Detected Variables Bar */}
                  {liveWaVariables.length > 0 && (
                    <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 block mb-1.5">
                        Test Parameters ({liveWaVariables.length}):
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {liveWaVariables.map((v) => (
                          <div key={v}>
                            <span className="text-[10px] text-slate-500 font-mono">{"{{" + v + "}}"}:</span>
                            <input
                              type="text"
                              placeholder={`Sample ${v}`}
                              value={sampleVariables[v] || ""}
                              onChange={(e) => setSampleVariables({ ...sampleVariables, [v]: e.target.value })}
                              className="w-full text-[11px] px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => setCreateModalChannel(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    disabled={actionLoading === "save_wa"}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {actionLoading === "save_wa" ? "Saving..." : "Save WhatsApp Template"}
                  </Button>
                </div>
              </form>

              {/* Right Column: Real-Time WhatsApp Phone Mockup */}
              <div className="p-5 bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center">
                {/* Mobile Phone Mockup Frame */}
                <div className="w-[310px] rounded-[36px] bg-slate-900 p-3 shadow-2xl border-4 border-slate-800">
                  {/* Phone Speaker Notch */}
                  <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2" />

                  {/* WhatsApp App Screen */}
                  <div className="rounded-[24px] bg-[#EFEAE2] dark:bg-[#0B141A] overflow-hidden min-h-[440px] flex flex-col justify-between text-slate-900 dark:text-slate-100">
                    {/* Top App Header */}
                    <div className="bg-[#075E54] dark:bg-[#1F2C34] text-white p-3 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white">
                          WA
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold leading-none">Business Account</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                          </div>
                          <span className="text-[9px] text-emerald-200">Verified official template</span>
                        </div>
                      </div>
                    </div>

                    {/* Chat Bubble Container */}
                    <div className="p-3 flex-1 flex flex-col justify-center">
                      <div className="bg-white dark:bg-[#1F2C34] rounded-2xl p-3 shadow-md border border-slate-200/40 dark:border-slate-800/60 max-w-[95%]">
                        {/* Header */}
                        {waForm.header_text && (
                          <div className="text-xs font-bold text-slate-900 dark:text-white mb-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
                            {waForm.header_text}
                          </div>
                        )}

                        {/* Body */}
                        <div className="text-xs whitespace-pre-wrap leading-relaxed">
                          {substituteVariables(waForm.body_text, sampleVariables) || "Template body message preview..."}
                        </div>

                        {/* Footer & Timestamp */}
                        <div className="mt-2 pt-1 flex items-baseline justify-between text-[9px] text-slate-400">
                          <span>{waForm.footer_text}</span>
                          <span className="flex items-center gap-1 font-mono">
                            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            <span className="text-emerald-500 font-bold">✓✓</span>
                          </span>
                        </div>

                        {/* Buttons */}
                        {waForm.buttons.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                            {waForm.buttons.map((btn, idx) => (
                              <div
                                key={idx}
                                className="py-1.5 px-3 bg-slate-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 text-center font-bold text-[11px] rounded-lg shadow-xs flex items-center justify-center gap-1"
                              >
                                {btn.type === "PHONE_NUMBER" ? (
                                  <Phone className="w-3 h-3" />
                                ) : (
                                  <Sparkles className="w-3 h-3" />
                                )}
                                <span>{btn.text || "Action"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-2 bg-slate-200/60 dark:bg-slate-900 text-center text-[10px] text-slate-400">
                      WhatsApp Business Cloud API Preview
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SMS TEMPLATE CREATION MODAL WITH LIVE SMARTPHONE PREVIEW               */}
      {/* ========================================================================= */}
      {createModalChannel === "SMS" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-purple-50 dark:bg-purple-950/40">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Create SMS Template with Real-Time Segment Counter & Device Preview
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Calculates GSM 7-bit vs UCS-2 Unicode segments and shows live smartphone bubble render.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalChannel(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 overflow-y-auto flex-1">
              {/* Left Column: Form Editor */}
              <form onSubmit={handleSaveSmsTemplate} className="p-5 space-y-3.5 flex flex-col justify-between">
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Template Name *
                    </label>
                    <Input
                      placeholder="Security OTP Alert"
                      value={smsForm.name}
                      onChange={(e) => setSmsForm({ ...smsForm, name: e.target.value })}
                      required
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Description
                    </label>
                    <Input
                      placeholder="One-time verification code notification"
                      value={smsForm.description}
                      onChange={(e) => setSmsForm({ ...smsForm, description: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        SMS Body Text * (supports {"{{variable}}"})
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Carrier-compliant text
                      </span>
                    </div>
                    <textarea
                      rows={6}
                      value={smsForm.body}
                      onChange={(e) => setSmsForm({ ...smsForm, body: e.target.value })}
                      placeholder="Hello {{name}}, your security code is {{code}}. Valid for 10 minutes. Reply STOP to opt out."
                      required
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                    />

                    {/* Character and Segment Stats Live Bar */}
                    <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {liveSmsStats.charCount} chars
                        </span>
                        <span>•</span>
                        <span className="font-bold text-purple-600 dark:text-purple-400">
                          {liveSmsStats.segmentCount} segment{liveSmsStats.segmentCount > 1 ? "s" : ""}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500 text-[11px]">
                          {liveSmsStats.charsRemaining} remaining
                        </span>
                      </div>

                      <Badge
                        variant={liveSmsStats.encoding === "GSM_7BIT" ? "emerald" : "amber"}
                        className="text-[10px]"
                      >
                        {liveSmsStats.encoding === "GSM_7BIT" ? "GSM 7-bit" : "UCS-2 Unicode"}
                      </Badge>
                    </div>

                    {liveSmsStats.hasUnicode && (
                      <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-300">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Contains emojis or Unicode characters (max 70 chars per segment).</span>
                      </div>
                    )}
                  </div>

                  {/* Detected Variables Bar */}
                  {liveSmsVariables.length > 0 && (
                    <div className="p-2.5 bg-purple-50/50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/40">
                      <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 block mb-1.5">
                        Test Parameters ({liveSmsVariables.length}):
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {liveSmsVariables.map((v) => (
                          <div key={v}>
                            <span className="text-[10px] text-slate-500 font-mono">{"{{" + v + "}}"}:</span>
                            <input
                              type="text"
                              placeholder={`Sample ${v}`}
                              value={sampleVariables[v] || ""}
                              onChange={(e) => setSampleVariables({ ...sampleVariables, [v]: e.target.value })}
                              className="w-full text-[11px] px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => setCreateModalChannel(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    disabled={actionLoading === "save_sms"}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {actionLoading === "save_sms" ? "Saving..." : "Save SMS Template"}
                  </Button>
                </div>
              </form>

              {/* Right Column: Real-Time Mobile Smartphone SMS Mockup */}
              <div className="p-5 bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center">
                <div className="w-[310px] rounded-[36px] bg-slate-900 p-3 shadow-2xl border-4 border-slate-800">
                  {/* Phone Speaker Notch */}
                  <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2" />

                  {/* SMS Messaging Screen */}
                  <div className="rounded-[24px] bg-slate-100 dark:bg-slate-950 overflow-hidden min-h-[440px] flex flex-col justify-between text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800">
                    {/* Status bar */}
                    <div className="px-4 py-2 bg-slate-200 dark:bg-slate-900 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                      <span>9:41 AM</span>
                      <span>5G • 100%</span>
                    </div>

                    {/* Sender bar */}
                    <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                        SMS
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">+1 (555) 019-2834</span>
                    </div>

                    {/* Chat Bubble Stream */}
                    <div className="p-4 flex-1 flex flex-col justify-end space-y-2">
                      <div className="bg-indigo-600 text-white rounded-2xl rounded-br-none p-3 shadow-sm text-xs leading-relaxed max-w-[85%] self-end">
                        <p className="whitespace-pre-wrap">
                          {substituteVariables(smsForm.body, sampleVariables) || "Hello! Your SMS template text renders here in real time."}
                        </p>
                        <div className="text-[9px] text-indigo-200 text-right mt-1.5 font-mono">
                          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • Sent
                        </div>
                      </div>
                    </div>

                    {/* Bottom message input mock */}
                    <div className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1.5 text-[11px] text-slate-400">
                        Text Message
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. REAL-TIME INTERACTIVE LIVE PREVIEW MODAL FOR EXISTING TEMPLATES         */}
      {/* ========================================================================= */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    previewTemplate.channel === "EMAIL"
                      ? "indigo"
                      : previewTemplate.channel === "WHATSAPP"
                      ? "emerald"
                      : "default"
                  }
                  className="text-xs"
                >
                  {previewTemplate.channel}
                </Badge>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Live Preview: {previewTemplate.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 overflow-y-auto flex-1">
              {/* Left Column: Sample Test Variables Editor */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Sample Test Data
                </h4>
                <p className="text-[11px] text-slate-500">
                  Update test values below to observe real-time variable injection on the device screen.
                </p>

                <div className="space-y-2 pt-1">
                  {Object.keys(sampleVariables).length === 0 ? (
                    <div className="text-xs text-slate-400 italic">No variables found in this template.</div>
                  ) : (
                    Object.keys(sampleVariables).map((v) => (
                      <div key={v}>
                        <label className="block text-[11px] font-mono text-slate-600 dark:text-slate-400 mb-0.5">
                          {"{{" + v + "}}"}:
                        </label>
                        <Input
                          value={sampleVariables[v]}
                          onChange={(e) => setSampleVariables({ ...sampleVariables, [v]: e.target.value })}
                          className="text-xs h-7"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Center / Right: Channel Device Live Preview */}
              <div className="lg:col-span-2 p-6 flex flex-col items-center justify-center bg-slate-100/60 dark:bg-slate-950">
                {previewTemplate.channel === "EMAIL" && (
                  <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-bold truncate">
                        {substituteVariables((previewTemplate as EmailTemplateItem).subject, sampleVariables)}
                      </span>
                      <Badge variant="indigo" className="text-[10px]">
                        HTML Render
                      </Badge>
                    </div>
                    <div
                      className="p-5 max-h-[380px] overflow-y-auto text-xs prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: substituteVariables((previewTemplate as EmailTemplateItem).html_content, sampleVariables),
                      }}
                    />
                  </div>
                )}

                {previewTemplate.channel === "WHATSAPP" && (
                  <div className="w-[300px] rounded-[32px] bg-slate-900 p-3 shadow-xl border-4 border-slate-800">
                    <div className="w-20 h-3.5 bg-slate-800 rounded-full mx-auto mb-2" />
                    <div className="rounded-[20px] bg-[#EFEAE2] dark:bg-[#0B141A] overflow-hidden min-h-[380px] p-3 flex flex-col justify-center">
                      <div className="bg-white dark:bg-[#1F2C34] rounded-2xl p-3 shadow-sm border border-slate-200/40 dark:border-slate-800/60 text-xs">
                        {/* Body text */}
                        <p className="whitespace-pre-wrap leading-relaxed text-slate-900 dark:text-slate-100">
                          {(() => {
                            let body = "";
                            for (const comp of (previewTemplate as WhatsAppTemplateItem).components || []) {
                              if (comp.type === "BODY") body = comp.text || "";
                            }
                            return substituteVariables(body, sampleVariables);
                          })()}
                        </p>
                        <div className="mt-1 text-right text-[9px] text-slate-400 font-mono">
                          12:00 PM <span className="text-emerald-500 font-bold">✓✓</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {previewTemplate.channel === "SMS" && (
                  <div className="w-[300px] rounded-[32px] bg-slate-900 p-3 shadow-xl border-4 border-slate-800">
                    <div className="w-20 h-3.5 bg-slate-800 rounded-full mx-auto mb-2" />
                    <div className="rounded-[20px] bg-slate-100 dark:bg-slate-950 overflow-hidden min-h-[380px] p-3 flex flex-col justify-end">
                      <div className="bg-indigo-600 text-white rounded-2xl rounded-br-none p-3 shadow-sm text-xs leading-relaxed self-end max-w-[90%]">
                        <p className="whitespace-pre-wrap">
                          {substituteVariables((previewTemplate as SmsTemplateItem).body, sampleVariables)}
                        </p>
                        <div className="text-[9px] text-indigo-200 text-right mt-1 font-mono">
                          12:00 PM • Sent
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
              <Button size="sm" onClick={() => setPreviewTemplate(null)} className="bg-slate-900 text-white">
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
