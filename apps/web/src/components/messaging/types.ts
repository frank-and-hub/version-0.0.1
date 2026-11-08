export interface ProviderFormField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'select' | 'textarea' | string;
  placeholder?: string;
  default_value?: any;
  required: boolean;
  description?: string;
  options?: Array<{ label: string; value: string }>;
  depends_on?: {
    field: string;
    value: any;
  };
}

export interface ProviderDefinition {
  provider_uuid: string;
  name: string;
  slug: string;
  type: 'EMAIL' | 'WHATSAPP' | 'SMS' | string;
  description?: string;
  logo?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DEPRECATED' | 'COMING_SOON';
  is_default: boolean;
  configuration_schema?: Record<string, any>;
  form_fields: ProviderFormField[];
  documentation_url?: string;
}

export interface UserProviderConfiguration {
  configuration_uuid: string;
  user_uuid: string;
  provider_uuid: string;
  configuration_name: string;
  type: string;
  sender_name: string;
  sender_email?: string;
  sender_phone?: string;
  reply_to?: string;
  is_active: boolean;
  is_verified: boolean;
  is_default: boolean;
  last_tested_at?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
  credentials: Record<string, any>;
  provider: {
    provider_uuid: string;
    name: string;
    slug: string;
    type: string;
    logo?: string;
    status: string;
  };
}
