'use client';

import React, { useState } from 'react';
import { ProviderDefinition } from './types';
import { ProviderConfigurationFields } from './ProviderConfigurationFields';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Lock,
} from 'lucide-react';

interface DynamicProviderFormProps {
  provider: ProviderDefinition;
  initialValues?: {
    configuration_uuid?: string;
    configuration_name?: string;
    sender_name?: string;
    sender_email?: string;
    sender_phone?: string;
    reply_to?: string;
    is_default?: boolean;
    credentials?: Record<string, any>;
  };
  isEditMode?: boolean;
  onBack?: () => void;
  onSuccess: (savedConfig: any) => void;
  onCancel: () => void;
}

export const DynamicProviderForm: React.FC<DynamicProviderFormProps> = ({
  provider,
  initialValues,
  isEditMode = false,
  onBack,
  onSuccess,
  onCancel,
}) => {
  const isWhatsApp = provider.type === 'WHATSAPP';
  const isSms = provider.type === 'SMS';
  const isEmail = !isWhatsApp && !isSms;

  const [configurationName, setConfigurationName] = useState(
    initialValues?.configuration_name || `${provider.name} Connection`,
  );
  const [senderName, setSenderName] = useState(
    initialValues?.sender_name || (isWhatsApp ? 'WhatsApp Official Business' : isSms ? 'Twilio SMS Alerts' : 'Antigravity Platform'),
  );
  const [senderEmail, setSenderEmail] = useState(
    initialValues?.sender_email || (isWhatsApp || isSms ? '' : 'notifications@antigravity.dev'),
  );
  const [senderPhone, setSenderPhone] = useState(
    initialValues?.sender_phone || initialValues?.credentials?.sender_phone || '',
  );
  const [replyTo, setReplyTo] = useState(initialValues?.reply_to || '');
  const [isDefault, setIsDefault] = useState(initialValues?.is_default || false);

  // Initialize credential fields from schema defaults or existing values
  const [credentials, setCredentials] = useState<Record<string, any>>(() => {
    if (initialValues?.credentials && Object.keys(initialValues.credentials).length > 0) {
      return { ...initialValues.credentials };
    }
    const initial: Record<string, any> = {};
    if (Array.isArray(provider.form_fields)) {
      provider.form_fields.forEach((f) => {
        initial[f.name] = f.default_value !== undefined ? f.default_value : '';
      });
    }
    return initial;
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCredentialChange = (field: string, value: any) => {
    setCredentials((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Reset test result if credentials change
    if (testResult) setTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setErrorMsg(null);

    try {
      const credsToTest = {
        ...credentials,
        ...((isWhatsApp || isSms) && senderPhone ? { sender_phone: senderPhone } : {}),
      };

      const res: any = await api.post('/messaging/provider-configurations/test', {
        provider_slug: provider.slug,
        credentials: credsToTest,
      });

      const data = res?.data || res;
      setTestResult({
        tested: true,
        success: !!data.success,
        message: data.message || (data.success ? 'Connection verified successfully!' : 'Connection test failed'),
      });
    } catch (err: any) {
      setTestResult({
        tested: true,
        success: false,
        message: err?.response?.data?.message || err?.message || 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        configuration_name: configurationName,
        sender_name: senderName,
        sender_email: isEmail ? senderEmail : undefined,
        sender_phone: (isWhatsApp || isSms) ? senderPhone : undefined,
        reply_to: isEmail ? (replyTo || undefined) : undefined,
        is_default: isDefault,
        credentials: {
          ...credentials,
          ...((isWhatsApp || isSms) && senderPhone ? { sender_phone: senderPhone } : {}),
        },
      };

      let result: any;
      if (isEditMode && initialValues?.configuration_uuid) {
        result = await api.patch(
          `/messaging/provider-configurations/${initialValues.configuration_uuid}`,
          payload,
        );
      } else {
        payload.provider_slug = provider.slug;
        result = await api.post('/messaging/provider-configurations', payload);
      }

      onSuccess(result?.data || result);
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.message || err?.message || 'Failed to save provider configuration',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Top Banner & Back Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1 -ml-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors rounded-lg"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{isEditMode ? 'Edit Configuration' : `Connect ${provider.name}`}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-mono">
                {provider.type}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Credentials are encrypted using AES-256-GCM before database storage.
            </p>
          </div>
        </div>

        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase">
          {provider.name.slice(0, 2)}
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Test Connection Result Alert */}
      {testResult && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{testResult.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setTestResult(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Channel Specific Header Fields */}
      {isSms ? (
        <div className="space-y-3">
          <Input
            label="SMS Configuration Name *"
            placeholder="e.g., Twilio Production SMS"
            value={configurationName}
            onChange={(e) => setConfigurationName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Sender Display Name *"
              placeholder="Acme Alerts"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              required
            />
            <Input
              label="Twilio Sender Phone Number (E.164) *"
              placeholder="+1 (555) 019-2834"
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              required
            />
          </div>
        </div>
      ) : isWhatsApp ? (
        <div className="space-y-3">
          <Input
            label="WhatsApp Configuration Name *"
            placeholder="e.g., Support WhatsApp Line"
            value={configurationName}
            onChange={(e) => setConfigurationName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Business Display Name *"
              placeholder="Acme Support"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              required
            />
            <Input
              label="WhatsApp Phone Number (E.164) *"
              placeholder="+1 (555) 019-2834"
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              required
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            label="Configuration Name *"
            placeholder="e.g., Primary Production SMTP"
            value={configurationName}
            onChange={(e) => setConfigurationName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Default Sender Name *"
              placeholder="Acme Support"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              required
            />
            <Input
              label="Default Sender Email *"
              type="email"
              placeholder="support@acme.com"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              required
            />
          </div>

          <Input
            label="Reply-To Email (Optional)"
            type="email"
            placeholder="replies@acme.com"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
          />
        </div>
      )}

      {/* Dynamic Provider Credentials Section */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5 text-indigo-500" />
            <span>Authentication Credentials</span>
          </div>
          <span className="text-[10px] text-slate-400">Zero-exposure storage</span>
        </div>

        <ProviderConfigurationFields
          fields={provider.form_fields}
          credentials={credentials}
          onChange={handleCredentialChange}
        />
      </div>

      {/* Default Channel Checkbox */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="isDefaultChannel"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
        />
        <label htmlFor="isDefaultChannel" className="text-xs font-medium text-slate-700 dark:text-slate-300">
          Set as default {provider.type.toLowerCase()} provider for this account
        </label>
      </div>

      {/* Footer Actions */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={isTesting || isSaving}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
          <span>{isTesting ? 'Validating Connection...' : 'Test Connection'}</span>
        </Button>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSaving}
            className="flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isSaving ? 'Encrypting & Saving...' : isEditMode ? 'Update Provider' : 'Connect Provider'}</span>
          </Button>
        </div>
      </div>
    </form>
  );
};
