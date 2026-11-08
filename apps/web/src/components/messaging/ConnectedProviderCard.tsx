"use client";

import React from "react";
import { UserProviderConfiguration } from "./types";
import { ProviderConnectionStatus } from "./ProviderConnectionStatus";
import { Button } from "@/components/ui/Button";
import {
  Server,
  Mail,
  Edit2,
  Trash2,
  Star,
  RefreshCw,
  Clock,
  Shield,
} from "lucide-react";

interface ConnectedProviderCardProps {
  configuration: UserProviderConfiguration;
  onEdit: (config: UserProviderConfiguration) => void;
  onTest: (configUuid: string) => void;
  onSetDefault: (configUuid: string) => void;
  onDelete: (configUuid: string) => void;
  isActionLoading?: boolean;
}

export const ConnectedProviderCard: React.FC<ConnectedProviderCardProps> = ({
  configuration,
  onEdit,
  onTest,
  onSetDefault,
  onDelete,
  isActionLoading = false,
}) => {
  const isSmtp = configuration.provider.slug === "smtp";

  return (
    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 btn hadow-sm hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">
              {configuration.provider.logo ? (
                <img
                  src={configuration.provider.logo}
                  alt={configuration.provider.name}
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : isSmtp ? (
                <Server className="w-5 h-5 text-amber-600" />
              ) : (
                <Mail className="w-5 h-5 text-indigo-600" />
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {configuration.configuration_name}
              </h4>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 uppercase">
                {configuration.provider.name} • {configuration.type}
              </p>
            </div>
          </div>

          <ProviderConnectionStatus
            isVerified={configuration.is_verified}
            isActive={configuration.is_active}
            isDefault={configuration.is_default}
            lastError={configuration.last_error}
          />
        </div>

        {/* Sender details and timestamp */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl text-xs space-y-1.5 mb-4 border border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">Sender:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {configuration.sender_name}{" "}
              {configuration.sender_phone
                ? `(${configuration.sender_phone})`
                : configuration.sender_email
                  ? `<${configuration.sender_email}>`
                  : ""}
            </span>
          </div>
          {configuration.reply_to && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Reply-To:</span>
              <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                {configuration.reply_to}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] text-slate-400">
            <span>Last Tested:</span>
            <span>
              {configuration.last_tested_at
                ? new Date(configuration.last_tested_at).toLocaleString()
                : "Never"}
            </span>
          </div>
        </div>
      </div>

      {/* Card Actions */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {!configuration.is_default && (
            <button
              type="button"
              onClick={() => onSetDefault(configuration.configuration_uuid)}
              disabled={isActionLoading}
              className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Star className="w-3.5 h-3.5" />
              <span>Make Default</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onTest(configuration.configuration_uuid)}
            disabled={isActionLoading}
            className="flex items-center gap-1 px-2.5"
            title="Test connection"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Test</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(configuration)}
            disabled={isActionLoading}
            className="flex items-center gap-1 px-2.5"
            title="Edit configuration"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </Button>

          <Button
            size="sm"
            variant="danger"
            onClick={() => onDelete(configuration.configuration_uuid)}
            disabled={isActionLoading}
            className="px-2"
            title="Delete configuration"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
