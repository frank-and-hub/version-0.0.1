"use client";

import React, { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import {
  ConnectedProviderCard,
  ProviderSelectionModal,
  UserProviderConfiguration,
} from "@/components/messaging";
import {
  Server,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Smartphone,
  MessageSquare,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function MessagingProvidersPage() {
  const [configurations, setConfigurations] = useState<UserProviderConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Tabs
  const [channelFilter, setChannelFilter] = useState<"ALL" | "EMAIL" | "WHATSAPP" | "SMS">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalChannel, setModalChannel] = useState<"EMAIL" | "WHATSAPP" | "SMS">("EMAIL");
  const [editingConfig, setEditingConfig] = useState<UserProviderConfiguration | null>(null);

  const fetchConfigurations = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res: any = await api.get("/messaging/provider-configurations");
      setConfigurations(Array.isArray(res) ? res : res?.items || []);
    } catch (err: any) {
      console.error("Failed to load providers:", err);
      setErrorMsg(err?.message || "Failed to fetch provider configurations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigurations();
  }, []);

  const handleTest = async (configUuid: string) => {
    setActionLoadingId(configUuid);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res: any = await api.post(`/messaging/configurations/${configUuid}/test`, {});
      if (res?.success) {
        setSuccessMsg(`Connection test passed: ${res?.message || "Ready to send"}`);
      } else {
        setErrorMsg(`Connection test failed: ${res?.message || "Unknown error"}`);
      }
      fetchConfigurations();
    } catch (err: any) {
      setErrorMsg(err?.message || "Connection test failed. Verify credentials.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSetDefault = async (configUuid: string) => {
    setActionLoadingId(configUuid);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.post(`/messaging/configurations/${configUuid}/default`, {});
      setSuccessMsg("Default provider updated successfully");
      fetchConfigurations();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to set default provider");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (configUuid: string) => {
    if (!window.confirm("Are you sure you want to disconnect this provider gateway?")) return;
    setActionLoadingId(configUuid);
    setErrorMsg(null);
    try {
      await api.delete(`/messaging/configurations/${configUuid}`);
      setSuccessMsg("Provider deleted successfully");
      fetchConfigurations();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delete provider");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenAdd = (channel: "EMAIL" | "WHATSAPP" | "SMS") => {
    setEditingConfig(null);
    setModalChannel(channel);
    setIsModalOpen(true);
  };

  const handleEdit = (config: UserProviderConfiguration) => {
    setEditingConfig(config);
    setModalChannel(config.type as any || "EMAIL");
    setIsModalOpen(true);
  };

  // Filtered list
  const filteredConfigs = configurations.filter((cfg) => {
    const matchesChannel =
      channelFilter === "ALL" ||
      cfg.type?.toUpperCase() === channelFilter ||
      (channelFilter === "EMAIL" && cfg.provider?.type === "EMAIL") ||
      (channelFilter === "SMS" && cfg.provider?.type === "SMS") ||
      (channelFilter === "WHATSAPP" && cfg.provider?.type === "WHATSAPP");

    const matchesSearch =
      searchQuery === "" ||
      cfg.configuration_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cfg.provider?.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesChannel && matchesSearch;
  });

  // Calculate statistics
  const totalCount = configurations.length;
  const connectedCount = configurations.filter((c) => c.is_active).length;
  const defaultCount = configurations.filter((c) => c.is_default).length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Messaging Platform", href: "/admin/messaging" },
          { label: "Providers" },
        ]}
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Provider Gateways
                <Badge variant="emerald" className="text-xs">
                  {connectedCount} Online
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure third-party gateways for transactional & bulk messaging with failover routing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConfigurations}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenAdd("EMAIL")}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Mail className="w-4 h-4" />
            + Email Gateway
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenAdd("WHATSAPP")}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <MessageSquare className="w-4 h-4" />
            + WhatsApp Gateway
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenAdd("SMS")}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Smartphone className="w-4 h-4" />
            + SMS Gateway
          </Button>
        </div>
      </div>

      {/* Feedback alerts */}
      {errorMsg && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* High-level Gateway Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Configured</span>
            <Server className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{totalCount}</span>
            <span className="text-xs text-muted-foreground">gateways</span>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active & Connected</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-500">{connectedCount}</span>
            <span className="text-xs text-muted-foreground">
              {totalCount > 0 ? `${Math.round((connectedCount / totalCount) * 100)}% online` : "none"}
            </span>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Primary Gateways</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{defaultCount}</span>
            <span className="text-xs text-muted-foreground">default dispatchers</span>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Security & Encryption</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-500">AES-256</span>
            <span className="text-xs text-muted-foreground">at rest</span>
          </div>
        </Card>
      </div>

      {/* Filter and Tab Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl">
        {/* Channel Filters */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/40 overflow-x-auto">
          {(["ALL", "EMAIL", "WHATSAPP", "SMS"] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                channelFilter === ch
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ch === "ALL" ? "All Channels" : ch}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search provider name..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Provider Gateway Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center bg-card border border-border rounded-xl">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">Loading Provider Gateways...</p>
          <p className="text-xs text-muted-foreground mt-1">Retrieving encrypted gateway credentials</p>
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className="p-12 text-center bg-card border border-border rounded-xl">
          <Server className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-base font-semibold text-foreground">No Providers Found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            {searchQuery
              ? `No provider configurations match "${searchQuery}". Try adjusting your search query.`
              : "No provider gateways configured for this channel yet. Connect your SendGrid, Twilio, Resend, or WhatsApp Cloud account to get started."}
          </p>
          <div className="flex justify-center gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={() => handleOpenAdd("EMAIL")}>
              + Connect Email
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleOpenAdd("WHATSAPP")}>
              + Connect WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleOpenAdd("SMS")}>
              + Connect SMS
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredConfigs.map((config) => (
            <ConnectedProviderCard
              key={config.configuration_uuid}
              configuration={config}
              onEdit={handleEdit}
              onTest={handleTest}
              onSetDefault={handleSetDefault}
              onDelete={handleDelete}
              isActionLoading={actionLoadingId === config.configuration_uuid}
            />
          ))}
        </div>
      )}

      {/* Dynamic Provider Form & Selection Modal */}
      <ProviderSelectionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingConfig(null);
        }}
        onSuccess={(savedConfig) => {
          setIsModalOpen(false);
          setEditingConfig(null);
          setSuccessMsg(`Gateway "${savedConfig.configuration_name}" saved successfully`);
          fetchConfigurations();
        }}
        editConfig={editingConfig}
        channel={modalChannel}
      />
    </div>
  );
}
