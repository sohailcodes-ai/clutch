/**
 * ============================================================================
 * EMAIL DELIVERY ABSTRACTION
 * ============================================================================
 * Provides a pluggable email delivery interface. In development, emails are
 * logged to the console. In production, emails are sent via SMTP.
 *
 * Configuration (env vars):
 *   SMTP_HOST     — SMTP server hostname (default: localhost)
 *   SMTP_PORT     — SMTP server port (default: 587)
 *   SMTP_USER     — SMTP auth username
 *   SMTP_PASS     — SMTP auth password
 *   EMAIL_FROM    — Sender address (default: noreply@clutch.dev)
 *   EMAIL_MODE    — "smtp" or "log" (default: "log" in development)
 * ============================================================================
 */

import { createTransport, type Transporter } from 'nodemailer'

export type EmailAddress = { name?: string; address: string }

export type SendEmailParams = {
  to: EmailAddress[]
  subject: string
  html: string
  text?: string
}

export type EmailDelivery = {
  send(params: SendEmailParams): Promise<{ messageId: string }>
}

// ---------------------------------------------------------------------------
// Log transport (development / testing)
// ---------------------------------------------------------------------------

class LogDelivery implements EmailDelivery {
  async send(params: SendEmailParams): Promise<{ messageId: string }> {
    const to = params.to.map((a) => a.address).join(', ')
    console.log('─── Email Delivery (log mode) ───')
    console.log(`To: ${to}`)
    console.log(`Subject: ${params.subject}`)
    console.log(params.text ?? params.html)
    console.log('─────────────────────────────────')
    return { messageId: `log-${Date.now()}` }
  }
}

// ---------------------------------------------------------------------------
// SMTP transport (production)
// ---------------------------------------------------------------------------

class SmtpDelivery implements EmailDelivery {
  private transporter: Transporter

  constructor() {
    this.transporter = createTransport({
      host: process.env.SMTP_HOST ?? 'localhost',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    })
  }

  async send(params: SendEmailParams): Promise<{ messageId: string }> {
    const result = await this.transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'Clutch <noreply@clutch.dev>',
      to: params.to.map((a) => a.address),
      subject: params.subject,
      html: params.html,
      text: params.text,
    })
    return { messageId: result.messageId }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let instance: EmailDelivery | null = null

export function getEmailDelivery(): EmailDelivery {
  if (instance) return instance

  const mode = (process.env.EMAIL_MODE ?? 'log').toLowerCase()
  if (mode === 'smtp') {
    instance = new SmtpDelivery()
  } else {
    instance = new LogDelivery()
  }
  return instance
}

/** Reset singleton (for testing). */
export function resetEmailDelivery(): void {
  instance = null
}
