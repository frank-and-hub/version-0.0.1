"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  User,
  UserRole,
  UserStatus,
  PaginatedResult,
} from "@monorepo/shared-types";
import { formatDate } from "@monorepo/shared-utils";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { DataTable } from "@/components/data-table/DataTable";
import { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Modal } from "@/components/ui/Modal";
import { UserFormModal } from "@/components/users/UserFormModal";
import { DeleteUserModal } from "@/components/users/DeleteUserModal";
import {
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  History,
  Shield,
  Activity,
  Copy,
  Check,
} from "lucide-react";

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  // Query & Pagination state
  const [data, setData] = useState<User[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Activity History Modal
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [userActivities, setUserActivities] = useState<any[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      sortOrder,
    });

    if (search.trim()) params.append("search", search.trim());
    if (selectedRole !== "ALL") params.append("role", selectedRole);
    if (selectedStatus !== "ALL") params.append("status", selectedStatus);

    try {
      const res = await api.get<PaginatedResult<User>>(
        `/users?${params.toString()}`,
      );
      setData(res.data);
      setTotalItems(res.meta.totalItems);
      setTotalPages(res.meta.totalPages);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, sortBy, sortOrder, search, selectedRole, selectedStatus]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleFormSubmit = async (payload: any) => {
    setIsActionLoading(true);
    try {
      if (activeUser) {
        await api.patch(`/users/${activeUser.user_uuid}`, payload);
      } else {
        await api.post("/users", payload);
      }
      fetchUsers();
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!activeUser) return;
    setIsActionLoading(true);
    try {
      await api.delete(`/users/${activeUser.user_uuid}`);
      setIsDeleteModalOpen(false);
      setActiveUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    } finally {
      setIsActionLoading(false);
    }
  };

  const viewUserActivity = async (targetUser: User) => {
    setActiveUser(targetUser);
    setIsActivityModalOpen(true);
    setIsLoadingActivities(true);
    try {
      const activities = await api.get<any[]>(
        `/activity-logs/user/${targetUser.user_uuid}`,
      );
      setUserActivities(activities);
    } catch (err: any) {
      console.error("Failed to load user activity history:", err);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  const canManage = isSuperAdmin || currentUser?.role === UserRole.ADMIN;

  const columns: ColumnDef<User>[] = [
    {
      id: "name",
      header: "User Identity",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
            {row.first_name?.[0]}
            {row.last_name?.[0]}
          </div>
          <div>
            <div className="font-semibold text-slate-900">
              {row.first_name} {row.last_name}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {row.email}
            </div>
          </div>
        </div>
      ),
    },
    /*
    {
      id: 'user_uuid',
      header: 'User UUID',
      cell: (row) => (
        <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title={row.user_uuid}>
          {row.user_uuid.slice(0, 8)}...{row.user_uuid.slice(-4)}
        </span>
      ),
    },
    */
    {
      id: "role",
      header: "Role (RBAC)",
      sortable: true,
      cell: (row) => {
        const variant =
          row.role === UserRole.SUPER_ADMIN
            ? "indigo"
            : row.role === UserRole.ADMIN
              ? "blue"
              : row.role === UserRole.MODERATOR
                ? "amber"
                : "slate";
        return <Badge variant={variant}>{row.role}</Badge>;
      },
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (row) => {
        const variant =
          row.status === UserStatus.ACTIVE
            ? "emerald"
            : row.status === UserStatus.INACTIVE
              ? "amber"
              : "rose";
        return <Badge variant={variant}>{row.status}</Badge>;
      },
    },
    {
      id: "created_at",
      header: "Registered",
      sortable: true,
      cell: (row) => (
        <span className="text-[11px] text-slate-500">
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      id: "last_login_at",
      header: "Last Login",
      sortable: true,
      cell: (row) => (
        <span className="text-[11px] text-slate-500">
          {row.last_login_at ? formatDate(row.last_login_at) : "Never"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          {/* Activity Logs history button (Requirement 9.6) */}
          <button
            onClick={() => viewUserActivity(row)}
            title="Inspect User Activity Logs"
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <History className="w-4 h-4" />
          </button>

          {canManage && (
            <button
              onClick={() => {
                setActiveUser(row);
                setIsFormModalOpen(true);
              }}
              title="Edit Profile & Role"
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}

          {canManage && (
            <button
              onClick={() => {
                setActiveUser(row);
                setIsDeleteModalOpen(true);
              }}
              disabled={row.user_uuid === currentUser?.user_uuid}
              title={
                row.user_uuid === currentUser?.user_uuid
                  ? "Cannot delete your own account"
                  : "Delete user"
              }
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Breadcrumbs items={[{ label: "User Management" }]} />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            User Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {/* PostgreSQL relational entities with UUID keys, RBAC control, and activity auditing. */}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsers()}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setActiveUser(null);
                setIsFormModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add User
            </Button>
          )}
        </div>
      </div>

      {/* Main Data Table */}
      <DataTable<User>
        data={data}
        columns={columns}
        totalItems={totalItems}
        page={page}
        limit={limit}
        totalPages={totalPages}
        isLoading={isLoading}
        error={error}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onPageChange={setPage}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        onSortChange={(field, order) => {
          setSortBy(field);
          setSortOrder(order);
        }}
        onSearchChange={(q) => {
          setSearch(q);
          setPage(1);
        }}
        searchValue={search}
        searchPlaceholder="Search by name, email, or phone..."
        onRetry={fetchUsers}
        getRowId={(r) => r.user_uuid}
        filterComponent={
          <div className="flex items-center gap-2">
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none "
            >
              <option value="ALL">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin</option>
              <option value="MODERATOR">Moderator</option>
              <option value="USER">User</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none "
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        }
      />

      {/* User Form Modal */}
      <UserFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        user={activeUser}
        isLoading={isActionLoading}
      />

      {/* Delete User Modal */}
      <DeleteUserModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        user={activeUser}
        isLoading={isActionLoading}
      />

      {/* Specific User Activity History Modal (Requirement 9.6) */}
      <Modal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        title={`Activity History: ${activeUser?.first_name} ${activeUser?.last_name}`}
        description={`Audit logs and authentication timeline for ${activeUser?.email}`}
        maxWidth="lg"
      >
        <div className="space-y-3">
          {isLoadingActivities ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Loading user activity history...
            </div>
          ) : userActivities.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No activity events recorded for this user.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
              {userActivities.map((act) => (
                <div
                  key={act.activity_log_uuid}
                  className="py-2.5 text-xs flex justify-between items-start"
                >
                  <div>
                    <div className="font-semibold text-slate-900">
                      {act.action}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Correlation: {act.correlation_id} • IP:{" "}
                      {act.ip_address || "127.0.0.1"}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {formatDate(act.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsActivityModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
