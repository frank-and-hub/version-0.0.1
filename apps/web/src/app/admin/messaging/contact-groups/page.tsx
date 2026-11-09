"use client";

import React, { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  RefreshCw,
  Mail,
  Smartphone,
  MessageSquare,
  Layers,
  Send,
  Trash2,
  Edit2,
  FolderPlus,
  CheckCircle2,
} from "lucide-react";

interface ContactGroupItem {
  id: string;
  name: string;
  description: string;
  members_count: number;
  email_count: number;
  sms_count: number;
  whatsapp_count: number;
  is_dynamic: boolean;
  created_at: string;
}

export default function MessagingContactGroupsPage() {
  const [groups, setGroups] = useState<ContactGroupItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_dynamic: false,
  });

  const loadGroups = () => {
    setIsLoading(true);
    try {
      const stored = localStorage.getItem("monorepo_messaging_contact_groups");
      if (stored) {
        setGroups(JSON.parse(stored));
      } else {
        const initialGroups: ContactGroupItem[] = [
          {
            id: "grp-001",
            name: "VIP Customers",
            description: "High-value active subscribers with verified phone numbers & email opt-ins",
            members_count: 1250,
            email_count: 1250,
            sms_count: 1180,
            whatsapp_count: 940,
            is_dynamic: true,
            created_at: "2026-10-10T10:00:00Z",
          },
          {
            id: "grp-002",
            name: "Newsletter Segment",
            description: "All registered users opted into marketing newsletters and product updates",
            members_count: 3800,
            email_count: 3800,
            sms_count: 850,
            whatsapp_count: 620,
            is_dynamic: false,
            created_at: "2026-10-15T12:30:00Z",
          },
          {
            id: "grp-003",
            name: "Product Beta Testers",
            description: "Users enrolled in early access beta software builds and experimental features",
            members_count: 420,
            email_count: 420,
            sms_count: 390,
            whatsapp_count: 310,
            is_dynamic: false,
            created_at: "2026-11-01T09:15:00Z",
          },
          {
            id: "grp-004",
            name: "Internal Staff & Admins",
            description: "Staff members receiving critical security notices and operational alerts",
            members_count: 85,
            email_count: 85,
            sms_count: 85,
            whatsapp_count: 75,
            is_dynamic: true,
            created_at: "2026-11-05T14:00:00Z",
          },
        ];
        setGroups(initialGroups);
        localStorage.setItem("monorepo_messaging_contact_groups", JSON.stringify(initialGroups));
      }
    } catch (err) {
      console.error("Failed to load contact groups:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFeedback({ type: "error", message: "Group name is required" });
      return;
    }

    setIsSubmitting(true);
    try {
      const newGroup: ContactGroupItem = {
        id: `grp-${Date.now()}`,
        name: formData.name,
        description: formData.description,
        members_count: 0,
        email_count: 0,
        sms_count: 0,
        whatsapp_count: 0,
        is_dynamic: formData.is_dynamic,
        created_at: new Date().toISOString(),
      };

      const updated = [newGroup, ...groups];
      setGroups(updated);
      localStorage.setItem("monorepo_messaging_contact_groups", JSON.stringify(updated));

      setFeedback({ type: "success", message: `Group "${formData.name}" created successfully!` });
      setIsModalOpen(false);
      setFormData({ name: "", description: "", is_dynamic: false });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to create group" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this group?")) return;
    const updated = groups.filter((g) => g.id !== id);
    setGroups(updated);
    localStorage.setItem("monorepo_messaging_contact_groups", JSON.stringify(updated));
  };

  const filteredGroups = groups.filter((g) => {
    return (
      searchQuery === "" ||
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const totalMembers = groups.reduce((acc, g) => acc + g.members_count, 0);

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Messaging Platform", href: "/admin/messaging" },
          { label: "Contact Groups" },
        ]}
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Contact Groups & Segments
                <Badge variant="indigo" className="text-xs">
                  {groups.length} Segments
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Organize audiences into targeted broadcast segments, dynamic filters, and VIP distribution lists.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadGroups}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <FolderPlus className="w-4 h-4" />
            Create Group
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

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl">
        <div className="text-xs text-muted-foreground font-medium">
          Total segmented audience: <span className="text-foreground font-bold">{totalMembers.toLocaleString()} members</span>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search groups..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Contact Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredGroups.map((group) => (
          <Card key={group.id} className="p-5 border-border flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    {group.name}
                    {group.is_dynamic && (
                      <Badge variant="blue" className="text-[10px]">
                        Dynamic
                      </Badge>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {group.description}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteGroup(group.id)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Channel Distribution */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
                <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-blue-500 mb-1">
                    <Mail className="w-3 h-3" />
                    Email
                  </div>
                  <div className="text-base font-bold text-foreground">
                    {group.email_count.toLocaleString()}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-amber-500 mb-1">
                    <Smartphone className="w-3 h-3" />
                    SMS
                  </div>
                  <div className="text-base font-bold text-foreground">
                    {group.sms_count.toLocaleString()}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-emerald-500 mb-1">
                    <MessageSquare className="w-3 h-3" />
                    WhatsApp
                  </div>
                  <div className="text-base font-bold text-foreground">
                    {group.whatsapp_count.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-border text-xs">
              <span className="text-muted-foreground">
                Created: {new Date(group.created_at).toLocaleDateString()}
              </span>
              <div className="flex items-center gap-2">
                <Link href={`/admin/messaging/contacts?group=${encodeURIComponent(group.name)}`}>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    View Contacts
                  </Button>
                </Link>
                <Link href="/admin/messaging/campaigns">
                  <Button variant="primary" size="sm" className="h-7 text-xs flex items-center gap-1">
                    <Send className="w-3 h-3" />
                    Broadcast
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Create Group Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Audience Group"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Group Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. High Intent Buyers"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full p-2.5 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-sans"
              placeholder="Explain the criteria and purpose for this segment."
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_dynamic}
              onChange={(e) => setFormData({ ...formData, is_dynamic: e.target.checked })}
              className="rounded border-border text-primary focus:ring-primary"
            />
            Dynamic Membership (auto-sync when contacts update)
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
