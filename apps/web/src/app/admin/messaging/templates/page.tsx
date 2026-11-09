"use client";

import React, { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import {
  MessagingTemplatesTab,
  UserProviderConfiguration,
} from "@/components/messaging";
import {
  FileText,
  Mail,
  Smartphone,
  MessageSquare,
  Sparkles,
  Layers,
  Info,
} from "lucide-react";

export default function MessagingTemplatesPage() {
  const [configurations, setConfigurations] = useState<UserProviderConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const res: any = await api.get("/messaging/provider-configurations");
        setConfigurations(Array.isArray(res) ? res : res?.items || []);
      } catch (err) {
        console.error("Failed to fetch provider configurations for templates:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfigs();
  }, []);

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Messaging Platform", href: "/admin/messaging" },
          { label: "Templates" },
        ]}
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Message Templates Studio
                <Badge variant="indigo" className="text-xs">
                  Omnichannel
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Create, customize, and preview rich transactional & broadcast templates across Email, SMS, and WhatsApp Cloud.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Highlights / Features Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-muted/20 border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 mt-0.5">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Responsive HTML Emails</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dual HTML + Plaintext layouts with Mustache variable support like <code className="text-[11px] font-mono bg-muted px-1 py-0.5 rounded">{"{{first_name}}"}</code>.
            </p>
          </div>
        </Card>

        <Card className="p-4 bg-muted/20 border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 mt-0.5">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">WhatsApp Meta Cloud</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sync pre-approved WhatsApp Business templates, variables, header media, and quick-reply action buttons.
            </p>
          </div>
        </Card>

        <Card className="p-4 bg-muted/20 border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 mt-0.5">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">SMS Token Messages</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              GSM-7 and UCS-2 segment calculation with automatic compliance opt-out footer injection.
            </p>
          </div>
        </Card>
      </div>

      {/* Main Templates Studio Component */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <MessagingTemplatesTab configurations={configurations} />
      </div>
    </div>
  );
}
