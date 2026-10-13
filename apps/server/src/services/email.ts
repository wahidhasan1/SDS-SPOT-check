import { config } from '../config';
import { notConfigured } from '../lib/errors';

export async function sendEmail(to: string, subject: string, text: string, devLogLine?: string): Promise<void> {
  if (config.resendApiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.emailFrom, to, subject, text }),
    });
    if (!res.ok) throw new Error(`Email provider error ${res.status}`);
    return;
  }
  if (config.isProd) throw notConfigured('Email delivery is not configured (RESEND_API_KEY).');
  // Development only: no email provider configured, so print the link for the developer.
  if (!config.isTest) console.warn(`[dev-email] To: ${to} | ${subject} | ${devLogLine ?? ''}`);
}
