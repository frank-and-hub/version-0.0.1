"use client";

import React, { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import {
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  RefreshCw,
  Mail,
  Smartphone,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Server,
  PieChart,
} from "lucide-react";

interface FailureItem {
  code: string;
  category: string;
  channel: string;
  count: number;
  sampleError: string;
}

export default function MessagingReportsPage() {
  const [dateRange, setDateRange] = useState("30d");
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const failureBreakdown: FailureItem[] = [
    {
      code: "550_5_1_1",
      category: "Hard Bounce",
      channel: "EMAIL",
      count: 14,
      sampleError: "Mailbox does not exist or user unknown",
    },
    {
      code: "30008",
      category: "Carrier Delivery Failure",
      channel: "SMS",
      count: 8,
      sampleError: "Unknown error returned by mobile carrier",
    },
    {
      code: "131047",
      category: "Customer Service Window",
      channel: "WHATSAPP",
      count: 3,
      sampleError: "More than 24 hours have passed since the recipient last replied",
    },
    {
      code: "429_RATE_LIMIT",
      category: "Provider Throttling",
      channel: "EMAIL",
      count: 2,
      sampleError: "Exceeded max requests per second on transactional pool",
    },
  ];

  const handleExportCSV = () => {
    setExporting(true);
    setExportNotice(null);
    setTimeout(() => {
      // Mock CSV generation
      const headers = "Timestamp,Channel,Recipient,Status,Provider,LatencyMs,Cost\n";
      const rows = [
        "2026-11-09T08:14:00Z,EMAIL,alex@example.com,DELIVERED,SendGrid,280,0.0005\n",
        "2026-11-09T08:14:22Z,SMS,+14155552671,DELIVERED,Twilio,410,0.0079\n",
        "2026-11-09T08:15:01Z,WHATSAPP,+14155558912,READ,Meta Cloud,350,0.0050\n",
      ].join("");

      const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `messaging-report-${dateRange}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExporting(false);
      setExportNotice("Report exported successfully as CSV.");
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Messaging Platform", href: "/admin/messaging" },
          { label: "Reports" },
        ]}
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Delivery & Compliance Reports
                <Badge variant="emerald" className="text-xs">
                  Audited
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Download consolidated transaction logs, bounce forensics, carrier delivery receipts, and SLA records.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Download className={`w-4 h-4 ${exporting ? "animate-bounce" : ""}`} />
            {exporting ? "Generating..." : "Export CSV Report"}
          </Button>
        </div>
      </div>

      {exportNotice && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-between text-sm">
          <span>{exportNotice}</span>
          <button onClick={() => setExportNotice(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* Filters and Date Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Date Range:
          </span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="h-9 px-3 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last Quarter (90 Days)</option>
          </select>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="h-9 px-3 rounded-md bg-background border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Communication Channels</option>
            <option value="EMAIL">Email Deliverability</option>
            <option value="SMS">SMS Carrier Receipts</option>
            <option value="WHATSAPP">WhatsApp Conversation Analytics</option>
          </select>
        </div>
      </div>

      {/* Summary KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-card border-border">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Processed Volume</div>
          <div className="mt-2 text-2xl font-bold text-foreground">142,850</div>
          <div className="text-xs text-emerald-500 mt-1">+12.4% vs previous window</div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Successful Delivery</div>
          <div className="mt-2 text-2xl font-bold text-emerald-500">99.1%</div>
          <div className="text-xs text-muted-foreground mt-1">141,564 successful receipts</div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Bounces / Errors</div>
          <div className="mt-2 text-2xl font-bold text-red-500">27</div>
          <div className="text-xs text-muted-foreground mt-1">0.9% hard & soft bounce rate</div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Estimated Cost</div>
          <div className="mt-2 text-2xl font-bold text-foreground">$128.40</div>
          <div className="text-xs text-blue-500 mt-1">Under monthly budget</div>
        </Card>
      </div>

      {/* Bounce & Failure Forensic Table */}
      <Card className="border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Delivery Failure & Bounce Diagnostics
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Root causes for undelivered notifications across active provider gateways.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/10">
                <th className="p-3.5 font-semibold text-muted-foreground">Error Code</th>
                <th className="p-3.5 font-semibold text-muted-foreground">Channel</th>
                <th className="p-3.5 font-semibold text-muted-foreground">Category</th>
                <th className="p-3.5 font-semibold text-muted-foreground">Incidents</th>
                <th className="p-3.5 font-semibold text-muted-foreground">Provider Diagnostic Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {failureBreakdown.map((item, idx) => (
                <tr key={idx} className="hover:bg-muted/10 transition-colors">
                  <td className="p-3.5 font-mono text-[11px] font-semibold text-red-500">
                    {item.code}
                  </td>
                  <td className="p-3.5">
                    <Badge
                      variant={
                        item.channel === "EMAIL"
                          ? "blue"
                          : item.channel === "WHATSAPP"
                          ? "emerald"
                          : "amber"
                      }
                      className="text-[10px]"
                    >
                      {item.channel}
                    </Badge>
                  </td>
                  <td className="p-3.5 font-medium text-foreground">{item.category}</td>
                  <td className="p-3.5 font-bold text-foreground">{item.count}</td>
                  <td className="p-3.5 text-muted-foreground font-mono text-[11px]">
                    {item.sampleError}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
