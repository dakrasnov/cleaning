const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN

export interface TelegramShiftPayload {
  employeeName: string
  customerName: string
  shiftId: string
  address: string
  date: string       // 'YYYY-MM-DD'
  timeStart: string  // 'HH:MM'
  timeEnd: string    // 'HH:MM'
  price: number
  comment: string
}

export function buildShiftMessage(p: TelegramShiftPayload): string {
  const [y, m, d] = p.date.split('-').map(Number)
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(y, m - 1, d).getDay()]

  const [sh, sm] = p.timeStart.split(':').map(Number)
  const [eh, em] = p.timeEnd.split(':').map(Number)
  const totalMins = (eh * 60 + em) - (sh * 60 + sm)
  const hrs = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  const duration = mins === 0 ? `${hrs} hrs` : `${hrs} hrs ${mins} min`

  const lines = [
    `🧹 ${p.employeeName}, Вы назначены на смену!`,
    `🗓️ Дата: ${p.date}, ${dayName}`,
    `⏰ Время: ${p.timeStart} – ${p.timeEnd}, ${duration}`,
    `    Клиент: ${p.customerName}`,
    `📍 Адрес: ${p.address}`,
    `💰 Ставка: ${p.price}`,
  ]
  if (p.comment) lines.push(`📝 Комментарий: ${p.comment}`)
  return lines.join('\n')
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

export async function sendTelegramWithConfirmation(chatId: string, text: string, assignmentId: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn('No Telegram bot token configured')
    return false
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text + '\n\n❓ Вы подтверждаете смену?',
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: 'Да ✅', callback_data: `confirm_${assignmentId}` },
            { text: 'Нет ❌', callback_data: `decline_${assignmentId}` },
          ]],
        },
      }),
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
