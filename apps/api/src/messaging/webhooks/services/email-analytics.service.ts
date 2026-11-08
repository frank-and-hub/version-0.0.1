import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NormalizedEventType } from '@prisma/client';

export interface EmailAnalyticsFilters {
  startDate?: string;
  endDate?: string;
  provider_configuration_uuid?: string;
  provider_slug?: string;
}

@Injectable()
export class EmailAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves message tracking timeline, recipient delivery states, and engagement metrics
   */
  async getMessageDetailsAndTimeline(userUuid: string, messageUuid: string) {
    const message = await this.prisma.emailMessage.findFirst({
      where: { message_uuid: messageUuid, user_uuid: userUuid },
      include: {
        recipients: true,
        attachments: true,
        provider: true,
        configuration: true,
        template: true,
        message_events: {
          orderBy: { event_timestamp: 'asc' },
          include: {
            provider_event: {
              select: {
                provider_event_id: true,
                provider_event_type: true,
              },
            },
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Email message not found');
    }

    // Calculate Engagement Metrics
    const opens = message.message_events.filter(
      (e) => e.event_type === NormalizedEventType.OPENED,
    );
    const clicks = message.message_events.filter(
      (e) => e.event_type === NormalizedEventType.CLICKED,
    );

    const firstOpenedAt = opens[0]?.event_timestamp || null;
    const lastOpenedAt = opens[opens.length - 1]?.event_timestamp || null;
    const firstClickedAt = clicks[0]?.event_timestamp || null;
    const lastClickedAt = clicks[clicks.length - 1]?.event_timestamp || null;

    // Unique open recipients
    const uniqueOpenedRecipients = new Set(opens.map((e) => e.recipient_email)).size;
    const uniqueClickedRecipients = new Set(clicks.map((e) => e.recipient_email)).size;

    return {
      message_info: {
        message_uuid: message.message_uuid,
        provider_name: message.provider?.name || 'SMTP',
        provider_slug: message.provider?.slug || 'smtp',
        provider_message_id: message.provider_message_id,
        sender_email: message.sender_email,
        sender_name: message.sender_name,
        subject: message.subject,
        status: message.status,
        created_at: message.created_at,
        sent_at: message.sent_at,
        delivered_at: message.delivered_at,
        last_error: message.last_error,
        html_content: message.html_content,
        text_content: message.text_content,
      },
      recipients: message.recipients,
      attachments: message.attachments,
      engagement: {
        open_count: opens.length,
        unique_opens: uniqueOpenedRecipients,
        first_opened_at: firstOpenedAt,
        last_opened_at: lastOpenedAt,
        click_count: clicks.length,
        unique_clicks: uniqueClickedRecipients,
        first_clicked_at: firstClickedAt,
        last_clicked_at: lastClickedAt,
      },
      events_timeline: message.message_events.map((ev) => ({
        event_uuid: ev.event_uuid,
        event_type: ev.event_type,
        provider_event_type: ev.provider_event?.provider_event_type,
        event_timestamp: ev.event_timestamp,
        recipient_email: ev.recipient_email,
        clicked_url: ev.clicked_url,
        failure_reason: ev.failure_reason,
        metadata: ev.metadata,
      })),
    };
  }

  /**
   * Generates comprehensive aggregated analytics & time-series chart data
   */
  async getAnalytics(userUuid: string, filters: EmailAnalyticsFilters = {}) {
    const where: any = { user_uuid: userUuid };

    if (filters.provider_configuration_uuid) {
      where.provider_configuration_uuid = filters.provider_configuration_uuid;
    }
    if (filters.provider_slug) {
      where.provider = { slug: filters.provider_slug };
    }
    if (filters.startDate || filters.endDate) {
      where.created_at = {};
      if (filters.startDate) where.created_at.gte = new Date(filters.startDate);
      if (filters.endDate) where.created_at.lte = new Date(filters.endDate);
    }

    const [
      totalSent,
      deliveredCount,
      failedCount,
      bouncedCount,
      totalEvents,
      waTotal,
      waDelivered,
      waRead,
      waFailed,
      smsTotal,
      smsDelivered,
      smsFailed,
      smsOptOuts,
    ] = await Promise.all([
      this.prisma.emailMessage.count({ where }),
      this.prisma.emailMessage.count({
        where: { ...where, status: 'DELIVERED' },
      }),
      this.prisma.emailMessage.count({
        where: { ...where, status: 'FAILED' },
      }),
      this.prisma.emailMessage.count({
        where: { ...where, status: 'BOUNCED' },
      }),
      this.prisma.messageEvent.findMany({
        where: {
          user_uuid: userUuid,
          ...(filters.provider_configuration_uuid
            ? { provider_configuration_uuid: filters.provider_configuration_uuid }
            : {}),
        },
        select: {
          event_type: true,
          recipient_email: true,
          event_timestamp: true,
        },
      }),
      // WhatsApp telemetry counts
      this.prisma.whatsAppMessage.count({
        where: { user_uuid: userUuid, direction: 'OUTBOUND' },
      }),
      this.prisma.whatsAppMessage.count({
        where: { user_uuid: userUuid, direction: 'OUTBOUND', status: { in: ['DELIVERED', 'READ'] } },
      }),
      this.prisma.whatsAppMessage.count({
        where: { user_uuid: userUuid, direction: 'OUTBOUND', status: 'READ' },
      }),
      this.prisma.whatsAppMessage.count({
        where: { user_uuid: userUuid, direction: 'OUTBOUND', status: 'FAILED' },
      }),
      // SMS telemetry counts
      this.prisma.smsMessage.count({
        where: { user_uuid: userUuid, direction: 'OUTBOUND' },
      }),
      this.prisma.smsMessage.count({
        where: { user_uuid: userUuid, direction: 'OUTBOUND', status: 'DELIVERED' },
      }),
      this.prisma.smsMessage.count({
        where: { user_uuid: userUuid, direction: 'OUTBOUND', status: 'FAILED' },
      }),
      this.prisma.smsOptOut.count({
        where: { user_uuid: userUuid, is_opted_out: true },
      }),
    ]);

    // Calculate Unique Engagement counts
    const openEvents = totalEvents.filter((e) => e.event_type === NormalizedEventType.OPENED);
    const clickEvents = totalEvents.filter((e) => e.event_type === NormalizedEventType.CLICKED);
    const spamEvents = totalEvents.filter((e) => e.event_type === NormalizedEventType.SPAM_REPORTED);
    const unsubEvents = totalEvents.filter((e) => e.event_type === NormalizedEventType.UNSUBSCRIBED);

    const uniqueOpenCount = new Set(openEvents.map((e) => e.recipient_email)).size;
    const uniqueClickCount = new Set(clickEvents.map((e) => e.recipient_email)).size;

    // Rates based on verified delivered denominator
    const deliveryRate = totalSent > 0 ? Number(((deliveredCount / totalSent) * 100).toFixed(1)) : 100;
    const bounceRate = totalSent > 0 ? Number(((bouncedCount / totalSent) * 100).toFixed(1)) : 0;
    const openRate = deliveredCount > 0 ? Number(((uniqueOpenCount / deliveredCount) * 100).toFixed(1)) : 0;
    const clickRate = deliveredCount > 0 ? Number(((uniqueClickCount / deliveredCount) * 100).toFixed(1)) : 0;

    // Omnichannel aggregations
    const grandTotalSent = totalSent + waTotal + smsTotal;
    const grandDelivered = deliveredCount + waDelivered + smsDelivered;
    const grandOpenedOrRead = uniqueOpenCount + waRead;
    const grandFailed = failedCount + waFailed + smsFailed;
    const grandDeliveryRate = grandTotalSent > 0 ? Number(((grandDelivered / grandTotalSent) * 100).toFixed(1)) : 100;
    const grandOpenRate = (deliveredCount + waDelivered) > 0 ? Number(((grandOpenedOrRead / (deliveredCount + waDelivered)) * 100).toFixed(1)) : 0;

    // Time-series breakdown for last 7 days
    const daysMap = new Map<string, {
      sent: number;
      delivered: number;
      opens: number;
      clicks: number;
      email_sent: number;
      whatsapp_sent: number;
      sms_sent: number;
    }>();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      daysMap.set(dateKey, {
        sent: 0,
        delivered: 0,
        opens: 0,
        clicks: 0,
        email_sent: 0,
        whatsapp_sent: 0,
        sms_sent: 0,
      });
    }

    const [recentEmail, recentWa, recentSms] = await Promise.all([
      this.prisma.emailMessage.findMany({
        where: {
          user_uuid: userUuid,
          created_at: { gte: new Date(Date.now() - 7 * 86400000) },
        },
        select: { created_at: true, status: true },
      }),
      this.prisma.whatsAppMessage.findMany({
        where: {
          user_uuid: userUuid,
          direction: 'OUTBOUND',
          created_at: { gte: new Date(Date.now() - 7 * 86400000) },
        },
        select: { created_at: true, status: true },
      }),
      this.prisma.smsMessage.findMany({
        where: {
          user_uuid: userUuid,
          direction: 'OUTBOUND',
          created_at: { gte: new Date(Date.now() - 7 * 86400000) },
        },
        select: { created_at: true, status: true },
      }),
    ]);

    for (const msg of recentEmail) {
      const key = msg.created_at.toISOString().slice(0, 10);
      if (daysMap.has(key)) {
        const item = daysMap.get(key)!;
        item.sent += 1;
        item.email_sent += 1;
        if (msg.status === 'DELIVERED') item.delivered += 1;
      }
    }

    for (const msg of recentWa) {
      const key = msg.created_at.toISOString().slice(0, 10);
      if (daysMap.has(key)) {
        const item = daysMap.get(key)!;
        item.sent += 1;
        item.whatsapp_sent += 1;
        if (msg.status === 'DELIVERED' || (msg.status as any) === 'READ') item.delivered += 1;
        if ((msg.status as any) === 'READ') item.opens += 1;
      }
    }

    for (const msg of recentSms) {
      const key = msg.created_at.toISOString().slice(0, 10);
      if (daysMap.has(key)) {
        const item = daysMap.get(key)!;
        item.sent += 1;
        item.sms_sent += 1;
        if (msg.status === 'DELIVERED') item.delivered += 1;
      }
    }

    for (const ev of totalEvents) {
      const key = ev.event_timestamp.toISOString().slice(0, 10);
      if (daysMap.has(key)) {
        const item = daysMap.get(key)!;
        if (ev.event_type === NormalizedEventType.OPENED) item.opens += 1;
        if (ev.event_type === NormalizedEventType.CLICKED) item.clicks += 1;
      }
    }

    const timeSeries = Array.from(daysMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));

    return {
      counters: {
        total_sent: totalSent,
        delivered: deliveredCount,
        failed: failedCount,
        bounced: bouncedCount,
        total_opens: openEvents.length,
        unique_opens: uniqueOpenCount,
        total_clicks: clickEvents.length,
        unique_clicks: uniqueClickCount,
        spam_reports: spamEvents.length,
        unsubscribes: unsubEvents.length,
      },
      rates: {
        delivery_rate: deliveryRate,
        bounce_rate: bounceRate,
        open_rate: openRate,
        click_rate: clickRate,
      },
      omnichannel: {
        total_sent: grandTotalSent,
        delivered: grandDelivered,
        opened_or_read: grandOpenedOrRead,
        clicked: uniqueClickCount,
        failed: grandFailed,
        bounced: bouncedCount,
        unsubscribes: unsubEvents.length + smsOptOuts,
        rates: {
          delivery_rate: grandDeliveryRate,
          open_read_rate: grandOpenRate,
          click_rate: grandDelivered > 0 ? Number(((uniqueClickCount / grandDelivered) * 100).toFixed(1)) : 0,
        },
      },
      channels: {
        email: {
          total_sent: totalSent,
          delivered: deliveredCount,
          opened: uniqueOpenCount,
          clicked: uniqueClickCount,
          bounced: bouncedCount,
          failed: failedCount,
          delivery_rate: deliveryRate,
          open_rate: openRate,
          click_rate: clickRate,
        },
        whatsapp: {
          total_sent: waTotal,
          delivered: waDelivered,
          read: waRead,
          failed: waFailed,
          delivery_rate: waTotal > 0 ? Number(((waDelivered / waTotal) * 100).toFixed(1)) : 100,
          read_rate: waDelivered > 0 ? Number(((waRead / waDelivered) * 100).toFixed(1)) : 0,
        },
        sms: {
          total_sent: smsTotal,
          delivered: smsDelivered,
          failed: smsFailed,
          opt_outs: smsOptOuts,
          delivery_rate: smsTotal > 0 ? Number(((smsDelivered / smsTotal) * 100).toFixed(1)) : 100,
        },
      },
      time_series: timeSeries,
    };
  }
}
