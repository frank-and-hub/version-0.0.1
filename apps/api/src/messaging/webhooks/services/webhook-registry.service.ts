import { Injectable, NotFoundException } from '@nestjs/common';
import { WebhookProviderAdapter } from '../adapters/webhook-provider.interface';
import { SendGridWebhookAdapter } from '../adapters/sendgrid-webhook.adapter';

@Injectable()
export class WebhookRegistryService {
  private readonly adapters = new Map<string, WebhookProviderAdapter>();

  constructor(private readonly sendgridWebhookAdapter: SendGridWebhookAdapter) {
    this.registerAdapter(this.sendgridWebhookAdapter);
  }

  registerAdapter(adapter: WebhookProviderAdapter) {
    this.adapters.set(adapter.slug.toLowerCase(), adapter);
  }

  getAdapter(slug: string): WebhookProviderAdapter {
    const adapter = this.adapters.get(slug.toLowerCase());
    if (!adapter) {
      throw new NotFoundException(`Webhook adapter for provider '${slug}' not found`);
    }
    return adapter;
  }

  hasAdapter(slug: string): boolean {
    return this.adapters.has(slug.toLowerCase());
  }
}
