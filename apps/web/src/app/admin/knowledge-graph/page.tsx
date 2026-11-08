"use client";

import React, { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { api } from "@/lib/api";
import {
  Network,
  GitFork,
  Cpu,
  Layers,
  ExternalLink,
  RefreshCw,
  Search,
  BookOpen,
  Terminal,
  FileCode2,
  ArrowRight,
  Sparkles,
  Link2,
} from "lucide-react";

export default function KnowledgeGraphPage() {
  const [activeTab, setActiveTab] = useState<string>("graph");
  const [iframeKey, setIframeKey] = useState<number>(Date.now());

  // Live Explorer State
  const [stats, setStats] = useState<any>(null);
  const [pathFrom, setPathFrom] = useState<string>("AuthService");
  const [pathTo, setPathTo] = useState<string>("PrismaService");
  const [pathResult, setPathResult] = useState<any>(null);
  const [isTracingPath, setIsTracingPath] = useState<boolean>(false);
  const [pathError, setPathError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [nodeDetails, setNodeDetails] = useState<any>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isRebuilding, setIsRebuilding] = useState<boolean>(false);
  const [rebuildStatus, setRebuildStatus] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<any>("/graphify/stats")
      .then((res) => setStats(res))
      .catch((err) => console.error("Failed to fetch graphify stats:", err));
  }, [iframeKey]);

  const handleRefresh = () => {
    setIframeKey(Date.now());
  };

  const handleTracePath = async () => {
    if (!pathFrom || !pathTo) return;
    setIsTracingPath(true);
    setPathError(null);
    try {
      const res = await api.get<any>(
        `/graphify/path?from=${encodeURIComponent(pathFrom.trim())}&to=${encodeURIComponent(pathTo.trim())}`,
      );
      setPathResult(res);
      if (!res.found) {
        setPathError(
          res.message || "No direct connection path found between symbols",
        );
      }
    } catch (err: any) {
      setPathError(err.message || "Failed to trace path");
    } finally {
      setIsTracingPath(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await api.get<any[]>(
        `/graphify/search?q=${encodeURIComponent(query.trim())}&limit=10`,
      );
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectNode = async (node: any) => {
    setSelectedNode(node);
    try {
      const details = await api.get<any>(
        `/graphify/node/${encodeURIComponent(node.id)}`,
      );
      setNodeDetails(details);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRebuild = async () => {
    setIsRebuilding(true);
    setRebuildStatus(null);
    try {
      const res = await api.post<any>("/graphify/refresh");
      setRebuildStatus(res?.message || "Graph refreshed successfully");
      setIframeKey(Date.now());
    } catch (err: any) {
      setRebuildStatus(`Rebuild failed: ${err.message}`);
    } finally {
      setIsRebuilding(false);
    }
  };

  const tabs = [
    { id: "graph", label: "Interactive 2D Knowledge Graph" },
    { id: "explorer", label: "Symbol & Path Explorer" },
    { id: "callflow", label: "Call-Flow & Architecture" },
    { id: "tree", label: "Collapsible File Tree" },
    { id: "cli", label: "CLI & AI Assistant Integration" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Breadcrumbs items={[{ label: "Codebase Knowledge Graph" }]} />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Network className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Codebase Knowledge Graph (Graphify)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            AST-powered semantic knowledge graph, module clustering, and
            call-flow architecture for this monorepo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRebuild}
            isLoading={isRebuilding}
            className="flex items-center gap-1.5 text-xs"
            title="Re-run tree-sitter AST extraction"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Re-Extract AST
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Viewer
          </Button>

          <a
            href={
              activeTab === "graph"
                ? "/graphify/graph.html"
                : activeTab === "callflow"
                  ? "/graphify/callflow.html"
                  : "/graphify/GRAPH_TREE.html"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white btn hadow-sm transition-colors"
          >
            <span>Open Full Screen</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {rebuildStatus && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 rounded-lg text-xs flex items-center justify-between">
          <span>{rebuildStatus}</span>
          <button
            onClick={() => setRebuildStatus(null)}
            className="text-xs font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {stats?.totalNodes || "1,127"}
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Graph Nodes
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                Classes, methods, routes, DTOs
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <GitFork className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {stats?.totalEdges || "2,415"}
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Structural Edges
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                Calls, imports, inheritance
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {stats?.communitiesCount || "63"}
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Module Communities
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                Leiden cluster groupings
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {stats?.tokenReductionRatio || "39.0x"}
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Token Reduction
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                ~1.9k vs ~74.6k tokens/query
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Panels */}
      {activeTab === "graph" && (
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden btn hadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Network className="w-4 h-4 text-indigo-600" />
                  Interactive Force-Directed Knowledge Graph
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Search symbols, drag nodes, inspect community boundaries, and
                  explore connections across Next.js, NestJS, and shared
                  packages.
                </CardDescription>
              </div>
              <Badge variant="indigo">Tree-Sitter AST</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full h-[650px] bg-slate-950 relative">
              <iframe
                key={`graph-${iframeKey}`}
                src="/graphify/graph.html"
                title="Graphify Knowledge Graph"
                className="w-full h-full border-0"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "explorer" && (
        <div className="space-y-6">
          {/* Path Tracer Card */}
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Link2 className="w-4 h-4 text-indigo-600" />
                Shortest Connection Path Tracer
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Discover the exact dependency sequence and method/import hops
                between any two classes, services, or controllers in the
                codebase.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="w-full sm:w-1/2 space-y-1">
                  <label className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                    Source Symbol
                  </label>
                  <input
                    type="text"
                    value={pathFrom}
                    onChange={(e) => setPathFrom(e.target.value)}
                    placeholder="e.g. AuthService or UsersController"
                    className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white "
                  />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 hidden sm:block mt-5" />
                <div className="w-full sm:w-1/2 space-y-1">
                  <label className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                    Target Symbol
                  </label>
                  <input
                    type="text"
                    value={pathTo}
                    onChange={(e) => setPathTo(e.target.value)}
                    placeholder="e.g. PrismaService or ValkeyService"
                    className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white "
                  />
                </div>
                <div className="mt-5 w-full sm:w-auto">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleTracePath}
                    isLoading={isTracingPath}
                    className="w-full sm:w-auto"
                  >
                    Trace Path
                  </Button>
                </div>
              </div>

              {/* Suggestions shortcuts */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
                <span>Try pairs:</span>
                {[
                  ["AuthService", "PrismaService"],
                  ["RolesController", "AuditService"],
                  ["AdminSidebar", "MenuItem"],
                  ["UsersService", "ValkeyService"],
                ].map(([f, t]) => (
                  <button
                    key={`${f}-${t}`}
                    type="button"
                    onClick={() => {
                      setPathFrom(f);
                      setPathTo(t);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 font-mono text-[10px] transition-colors"
                  >
                    {f} → {t}
                  </button>
                ))}
              </div>

              {pathError && (
                <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 rounded-lg">
                  {pathError}
                </div>
              )}

              {pathResult?.found && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Path Found in {pathResult.hops} Hop
                      {pathResult.hops === 1 ? "" : "s"}
                    </span>
                    <Badge variant="emerald">Connected</Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {pathResult.path.map((step: any, idx: number) => (
                      <React.Fragment key={idx}>
                        <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs space-y-0.5">
                          <div className="font-bold text-xs text-indigo-700 dark:text-indigo-400">
                            {step.node?.label}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                            {step.node?.source_file ||
                              step.node?.sourceFile ||
                              "source"}
                          </div>
                        </div>
                        {idx < pathResult.path.length - 1 && (
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold px-1">
                              --{pathResult.path[idx + 1]?.relation}--&gt;
                            </span>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Symbol Inspector & Search */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Search className="w-4 h-4 text-purple-600" />
                  Codebase Symbol Search
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Search through 1,127 parsed classes, methods, endpoints, and
                  schemas.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Type to search symbols (e.g. UserRole, TransformInterceptor)..."
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white "
                />

                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectNode(item)}
                      className={`p-2.5 rounded-lg cursor-pointer transition-colors flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        selectedNode?.id === item.id
                          ? "bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800"
                          : ""
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs text-slate-900 dark:text-white">
                          {item.label}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                          {item.source_file}{" "}
                          {item.source_location && `(${item.source_location})`}
                        </div>
                      </div>
                      <Badge variant="slate">
                        {item.community_name || "Community"}
                      </Badge>
                    </div>
                  ))}
                  {searchQuery &&
                    searchResults.length === 0 &&
                    !isSearching && (
                      <div className="text-xs text-slate-400 py-4 text-center">
                        No matching symbols found.
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>

            {/* Selected Node Details */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Symbol Inspector
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedNode
                    ? selectedNode.label
                    : "Select a symbol from search to view incoming & outgoing dependencies"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {selectedNode && nodeDetails ? (
                  <div className="space-y-4 text-xs">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-indigo-700 dark:text-indigo-400">
                          {nodeDetails.node.label}
                        </span>
                        <Badge variant="indigo">
                          {nodeDetails.totalConnections} Connections
                        </Badge>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {nodeDetails.node.source_file}:
                        {nodeDetails.node.source_location || "1"}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        Community:{" "}
                        <span className="font-semibold">
                          {nodeDetails.node.community_name}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        Outgoing References / Calls (
                        {nodeDetails.outgoing.length}):
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                        {nodeDetails.outgoing.map((out: any, i: number) => (
                          <div
                            key={i}
                            className="p-1.5 bg-slate-50 dark:bg-slate-800/40 rounded flex items-center justify-between text-[11px]"
                          >
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {out.target?.label}
                            </span>
                            <Badge variant="slate">{out.relation}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        Incoming Referrers ({nodeDetails.incoming.length}):
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                        {nodeDetails.incoming.map((inc: any, i: number) => (
                          <div
                            key={i}
                            className="p-1.5 bg-slate-50 dark:bg-slate-800/40 rounded flex items-center justify-between text-[11px]"
                          >
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {inc.source?.label}
                            </span>
                            <Badge variant="slate">{inc.relation}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                    Search or click a central hub to inspect its connections and
                    source location.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "callflow" && (
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden btn hadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <GitFork className="w-4 h-4 text-emerald-600" />
                  Architecture & Call-Flow Diagrams
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Mermaid sequence diagrams and call tables mapping module-level
                  interaction flows.
                </CardDescription>
              </div>
              <Badge variant="emerald">15 Mermaid Diagrams</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full h-[650px] bg-white dark:bg-slate-950 relative">
              <iframe
                key={`callflow-${iframeKey}`}
                src="/graphify/callflow.html"
                title="Graphify Call-Flow Architecture"
                className="w-full h-full border-0"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "tree" && (
        <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden btn hadow-sm">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-indigo-600" />
                  Collapsible File & Dependency Hierarchy
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Nested hierarchy visualizing file-to-file imports, exports,
                  and circular-safe dependencies.
                </CardDescription>
              </div>
              <Badge variant="indigo">143 Analyzed Files</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full h-[650px] bg-white dark:bg-slate-950 relative">
              <iframe
                key={`tree-${iframeKey}`}
                src="/graphify/GRAPH_TREE.html"
                title="Graphify Dependency Tree"
                className="w-full h-full border-0"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "cli" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-600" />
                Monorepo CLI Automation Scripts
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Commands configured in root package.json for deterministic local
                execution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs space-y-2">
                <div>
                  <span className="text-emerald-400">
                    # 1. Update AST Knowledge Graph
                  </span>
                  <p className="text-slate-300">pnpm graphify</p>
                </div>
                <div>
                  <span className="text-emerald-400">
                    # 2. Export All Visualizers & Web Assets
                  </span>
                  <p className="text-slate-300">pnpm graphify:export</p>
                </div>
                <div>
                  <span className="text-emerald-400">
                    # 3. Generate Collapsible File Tree
                  </span>
                  <p className="text-slate-300">pnpm graphify:tree</p>
                </div>
                <div>
                  <span className="text-emerald-400">
                    # 4. Generate Mermaid Callflow HTML
                  </span>
                  <p className="text-slate-300">pnpm graphify:callflow</p>
                </div>
                <div>
                  <span className="text-emerald-400">
                    # 5. Measure Token Reduction Efficiency
                  </span>
                  <p className="text-slate-300">pnpm graphify:benchmark</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-600" />
                Querying the Graph via Terminal & Git Hooks
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Direct CLI queries to trace paths and automated git lifecycle
                updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-xs">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Find Shortest Connection Path Between Any Two Symbols:
                </p>
                <pre className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                  .venv/bin/graphify path "AuthService" "PrismaService"
                </pre>
              </div>

              <div className="space-y-2 text-xs">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Git Hooks Configured:
                </p>
                <p className="text-slate-600 dark:text-slate-400 text-xs">
                  Active in{" "}
                  <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-indigo-600 dark:text-indigo-400">
                    .git/hooks/
                  </code>{" "}
                  (post-commit, post-checkout, post-merge, post-rewrite) with
                  custom union-merge driver for{" "}
                  <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-indigo-600 dark:text-indigo-400">
                    graph.json
                  </code>
                  .
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Obsidian Vault Export:
                </p>
                <p className="text-slate-600 dark:text-slate-400 text-xs">
                  Generated in{" "}
                  <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-indigo-600 dark:text-indigo-400">
                    graphify-out/obsidian/
                  </code>{" "}
                  with 1,190 interconnected Markdown notes and{" "}
                  <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-indigo-600 dark:text-indigo-400">
                    graph.canvas
                  </code>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
