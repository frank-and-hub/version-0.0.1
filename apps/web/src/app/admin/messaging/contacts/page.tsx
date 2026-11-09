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
  Users,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Mail,
  Smartphone,
  MessageSquare,
  CheckCircle2,
  XCircle,
  UploadCloud,
  Trash2,
  Edit2,
  UserCheck,
} from "lucide-react";

interface ContactItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  group: string;
  status: "SUBSCRIBED" | "UNSUBSCRIBED" | "BOUNCED";
  channels: ("EMAIL" | "SMS" | "WHATSAPP")[];
  created_at: string;
}

export default function MessagingContactsPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");

  // Add Contact Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    group: "Newsletter Segment",
    emailOptIn: true,
    smsOptIn: true,
    whatsappOptIn: true,
  });

  const loadContacts = () => {
    setIsLoading(true);
    try {
      const stored = localStorage.getItem("monorepo_messaging_contacts");
      if (stored) {
        setContacts(JSON.parse(stored));
      } else {
        const initialContacts: ContactItem[] = [
          {
            id: "cnt-001",
            name: "Alexander Wright",
            email: "alexander.wright@acmecorp.com",
            phone: "+14155552671",
            group: "VIP Customers",
            status: "SUBSCRIBED",
            channels: ["EMAIL", "SMS", "WHATSAPP"],
            created_at: "2026-10-15T09:30:00Z",
          },
          {
            id: "cnt-002",
            name: "Sophia Martinez",
            email: "sophia.m@globaltech.io",
            phone: "+14155558912",
            group: "Newsletter Segment",
            status: "SUBSCRIBED",
            channels: ["EMAIL"],
            created_at: "2026-10-20T14:15:00Z",
          },
          {
            id: "cnt-003",
            name: "Marcus Chen",
            email: "m.chen@enterprise.org",
            phone: "+14155554321",
            group: "Product Beta Testers",
            status: "SUBSCRIBED",
            channels: ["EMAIL", "WHATSAPP"],
            created_at: "2026-11-01T11:45:00Z",
          },
          {
            id: "cnt-004",
            name: "Elena Rostova",
            email: "elena.r@fintechsolutions.com",
            phone: "+14155557766",
            group: "VIP Customers",
            status: "UNSUBSCRIBED",
            channels: ["SMS"],
            created_at: "2026-11-03T16:00:00Z",
          },
        ];
        setContacts(initialContacts);
        localStorage.setItem("monorepo_messaging_contacts", JSON.stringify(initialContacts));
      }
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || (!formData.email.trim() && !formData.phone.trim())) {
      setFeedback({ type: "error", message: "Name and either email or phone is required" });
      return;
    }

    setIsSubmitting(true);
    try {
      const channels: ("EMAIL" | "SMS" | "WHATSAPP")[] = [];
      if (formData.emailOptIn && formData.email) channels.push("EMAIL");
      if (formData.smsOptIn && formData.phone) channels.push("SMS");
      if (formData.whatsappOptIn && formData.phone) channels.push("WHATSAPP");

      const newContact: ContactItem = {
        id: `cnt-${Date.now()}`,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        group: formData.group,
        status: "SUBSCRIBED",
        channels,
        created_at: new Date().toISOString(),
      };

      const updated = [newContact, ...contacts];
      setContacts(updated);
      localStorage.setItem("monorepo_messaging_contacts", JSON.stringify(updated));

      setFeedback({ type: "success", message: `Contact "${formData.name}" added successfully!` });
      setIsAddModalOpen(false);
      setFormData({
        name: "",
        email: "",
        phone: "",
        group: "Newsletter Segment",
        emailOptIn: true,
        smsOptIn: true,
        whatsappOptIn: true,
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "Failed to add contact" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContact = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this contact?")) return;
    const updated = contacts.filter((c) => c.id !== id);
    setContacts(updated);
    localStorage.setItem("monorepo_messaging_contacts", JSON.stringify(updated));
  };

  // Filtered Contacts
  const filteredContacts = contacts.filter((c) => {
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchesGroup = groupFilter === "ALL" || c.group === groupFilter;
    const matchesSearch =
      searchQuery === "" ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);

    return matchesStatus && matchesGroup && matchesSearch;
  });

  const totalContacts = contacts.length;
  const emailSubscribed = contacts.filter((c) => c.channels.includes("EMAIL")).length;
  const smsSubscribed = contacts.filter((c) => c.channels.includes("SMS")).length;
  const whatsappSubscribed = contacts.filter((c) => c.channels.includes("WHATSAPP")).length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Messaging Platform", href: "/admin/messaging" },
          { label: "Contacts" },
        ]}
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Contacts Directory
                <Badge variant="blue" className="text-xs">
                  {totalContacts} Contacts
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage audience profiles, channel opt-ins, verified phone numbers, and segmentation tags.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadContacts}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Contact
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Audience</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalContacts}</span>
            <span className="text-xs text-muted-foreground">profiles</span>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Opt-Ins</span>
            <Mail className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-500">{emailSubscribed}</span>
            <span className="text-xs text-muted-foreground">verified</span>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SMS Subscribers</span>
            <Smartphone className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-500">{smsSubscribed}</span>
            <span className="text-xs text-muted-foreground">E.164 format</span>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">WhatsApp Direct</span>
            <MessageSquare className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-500">{whatsappSubscribed}</span>
            <span className="text-xs text-muted-foreground">opted-in</span>
          </div>
        </Card>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="h-9 px-3 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Segments</option>
            <option value="VIP Customers">VIP Customers</option>
            <option value="Newsletter Segment">Newsletter Segment</option>
            <option value="Product Beta Testers">Product Beta Testers</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBSCRIBED">Subscribed</option>
            <option value="UNSUBSCRIBED">Unsubscribed</option>
            <option value="BOUNCED">Bounced</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Contacts Data Table */}
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-3.5 font-semibold text-muted-foreground">Contact</th>
                <th className="p-3.5 font-semibold text-muted-foreground">Channels</th>
                <th className="p-3.5 font-semibold text-muted-foreground">Segment Group</th>
                <th className="p-3.5 font-semibold text-muted-foreground">Status</th>
                <th className="p-3.5 font-semibold text-muted-foreground">Added Date</th>
                <th className="p-3.5 font-semibold text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No contacts found matching your search.
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-3.5">
                      <div className="font-semibold text-foreground text-sm">{contact.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {contact.email} • {contact.phone}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        {contact.channels.includes("EMAIL") && (
                          <span className="p-1 rounded bg-blue-500/10 text-blue-500" title="Email Opted-in">
                            <Mail className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {contact.channels.includes("SMS") && (
                          <span className="p-1 rounded bg-amber-500/10 text-amber-500" title="SMS Opted-in">
                            <Smartphone className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {contact.channels.includes("WHATSAPP") && (
                          <span className="p-1 rounded bg-emerald-500/10 text-emerald-500" title="WhatsApp Opted-in">
                            <MessageSquare className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <Badge variant="slate" className="text-[10px]">
                        {contact.group}
                      </Badge>
                    </td>
                    <td className="p-3.5">
                      <Badge
                        variant={
                          contact.status === "SUBSCRIBED"
                            ? "emerald"
                            : contact.status === "UNSUBSCRIBED"
                            ? "slate"
                            : "danger"
                        }
                        className="text-[10px]"
                      >
                        {contact.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-muted-foreground">
                      {new Date(contact.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteContact(contact.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Contact Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Contact"
      >
        <form onSubmit={handleAddContact} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Full Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. John Doe"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Email Address
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Phone Number (E.164 format)
              </label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+14155551234"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Contact Group / Segment
            </label>
            <select
              value={formData.group}
              onChange={(e) => setFormData({ ...formData, group: e.target.value })}
              className="w-full h-9 px-3 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="VIP Customers">VIP Customers</option>
              <option value="Newsletter Segment">Newsletter Segment</option>
              <option value="Product Beta Testers">Product Beta Testers</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-2">
              Consent & Channel Opt-Ins
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.emailOptIn}
                  onChange={(e) => setFormData({ ...formData, emailOptIn: e.target.checked })}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                Email Marketing & Transactional consent
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.smsOptIn}
                  onChange={(e) => setFormData({ ...formData, smsOptIn: e.target.checked })}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                SMS Notifications (TCPA compliance confirmed)
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.whatsappOptIn}
                  onChange={(e) => setFormData({ ...formData, whatsappOptIn: e.target.checked })}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                WhatsApp Business Messaging consent
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Save Contact"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
