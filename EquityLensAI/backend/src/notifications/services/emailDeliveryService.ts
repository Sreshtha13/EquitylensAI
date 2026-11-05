import crypto from 'node:crypto';
import { Resend } from 'resend';
import { getEnv } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import {
  notificationRepository,
  type NotificationDeliveryRecord,
} from '../repositories/notificationRepository.js';
import type { AppNotification, UserAlertPreferences } from '@equitylensai/shared';

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailDeliveryResult {
  delivered: boolean;
  channel: 'email';
  status: 'delivered' | 'pending' | 'failed' | 'skipped';
  providerMessageId?: string | null;
  error?: string | null;
}

export class EmailDeliveryService {
  private resendClient: Resend | null = null;

  public setResendClient(client: Resend | null): void {
    this.resendClient = client;
  }

  private getResendClient(): Resend | null {
    const env = getEnv();
    if (this.resendClient) {
      return this.resendClient;
    }
    if (env.RESEND_API_KEY) {
      this.resendClient = new Resend(env.RESEND_API_KEY);
    }
    return this.resendClient;
  }
  /**
   * Evaluates user preferences and sends an email notification if eligible.
   */
  async processNotification(
    notification: AppNotification,
    preferences: UserAlertPreferences,
  ): Promise<EmailDeliveryResult> {
    // 1. Preference checks
    if (!preferences.emailEnabled || !preferences.emailAddress) {
      return {
        delivered: false,
        channel: 'email',
        status: 'skipped',
        error: 'User has not enabled email delivery or no email address configured',
      };
    }

    // Check category preferences
    if (!this.isCategoryEnabled(notification.category, preferences)) {
      return {
        delivered: false,
        channel: 'email',
        status: 'skipped',
        error: `Category '${notification.category}' is disabled in user email preferences`,
      };
    }

    // Check quiet hours
    if (this.isInQuietHours(preferences)) {
      return {
        delivered: false,
        channel: 'email',
        status: 'skipped',
        error: 'Suppressed due to active user quiet hours schedule',
      };
    }

    const { html, text } = this.generateAlertEmailTemplate(notification);
    const subject = `[EquityLensAI] ${notification.title}`;

    return this.sendWithRetry({
      notificationId: notification.id,
      to: preferences.emailAddress,
      subject,
      html,
      text,
    });
  }

  /**
   * Sends email with exponential backoff retry (up to 3 attempts).
   */
  async sendWithRetry(options: {
    notificationId: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<EmailDeliveryResult> {
    const deliveryId = crypto.randomUUID();
    let attemptCount = 0;
    const maxRetries = 3;
    let lastError: string | null = null;
    let providerMessageId: string | null = null;

    while (attemptCount < maxRetries) {
      attemptCount++;
      try {
        providerMessageId = await this.dispatchEmail({
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });

        // Record successful delivery
        const record: NotificationDeliveryRecord = {
          id: deliveryId,
          notificationId: options.notificationId,
          channel: 'email',
          status: 'delivered',
          attemptCount,
          lastAttemptAt: new Date().toISOString(),
          providerMessageId,
          deliveredAt: new Date().toISOString(),
        };
        await notificationRepository.createDeliveryAttempt(record);

        logger.info(
          { notificationId: options.notificationId, to: options.to, providerMessageId },
          'Alert email delivered successfully',
        );

        return {
          delivered: true,
          channel: 'email',
          status: 'delivered',
          providerMessageId,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        logger.warn(
          { attemptCount, err: lastError, to: options.to },
          'Email dispatch attempt failed, backing off',
        );

        if (attemptCount < maxRetries) {
          // Exponential backoff: 50ms, 100ms
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attemptCount) * 25));
        }
      }
    }

    // Record failure
    const failedRecord: NotificationDeliveryRecord = {
      id: deliveryId,
      notificationId: options.notificationId,
      channel: 'email',
      status: 'failed',
      attemptCount,
      lastAttemptAt: new Date().toISOString(),
      errorMessage: lastError,
    };
    await notificationRepository.createDeliveryAttempt(failedRecord);

    logger.error(
      { notificationId: options.notificationId, to: options.to, attempts: attemptCount, error: lastError },
      'Failed to deliver alert email after maximum retry attempts',
    );

    return {
      delivered: false,
      channel: 'email',
      status: 'failed',
      error: lastError,
    };
  }

  /**
   * Dispatches email via Resend API or simulated transport when unconfigured.
   */
  private async dispatchEmail(options: EmailSendOptions): Promise<string> {
    const env = getEnv();
    const resend = this.getResendClient();

    // In production/staging with RESEND_API_KEY, or in tests with an injected client
    if (resend && (env.NODE_ENV !== 'test' || this.resendClient !== null)) {
      const from = env.RESEND_FROM_EMAIL || 'EquityLensAI Alerts <alerts@equitylensai.com>';
      const result = await resend.emails.send({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (result.error) {
        throw new Error(`Resend email dispatch error: ${result.error.name} - ${result.error.message}`);
      }

      const providerMessageId = result.data?.id || crypto.randomUUID();
      logger.info(
        { to: options.to, subject: options.subject, providerMessageId },
        'Email successfully dispatched via Resend API',
      );
      return providerMessageId;
    }

    // Fallback simulation in test / dev without key
    const messageId = `<${crypto.randomUUID()}@equitylensai.internal>`;
    logger.debug(
      { to: options.to, subject: options.subject, messageId, env: env.NODE_ENV },
      'Email simulated via internal transport (Resend API key not configured or running in test mode)',
    );

    return messageId;
  }

  /**
   * Checks if user quiet hours are currently active.
   */
  private isInQuietHours(preferences: UserAlertPreferences): boolean {
    if (!preferences.quietHoursEnabled || !preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false;
    }

    try {
      const now = new Date();
      // Format current time in user's timezone if possible
      const timeStr = now.toLocaleTimeString('en-US', {
        timeZone: preferences.timeZone || 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });

      const [nowH, nowM] = timeStr.split(':').map(Number);
      const [startH, startM] = preferences.quietHoursStart.split(':').map(Number);
      const [endH, endM] = preferences.quietHoursEnd.split(':').map(Number);

      if (
        nowH === undefined ||
        nowM === undefined ||
        startH === undefined ||
        startM === undefined ||
        endH === undefined ||
        endM === undefined
      ) {
        return false;
      }

      const nowMins = nowH * 60 + nowM;
      const startMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;

      if (startMins <= endMins) {
        return nowMins >= startMins && nowMins <= endMins;
      } else {
        // Spans midnight e.g. 22:00 to 08:00
        return nowMins >= startMins || nowMins <= endMins;
      }
    } catch {
      return false;
    }
  }

  /**
   * Checks if a notification category is enabled in user alert preferences.
   */
  private isCategoryEnabled(category: string, preferences: UserAlertPreferences): boolean {
    switch (category) {
      case 'price_alert':
        return preferences.priceAlerts ?? true;
      case 'percentage_alert':
        return preferences.percentageAlerts ?? true;
      case 'volume_alert':
        return preferences.volumeAlerts ?? true;
      case 'technical_alert':
        return preferences.technicalAlerts ?? true;
      case 'financial_alert':
        return preferences.financialAlerts ?? true;
      case 'announcement_alert':
      case 'corporate_action_alert':
        return preferences.announcementAlerts ?? true;
      case 'market_event':
        return preferences.marketSummaries ?? true;
      case 'research_report':
        return preferences.researchUpdates ?? true;
      case 'system':
        return preferences.systemAlerts ?? true;
      case 'news_alert':
        return preferences.newsAlerts ?? true;
      default:
        return true;
    }
  }

  /**
   * Generates a sleek, dark-styled responsive HTML email template.
   */
  private generateAlertEmailTemplate(notification: AppNotification): { html: string; text: string } {
    const env = getEnv();
    const appUrl = env.FRONTEND_URL || 'http://localhost:3000';
    const linkUrl = notification.link ? `${appUrl}${notification.link}` : `${appUrl}/notifications`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notification.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #030712; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 28px; background: linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(99, 102, 241, 0.15)); border-bottom: 1px solid rgba(255,255,255,0.1);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">EquityLens<span style="color: #38bdf8;">AI</span></span>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background-color: rgba(56, 189, 248, 0.15); padding: 4px 10px; border-radius: 9999px; text-transform: uppercase;">Verified Alert</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 28px;">
              <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                ${notification.title}
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                ${notification.message}
              </p>

              ${
                notification.symbol
                  ? `
              <div style="background-color: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px 18px; margin-bottom: 24px;">
                <span style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Security</span>
                <div style="font-size: 16px; font-weight: 700; color: #ffffff; margin-top: 2px;">
                  ${notification.symbol} <span style="font-size: 12px; font-weight: 500; color: #38bdf8;">(${notification.exchange || 'NSE'})</span>
                </div>
              </div>`
                  : ''
              }

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${linkUrl}" style="display: inline-block; background: linear-gradient(135deg, #0284c7, #4f46e5); color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);">
                      View Details on EquityLensAI
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 28px; background-color: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #64748b; text-align: center;">
              You received this alert because you configured an active alert rule in your EquityLensAI account.
              <br><br>
              <a href="${appUrl}/settings/preferences" style="color: #38bdf8; text-decoration: none;">Manage Notification Preferences</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    const text = `[EquityLensAI Alert] ${notification.title}\n\n${notification.message}\n\nSymbol: ${notification.symbol || 'N/A'}\nTime: ${notification.createdAt}\n\nView details: ${linkUrl}\n\nManage preferences: ${appUrl}/settings/preferences`;

    return { html, text };
  }
}

export const emailDeliveryService = new EmailDeliveryService();
