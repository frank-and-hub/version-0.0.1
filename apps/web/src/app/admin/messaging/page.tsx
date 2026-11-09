"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { api } from "@/lib/api";
import {
  ConnectProviderButton,
  ProviderSelectionModal,
  ConnectedProviderCard,
  UserProviderConfiguration,
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
  Settings,
  Webhook,
  TrendingUp,
  BarChart2,
  Users,
  Radio,
  PieChart,
  ShieldCheck,
  Smartphone,
  MessageSquare,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

export default function MessagingOverviewPage() {
  const [stats, setStats] = useState<any>(null);
  const [smsStats, setSmsStats] = useState<any>(null);
  const [configurations, setConfigurations] = useState<UserProviderConfiguration[]>([]);
  const [recentEmails, setRecentEmails] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Provider Modal
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [modalChannel, setModalChannel] = useState<"EMAIL" | "WHATSAPP" | "SMS">("EMAIL");
  const [editingConfig, setEditingConfig] = useState<UserProviderConfiguration | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, smsStatsRes, configRes, emailsRes] = await Promise.allSettled([
        api.get("/messaging/stats"),
        api.get("/messaging/sms/stats"),
        api.get("/messaging/provider-configurations"),
        api.get("/messaging/emails?limit=6"),
      ]);

      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (smsStatsRes.status === "fulfilled") setSmsStats(smsStatsRes.value);
      if (configRes.status === "fulfilled") {
        const val: any = configRes.value;
        setConfigurations(Array.isArray(val) ? val : val?.items || []);
      }
      if (emailsRes.status === "fulfilled") {
        const val: any = emailsRes.value;
        setRecentEmails(Array.isArray(val) ? val : val?.items || []);
      }
    } catch (err) {
      console.error("Failed to load messaging overview:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalSent = (stats?.totalSent || 0) + (smsStats?.total_sent || 0);
  const totalDelivered = (stats?.totalDelivered || 0) + (smsStats?.delivered || 0);
  const overallRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 100;

  const modules = [
    {
      label: "Messages Log",
      description: "Inspect multi-channel delivery history, live statuses, and dispatch single messages.",
      href: "/admin/messaging/messages",
      icon: Send,
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/50",
    },
    {
      label: "Broadcast Campaigns",
      description: "Design, schedule, and execute mass broadcast campaigns across all channels.",
      href: "/admin/messaging/campaigns",
      icon: Radio,
      color: "text-purple-600 bg-purple-50 dark:bg-purple-950/50",
    },
    {
      label: "Contacts Directory",
      description: "Manage subscriber profiles, phone numbers, email addresses, and opt-in states.",
      href: "/admin/messaging/contacts",
      icon: Users,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50",
    },
    {
      label: "Contact Groups",
      description: "Audience segmentation by customer tiers, product interest, and geographic region.",
      href: "/admin/messaging/contact-groups",
      icon: Users,
      color: "text-teal-600 bg-teal-50 dark:bg-teal-950/50",
    },
    {
      label: "Templates Studio",
      description: "Rich HTML emails, GSM-segmented SMS, and Meta-approved WhatsApp templates.",
      href: "/admin/messaging/templates",
      icon: FileText,
      color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50",
    },
    {
      label: "Provider Gateways",
      description: "Connect SendGrid, Twilio, Meta Cloud API, SMTP, AWS SES, and 8+ SMS providers.",
      href: "/admin/messaging/providers",
      icon: Server,
      color: "text-amber-600 bg-amber-50 dark:bg-amber-950/50",
    },
    {
      label: "Analytics Dashboard",
      description: "Delivery rates, open tracking, click-through rates, and hourly throughput graphs.",
      href: "/admin/messaging/analytics",
      icon: TrendingUp,
      color: "text-rose-600 bg-rose-50 dark:bg-rose-950/50",
    },
    {
      label: "Delivery Reports",
      description: "Detailed compliance reports, failure breakdowns, and scheduled CSV data export.",
      href: "/admin/messaging/reports",
      icon: BarChart2,
      color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/50",
    },
    {
      label: "Usage & Quotas",
      description: "Track monthly plan limits, carrier rate limits, credits, and spend forecast.",
      href: "/admin/messaging/usage",
      icon: PieChart,
      color: "text-orange-600 bg-orange-50 dark:bg-orange-950/50",
    },
    {
      label: "Compliance & Opt-Out",
      description: "TCPA/CTIA STOP keywords suppression list, unsubscribe links, and WhatsApp 24h window.",
      href: "/admin/messaging/compliance",
      icon: ShieldCheck,
      color: "text-red-600 bg-red-50 dark:bg-red-950/50",
    },
    {
      label: "Webhook Monitoring",
      description: "Real-time status callback logs, HMAC verification, event payloads, and retries.",
      href: "/admin/messaging/webhooks",
      icon: Webhook,
      color: "text-violet-600 bg-violet-50 dark:bg-violet-950/50",
    },
    {
      label: "Platform Settings",
      description: "Default fallback channels, sending throttles, retry policies, and alert webhooks.",
      href: "/admin/messaging/settings",
      icon: Settings,
      color: "text-slate-600 bg-slate-50 dark:bg-slate-800",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: "Messaging Platform", href: "/admin/messaging" },
              { label: "Overview" },
            ]}
          />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Messaging Platform
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Omnichannel communication hub across Email, WhatsApp Business, and Programmable SMS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          {/* <ConnectProviderButton
            onClick={() => {
              setModalChannel("EMAIL");
              setEditingConfig(null);
              setIsConnectModalOpen(true);
            }}
          /> */}
          {/* <Link href="/admin/messaging/messages">
            <Button variant="primary" size="sm">
              <Send className="w-3.5 h-3.5 mr-1.5" /> Compose Message
            </Button>
          </Link> */}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Dispatched</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {totalSent.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">Email, SMS & WhatsApp</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Delivery Rate</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">{overallRate}%</div>
          <span className="text-[11px] text-slate-400">Carrier & Inbox confirmed</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Gateways</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {configurations.filter((c) => c.is_active).length}
          </div>
          <span className="text-[11px] text-slate-400">
            Across {configurations.length} configured
          </span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Channel Coverage</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">3 / 3</div>
          <span className="text-[11px] text-emerald-600 font-medium">Email, SMS, WhatsApp active</span>
        </Card>
      </div>

      {/* Core Modules Directory Grid */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
          Messages Platform Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link key={mod.href} href={mod.href} className="group">
                <Card className="p-4 h-full hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${mod.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-xs text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                          {mod.label}
                        </h3>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {mod.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity & Connected Providers Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent Activity Feed */}
        <Card className="lg:col-span-2 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">Recent Message Activity</h3>
              <p className="text-[11px] text-slate-400">Latest dispatched communications</p>
            </div>
            <Link
              href="/admin/messaging/messages"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
            >
              View Full Log <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentEmails.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No recent messages found. Use Compose Message to dispatch your first communication.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentEmails.map((msg) => (
                <div key={msg.message_uuid} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md shrink-0">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {msg.subject || "(No Subject)"}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        To: {msg.recipients?.[0]?.email || "Unknown"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={msg.status === "DELIVERED" ? "emerald" : msg.status === "FAILED" ? "rose" : "slate"}>
                      {msg.status}
                    </Badge>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right: Connected Providers Summary */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">Active Gateways</h3>
              <p className="text-[11px] text-slate-400">Authenticated providers</p>
            </div>
            <Link
              href="/admin/messaging/providers"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
            >
              Manage <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {configurations.slice(0, 4).map((config) => (
              <div
                key={config.configuration_uuid}
                className="p-2.5 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 dark:text-white">{config.provider?.name}</span>
                  <Badge variant="slate" className="text-[9px]">
                    {config.provider?.type || config.type}
                  </Badge>
                </div>
                <Badge variant={config.is_active ? "emerald" : "rose"}>
                  {config.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            ))}

            {configurations.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400">
                No gateways connected yet. Click &apos;Connect Provider&apos; to link your first service.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Connect Provider Modal */}
      <ProviderSelectionModal
        isOpen={isConnectModalOpen}
        onClose={() => {
          setIsConnectModalOpen(false);
          setEditingConfig(null);
        }}
        onSuccess={() => {
          setIsConnectModalOpen(false);
          setEditingConfig(null);
          loadData();
        }}
        channel={modalChannel}
        editConfig={editingConfig}
      />
    </div>
  );
}
