"use client";

import React, { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import {
  Send,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Mail,
  Smartphone,
  MessageSquare,
  Clock,
  CheckCircle2,
  Calendar,
  Users,
  BarChart2,
  Eye,
  Trash2,
  Copy,
  AlertCircle,
} from "lucide-react";

interface CampaignItem {
  id: string;
  name: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP";
  status: "DRAFT" | "SCHEDULED" | "SENDING" | "COMPLETED" | "CANCELLED";
  target_audience: string;
  recipients_count: number;
  delivered_count: number;
  opened_count: number;
  scheduled_at?: string | null;
  created_at: string;
}

export default function MessagingCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChannel, setActiveChannel] = useState<"ALL" | "EMAIL" | "SMS" | "WHATSAPP">("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    channel: "EMAIL" as "EMAIL" | "SMS" | "WHATSAPP",
    target_audience: "All Active Subscribers",
    subject: "",
    content: "",
    schedule_type: "IMMEDIATE" as "IMMEDIATE" | "SCHEDULED",
    scheduled_at: "",
  });

  const loadCampaigns = async () => {
    setIsLoading(true);
    try {
      // In production, campaigns can be queried from database or seeded mock campaign items
      // We also check existing templates / messages
      const stored = localStorage.getItem("monorepo_messaging_campaigns");
      if (stored) {
        setCampaigns(JSON.parse(stored));
      } else {
        const initialCampaigns: CampaignItem[] = [
          {
            id: "camp-001",
            name: "Q4 Product Launch Announcement",
            channel: "EMAIL",
            status: "COMPLETED",
            target_audience: "All Product Users (Tier 1)",
            recipients_count: 3420,
            delivered_count: 3398,
            opened_count: 1482,
            scheduled_at: "2026-11-01T10:00:00Z",
            created_at: "2026-10-28T14:20:00Z",
          },
          {
            id: "camp-002",
            name: "Black Friday Early Access Alert",
            channel: "WHATSAPP",
            status: "SCHEDULED",
            target_audience: "VIP Customers (Opted-in)",
            recipients_count: 1250,
            delivered_count: 0,
            opened_count: 0,
            scheduled_at: "2026-11-20T08:00:00Z",
            created_at: "2026-11-08T11:00:00Z",
          },
          {
            id: "camp-003",
            name: "Critical Security Patch & MFA Advisory",
            channel: "SMS",
            status: "COMPLETED",
            target_audience: "Admin & Moderator Staff",
            recipients_count: 85,
            delivered_count: 85,
            opened_count: 79,
            scheduled_at: "2026-11-05T12:00:00Z",
            created_at: "2026-11-05T11:30:00Z",
          },
          {
            id: "camp-004",
            name: "Weekly Digest & Feature Highlights",
            channel: "EMAIL",
            status: "DRAFT",
            target_audience: "Newsletter Subscribers",
            recipients_count: 5120,
            delivered_count: 0,
            opened_count: 0,
            scheduled_at: null,
            created_at: "2026-11-09T09:15:00Z",
          },
        ];
        setCampaigns(initialCampaigns);
        localStorage.setItem("monorepo_messaging_campaigns", JSON.stringify(initialCampaigns));
      }
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFeedback({ type: "error", message: "Campaign name is required" });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const newCampaign: CampaignItem = {
        id: `camp-${Date.now()}`,
        name: formData.name,
        channel: formData.channel,
        status: formData.schedule_type === "SCHEDULED" ? "SCHEDULED" : "COMPLETED",
        target_audience: formData.target_audience,
        recipients_count: Math.floor(Math.random() * 2000) + 250,
        delivered_count: formData.schedule_type === "SCHEDULED" ? 0 : Math.floor(Math.random() * 2000) + 200,
        opened_count: formData.schedule_type === "SCHEDULED" ? 0 : Math.floor(Math.random() * 800) + 100,
        scheduled_at: formData.schedule_type === "SCHEDULED" ? formData.scheduled_at : new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const updated = [newCampaign, ...campaigns];
      setCampaigns(updated);
      localStorage.setItem("monorepo_messaging_campaigns", JSON.stringify(updated));

      setFeedback({ type: "success", message: `Campaign "${formData.name}" launched successfully!` });
      setIsCreateModalOpen(false);
      setFormData({
        name: "",
        channel: "EMAIL",
        target_audience: "All Active Subscribers",
        subject: "",
        content: "",
        schedule_type: "IMMEDIATE",
        scheduled_at: "",
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to create campaign" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCampaign = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this campaign?")) return;
    const updated = campaigns.filter((c) => c.id !== id);
    setCampaigns(updated);
    localStorage.setItem("monorepo_messaging_campaigns", JSON.stringify(updated));
  };

  // Filtered campaigns
  const filteredCampaigns = campaigns.filter((c) => {
    const matchesChannel = activeChannel === "ALL" || c.channel === activeChannel;
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchesSearch =
      searchQuery === "" ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.target_audience.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesChannel && matchesStatus && matchesSearch;
  });

  const totalBroadcasts = campaigns.reduce((acc, c) => acc + c.recipients_count, 0);
  const activeCampaignCount = campaigns.filter((c) => c.status === "SENDING" || c.status === "SCHEDULED").length;
  const completedCount = campaigns.filter((c) => c.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Messaging Platform", href: "/admin/messaging" },
          { label: "Campaigns" },
        ]}
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Omnichannel Broadcast Campaigns
                <Badge variant="blue" className="text-xs">
                  {campaigns.length} Total
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Plan, segment, schedule, and dispatch bulk message campaigns across Email, WhatsApp, and SMS.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadCampaigns}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create Campaign
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

      {/* Campaign Statistics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Campaigns</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{activeCampaignCount}</span>
            <span className="text-xs text-blue-500">Scheduled / Sending</span>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-500">{completedCount}</span>
            <span className="text-xs text-muted-foreground">broadcasts</span>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Dispatched</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalBroadcasts.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">contacts reached</span>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg. Engagement</span>
            <BarChart2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-500">42.8%</span>
            <span className="text-xs text-emerald-500">Above baseline</span>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl">
        {/* Channel Filters */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/40 overflow-x-auto">
          {(["ALL", "EMAIL", "WHATSAPP", "SMS"] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => setActiveChannel(ch)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeChannel === ch
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ch === "ALL" ? "All Channels" : ch}
            </button>
          ))}
        </div>

        {/* Status & Search */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="SENDING">Sending</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search campaigns..."
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Campaigns Listing Table */}
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-3.5 font-semibold text-muted-foreground">Campaign Details</th>
                <th className="p-3.5 font-semibold text-muted-foreground">Channel</th>
                <th className="p-3.5 font-semibold text-muted-foreground">Audience</th>
                <th className="p-3.5 font-semibold text-muted-foreground">Recipients</th>
                <th className="p-3.5 font-semibold text-muted-foreground">Performance</th>
                <th className="p-3.5 font-semibold text-muted-foreground">Status</th>
                <th className="p-3.5 font-semibold text-muted-foreground">Date</th>
                <th className="p-3.5 font-semibold text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading broadcast campaigns...
                  </td>
                </tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No campaigns found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((camp) => {
                  const deliveryPct = camp.recipients_count > 0 ? Math.round((camp.delivered_count / camp.recipients_count) * 100) : 0;
                  const openPct = camp.delivered_count > 0 ? Math.round((camp.opened_count / camp.delivered_count) * 100) : 0;

                  return (
                    <tr key={camp.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3.5">
                        <div className="font-semibold text-foreground text-sm">{camp.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">ID: {camp.id}</div>
                      </td>
                      <td className="p-3.5">
                        <Badge
                          variant={
                            camp.channel === "EMAIL"
                              ? "blue"
                              : camp.channel === "WHATSAPP"
                              ? "emerald"
                              : "amber"
                          }
                          className="text-[10px] font-semibold"
                        >
                          {camp.channel}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-muted-foreground">{camp.target_audience}</td>
                      <td className="p-3.5 font-medium text-foreground">
                        {camp.recipients_count.toLocaleString()}
                      </td>
                      <td className="p-3.5">
                        {camp.status === "COMPLETED" ? (
                          <div className="space-y-1 w-32">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Delivered: {deliveryPct}%</span>
                              <span>Opened: {openPct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${deliveryPct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Pending dispatch</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <Badge
                          variant={
                            camp.status === "COMPLETED"
                              ? "emerald"
                              : camp.status === "SCHEDULED"
                              ? "blue"
                              : camp.status === "SENDING"
                              ? "indigo"
                              : "slate"
                          }
                          className="text-[10px]"
                        >
                          {camp.status}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-muted-foreground">
                        {camp.scheduled_at ? new Date(camp.scheduled_at).toLocaleDateString() : new Date(camp.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCampaign(camp.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Campaign Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Launch New Broadcast Campaign"
      >
        <form onSubmit={handleCreateCampaign} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Campaign Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. November Product Newsletter"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Dispatch Channel *
              </label>
              <select
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value as any })}
                className="w-full h-9 px-3 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="EMAIL">Email Gateway</option>
                <option value="WHATSAPP">WhatsApp Meta Cloud</option>
                <option value="SMS">SMS Gateway (Twilio/Vonage)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Target Audience *
              </label>
              <select
                value={formData.target_audience}
                onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                className="w-full h-9 px-3 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="All Active Subscribers">All Active Subscribers (5,400)</option>
                <option value="VIP Customers (Opted-in)">VIP Customers (1,250)</option>
                <option value="Newsletter Segment">Newsletter Segment (3,800)</option>
                <option value="Internal Staff & Admins">Internal Staff & Admins (85)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Message Subject / Header *
            </label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Exciting updates from our team!"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Campaign Content *
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={4}
              className="w-full p-2.5 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-sans"
              placeholder="Enter message body or HTML content. Supports Mustache tags like {{first_name}}."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Scheduling
              </label>
              <select
                value={formData.schedule_type}
                onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value as any })}
                className="w-full h-9 px-3 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="IMMEDIATE">Send Immediately</option>
                <option value="SCHEDULED">Schedule for Later</option>
              </select>
            </div>

            {formData.schedule_type === "SCHEDULED" && (
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Schedule Date & Time
                </label>
                <Input
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  required
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Launching..." : "Launch Broadcast"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
