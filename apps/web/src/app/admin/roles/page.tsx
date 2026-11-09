"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import {
  ShieldCheck,
  Lock,
  Edit3,
  Check,
  ShieldAlert,
  Plus,
  Trash2,
  Users,
  CheckSquare,
  Square,
  Sparkles,
  Info,
  UserCheck,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@monorepo/shared-types";

interface RoleData {
  role_uuid: string;
  role: string;
  code: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  userCount: number;
  permissions: Array<{
    permission_uuid: string;
    code: string;
    name: string;
    category: string;
    description?: string | null;
  }>;
}

interface PermissionData {
  permission_uuid: string;
  code: string;
  name: string;
  category: string;
  description?: string | null;
}

export default function RolePermissionPage() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"roles" | "overrides" | "matrix">("roles");
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [permissions, setPermissions] = useState<PermissionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Role Permissions Modal State
  const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
  const [assignedPerms, setAssignedPerms] = useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create Role Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    code: "",
    description: "",
    permissions: [] as string[],
  });
  const [isCreating, setIsCreating] = useState(false);

  // User Overrides State
  const [targetUserUuid, setTargetUserUuid] = useState("");
  const [userEffectiveData, setUserEffectiveData] = useState<any | null>(null);
  const [isLoadingUserOverrides, setIsLoadingUserOverrides] = useState(false);
  const [overridePermCode, setOverridePermCode] = useState("");
  const [overrideGrantType, setOverrideGrantType] = useState<"GRANT" | "DENY">("GRANT");
  const [isSavingOverride, setIsSavingOverride] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setPageError(null);
    try {
      const [rolesData, permsData] = await Promise.all([
        api.get<RoleData[]>("/roles"),
        api.get<PermissionData[]>("/roles/permissions"),
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
    } catch (err: any) {
      console.error("Failed to load roles and permissions:", err);
      setPageError(err.message || "Failed to load roles and permissions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handlePermissionsUpdated = () => {
      loadData();
    };
    window.addEventListener("auth:permissions-updated", handlePermissionsUpdated);
    return () => {
      window.removeEventListener("auth:permissions-updated", handlePermissionsUpdated);
    };
  }, []);

  // Group permissions by category
  const categories = React.useMemo(() => {
    const map = new Map<string, PermissionData[]>();
    for (const p of permissions) {
      const list = map.get(p.category) || [];
      list.push(p);
      map.set(p.category, list);
    }
    return Array.from(map.entries());
  }, [permissions]);

  const openEditModal = (roleObj: RoleData) => {
    setSelectedRole(roleObj);
    setAssignedPerms(roleObj.permissions.map((p) => p.code));
    setErrorMsg(null);
    setIsEditModalOpen(true);
  };

  const handleTogglePerm = (code: string) => {
    if (assignedPerms.includes(code)) {
      setAssignedPerms(assignedPerms.filter((p) => p !== code));
    } else {
      setAssignedPerms([...assignedPerms, code]);
    }
  };

  const handleSelectAllCategory = (catPerms: PermissionData[]) => {
    const codes = catPerms.map((p) => p.code);
    const newAssigned = Array.from(new Set([...assignedPerms, ...codes]));
    setAssignedPerms(newAssigned);
  };

  const handleDeselectAllCategory = (catPerms: PermissionData[]) => {
    const codes = catPerms.map((p) => p.code);
    setAssignedPerms(assignedPerms.filter((p) => !codes.includes(p)));
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      await api.post(`/roles/${selectedRole.code || selectedRole.role}/permissions`, {
        permissions: assignedPerms,
      });
      setIsEditModalOpen(false);
      setSuccessMsg(`Permissions updated successfully for ${selectedRole.name}`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update permissions");
    } finally {
      setIsSaving(false);
    }
  };

  // Create Role handlers
  const handleNameChange = (name: string) => {
    const code = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "_");
    setCreateForm((prev) => ({ ...prev, name, code }));
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.code) {
      setErrorMsg("Role name and code are required");
      return;
    }

    setIsCreating(true);
    setErrorMsg(null);

    try {
      await api.post("/roles", createForm);
      setIsCreateModalOpen(false);
      setCreateForm({ name: "", code: "", description: "", permissions: [] });
      setSuccessMsg(`Role ${createForm.name} created successfully!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create dynamic role");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRole = async (roleObj: RoleData) => {
    if (roleObj.is_system) {
      alert("System roles cannot be deleted.");
      return;
    }
    if (!confirm(`Are you sure you want to delete role '${roleObj.name}'?`)) {
      return;
    }

    try {
      await api.delete(`/roles/${roleObj.role_uuid}`);
      setSuccessMsg(`Role ${roleObj.name} deleted.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete role");
    }
  };

  // User Overrides Handlers
  const handleInspectUserOverrides = async () => {
    if (!targetUserUuid.trim()) return;
    setIsLoadingUserOverrides(true);
    try {
      const data = await api.get(`/roles/users/${targetUserUuid.trim()}/effective`);
      setUserEffectiveData(data);
    } catch (err: any) {
      alert(err.message || "Failed to fetch user permissions");
      setUserEffectiveData(null);
    } finally {
      setIsLoadingUserOverrides(false);
    }
  };

  const handleAddUserOverride = async () => {
    if (!targetUserUuid || !overridePermCode) return;
    setIsSavingOverride(true);
    try {
      await api.post(`/roles/users/${targetUserUuid}/overrides`, {
        permission: overridePermCode,
        is_granted: overrideGrantType === "GRANT",
      });
      await handleInspectUserOverrides();
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to set user override");
    } finally {
      setIsSavingOverride(false);
    }
  };

  const handleRemoveUserOverride = async (code: string) => {
    try {
      await api.delete(`/roles/users/${targetUserUuid}/overrides/${code}`);
      await handleInspectUserOverrides();
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to remove user override");
    }
  };

  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  const canManagePerms =
    isSuperAdmin ||
    Boolean(
      currentUser?.permissions &&
        currentUser.permissions.includes("permissions.manage"),
    );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Breadcrumbs items={[{ label: "Role & Permission Management" }]} />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Role & Permission Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Dynamic database-driven roles, modular capability matrix, and real-time synchronization.
          </p>
        </div>

        {isSuperAdmin && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setErrorMsg(null);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create New Role
          </Button>
        )}
      </div>

      {successMsg && (
        <Alert type="success" title="Success">
          {successMsg}
        </Alert>
      )}

      {pageError && (
        <Alert type="error" title="Error Loading Roles & Permissions">
          <div className="flex items-center justify-between">
            <span>{pageError}</span>
            <Button size="sm" variant="outline" onClick={loadData}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab("roles")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "roles"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Dynamic Roles ({roles.length})
        </button>
        <button
          onClick={() => setActiveTab("overrides")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "overrides"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          User-Level Overrides
        </button>
        <button
          onClick={() => setActiveTab("matrix")}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "matrix"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          All System Permissions ({permissions.length})
        </button>
      </div>

      {/* Tab 1: Dynamic Roles List & Management */}
      {activeTab === "roles" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {roles.map((r) => {
              const isSuper = r.code === "SUPER_ADMIN";
              const isTargetAdmin = r.code === "ADMIN";
              const isBlockedNonSuperOnAdmin = !isSuperAdmin && isTargetAdmin;
              const isEditable = !isSuper && canManagePerms && !isBlockedNonSuperOnAdmin;

              return (
                <Card key={r.role_uuid || r.code} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={
                          isSuper
                            ? "indigo"
                            : r.code === "ADMIN"
                            ? "blue"
                            : r.is_system
                            ? "slate"
                            : "emerald"
                        }
                      >
                        {r.is_system ? "System" : "Custom Dynamic"}
                      </Badge>
                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {r.userCount} Users
                      </span>
                    </div>
                    <CardTitle className="text-base mt-2 flex items-center justify-between">
                      <span>{r.name}</span>
                    </CardTitle>
                    <div className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                      {r.code}
                    </div>
                    <CardDescription className="line-clamp-2 text-xs">
                      {r.description || "No description provided."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2">
                      <span>Permissions Assigned:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {isSuper ? "Full (All)" : `${r.permissions.length} of ${permissions.length}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => openEditModal(r)}
                        disabled={!isEditable}
                      >
                        {isSuper ? (
                          <>
                            <Lock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                            Full Access
                          </>
                        ) : (
                          <>
                            <Edit3 className="w-3.5 h-3.5 mr-1" />
                            Edit Permissions
                          </>
                        )}
                      </Button>

                      {!r.is_system && isSuperAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 p-1.5"
                          title="Delete custom role"
                          onClick={() => handleDeleteRole(r)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: User-Specific Permission Overrides */}
      {activeTab === "overrides" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              User-Level Permission Overrides
            </CardTitle>
            <CardDescription>
              Effective Permissions = (Role Permissions ∪ User Grants) \ User Denials. Overrides take immediate precedence over role assignments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-3 max-w-xl">
              <Input
                placeholder="Enter User UUID to inspect..."
                value={targetUserUuid}
                onChange={(e) => setTargetUserUuid(e.target.value)}
                className="text-xs"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleInspectUserOverrides}
                isLoading={isLoadingUserOverrides}
                className="shrink-0"
              >
                Inspect User
              </Button>
            </div>

            {userEffectiveData && (
              <div className="space-y-6 border-t border-slate-200 dark:border-slate-800 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <span className="text-[11px] text-slate-500">Base Role</span>
                    <div className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                      {userEffectiveData.role}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <span className="text-[11px] text-slate-500">Effective Capabilities</span>
                    <div className="font-bold text-sm text-indigo-600 mt-0.5">
                      {userEffectiveData.effective_permissions.length} active
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200">
                    <span className="text-[11px] text-emerald-700">Explicit Grants</span>
                    <div className="font-bold text-sm text-emerald-700 mt-0.5">
                      +{userEffectiveData.user_grants.length} overrides
                    </div>
                  </div>
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200">
                    <span className="text-[11px] text-rose-700">Explicit Denials</span>
                    <div className="font-bold text-sm text-rose-700 mt-0.5">
                      -{userEffectiveData.user_denials.length} overrides
                    </div>
                  </div>
                </div>

                {/* Add New Override */}
                <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase">
                    Configure User Override
                  </h4>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <select
                      value={overridePermCode}
                      onChange={(e) => setOverridePermCode(e.target.value)}
                      className="text-xs border rounded-lg p-2 bg-white dark:bg-slate-800 flex-1 w-full"
                    >
                      <option value="">Select permission to override...</option>
                      {permissions.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>

                    <select
                      value={overrideGrantType}
                      onChange={(e) => setOverrideGrantType(e.target.value as any)}
                      className="text-xs border rounded-lg p-2 bg-white dark:bg-slate-800 w-full sm:w-44"
                    >
                      <option value="GRANT">Explicit GRANT (+)</option>
                      <option value="DENY">Explicit DENY (-)</option>
                    </select>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAddUserOverride}
                      isLoading={isSavingOverride}
                      disabled={!overridePermCode}
                      className="w-full sm:w-auto"
                    >
                      Save Override
                    </Button>
                  </div>
                </div>

                {/* List of active explicit user overrides */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 mb-2">
                    Active User Overrides ({userEffectiveData.user_grants.length + userEffectiveData.user_denials.length})
                  </h4>
                  {userEffectiveData.user_grants.length === 0 && userEffectiveData.user_denials.length === 0 ? (
                    <p className="text-xs text-slate-400">User is governed entirely by base role defaults without overrides.</p>
                  ) : (
                    <div className="space-y-2">
                      {userEffectiveData.user_grants.map((code: string) => (
                        <div key={code} className="flex items-center justify-between p-2 bg-emerald-50 text-emerald-800 rounded-lg text-xs border border-emerald-200">
                          <span className="font-mono font-semibold">+ GRANT: {code}</span>
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveUserOverride(code)}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Revert
                          </Button>
                        </div>
                      ))}
                      {userEffectiveData.user_denials.map((code: string) => (
                        <div key={code} className="flex items-center justify-between p-2 bg-rose-50 text-rose-800 rounded-lg text-xs border border-rose-200">
                          <span className="font-mono font-semibold">- DENY: {code}</span>
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveUserOverride(code)}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Revert
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Complete System Permissions Table */}
      {activeTab === "matrix" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Complete System Capabilities Matrix ({permissions.length})
            </CardTitle>
            <CardDescription>
              All modular granular capabilities across User Management, Messaging Platform, Access Control, and System Domains
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 uppercase font-semibold">
                    <th className="py-3 px-4">Permission Code</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {permissions.map((p) => (
                    <tr key={p.permission_uuid} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-semibold text-indigo-700 dark:text-indigo-400">
                        {p.code}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        {p.name}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="slate">{p.category}</Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {p.description || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Dynamic Role Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Dynamic Role"
        description="Define a new role and choose its initial granular capabilities."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateRole} className="space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Role Name</label>
            <Input
              placeholder="e.g. Customer Support Specialist"
              value={createForm.name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Role Code</label>
            <Input
              placeholder="e.g. CUSTOMER_SUPPORT"
              value={createForm.code}
              onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <Input
              placeholder="Responsibilities and purpose of this role..."
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isCreating}>
              Create Role
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Role Permissions Modal (Modular Permission Tree) */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Configure Permissions: ${selectedRole?.name}`}
        description="Assign or revoke granular capabilities. Changes are saved dynamically and broadcast in real time."
        maxWidth="2xl"
      >
        <div className="space-y-6">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {errorMsg}
            </div>
          )}

          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
            {categories.map(([category, catPerms]) => {
              const assignedInCat = catPerms.filter((p) => assignedPerms.includes(p.code)).length;
              const allSelected = assignedInCat === catPerms.length;

              return (
                <div key={category} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/30">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wide">
                        {category}
                      </h4>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {assignedInCat} of {catPerms.length} assigned
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-[11px] h-7 px-2 text-indigo-600 hover:text-indigo-700"
                        onClick={() => handleSelectAllCategory(catPerms)}
                      >
                        <CheckSquare className="w-3.5 h-3.5 mr-1" /> Select All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-[11px] h-7 px-2 text-slate-500 hover:text-slate-700"
                        onClick={() => handleDeselectAllCategory(catPerms)}
                      >
                        <Square className="w-3.5 h-3.5 mr-1" /> Deselect All
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {catPerms.map((p) => {
                      const isChecked = assignedPerms.includes(p.code);
                      const isMasterMessaging = assignedPerms.includes("messaging.manage") && p.code.startsWith("messaging.") && p.code !== "messaging.manage";

                      return (
                        <div
                          key={p.code}
                          onClick={() => handleTogglePerm(p.code)}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                            isChecked
                              ? "bg-indigo-50/70 border-indigo-300 text-indigo-900"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-0.5 rounded text-indigo-600 border-slate-300"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs flex items-center justify-between">
                              <span className="truncate">{p.name}</span>
                              {isMasterMessaging && (
                                <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 rounded font-normal shrink-0">
                                  Inherited
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[10px] text-slate-500 truncate">
                              {p.code}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSavePermissions} isLoading={isSaving}>
              Save Permissions
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
