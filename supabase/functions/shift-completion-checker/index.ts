import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!

async function sendCompletionPrompt(
  chatId: string,
  employeeName: string,
  customerName: string,
  shiftId: string
) {
  const waLink = 'https://wa.me/972539547100'
  const text =
    `${employeeName}, пожалуйста, подтвердите окончание смены у клиента ${customerName}.\n\n` +
    `Если есть, что сообщить по поводу смены, напиши в <a href="${waLink}">WhatsApp</a>`

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },  
      reply_markup: {
        inline_keyboard: [[
          { text: 'Закончила ✅', callback_data: `shift_done_${shiftId}` },
          { text: 'В процессе 🔄', callback_data: `shift_wip_${shiftId}` },
        ]],
      },
    }),
  })
  if (!res.ok) {
    console.error(`sendMessage failed for chatId ${chatId}:`, await res.text())
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const now = new Date()
  const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
  const cutoffTime = new Date(israelTime.getTime() - 30 * 60 * 1000)
  const cutoffHHMM = cutoffTime.toTimeString().slice(0, 5)
  const todayDate = israelTime.toISOString().slice(0, 10)


  console.log(`Running at ${now.toISOString()}, cutoff: ${cutoffHHMM}, date: ${todayDate}`)

  // 1. Find all confirmed shifts from today that ended more than 30 min ago
  const { data: shifts, error: shiftsError } = await supabase
    .from('shifts')
    .select(`id, date, time_start, time_end, status, customers ( id, name )`)
    .eq('status', 'confirmed')
    .eq('date', todayDate)
    .lt('time_end', cutoffHHMM)

  if (shiftsError) {
    console.error('Error fetching shifts:', shiftsError)
    return new Response(JSON.stringify({ error: shiftsError.message }), { status: 500 })
  }

  console.log(`Found ${shifts?.length ?? 0} overdue confirmed shifts`)

  if (!shifts || shifts.length === 0) {
    return new Response(JSON.stringify({ notified: 0 }), { status: 200 })
  }

  let totalMessagesSent = 0

  for (const shift of shifts) {
    const customerName = (shift.customers as any)?.name ?? 'клиента'

    // 2. Get assignment to find employee_ids
    const { data: assignment } = await supabase
      .from('assignments')
      .select('employee_ids')
      .eq('shift_id', shift.id)
      .single()

    if (!assignment?.employee_ids?.length) {
      console.log(`No assignment for shift ${shift.id}, skipping`)
      continue
    }

    // 3. Get existing responses for this shift
    const { data: existingResponses } = await supabase
      .from('shift_completion_responses')
      .select('employee_id')
      .eq('shift_id', shift.id)

    const respondedEmployeeIds = new Set(
      (existingResponses ?? []).map((r: any) => r.employee_id)
    )

    // 4. Filter to employees who have NOT yet responded
    const pendingEmployeeIds = assignment.employee_ids.filter(
      (id: string) => !respondedEmployeeIds.has(id)
    )

    if (pendingEmployeeIds.length === 0) {
      console.log(`All employees for shift ${shift.id} have already responded, skipping`)
      continue
    }

    // 5. Fetch only pending employees
    const { data: employees } = await supabase
      .from('employees')
      .select('id, name, telegram_chat_id')
      .in('id', pendingEmployeeIds)

    if (!employees?.length) continue

    // 6. Send message to each pending employee
    for (const emp of employees) {
      if (!emp.telegram_chat_id) {
        console.log(`Employee ${emp.name} has no telegram_chat_id, skipping`)
        continue
      }
      try {
        await sendCompletionPrompt(emp.telegram_chat_id, emp.name, customerName, shift.id)
        console.log(`Sent to ${emp.name} for shift ${shift.id}`)
        totalMessagesSent++
      } catch (err) {
        console.error(`Failed to send to ${emp.name}:`, err)
      }
    }
  }

  return new Response(JSON.stringify({ notified: totalMessagesSent }), { status: 200 })
})
