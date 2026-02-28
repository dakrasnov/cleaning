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

async function sendMessage(chatId: string | number, text: string, parseMode = 'HTML') {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
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

  // ─── Inline keyboard callbacks ────────────────────────────────────────────
  const cbq = body?.callback_query
  if (cbq) {
    const chatId = cbq.from.id
    const callbackData: string = cbq.data ?? ''

    // Always answer immediately to remove loading spinner on button
    await answerCallbackQuery(cbq.id)

    console.log(`callback_query from chatId=${chatId}, data="${callbackData}"`)

    // ── Shift start: confirm ──────────────────────────────────────────────
    if (callbackData.startsWith('confirm_')) {
      const assignmentId = callbackData.slice('confirm_'.length)
      console.log(`confirm_ from chatId=${chatId}, assignmentId=${assignmentId}`)

      // Find employee by telegram chat ID
      const { data: emps, error: empError } = await supabase
        .from('employees')
        .select('id, name')
        .eq('telegram_chat_id', String(chatId))

      if (empError || !emps?.length) {
        console.error('Employee lookup error:', empError)
        await sendMessage(chatId, `❌ Ваш Telegram (ID: ${chatId}) не привязан ни к одному сотруднику.\n\nПередайте этот ID менеджеру.`)
        return new Response('OK')
      }
      const employee = emps[0]
      console.log(`Employee: ${employee.name} (${employee.id})`)

      // Fetch full assignment including payment_info and employee_ids
      const { data: assignment, error: assignError } = await supabase
        .from('assignments')
        .select('id, shift_id, employee_ids, payment_info, confirmed_by')
        .eq('id', assignmentId)
        .single()

      if (assignError || !assignment) {
        console.error('Assignment lookup error:', assignError)
        await sendMessage(chatId, '❌ Назначение не найдено.')
        return new Response('OK')
      }

      // Check if this employee already confirmed
      const paymentInfo: any[] = assignment.payment_info ?? []
      const myEntry = paymentInfo.find((p: any) => p.employee_id === employee.id)
      if (myEntry?.confirmed) {
        await sendMessage(chatId, '⚠️ Вы уже подтвердили эту смену.')
        return new Response('OK')
      }

      // Mark this employee as confirmed in payment_info
      const updatedPaymentInfo = myEntry
        ? paymentInfo.map((p: any) =>
            p.employee_id === employee.id ? { ...p, confirmed: true } : p
          )
        : [...paymentInfo, { employee_id: employee.id, amount: 0, paid: false, confirmed: true }]

      // Check if ALL assigned employees have now confirmed
      const allConfirmed = (assignment.employee_ids as string[]).every((eid: string) =>
        updatedPaymentInfo.find((p: any) => p.employee_id === eid)?.confirmed === true
      )

      // Update assignment
      const { error: updateError } = await supabase
        .from('assignments')
        .update({
          payment_info: updatedPaymentInfo,
          confirmed_by: employee.id,
          confirmed_at: new Date().toISOString(),
          ...(allConfirmed ? { status: 'confirmed' } : {}),
        })
        .eq('id', assignmentId)

      if (updateError) {
        console.error('Assignment update error:', updateError)
        await sendMessage(chatId, `❌ Не удалось подтвердить смену: ${updateError.message}`)
        return new Response('OK')
      }

      // If all confirmed → flip shift to 'confirmed'
      if (allConfirmed) {
        const { error: shiftUpdateError } = await supabase
          .from('shifts')
          .update({ status: 'confirmed' })
          .eq('id', assignment.shift_id)

        if (shiftUpdateError) {
          console.error('Shift status update error:', shiftUpdateError)
        } else {
          console.log(`Shift ${assignment.shift_id} → confirmed (all employees confirmed)`)
        }

        await sendMessage(chatId, `✅ Отлично, ${employee.name}! Все сотрудники подтвердили — смена подтверждена! 🎉`)
      } else {
        console.log(`Assignment ${assignmentId}: ${employee.name} confirmed, waiting for others`)
        await sendMessage(chatId, `✅ ${employee.name}, ваше подтверждение записано! Ждём остальных сотрудников.`)
      }

    // ── Shift start: decline ──────────────────────────────────────────────
    } else if (callbackData.startsWith('decline_')) {
      await sendMessage(chatId, '🙅 Понятно, спасибо за ответ. Мы найдём другого сотрудника.')

    // ── Shift completion: done ────────────────────────────────────────────
    } else if (callbackData.startsWith('shift_done_')) {
      const shiftId = callbackData.slice('shift_done_'.length)
      console.log(`Shift completion "done" from chatId=${chatId}, shiftId=${shiftId}`)

      // Find employee by telegram chat ID
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
        await sendMessage(chatId, `❌ Ваш Telegram (ID: ${chatId}) не привязан ни к одному сотруднику.\n\nПередайте этот ID менеджеру.`)
        return new Response('OK')
      }

      // Fetch the shift
      const { data: shift, error: shiftError } = await supabase
        .from('shifts')
        .select('id, status, time_start, time_end')
        .eq('id', shiftId)
        .single()

      if (shiftError || !shift) {
        console.error('Shift lookup error:', shiftError)
        await sendMessage(chatId, '❌ Смена не найдена.')
        return new Response('OK')
      }

      if (shift.status === 'completed') {
        await sendMessage(chatId, '✅ Смена уже отмечена как завершённая.')
        return new Response('OK')
      }

      if (shift.status !== 'confirmed') {
        await sendMessage(chatId, '⚠️ Смена не может быть завершена в текущем статусе.')
        return new Response('OK')
      }

      // Record 'done' response before updating shift
      await supabase
        .from('shift_completion_responses')
        .upsert(
          {
            shift_id: shiftId,
            employee_id: employee.id,
            response: 'done',
            responded_at: new Date().toISOString(),
          },
          { onConflict: 'shift_id,employee_id' }
        )

      // Move shift to 'completed'
      const { error: updateError } = await supabase
        .from('shifts')
        .update({ status: 'completed' })
        .eq('id', shiftId)

      if (updateError) {
        console.error('Shift update error:', updateError)
        await sendMessage(chatId, `❌ Ошибка обновления смены: ${updateError.message}`)
        return new Response('OK')
      }

      console.log(`Shift ${shiftId} marked completed by ${employee.name}`)

      // ACCRUAL TRIGGER
      // Must run server-side here because the Zustand browser trigger
      // only fires when a manager acts in the web UI.
      // Formula: accrual = employee.salary * shift_duration_hours
      const { data: assignment } = await supabase
        .from('assignments')
        .select('employee_ids')
        .eq('shift_id', shiftId)
        .single()

      if (assignment?.employee_ids?.length) {
        const [sh, sm] = shift.time_start.split(':').map(Number)
        const [eh, em] = shift.time_end.split(':').map(Number)
        const durationHours = ((eh * 60 + em) - (sh * 60 + sm)) / 60

        const { data: allEmployees } = await supabase
          .from('employees')
          .select('id, salary')
          .in('id', assignment.employee_ids)

        if (allEmployees?.length) {
          const accrualRows = allEmployees.map((emp: any) => ({
            employee_id: emp.id,
            shift_id: shiftId,
            amount: emp.salary * durationHours,
            note: 'Shift completed via Telegram',
          }))

          const { error: accrualError } = await supabase
            .from('employee_accruals')
            .upsert(accrualRows, { onConflict: 'employee_id,shift_id' })

          if (accrualError) {
            console.error('Accrual insert error:', accrualError)
          } else {
            console.log(`Created ${accrualRows.length} accrual(s) for shift ${shiftId}`)
          }
        }
      }

      await sendMessage(chatId, `✅ Отлично, ${employee.name}! Смена завершена. Спасибо за работу! 🙌`)

    // ── Shift completion: still in progress ───────────────────────────────
    } else if (callbackData.startsWith('shift_wip_')) {
      const shiftId = callbackData.slice('shift_wip_'.length)
      console.log(`Shift completion "wip" from chatId=${chatId}, shiftId=${shiftId}`)

      // Find employee to record the response
      const { data: emps } = await supabase
        .from('employees')
        .select('id, name')
        .eq('telegram_chat_id', String(chatId))

      const employee = emps?.[0]

      if (employee) {
        // Record 'wip' — prevents re-notification this round
        await supabase
          .from('shift_completion_responses')
          .upsert(
            {
              shift_id: shiftId,
              employee_id: employee.id,
              response: 'wip',
              responded_at: new Date().toISOString(),
            },
            { onConflict: 'shift_id,employee_id' }
          )
        console.log(`Recorded wip response for ${employee.name}, shift ${shiftId}`)
      }

      await sendMessage(chatId, '🔄 Понятно! Продолжайте, удачи на смене.')
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
