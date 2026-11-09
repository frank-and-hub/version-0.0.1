"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import {
  FileText,
  X,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
} from "lucide-react";

export interface WhatsAppTemplateData {
  template_uuid?: string;
  name: string;
  language: string;
  category: string;
  body_text: string;
  header_text?: string;
  footer_text?: string;
  buttons?: Array<{ type: string; text: string; url?: string }>;
}

interface WhatsAppTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  configurationUuid: string;
  editingTemplate?: any | null;
}

export const WhatsAppTemplateModal: React.FC<WhatsAppTemplateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  configurationUuid,
  editingTemplate = null,
}) => {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en_US");
  const [category, setCategory] = useState("MARKETING");
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<
    Array<{ type: string; text: string; url?: string }>
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editingTemplate) {
      setName(editingTemplate.name || "");
      setLanguage(editingTemplate.language || "en_US");
      setCategory(editingTemplate.category || "MARKETING");

      let body = "";
      let header = "";
      let footer = "";
      let btns: any[] = [];

      if (Array.isArray(editingTemplate.components)) {
        for (const comp of editingTemplate.components) {
          if (comp.type === "BODY") body = comp.text || "";
          if (comp.type === "HEADER") header = comp.text || "";
          if (comp.type === "FOOTER") footer = comp.text || "";
          if (comp.type === "BUTTONS") btns = comp.buttons || [];
        }
      }

      setBodyText(body);
      setHeaderText(header);
      setFooterText(footer);
      setButtons(btns);
    } else {
      setName("");
      setLanguage("en_US");
      setCategory("MARKETING");
      setHeaderText("");
      setBodyText(
        "Hello {{1}}, thank you for choosing our service! Your order {{2}} has been confirmed.",
      );
      setFooterText("Reply STOP to unsubscribe");
      setButtons([
        { type: "QUICK_REPLY", text: "Track Order" },
        { type: "QUICK_REPLY", text: "Contact Support" },
      ]);
    }
    setErrorMsg(null);
  }, [editingTemplate, isOpen]);

  if (!isOpen) return null;

  const insertVariable = () => {
    // Count existing variables like {{1}}, {{2}}
    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const nextVarNumber = matches.length + 1;
    setBodyText((prev) => `${prev} {{${nextVarNumber}}}`);
  };

  const handleAddButton = () => {
    if (buttons.length >= 3) return;
    setButtons([...buttons, { type: "QUICK_REPLY", text: "New Button" }]);
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleButtonChange = (index: number, text: string) => {
    const updated = [...buttons];
    updated[index].text = text;
    setButtons(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !bodyText.trim()) {
      setErrorMsg("Template Name and Body Text are required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const payload = {
      configuration_uuid: configurationUuid,
      name,
      language,
      category,
      body_text: bodyText,
      header_text: headerText || undefined,
      footer_text: footerText || undefined,
      buttons: buttons.length > 0 ? buttons : undefined,
    };

    try {
      if (editingTemplate?.template_uuid) {
        await api.put(
          `/messaging/whatsapp/templates/${editingTemplate.template_uuid}`,
          payload,
        );
      } else {
        await api.post("/messaging/whatsapp/templates", payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save WhatsApp Template",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingTemplate
                  ? "Edit WhatsApp Message Template"
                  : "Create WhatsApp Message Template"}
              </h3>
              <p className="text-xs text-slate-500">
                Design compliant Meta WhatsApp templates for customer
                notifications & 24h window re-opening.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content: Form on Left, Live Bubble Preview on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto">
          {/* Left Form: 7 cols */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-7 p-6 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800"
          >
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="order_update_confirmation"
                  value={name}
                  onChange={(e) =>
                    setName(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                    )
                  }
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Lowercase and underscores only
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="MARKETING">Marketing (Offers, updates)</option>
                  <option value="UTILITY">
                    Utility (Orders, alerts, account)
                  </option>
                  <option value="AUTHENTICATION">
                    Authentication (OTPs, codes)
                  </option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Language Code *
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="en_US">English (US) - en_US</option>
                  <option value="en_GB">English (UK) - en_GB</option>
                  <option value="es_ES">Spanish (Spain) - es_ES</option>
                  <option value="pt_BR">Portuguese (Brazil) - pt_BR</option>
                  <option value="hi_IN">Hindi (India) - hi_IN</option>
                  <option value="fr_FR">French - fr_FR</option>
                  <option value="de_DE">German - de_DE</option>
                  <option value="ar_SA">Arabic - ar_SA</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Header Text (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Order Notification"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Message Body Text *
                </label>
                <button
                  type="button"
                  onClick={insertVariable}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Insert Variable (&#123;&#123;1&#125;&#125;)</span>
                </button>
              </div>
              <textarea
                required
                rows={4}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Hello {{1}}, your order {{2}} has been confirmed!"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Footer Text (Optional)
              </label>
              <input
                type="text"
                placeholder="Reply STOP to unsubscribe"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {/* Quick Action Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Interactive Buttons (Up to 3)
                </label>
                {buttons.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddButton}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Button</span>
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {buttons.map((btn, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400 w-5">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={btn.text}
                      onChange={(e) => handleButtonChange(idx, e.target.value)}
                      placeholder="Button label"
                      className="flex-1 text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveButton(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {editingTemplate ? "Save Changes" : "Save WhatsApp Template"}
                </span>
              </Button>
            </div>
          </form>

          {/* Right Preview: 5 cols */}
          <div className="lg:col-span-5 p-6 bg-slate-100/60 dark:bg-slate-950/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>WhatsApp Live Preview</span>
              </div>

              {/* Realistic WhatsApp Chat Bubble Container */}
              <div className="bg-[#e5ddd5] dark:bg-slate-950 p-4 rounded-2xl shadow-inner min-h-[300px] flex flex-col justify-end">
                <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-none p-3.5 shadow text-xs max-w-[92%] space-y-2 border border-slate-200/60 dark:border-slate-700">
                  {headerText && (
                    <h5 className="font-bold text-slate-900 dark:text-white text-xs border-b border-slate-100 dark:border-slate-700/60 pb-1">
                      {headerText}
                    </h5>
                  )}

                  <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200 leading-relaxed text-[11px]">
                    {bodyText ||
                      "Your template body message will appear here..."}
                  </p>

                  {footerText && (
                    <p className="text-[10px] text-slate-400 pt-0.5">
                      {footerText}
                    </p>
                  )}

                  <div className="text-[9px] text-slate-400 text-right">
                    12:00 PM
                  </div>
                </div>

                {/* Quick Action Buttons in Preview */}
                {buttons.length > 0 && (
                  <div className="mt-1 space-y-1 max-w-[92%]">
                    {buttons.map((btn, idx) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] text-center py-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm cursor-pointer"
                      >
                        {btn.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-4">
              Templates are approved for automated sending outside the 24-hour
              customer service window.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
