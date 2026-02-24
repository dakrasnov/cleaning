// supabase/functions/telegram-webhook/index.ts
// Deploy:   supabase functions deploy telegram-webhook
// Secrets:  supabase secrets set TELEGRAM_BOT_TOKEN=<token>
// Register: curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
//           -d '{"url":"https://<project-ref>.supabase.co/functions/v1/telegram-webhook"}'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!

async function sendMessage(chatId: string | number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) {
    console.error('sendMessage failed:', await res.text())
  }
}

async function answerCallbackQuery(queryId: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: queryId }),
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK')

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response('OK')
  }

  console.log('Incoming update:', JSON.stringify(body))

  // ─── Inline keyboard callback (Да / Нет buttons) ──────────────────────────
  const cbq = body?.callback_query
  if (cbq) {
    const chatId = cbq.from.id
    const callbackData: string = cbq.data ?? ''

    // Always answer immediately to remove loading spinner on button
    await answerCallbackQuery(cbq.id)

    console.log(`callback_query from chatId=${chatId}, data="${callbackData}"`)

    if (callbackData.startsWith('confirm_')) {
      const assignmentId = callbackData.slice('confirm_'.length)
      console.log(`Looking up employee for telegram_chat_id=${chatId}`)

      const { data: emps, error: empError } = await supabase
        .from('employees')
        .select('id, name')
        .eq('telegram_chat_id', String(chatId))

      if (empError) {
        console.error('Employee lookup error:', empError)
        await sendMessage(chatId, '❌ Ошибка при поиске сотрудника. Попробуйте позже.')
        return new Response('OK')
      }

      const employee = emps?.[0]
      if (!employee) {
        console.error(`No employee found for telegram_chat_id=${chatId}`)
        await sendMessage(chatId, `❌ Ваш Telegram (ID: ${chatId}) не привязан ни к одному сотруднику.\n\nПередайте этот ID менеджеру.`)
        return new Response('OK')
      }

      console.log(`Found employee: ${employee.name} (${employee.id}), looking up assignment ${assignmentId}`)

      const { data: assignment, error: assignError } = await supabase
        .from('assignments')
        .select('id, status')
        .eq('id', assignmentId)
        .single()

      if (assignError || !assignment) {
        console.error('Assignment lookup error:', assignError)
        await sendMessage(chatId, '❌ Назначение не найдено.')
        return new Response('OK')
      }

      if (assignment.status === 'confirmed') {
        await sendMessage(chatId, '⚠️ Смена уже подтверждена.')
        return new Response('OK')
      }

      const { error: updateError } = await supabase
        .from('assignments')
        .update({
          status: 'confirmed',
          confirmed_by: employee.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', assignmentId)

      if (updateError) {
        console.error('Assignment update error:', updateError)
        await sendMessage(chatId, `❌ Не удалось подтвердить смену: ${updateError.message}`)
        return new Response('OK')
      }

      console.log(`Assignment ${assignmentId} confirmed by ${employee.name}`)
      await sendMessage(chatId, `✅ Отлично, ${employee.name}! Смена подтверждена.`)

    } else if (callbackData.startsWith('decline_')) {
      await sendMessage(chatId, '🙅 Понятно, спасибо за ответ. Мы найдём другого сотрудника.')
    }

    return new Response('OK')
  }

  // ─── Text message commands ─────────────────────────────────────────────────
  const message = body?.message
  if (!message?.text) return new Response('OK')

  const chatId = message.chat.id
  const text: string = message.text.trim()

  console.log(`Message from chatId=${chatId}: "${text}"`)

  // /start
  if (text === '/start') {
    await sendMessage(chatId, `👋 Добро пожаловать!\n\nВаш Chat ID: <b>${chatId}</b>\n\nПередайте его менеджеру для привязки аккаунта.\nДля проверки привязки отправьте /check`)
    return new Response('OK')
  }

  // /check — diagnostic: confirms whether this chat ID is linked to an employee
  if (text === '/check') {
    const { data: emps, error } = await supabase
      .from('employees')
      .select('id, name')
      .eq('telegram_chat_id', String(chatId))

    if (error) {
      await sendMessage(chatId, `❌ Ошибка БД: ${error.message}`)
    } else if (emps?.length) {
      await sendMessage(chatId, `✅ Аккаунт привязан: ${emps[0].name}\nChat ID: ${chatId}`)
    } else {
      await sendMessage(chatId, `❌ Аккаунт не привязан.\nВаш Chat ID: ${chatId}\nПередайте его менеджеру.`)
    }
    return new Response('OK')
  }

  return new Response('OK')
})
