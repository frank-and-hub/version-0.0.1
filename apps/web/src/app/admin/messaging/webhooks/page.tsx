"use client";

import React, { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import {
  WebhookManagerTab,
  UserProviderConfiguration,
} from "@/components/messaging";
import {
  Webhook,
  Activity,
  CheckCircle2,
  ShieldAlert,
  Server,
  Zap,
} from "lucide-react";

export default function MessagingWebhooksPage() {
  const [configurations, setConfigurations] = useState<UserProviderConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const res: any = await api.get("/messaging/provider-configurations");
        setConfigurations(Array.isArray(res) ? res : res?.items || []);
      } catch (err) {
        console.error("Failed to load configurations for webhook manager:", err);
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
          { label: "Webhook Monitoring" },
        ]}
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Webhook className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Webhook Event Stream & Ingress
                <Badge variant="emerald" className="text-xs">
                  Active Listener
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Inspect inbound status callbacks, delivery reports, bounce telemetry, and HMAC signature verifications.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Highlights / Features Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-muted/20 border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 mt-0.5">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Status Callbacks</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live updates when emails are delivered, opened, clicked, or when SMS / WhatsApp messages reach user handsets.
            </p>
          </div>
        </Card>

        <Card className="p-4 bg-muted/20 border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 mt-0.5">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Two-Way Inbound Messages</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time conversational replies routed straight to conversation queues and thread managers.
            </p>
          </div>
        </Card>

        <Card className="p-4 bg-muted/20 border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 mt-0.5">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">HMAC Verification</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cryptographic verification of Twilio, SendGrid, and Meta Cloud request signatures to prevent spoofing.
            </p>
          </div>
        </Card>
      </div>

      {/* Main Webhook Management Component */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <WebhookManagerTab configurations={configurations} />
      </div>
    </div>
  );
}
