"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Setting,
  SettingCategory,
  SettingType,
  UserRole,
} from "@monorepo/shared-types";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  Sliders,
  RefreshCw,
  Search,
  Save,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Globe,
  Edit2,
  Sun,
  Moon,
  Laptop,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { reloadSystemSettings } = useTheme();

  const [settings, setSettings] = useState<Setting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");

  // Super Admin Theme Configuration State (Requirement 10.4)
  const [selectedThemeDefault, setSelectedThemeDefault] = useState<
    "LIGHT" | "DARK" | "SYSTEM"
  >("LIGHT");
  const [isUpdatingTheme, setIsUpdatingTheme] = useState(false);
  const [themeSuccess, setThemeSuccess] = useState<string | null>(null);
  const [themeError, setThemeError] = useState<string | null>(null);

  // Edit Modal State
  const [editingSetting, setEditingSetting] = useState<Setting | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<Setting[]>("/settings");
      setSettings(res);

      const themeSetting = res.find((s) => s.key === "ui.theme.default");
      if (themeSetting && themeSetting.value) {
        const val = themeSetting.value.toUpperCase();
        if (val === "LIGHT" || val === "DARK" || val === "SYSTEM") {
          setSelectedThemeDefault(val);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load system settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleUpdateSystemTheme = async (
    themeVal: "LIGHT" | "DARK" | "SYSTEM",
  ) => {
    if (!isSuperAdmin) {
      setThemeError(
        "Only Super Admins have permission to modify the system-wide default theme.",
      );
      return;
    }

    setIsUpdatingTheme(true);
    setThemeError(null);
    setThemeSuccess(null);

    try {
      await api.patch("/settings/ui.theme.default", { value: themeVal });
      setSelectedThemeDefault(themeVal);
      setThemeSuccess(
        `System-wide default theme successfully set to ${themeVal}!`,
      );
      await reloadSystemSettings();
      await fetchSettings();
      setTimeout(() => setThemeSuccess(null), 4000);
    } catch (err: any) {
      setThemeError(err.message || "Failed to update system default theme");
    } finally {
      setIsUpdatingTheme(false);
    }
  };

  const handleOpenEdit = (setting: Setting) => {
    setEditingSetting(setting);
    setEditValue(setting.value);
    setEditError(null);
  };

  const handleSaveSetting = async () => {
    if (!editingSetting) return;

    if (editingSetting.key === "ui.theme.default" && !isSuperAdmin) {
      setEditError("Only Super Admins can update ui.theme.default");
      return;
    }

    // Validate type
    if (
      editingSetting.type === SettingType.NUMBER &&
      isNaN(Number(editValue))
    ) {
      setEditError("Value must be a valid number");
      return;
    }
    if (
      editingSetting.type === SettingType.BOOLEAN &&
      editValue !== "true" &&
      editValue !== "false"
    ) {
      setEditError('Value must be "true" or "false"');
      return;
    }
    if (editingSetting.type === SettingType.JSON) {
      try {
        JSON.parse(editValue);
      } catch {
        setEditError("Value must be valid JSON");
        return;
      }
    }

    setIsSaving(true);
    setEditError(null);

    try {
      await api.patch(`/settings/${editingSetting.key}`, { value: editValue });
      setSaveSuccess(`Setting "${editingSetting.key}" successfully updated!`);
      setTimeout(() => setSaveSuccess(null), 3000);
      setEditingSetting(null);
      if (editingSetting.key === "ui.theme.default") {
        await reloadSystemSettings();
      }
      fetchSettings();
    } catch (err: any) {
      setEditError(err.message || "Failed to update setting");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleBoolean = async (setting: Setting) => {
    const newValue = setting.value === "true" ? "false" : "true";
    try {
      await api.patch(`/settings/${setting.key}`, { value: newValue });
      setSaveSuccess(`Updated "${setting.key}" to ${newValue}`);
      setTimeout(() => setSaveSuccess(null), 3000);
      fetchSettings();
    } catch (err: any) {
      setError(err.message || "Failed to toggle setting");
    }
  };

  const filteredSettings = settings.filter((s) => {
    const matchesCategory =
      activeCategory === "ALL" || s.category === activeCategory;
    const matchesSearch =
      !search.trim() ||
      s.key.toLowerCase().includes(search.toLowerCase()) ||
      (s.description &&
        s.description.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const categories = [
    "ALL",
    SettingCategory.GENERAL,
    SettingCategory.SECURITY,
    SettingCategory.AUTHENTICATION,
    SettingCategory.UI,
    SettingCategory.NOTIFICATIONS,
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Header */}
      <div>
        <Breadcrumbs
          items={[
            { label: "Admin", href: "/admin/dashboard" },
            { label: "Default Settings" },
          ]}
        />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Default System Settings
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure system parameters, security policies, token expirations,
              and runtime preferences.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchSettings()}
              disabled={isLoading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Success Alert */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Super Admin System-Wide Theme Configuration Card (Requirement 10.4) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-200 rounded-2xl p-6 btn hadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Application Default Theme (System-Wide)
              </h2>
              {isSuperAdmin ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  <ShieldCheck className="w-3 h-3" />
                  Super Admin Authorized
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <ShieldAlert className="w-3 h-3" />
                  Super Admin Clearance Required
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Configures the database setting{" "}
              <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">
                ui.theme.default
              </code>{" "}
              applied to all new and unconfigured user sessions.
            </p>
          </div>

          <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-200">
            <span className="font-semibold block text-slate-700 dark:text-slate-300 mb-0.5">
              Precedence Order:
            </span>
            1. User Preference → 2. Super Admin Default → 3. Light Mode Fallback
          </div>
        </div>

        {themeSuccess && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>{themeSuccess}</span>
          </div>
        )}

        {themeError && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span>{themeError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {/* Light Theme Card */}
          <button
            type="button"
            disabled={!isSuperAdmin || isUpdatingTheme}
            onClick={() => handleUpdateSystemTheme("LIGHT")}
            className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
              selectedThemeDefault === "LIGHT"
                ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20"
                : "border-slate-200 dark:border-slate-200 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800"
            } ${!isSuperAdmin ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-600 rounded-lg">
                <Sun className="w-5 h-5" />
              </div>
              {selectedThemeDefault === "LIGHT" && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-600 text-white rounded-full">
                  ACTIVE DEFAULT
                </span>
              )}
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                Light Mode
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Clean, crisp default interface with light backgrounds and
                maximum contrast.
              </div>
            </div>
          </button>

          {/* Dark Theme Card */}
          <button
            type="button"
            disabled={!isSuperAdmin || isUpdatingTheme}
            onClick={() => handleUpdateSystemTheme("DARK")}
            className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
              selectedThemeDefault === "DARK"
                ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20"
                : "border-slate-200 dark:border-slate-200 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800"
            } ${!isSuperAdmin ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Moon className="w-5 h-5" />
              </div>
              {selectedThemeDefault === "DARK" && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-600 text-white rounded-full">
                  ACTIVE DEFAULT
                </span>
              )}
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                Dark Mode
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Deep slate backgrounds designed for reduced eye strain in
                low-light environments.
              </div>
            </div>
          </button>

          {/* System Theme Card */}
          <button
            type="button"
            disabled={!isSuperAdmin || isUpdatingTheme}
            onClick={() => handleUpdateSystemTheme("SYSTEM")}
            className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
              selectedThemeDefault === "SYSTEM"
                ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20"
                : "border-slate-200 dark:border-slate-200 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800"
            } ${!isSuperAdmin ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg">
                <Laptop className="w-5 h-5" />
              </div>
              {selectedThemeDefault === "SYSTEM" && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-600 text-white rounded-full">
                  ACTIVE DEFAULT
                </span>
              )}
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                System Synchronized
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Dynamically matches each user&apos;s operating system light/dark
                preference.
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-200 pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? "bg-indigo-600 text-white btn hadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by key name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none  transition-colors"
          />
        </div>
      </div>

      {/* Settings Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filteredSettings.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-200 text-slate-500 dark:text-slate-400 text-sm">
          No settings found matching your current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSettings.map((setting) => {
            const settingId =
              setting.settingUuid || setting.setting_uuid || setting.key;
            const isPublicSetting =
              setting.isPublic !== undefined
                ? setting.isPublic
                : setting.is_public;

            return (
              <div
                key={settingId}
                className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-200 btn hadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 break-all">
                        {setting.key}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge variant="indigo">{setting.category}</Badge>
                      <Badge variant="default">{setting.type}</Badge>
                      {isPublicSetting ? (
                        <span
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          title="Publicly accessible"
                        >
                          <Globe className="w-3.5 h-3.5 text-blue-500" />
                        </span>
                      ) : (
                        <span
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          title="Private system setting"
                        >
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    {setting.description || "No description provided."}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">
                      Value:
                    </span>
                    {setting.type === SettingType.BOOLEAN ? (
                      <button
                        onClick={() => handleToggleBoolean(setting)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                          setting.value === "true"
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200"
                            : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 hover:bg-rose-200"
                        }`}
                        title="Click to toggle"
                      >
                        {setting.value.toUpperCase()}
                      </button>
                    ) : (
                      <span
                        className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 max-w-[200px] truncate block"
                        title={setting.value}
                      >
                        {setting.value}
                      </span>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(setting)}
                    className="text-xs flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Setting Modal */}
      {editingSetting && (
        <Modal
          isOpen={!!editingSetting}
          onClose={() => setEditingSetting(null)}
          title={`Edit Setting: ${editingSetting.key}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300">
              <p className="font-medium text-slate-800 dark:text-white mb-1">
                Description:
              </p>
              <p>{editingSetting.description || "System setting"}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="indigo">{editingSetting.category}</Badge>
                <Badge variant="default">Type: {editingSetting.type}</Badge>
              </div>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs">
                {editError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Setting Value ({editingSetting.type})
              </label>

              {editingSetting.type === SettingType.BOOLEAN ? (
                <select
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none "
                >
                  <option value="true">true (Enabled)</option>
                  <option value="false">false (Disabled)</option>
                </select>
              ) : editingSetting.key === "ui.theme.default" ? (
                <select
                  value={editValue.toUpperCase()}
                  onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                  className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none "
                >
                  <option value="LIGHT">LIGHT (Default Light Mode)</option>
                  <option value="DARK">DARK (Dark Mode)</option>
                  <option value="SYSTEM">SYSTEM (Sync with OS)</option>
                </select>
              ) : editingSetting.type === SettingType.JSON ? (
                <textarea
                  rows={6}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-900 text-emerald-400 "
                />
              ) : (
                <input
                  type={
                    editingSetting.type === SettingType.NUMBER
                      ? "number"
                      : "text"
                  }
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none "
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-200">
              <Button
                variant="secondary"
                onClick={() => setEditingSetting(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveSetting}
                disabled={isSaving}
                className="flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
