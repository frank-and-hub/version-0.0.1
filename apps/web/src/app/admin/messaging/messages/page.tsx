"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { EmailMessageDetailsModal } from "@/components/messaging/EmailMessageDetailsModal";
import {
  Mail,
  Send,
  Smartphone,
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

export default function MessagesLogPage() {
  const [activeChannel, setActiveChannel] = useState<
    "ALL" | "EMAIL" | "SMS" | "WHATSAPP"
  >("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [emailMessages, setEmailMessages] = useState<any[]>([]);
  const [smsMessages, setSmsMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Inspection modal
  const [selectedMessageUuid, setSelectedMessageUuid] = useState<string | null>(
    null,
  );

  // Quick Compose Modal
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeChannel, setComposeChannel] = useState<
    "EMAIL" | "SMS" | "WHATSAPP"
  >("EMAIL");
  const [composeForm, setComposeForm] = useState({
    recipient: "",
    subject: "",
    body: "",
  });
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const [emailRes, smsRes] = await Promise.allSettled([
        api.get("/messaging/emails?limit=100"),
        api.get("/messaging/sms?limit=100"),
      ]);

      if (emailRes.status === "fulfilled") {
        const val: any = emailRes.value;
        setEmailMessages(Array.isArray(val) ? val : val?.items || []);
      }
      if (smsRes.status === "fulfilled") {
        const val: any = smsRes.value;
        setSmsMessages(Array.isArray(val) ? val : val?.items || []);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  // Standardize message list
  const combinedMessages = React.useMemo(() => {
    const list: any[] = [];

    // Map emails
    emailMessages.forEach((m) => {
      list.push({
        id: m.message_uuid,
        channel: "EMAIL",
        recipient: m.recipients?.[0]?.email || "Unknown",
        sender: m.sender_email || "System",
        subject: m.subject || "(No Subject)",
        status: m.status,
        provider: m.provider?.name || "SMTP Gateway",
        createdAt: m.created_at,
        raw: m,
      });
    });

    // Map SMS
    smsMessages.forEach((m) => {
      list.push({
        id: m.sms_message_uuid || m.message_uuid,
        channel: "SMS",
        recipient: m.recipient_phone,
        sender: m.sender_phone || "Twilio Service",
        subject: m.message_body || "(SMS Content)",
        status: m.status,
        provider: m.provider_name || "Twilio Programmable SMS",
        createdAt: m.created_at,
        raw: m,
      });
    });

    return list.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [emailMessages, smsMessages]);

  const filteredMessages = combinedMessages.filter((msg) => {
    if (activeChannel !== "ALL" && msg.channel !== activeChannel) return false;
    if (statusFilter !== "ALL" && msg.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchRec = msg.recipient.toLowerCase().includes(q);
      const matchSub = msg.subject.toLowerCase().includes(q);
      const matchSend = msg.sender.toLowerCase().includes(q);
      return matchRec || matchSub || matchSend;
    }
    return true;
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setFeedback(null);

    try {
      if (composeChannel === "EMAIL") {
        await api.post("/messaging/emails", {
          recipients: [{ email: composeForm.recipient, type: "TO" }],
          subject: composeForm.subject,
          text_content: composeForm.body,
          html_content: `<p>${composeForm.body}</p>`,
        });
      } else if (composeChannel === "SMS") {
        await api.post("/messaging/sms/send", {
          recipient_phone: composeForm.recipient,
          message_body: composeForm.body,
        });
      }

      setFeedback({
        type: "success",
        message: `${composeChannel} message dispatched successfully!`,
      });
      setComposeForm({ recipient: "", subject: "", body: "" });
      setIsComposeOpen(false);
      loadMessages();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to dispatch message",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: "Messaging Platform", href: "/admin/messaging" },
              { label: "Messages" },
            ]}
          />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Messages Log & History
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Omnichannel communication stream across Email, SMS, and WhatsApp
            channels.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMessages}
            isLoading={isLoading}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsComposeOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Compose New
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 text-xs rounded-lg border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Channel Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveChannel("ALL")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeChannel === "ALL"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          All Channels ({combinedMessages.length})
        </button>
        <button
          onClick={() => setActiveChannel("EMAIL")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeChannel === "EMAIL"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Mail className="w-3.5 h-3.5" /> Email ({emailMessages.length})
        </button>
        <button
          onClick={() => setActiveChannel("SMS")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeChannel === "SMS"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" /> SMS ({smsMessages.length})
        </button>
        <button
          onClick={() => setActiveChannel("WHATSAPP")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeChannel === "WHATSAPP"
              ? "border-green-600 text-green-600 dark:text-green-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            placeholder="Search by recipient, sender, or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-800 w-full sm:w-44"
        >
          <option value="ALL">All Statuses</option>
          <option value="DELIVERED">Delivered</option>
          <option value="SENT">Sent</option>
          <option value="QUEUED">Queued</option>
          <option value="FAILED">Failed</option>
          <option value="SCHEDULED">Scheduled</option>
        </select>
      </div>

      {/* Messages Data Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 uppercase font-semibold">
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Subject / Message</th>
                <th className="py-3 px-4">Gateway</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Sent At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredMessages.map((msg) => (
                <tr
                  key={msg.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                >
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        msg.channel === "EMAIL"
                          ? "blue"
                          : msg.channel === "SMS"
                            ? "emerald"
                            : "indigo"
                      }
                      className="text-[10px]"
                    >
                      {msg.channel}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-white">
                    {msg.recipient}
                  </td>
                  <td className="py-3 px-4 max-w-xs truncate text-slate-700 dark:text-slate-300">
                    {msg.subject}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {msg.provider}
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        msg.status === "DELIVERED"
                          ? "emerald"
                          : msg.status === "FAILED"
                            ? "rose"
                            : msg.status === "SENT"
                              ? "blue"
                              : "slate"
                      }
                      className="text-[10px]"
                    >
                      {msg.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                    {new Date(msg.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedMessageUuid(msg.id)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50"
                      title="Inspect message timeline and delivery receipts"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredMessages.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No messages match your current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Message Inspection Modal */}
      {selectedMessageUuid && (
        <EmailMessageDetailsModal
          onClose={() => setSelectedMessageUuid(null)}
          messageUuid={selectedMessageUuid}
        />
      )}

      {/* Compose Message Modal */}
      <Modal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        title="Compose & Dispatch Message"
        description="Send an ad-hoc direct communication to a recipient."
        maxWidth="lg"
      >
        <form onSubmit={handleSendMessage} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Channel
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setComposeChannel("EMAIL")}
                className={`py-2 text-xs font-semibold rounded-lg border ${
                  composeChannel === "EMAIL"
                    ? "bg-blue-50 border-blue-600 text-blue-700"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => setComposeChannel("SMS")}
                className={`py-2 text-xs font-semibold rounded-lg border ${
                  composeChannel === "SMS"
                    ? "bg-emerald-50 border-emerald-600 text-emerald-700"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                SMS
              </button>
              <button
                type="button"
                onClick={() => setComposeChannel("WHATSAPP")}
                className={`py-2 text-xs font-semibold rounded-lg border ${
                  composeChannel === "WHATSAPP"
                    ? "bg-green-50 border-green-600 text-green-700"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                WhatsApp
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Recipient{" "}
              {composeChannel === "EMAIL" ? "Email" : "Phone (+E.164)"}
            </label>
            <Input
              placeholder={
                composeChannel === "EMAIL" ? "user@example.com" : "+15551234567"
              }
              value={composeForm.recipient}
              onChange={(e) =>
                setComposeForm({ ...composeForm, recipient: e.target.value })
              }
              required
            />
          </div>

          {composeChannel === "EMAIL" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject
              </label>
              <Input
                placeholder="Message Subject..."
                value={composeForm.subject}
                onChange={(e) =>
                  setComposeForm({ ...composeForm, subject: e.target.value })
                }
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Message Body
            </label>
            <textarea
              rows={4}
              value={composeForm.body}
              onChange={(e) =>
                setComposeForm({ ...composeForm, body: e.target.value })
              }
              placeholder="Write your message content..."
              className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsComposeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={isSending}
            >
              Send Dispatch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
