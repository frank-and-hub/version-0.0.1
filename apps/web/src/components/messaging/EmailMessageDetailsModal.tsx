"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import {
  X,
  Mail,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  MousePointer,
  AlertOctagon,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";

interface EmailMessageDetailsModalProps {
  messageUuid: string | null;
  onClose: () => void;
}

export const EmailMessageDetailsModal: React.FC<
  EmailMessageDetailsModalProps
> = ({ messageUuid, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (messageUuid) {
      loadDetails(messageUuid);
    }
  }, [messageUuid]);

  const loadDetails = async (uuid: string) => {
    setIsLoading(true);
    try {
      const res = (await api.get(`/messaging/emails/${uuid}/details`)) as any;
      setData(res?.data || res);
    } catch (err: any) {
      console.error("Failed to load message details:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!messageUuid) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" />
              <span>Message Delivery & Engagement Details</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {messageUuid}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {isLoading || !data ? (
            <p className="py-12 text-center text-slate-400">
              Loading delivery telemetry...
            </p>
          ) : (
            <>
              {/* Engagement Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Status
                  </span>
                  <div className="mt-1">
                    <Badge
                      variant={
                        data.message_info.status === "DELIVERED" ||
                        data.message_info.status === "ACCEPTED"
                          ? "success"
                          : data.message_info.status === "FAILED" ||
                              data.message_info.status === "BOUNCED"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {data.message_info.status}
                    </Badge>
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                  <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Opens
                    </span>
                    <Eye className="w-4 h-4" />
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {data.engagement.open_count}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({data.engagement.unique_opens} unique)
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      Clicks
                    </span>
                    <MousePointer className="w-4 h-4" />
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {data.engagement.click_count}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({data.engagement.unique_clicks} unique)
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Provider
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white mt-1 block">
                    {data.message_info.provider_name}
                  </span>
                </div>
              </div>

              {/* Message Details Grid */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-400 block font-medium">
                      Subject:
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {data.message_info.subject}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">
                      Sender:
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {data.message_info.sender_name} &lt;
                      {data.message_info.sender_email}&gt;
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                  <div>
                    <span className="text-slate-400 block font-medium">
                      Provider Message ID:
                    </span>
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {data.message_info.provider_message_id || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">
                      Sent At:
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">
                      {data.message_info.sent_at
                        ? new Date(data.message_info.sent_at).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                </div>

                {data.message_info.last_error && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-[11px]">
                    <span className="font-bold">Error detail: </span>
                    <span>{data.message_info.last_error}</span>
                  </div>
                )}
              </div>

              {/* Recipient Outcomes */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
                  Recipients & Outcomes
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 uppercase font-semibold text-slate-500 text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Delivered At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.recipients.map((r: any) => (
                        <tr key={r.recipient_uuid}>
                          <td className="px-3 py-2 font-mono">{r.email}</td>
                          <td className="px-3 py-2 uppercase text-[10px] text-slate-400 font-semibold">
                            {r.type}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`font-semibold ${
                                r.status === "DELIVERED"
                                  ? "text-emerald-600"
                                  : r.status === "BOUNCED" ||
                                      r.status === "FAILED"
                                    ? "text-rose-600"
                                    : "text-amber-600"
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-400">
                            {r.delivered_at
                              ? new Date(r.delivered_at).toLocaleTimeString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Normalized Event Timeline */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Real-Time Webhook Event Timeline</span>
                </h4>

                {data.events_timeline.length === 0 ? (
                  <p className="p-4 bg-slate-50 dark:bg-slate-800/20 rounded-xl text-center text-slate-400">
                    No webhook events recorded yet for this email.
                  </p>
                ) : (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                    {data.events_timeline.map((ev: any, idx: number) => (
                      <div
                        key={idx}
                        className="relative flex items-start justify-between gap-3"
                      >
                        <div
                          className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white dark:ring-slate-900 ${
                            ev.event_type === "DELIVERED"
                              ? "bg-emerald-500"
                              : ev.event_type === "OPENED"
                                ? "bg-indigo-500"
                                : ev.event_type === "CLICKED"
                                  ? "bg-cyan-500"
                                  : ev.event_type === "BOUNCED" ||
                                      ev.event_type === "DROPPED"
                                    ? "bg-rose-500"
                                    : "bg-slate-400"
                          }`}
                        />
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white uppercase text-[11px]">
                            {ev.event_type}
                          </span>
                          <span className="text-slate-400 ml-2 font-mono text-[10px]">
                            {ev.recipient_email}
                          </span>
                          {ev.clicked_url && (
                            <div className="text-indigo-600 dark:text-indigo-400 font-mono text-[10px] mt-0.5 truncate max-w-md">
                              Clicked: {ev.clicked_url}
                            </div>
                          )}
                          {ev.failure_reason && (
                            <div className="text-rose-600 text-[10px] mt-0.5">
                              {ev.failure_reason}
                            </div>
                          )}
                        </div>
                        <span className="text-slate-400 font-mono text-[10px] whitespace-nowrap">
                          {new Date(ev.event_timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
