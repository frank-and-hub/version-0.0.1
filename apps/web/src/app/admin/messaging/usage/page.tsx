"use client";

import React, { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import {
  PieChart,
  TrendingUp,
  Mail,
  Smartphone,
  MessageSquare,
  AlertTriangle,
  Zap,
  Clock,
  ShieldCheck,
  RefreshCw,
  CreditCard,
} from "lucide-react";

export default function MessagingUsagePage() {
  const [isLoading, setIsLoading] = useState(false);

  // Quota specifications
  const quotas = [
    {
      channel: "EMAIL",
      title: "Email Dispatch Quota",
      icon: Mail,
      color: "blue",
      used: 18450,
      limit: 100000,
      unit: "emails",
      resetPeriod: "Renews on Dec 1, 2026",
      rateLimit: "120 emails / second",
      activeProviders: "SendGrid (Primary), Resend (Fallback)",
    },
    {
      channel: "SMS",
      title: "SMS Message Segments",
      icon: Smartphone,
      color: "amber",
      used: 3410,
      limit: 10000,
      unit: "segments",
      resetPeriod: "Renews on Dec 1, 2026",
      rateLimit: "15 segments / second",
      activeProviders: "Twilio SMS, Vonage",
    },
    {
      channel: "WHATSAPP",
      title: "WhatsApp Service Conversations",
      icon: MessageSquare,
      color: "emerald",
      used: 820,
      limit: 2500,
      unit: "conversations",
      resetPeriod: "Renews on Dec 1, 2026",
      rateLimit: "80 messages / second",
      activeProviders: "Meta Cloud Business API",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Messaging Platform", href: "/admin/messaging" },
          { label: "Usage & Quotas" },
        ]}
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <PieChart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Usage, Quotas & Rate Limits
                <Badge variant="emerald" className="text-xs">
                  Normal Health
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Track channel allowances, provider rate limits, credit forecasts, and throttle parameters.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLoading(true)}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Usage
          </Button>
        </div>
      </div>

      {/* Quotas Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {quotas.map((quota) => {
          const Icon = quota.icon;
          const percentage = Math.round((quota.used / quota.limit) * 100);
          const isWarning = percentage > 80;

          return (
            <Card key={quota.channel} className="p-5 border-border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-lg ${
                        quota.color === "blue"
                          ? "bg-blue-500/10 text-blue-500"
                          : quota.color === "emerald"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{quota.title}</h3>
                      <span className="text-[11px] text-muted-foreground">{quota.resetPeriod}</span>
                    </div>
                  </div>
                  <Badge variant={isWarning ? "danger" : "slate"} className="text-xs">
                    {percentage}% used
                  </Badge>
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-2xl font-bold text-foreground">
                      {quota.used.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      of {quota.limit.toLocaleString()} {quota.unit}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isWarning
                          ? "bg-red-500"
                          : quota.color === "blue"
                          ? "bg-blue-500"
                          : quota.color === "emerald"
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rate Limit:</span>
                    <span className="font-medium text-foreground">{quota.rateLimit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gateways:</span>
                    <span className="font-medium text-foreground text-right truncate max-w-[180px]">
                      {quota.activeProviders}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-border">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  Request Quota Increase
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Account Credit & Protection Notice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="p-5 border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Prepaid Gateway Balance</h3>
              <p className="text-xs text-muted-foreground">Third-party telecom credits</p>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-muted/20 border border-border/50 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-foreground font-medium">Twilio SMS Account</span>
              <span className="text-emerald-500 font-bold">$148.20 available</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-foreground font-medium">Meta WhatsApp Cloud</span>
              <span className="text-emerald-500 font-bold">$310.00 available</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-foreground font-medium">SendGrid Pro Plan</span>
              <span className="text-blue-500 font-bold">Included in tier</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Valkey Queue Backpressure</h3>
              <p className="text-xs text-muted-foreground">Automated burst protection</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            All outbound emails and SMS messages pass through in-memory Valkey worker queues.
            When external carrier rate limits are approached, workers automatically insert exponential backoff delays
            to prevent 429 throttling and dropped messages.
          </p>
        </Card>
      </div>
    </div>
  );
}
