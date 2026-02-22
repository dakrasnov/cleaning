const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN

export interface TelegramShiftPayload {
  shiftId: string
  address: string
  date: string
  timeStart: string
  timeEnd: string
  price: number
  comment: string
}

export function buildShiftMessage(p: TelegramShiftPayload): string {
  return `🧹 New Shift Available!
📍 Address: ${p.address}
🗓️ Date: ${p.date}
⏰ Time: ${p.timeStart} – ${p.timeEnd}
💰 Rate: $${p.price}
📝 Note: ${p.comment || 'None'}

Reply:
✅ /confirm_${p.shiftId} — I'll take it
❌ /refuse_${p.shiftId} — Not available`
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn('No Telegram bot token configured')
    return false
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    const data = await res.json()
    return data.ok === true
  } catch (err) {
    console.error('Telegram send error:', err)
    return false
  }
}

export async function testBotConnection(token: string): Promise<{ ok: boolean; username?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const data = await res.json()
    if (data.ok) return { ok: true, username: data.result.username }
    return { ok: false }
  } catch {
    return { ok: false }
  }
}
