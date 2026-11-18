import type { SendEmail } from '@app/auth'
import type { Env } from './env.ts'

// Both providers are plain HTTP calls, so the same code runs on Node and Workers.
export function createMailer(env: Env): SendEmail {
  const from = parseAddress(env.MAIL_FROM)

  if (env.MAIL_PROVIDER === 'none') {
    return async () => {
      throw new Error('Email is turned off (MAIL_PROVIDER=none)')
    }
  }

  if (env.MAIL_PROVIDER === 'resend') {
    return async (message) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM, to: [message.to], ...pick(message) }),
      })
      if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`)
    }
  }

  return async (message) => {
    const res = await fetch(new URL('/api/v1/send', env.MAILPIT_URL), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        From: { Email: from.email, Name: from.name },
        To: [{ Email: message.to }],
        Subject: message.subject,
        Text: message.text,
        HTML: message.html,
      }),
    })
    if (!res.ok) throw new Error(`Mailpit failed: ${res.status} ${await res.text()}`)
  }
}

function pick(message: Parameters<SendEmail>[0]) {
  return { subject: message.subject, text: message.text, html: message.html }
}

function parseAddress(value: string): { name: string; email: string } {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  return match ? { name: match[1] ?? '', email: match[2] ?? '' } : { name: '', email: value.trim() }
}
