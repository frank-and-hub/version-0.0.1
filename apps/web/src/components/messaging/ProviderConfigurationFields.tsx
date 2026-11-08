"use client";

import React from "react";
import { ProviderFormField } from "./types";
import { Input } from "@/components/ui/Input";

interface ProviderConfigurationFieldsProps {
  fields: ProviderFormField[];
  credentials: Record<string, any>;
  onChange: (field: string, value: any) => void;
  disabled?: boolean;
}

const EXCLUDED_FIELDS = new Set([
  "configuration_name",
  "sender_name",
  "sender_email",
  "sender_phone",
  "reply_to",
  "is_default",
]);

export const ProviderConfigurationFields: React.FC<
  ProviderConfigurationFieldsProps
> = ({ fields, credentials, onChange, disabled = false }) => {
  const credentialFields = (fields || []).filter(
    (f) => !EXCLUDED_FIELDS.has(f.name),
  );

  if (!credentialFields || credentialFields.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-lg">
        No additional credential fields required for this provider.
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {credentialFields.map((field) => {
        // Evaluate conditional display if depends_on is specified
        if (field.depends_on) {
          const parentVal = credentials[field.depends_on.field];
          if (parentVal !== field.depends_on.value) {
            return null;
          }
        }

        const value =
          credentials[field.name] !== undefined
            ? credentials[field.name]
            : (field.default_value ?? "");

        if (field.type === "boolean") {
          return (
            <div key={field.name} className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id={`field_${field.name}`}
                disabled={disabled}
                checked={Boolean(value)}
                onChange={(e) => onChange(field.name, e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
              <label
                htmlFor={`field_${field.name}`}
                className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {field.label}{" "}
                {field.required && <span className="text-rose-500">*</span>}
              </label>
              {field.description && (
                <span className="text-[11px] text-slate-400 ml-1">
                  ({field.description})
                </span>
              )}
            </div>
          );
        }

        if (field.type === "select") {
          return (
            <div key={field.name}>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {field.label}{" "}
                {field.required && <span className="text-rose-500">*</span>}
              </label>
              <select
                disabled={disabled}
                value={value}
                onChange={(e) => onChange(field.name, e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white  disabled:opacity-50"
              >
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {field.description && (
                <p className="text-[11px] text-slate-400 mt-1">
                  {field.description}
                </p>
              )}
            </div>
          );
        }

        if (field.type === "textarea") {
          return (
            <div key={field.name}>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {field.label}{" "}
                {field.required && <span className="text-rose-500">*</span>}
              </label>
              <textarea
                rows={3}
                disabled={disabled}
                value={value}
                placeholder={field.placeholder || ""}
                onChange={(e) => onChange(field.name, e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white  disabled:opacity-50"
              />
              {field.description && (
                <p className="text-[11px] text-slate-400 mt-1">
                  {field.description}
                </p>
              )}
            </div>
          );
        }

        const inputType =
          field.type === "password"
            ? "password"
            : field.type === "number"
              ? "number"
              : "text";

        return (
          <div key={field.name}>
            <Input
              disabled={disabled}
              label={`${field.label} ${field.required ? "*" : ""}`}
              type={inputType}
              placeholder={field.placeholder || ""}
              value={value}
              onChange={(e) =>
                onChange(
                  field.name,
                  field.type === "number"
                    ? e.target.value === ""
                      ? ""
                      : Number(e.target.value)
                    : e.target.value,
                )
              }
              required={field.required}
            />
            {field.description && (
              <p className="text-[11px] text-slate-400 mt-1 -mt-0.5">
                {field.description}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
