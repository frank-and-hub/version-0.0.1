"use client";

import React, { useState, useEffect } from "react";
import { ProviderDefinition, UserProviderConfiguration } from "./types";
import { ProviderList } from "./ProviderList";
import { DynamicProviderForm } from "./DynamicProviderForm";
import { api } from "@/lib/api";
import { Loader2, X, AlertCircle } from "lucide-react";

interface ProviderSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedConfig: UserProviderConfiguration) => void;
  editConfig?: UserProviderConfiguration | null;
  channel?: "EMAIL" | "WHATSAPP" | "SMS";
}

export const ProviderSelectionModal: React.FC<ProviderSelectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editConfig = null,
  channel = "EMAIL",
}) => {
  const [providers, setProviders] = useState<ProviderDefinition[]>([]);
  const [selectedProvider, setSelectedProvider] =
    useState<ProviderDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProviders();
    } else {
      setSelectedProvider(null);
      setError(null);
    }
  }, [isOpen, editConfig, channel]);

  const loadProviders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = (await api.get(
        `/messaging/providers?type=${channel}`,
      )) as any;
      const data: ProviderDefinition[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : [];
      setProviders(data);

      // If opening in edit mode, automatically find and select the matching provider
      if (editConfig) {
        const found = data.find(
          (p) =>
            p.slug === editConfig.provider?.slug ||
            p.provider_uuid === editConfig.provider_uuid ||
            p.provider_uuid === editConfig.provider?.provider_uuid,
        );
        if (found) {
          setSelectedProvider(found);
        } else if (editConfig.provider) {
          setSelectedProvider(editConfig.provider as any);
        }
      } else {
        setSelectedProvider(null);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          `Failed to load ${channel.toLowerCase()} providers`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {editConfig
                ? `Edit ${editConfig.provider?.name || "Provider"} Configuration`
                : selectedProvider
                  ? `Connect ${selectedProvider.name}`
                  : channel === "SMS"
                    ? "Connect SMS Messaging Provider"
                    : channel === "WHATSAPP"
                      ? "Connect WhatsApp Messaging Provider"
                      : "Connect Your Email Provider"}
            </h2>
            <p className="text-xs text-slate-500">
              {selectedProvider
                ? channel === "SMS"
                  ? "Fill in Twilio credentials to start sending global SMS alerts, 2FA, and notifications"
                  : channel === "WHATSAPP"
                    ? "Fill in official credentials to start sending WhatsApp templates & interactive chats"
                    : "Fill in authentication credentials to start dispatching system emails"
                : channel === "SMS"
                  ? "Choose from carrier-grade SMS gateways such as Twilio Programmable SMS"
                  : channel === "WHATSAPP"
                    ? "Choose from official Meta Cloud API, Interakt, WATI, and Twilio WhatsApp providers"
                    : "Choose from supported high-throughput enterprise mail providers"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/75 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-xs text-slate-400">
                Loading available providers from database...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : !selectedProvider ? (
            <ProviderList
              providers={providers}
              selectedSlug={null}
              onSelect={(p) => setSelectedProvider(p)}
            />
          ) : (
            <DynamicProviderForm
              key={`${selectedProvider.provider_uuid || selectedProvider.slug}_${editConfig?.configuration_uuid || "new"}`}
              provider={selectedProvider}
              isEditMode={!!editConfig}
              initialValues={
                editConfig
                  ? {
                      configuration_uuid: editConfig.configuration_uuid,
                      configuration_name: editConfig.configuration_name,
                      sender_name: editConfig.sender_name,
                      sender_email: editConfig.sender_email,
                      sender_phone: editConfig.sender_phone,
                      reply_to: editConfig.reply_to,
                      is_default: editConfig.is_default,
                      credentials: editConfig.credentials,
                    }
                  : undefined
              }
              onBack={!editConfig ? () => setSelectedProvider(null) : undefined}
              onSuccess={(saved) => {
                onSuccess(saved);
                onClose();
              }}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
};
