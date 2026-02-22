// supabase/functions/telegram-webhook/index.ts
// Deploy with: supabase functions deploy telegram-webhook
// Then register with Telegram:
//   curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
//        -d '{"url":"https://<project>.supabase.co/functions/v1/telegram-webhook"}'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!

async function sendMessage(chatId: string | number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK')

  const body = await req.json()
  const message = body?.message
  if (!message?.text) return new Response('OK')

  const chatId = message.chat.id
  const text: string = message.text.trim()

  // ─── /confirm_{shift_id} ──────────────────────────────────────────────────
  const confirmMatch = text.match(/^\/confirm_([a-z0-9-]+)$/i)
  if (confirmMatch) {
    const shiftId = confirmMatch[1]

    // Find employee by telegram_chat_id
    const { data: employees } = await supabase
      .from('employees')
      .select('id, name')
      .eq('telegram_chat_id', String(chatId))

    const employee = employees?.[0]
    if (!employee) {
      await sendMessage(chatId, '❌ Your Telegram account is not linked to any employee profile.')
      return new Response('OK')
    }

    // Get shift info
    const { data: shift } = await supabase
      .from('shifts')
      .select('*, customers(*)')
      .eq('id', shiftId)
      .single()

    if (!shift) {
      await sendMessage(chatId, '❌ Shift not found.')
      return new Response('OK')
    }

    if (shift.status === 'confirmed') {
      await sendMessage(chatId, '⚠️ This shift has already been confirmed.')
      return new Response('OK')
    }

    // Check if assignment already exists
    const { data: existingAssignment } = await supabase
      .from('assignments')
      .select('id, employee_ids')
      .eq('shift_id', shiftId)
      .single()

    const now = new Date().toISOString()

    if (existingAssignment) {
      // Add employee to existing assignment
      const updatedIds = [...new Set([...existingAssignment.employee_ids, employee.id])]
      await supabase.from('assignments').update({
        employee_ids: updatedIds,
        confirmed_by: employee.id,
        confirmed_at: now,
      }).eq('id', existingAssignment.id)
    } else {
      // Create new assignment
      await supabase.from('assignments').insert({
        shift_id: shiftId,
        employee_ids: [employee.id],
        confirmed_by: employee.id,
        confirmed_at: now,
      })
    }

    // Mark shift as confirmed
    await supabase.from('shifts').update({ status: 'confirmed' }).eq('id', shiftId)

    const address = shift.customers?.address ?? 'TBD'
    await sendMessage(chatId, `✅ Confirmed! You're booked for ${shift.date} at ${address}. See you there!`)
    return new Response('OK')
  }

  // ─── /refuse_{shift_id} ───────────────────────────────────────────────────
  const refuseMatch = text.match(/^\/refuse_([a-z0-9-]+)$/i)
  if (refuseMatch) {
    await sendMessage(chatId, "Got it, we'll find someone else. Thanks for letting us know!")
    return new Response('OK')
  }

  // ─── /start ───────────────────────────────────────────────────────────────
  if (text === '/start') {
    await sendMessage(chatId, `👋 Welcome to CleanShift!\n\nYour Chat ID is: ${chatId}\n\nPlease share this with your manager so they can link your account.`)
    return new Response('OK')
  }

  return new Response('OK')
})
