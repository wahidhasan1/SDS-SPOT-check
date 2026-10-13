import nodemailer from 'nodemailer';
import { config } from '../config';
import { db, schema } from '../db';

let transporter: nodemailer.Transporter | null = null;

export function emailConfigured() {
  return Boolean(config.smtpUrl);
}

/**
 * Send an email via SMTP when SMTP_URL is configured. Otherwise the message is stored in the
 * email_outbox table with status "logged" and printed to the server log, so developers can still
 * follow links (e.g. password reset) locally. Nothing claims the email was delivered.
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<'sent' | 'logged' | 'failed'> {
  if (!config.smtpUrl) {
    await db.insert(schema.emailOutbox).values({ to, subject, body, status: 'logged' });
    if (!config.isTest) console.log(`\n[email:not-sent — SMTP_URL not configured]\nTo: ${to}\nSubject: ${subject}\n${body}\n`);
    return 'logged';
  }
  try {
    transporter ??= nodemailer.createTransport(config.smtpUrl);
    await transporter.sendMail({ from: config.mailFrom, to, subject, text: body });
    await db.insert(schema.emailOutbox).values({ to, subject, body, status: 'sent' });
    return 'sent';
  } catch (err) {
    await db.insert(schema.emailOutbox).values({ to, subject, body, status: 'failed', error: String((err as Error).message).slice(0, 500) });
    return 'failed';
  }
}
