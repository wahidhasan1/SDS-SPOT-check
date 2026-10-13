import nodemailer from 'nodemailer'
import { env } from '../env.ts'

let transport: ReturnType<typeof nodemailer.createTransport> | null = null

/** Sends a plain-text email through SMTP_URL. Returns false when email is not configured or sending fails. */
export async function sendMail(to: string, subject: string, text: string) {
  if (!env.smtpUrl) return false
  transport ??= nodemailer.createTransport(env.smtpUrl)
  try {
    await transport.sendMail({ from: env.mailFrom, to, subject, text })
    return true
  } catch (e) {
    console.error('Email failed:', (e as Error).message)
    return false
  }
}
