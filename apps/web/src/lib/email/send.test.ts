import { describe, it, expect, vi } from 'vitest'
import { sendEmail } from './send'

function makeBinding() {
  return {
    send: vi.fn().mockResolvedValue({ messageId: 'msg_test' }),
  }
}

describe('sendEmail', () => {
  const payload = {
    to: 'user@example.com',
    subject: 'Subject',
    html: '<p>html</p>',
    text: 'text',
  }

  it('logs to the provided logger in dev and never touches the binding', async () => {
    const info = vi.fn()
    const email = makeBinding()
    await sendEmail(payload, {
      email: email as unknown as SendEmail,
      from: 'unused@baseout.com',
      dev: true,
      logger: { info },
    })
    expect(info).toHaveBeenCalledTimes(1)
    const arg = info.mock.calls[0]![0] as string
    expect(arg).toContain('to=user@example.com')
    expect(arg).toContain(payload.text)
    expect(email.send).not.toHaveBeenCalled()
  })

  it('calls the EMAIL binding with the expected payload in prod', async () => {
    const email = makeBinding()
    await sendEmail(payload, {
      email: email as unknown as SendEmail,
      from: 'Baseout <login@mail.baseout.dev>',
      dev: false,
    })
    expect(email.send).toHaveBeenCalledTimes(1)
    expect(email.send).toHaveBeenCalledWith({
      from: 'Baseout <login@mail.baseout.dev>',
      to: 'user@example.com',
      subject: 'Subject',
      html: '<p>html</p>',
      text: 'text',
    })
  })

  it('throws in prod when the EMAIL binding is missing', async () => {
    await expect(
      sendEmail(payload, { email: undefined, from: 'a@b.com', dev: false }),
    ).rejects.toThrow(/EMAIL binding/)
  })

  it('throws in prod when EMAIL_FROM is missing', async () => {
    const email = makeBinding()
    await expect(
      sendEmail(payload, { email: email as unknown as SendEmail, from: undefined, dev: false }),
    ).rejects.toThrow(/EMAIL_FROM/)
  })

  it('propagates errors thrown by the binding (e.g. E_SENDER_NOT_VERIFIED)', async () => {
    const email = {
      send: vi.fn().mockRejectedValue(
        Object.assign(new Error('sender not verified'), { code: 'E_SENDER_NOT_VERIFIED' }),
      ),
    }
    await expect(
      sendEmail(payload, { email: email as unknown as SendEmail, from: 'a@b.com', dev: false }),
    ).rejects.toThrow(/sender not verified/)
  })
})
