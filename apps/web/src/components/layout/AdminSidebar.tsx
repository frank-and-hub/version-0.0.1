"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MenuItem } from "@monorepo/shared-types";
import { api } from "@/lib/api";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  Menu as MenuIcon,
  ScrollText,
  History,
  AlertOctagon,
  Settings,
  User,
  Activity,
  Network,
  ChevronDown,
  ChevronRight,
  Layers,
  ChevronLeft,
  X,
  Circle,
  Mail,
  Send,
  Smartphone,
  Key,
  Share2,
  FileText,
  BarChart2,
  PieChart,
  Bell,
  ShieldAlert,
  List,
  Compass,
  Radio,
  Server,
  TrendingUp,
  Webhook,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  Menu: MenuIcon,
  ScrollText,
  History,
  AlertOctagon,
  Settings,
  User,
  Activity,
  Network,
  Mail,
  Send,
  Smartphone,
  Key,
  Share2,
  FileText,
  BarChart2,
  PieChart,
  Bell,
  ShieldAlert,
  List,
  Compass,
  Radio,
  Server,
  TrendingUp,
  Webhook,
  MessageSquare,
  Layers,
};

interface AdminSidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function AdminSidebar({
  isMobileOpen,
  onMobileClose,
  isCollapsed,
  onToggleCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fullCurrentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);

  const loadMenu = useCallback(async () => {
    try {
      const tree = await api.get<MenuItem[]>("/navigation/menu");
      setMenuItems(tree);

      // Auto-expand parents of active route
      const initialExpanded: Record<string, boolean> = {};
      tree.forEach((item) => {
        const itemKey = item.menuUuid || item.menu_uuid || "";
        if (
          item.children &&
          item.children.some(
            (c) =>
              fullCurrentUrl === c.route ||
              fullCurrentUrl.startsWith(c.route) ||
              pathname === c.route.split("?")[0],
          )
        ) {
          initialExpanded[itemKey] = true;
        }
      });
      setExpandedMenus((prev) => ({ ...initialExpanded, ...prev }));
    } catch (err) {
      console.error("Failed to load dynamic sidebar menu:", err);
    } finally {
      setIsLoading(false);
    }
  }, [fullCurrentUrl, pathname]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  // Real-time permission event listener
  useEffect(() => {
    const handlePermissionsUpdated = () => {
      loadMenu();
    };

    window.addEventListener("auth:permissions-updated", handlePermissionsUpdated);
    return () => {
      window.removeEventListener("auth:permissions-updated", handlePermissionsUpdated);
    };
  }, [loadMenu]);

  const toggleExpand = (menuUuid: string) => {
    setExpandedMenus((prev) => ({ ...prev, [menuUuid]: !prev[menuUuid] }));
  };

  const renderIcon = (iconName: string) => {
    const IconComponent = ICON_MAP[iconName] || Circle;
    return <IconComponent className="w-4 h-4 shrink-0" />;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white text-slate-300">
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200">
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-3 overflow-hidden"
        >
          {/* <div className="p-2 bg-indigo-400 text-white rounded-xl shadow-md shrink-0">
            <Layers className="w-5 h-5" />
          </div> */}
          {!isCollapsed && (
            <div className="flex flex-col truncate">
              <span className="font-bold text-sm text-red tracking-tight">
                Enterprise Stack
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Administration
              </span>
            </div>
          )}
        </Link>
        <a
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </a>
        <a
          onClick={onMobileClose}
          className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </a>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {isLoading ? (
          <div className="space-y-2 px-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-9 bg-slate-800/60 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : (
          menuItems.map((item) => {
            const itemKey = item.menuUuid || item.menu_uuid || item.route;
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = !!expandedMenus[itemKey];
            const isActive =
              pathname === item.route ||
              (hasChildren && item.children?.some((c) => pathname === c.route));

            if (hasChildren) {
              return (
                <div key={itemKey} className="space-y-1">
                  <a
                    type="button"
                    onClick={() => toggleExpand(itemKey)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-indigo-400 text-white btn"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50",
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div className="flex items-center gap-3 truncate">
                      {renderIcon(item.icon)}
                      {!isCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </div>
                    {!isCollapsed && (
                      <span className="text-slate-500">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </span>
                    )}
                  </a>

                  {/* Child Menus */}
                  {!isCollapsed && isExpanded && (
                    <div className="pl-6 space-y-1 pt-1 border-l border-slate-200 ml-4">
                      {item.children?.map((child) => {
                        const childKey =
                          child.menuUuid || child.menu_uuid || child.route;
                        const isChildActive = pathname === child.route;
                        return (
                          <Link
                            key={childKey}
                            href={child.route}
                            onClick={onMobileClose}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-1.5 text-xs rounded-md transition-colors",
                              isChildActive
                                ? "bg-indigo-400 text-white font-medium btn hadow-sm"
                                : "text-slate-400 hover:text-white hover:bg-slate-800/40",
                            )}
                          >
                            {renderIcon(child.icon)}
                            <span className="truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={itemKey}
                href={item.route}
                onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-indigo-400 text-white font-semibold btn hadow-sm btn"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50",
                )}
                title={isCollapsed ? item.label : undefined}
              >
                {renderIcon(item.icon)}
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })
        )}
      </nav>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-200 text-[11px] text-slate-500 text-center">
          Dynamic RBAC Navigation
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          "hidden md:block transition-all duration-300 ease-in-out shrink-0 border-r border-slate-200 z-30 sticky top-0 h-screen",
          isCollapsed ? "w-16" : "w-64",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <div className="relative w-64 max-w-xs h-full z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
