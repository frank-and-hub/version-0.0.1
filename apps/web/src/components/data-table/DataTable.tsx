"use client";

import React from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { DataTableProps } from "./types";
import { DataTableToolbar } from "./DataTableToolbar";
import { DataTablePagination } from "./DataTablePagination";
import { Button } from "../ui/Button";

export function DataTable<T>({
  data,
  columns,
  totalItems,
  page,
  limit,
  totalPages,
  isLoading,
  error,
  sortBy,
  sortOrder,
  onPageChange,
  onLimitChange,
  onSortChange,
  onSearchChange,
  searchValue,
  searchPlaceholder,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  getRowId = (row: any) => row.id,
  onRetry,
  emptyMessage = "No records found",
  toolbarActions,
  filterComponent,
}: DataTableProps<T>) {
  const allCurrentIds = data.map(getRowId);
  const isAllSelected =
    data.length > 0 && allCurrentIds.every((id) => selectedIds.includes(id));
  const isPartiallySelected =
    selectedIds.length > 0 &&
    !isAllSelected &&
    allCurrentIds.some((id) => selectedIds.includes(id));

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      const merged = Array.from(new Set([...selectedIds, ...allCurrentIds]));
      onSelectionChange(merged);
    } else {
      const filtered = selectedIds.filter((id) => !allCurrentIds.includes(id));
      onSelectionChange(filtered);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    }
  };

  const handleSort = (columnId: string, isSortable?: boolean) => {
    if (!isSortable) return;
    if (sortBy === columnId) {
      onSortChange(columnId, sortOrder === "asc" ? "desc" : "asc");
    } else {
      onSortChange(columnId, "asc");
    }
  };

  return (
    <div className="w-full bg-white rounded-xl btn hadow-sm border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <DataTableToolbar
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        selectedCount={selectedIds.length}
        filterComponent={filterComponent}
        toolbarActions={toolbarActions}
      />

      {/* Error state alert */}
      {error && (
        <div className="flex items-center justify-between p-4 bg-rose-50 border-b border-rose-200 text-rose-800 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="gap-1.5 border-rose-300 text-rose-800 hover:bg-rose-100"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Main Table Container */}
      <div className="relative overflow-x-auto min-h-[300px]">
        <table className="w-full text-left border-collapse text-sm">
          {/* Header */}
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold text-xs tracking-wider uppercase">
              {selectable && (
                <th className="w-12 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isPartiallySelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                </th>
              )}
              {columns.map((col) => {
                const isCurrentSort = sortBy === col.id;
                return (
                  <th
                    key={col.id}
                    onClick={() => handleSort(col.id, col.sortable)}
                    className={`px-6 py-3.5 ${col.sortable ? "cursor-pointer select-none hover:bg-slate-100/80 transition-colors" : ""} ${
                      col.align === "center"
                        ? "text-center"
                        : col.align === "right"
                          ? "text-right"
                          : "text-left"
                    } ${col.className || ""}`}
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 ${
                        col.align === "center"
                          ? "justify-center"
                          : col.align === "right"
                            ? "justify-end"
                            : "justify-start"
                      }`}
                    >
                      {col.header}
                      {col.sortable && (
                        <span className="text-slate-400">
                          {isCurrentSort ? (
                            sortOrder === "asc" ? (
                              <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 hover:text-slate-600" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Body */}
          <tbody
            className="divide-y divide-slate-100"
            key={new Date().getUTCMilliseconds() * Math.random()}
          >
            {isLoading ? (
              // Loading Skeleton Rows
              Array.from({ length: limit > 8 ? 8 : limit }).map((_, rIdx) => (
                <tr key={`skeleton-${rIdx}`} className="animate-pulse">
                  {selectable && (
                    <td className="px-4 py-4 text-center">
                      <div className="w-4 h-4 bg-slate-200 rounded mx-auto" />
                    </td>
                  )}
                  {columns.map((col, cIdx) => (
                    <td key={`skeleton-cell-${cIdx}`} className="px-6 py-4">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty State
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-6 py-16 text-center text-slate-500"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Inbox className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                    <p className="text-base font-medium text-slate-700">
                      {emptyMessage}
                    </p>
                    <p className="text-xs text-slate-400">
                      Try adjusting your filters, searching for a different
                      keyword, or add a new record.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              data.map((row) => {
                const rowId = getRowId(row);
                const isSelected = selectedIds.includes(rowId);

                return (
                  <tr
                    key={new Date().getUTCMilliseconds() * Math.random()}
                    className={`transition-colors hover:bg-indigo-50/30 ${
                      isSelected ? "bg-indigo-50/50" : "bg-white"
                    }`}
                  >
                    {selectable && (
                      <td className="w-12 px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            handleSelectRow(rowId, e.target.checked)
                          }
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    {columns.map((col) => {
                      const value = col.accessorKey
                        ? (row as any)[col.accessorKey]
                        : undefined;
                      return (
                        <td
                          key={`${rowId}-${col.id}`}
                          className={`px-4 py-2 text-slate-700 ${
                            col.align === "center"
                              ? "text-center"
                              : col.align === "right"
                                ? "text-right"
                                : "text-left"
                          } ${col.className || ""}`}
                        >
                          {col.cell ? col.cell(row) : (value ?? "-")}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <DataTablePagination
        page={page}
        limit={limit}
        totalItems={totalItems}
        totalPages={totalPages}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
      />
    </div>
  );
}
