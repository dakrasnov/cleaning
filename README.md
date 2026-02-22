# CleanShift

A mobile-first web app for managing cleaning business operations.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Fill in your Supabase URL, anon key, and Telegram bot token
```

### 3. Set up the database
- Go to [supabase.com](https://supabase.com) and create a new project
- Open **SQL Editor** → **New Query**
- Paste and run the contents of `supabase-schema.sql`

### 4. Run the dev server
```bash
npm run dev
# → http://localhost:5173
```

---

## Project Structure

```
src/
├── components/
│   ├── ui.tsx              # All shared UI primitives (Button, Card, Modal, etc.)
│   └── TelegramModal.tsx   # Shift notification modal
├── lib/
│   ├── supabase.ts         # Supabase client
│   ├── telegram.ts         # Telegram Bot API helpers
│   └── utils.ts            # Date/time utilities
├── pages/
│   ├── Dashboard.tsx
│   ├── Customers.tsx       # List + create
│   ├── CustomerDetail.tsx  # View + edit + delete
│   ├── Employees.tsx
│   ├── EmployeeDetail.tsx
│   ├── Shifts.tsx
│   ├── ShiftDetail.tsx
│   └── Assignments.tsx
├── store/
│   ├── customers.ts        # Zustand store with Supabase CRUD
│   ├── employees.ts
│   ├── shifts.ts
│   └── assignments.ts
├── types/
│   └── index.ts            # TypeScript interfaces
├── App.tsx                 # Router + bottom navigation
├── main.tsx                # React entry point
└── index.css               # Tailwind + global styles
```

---

## Telegram Bot Setup

### Create the bot
1. Open Telegram and message `@BotFather`
2. Send `/newbot` and follow the prompts
3. Copy the token into your `.env` as `VITE_TELEGRAM_BOT_TOKEN`

### Link employees
Each employee needs to:
1. Start a chat with your bot (send `/start`)
2. The bot will reply with their **Chat ID**
3. Save that Chat ID in their employee profile in CleanShift

### Deploy the webhook (for /confirm and /refuse commands)
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref <your-project-ref>

# Set secrets
supabase secrets set TELEGRAM_BOT_TOKEN=your-token-here

# Deploy the function
supabase functions deploy telegram-webhook

# Register webhook with Telegram
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
     -d '{"url":"https://<project-ref>.supabase.co/functions/v1/telegram-webhook"}'
```

### During development (optional)
Use [ngrok](https://ngrok.com) to tunnel localhost for webhook testing:
```bash
ngrok http 54321   # Supabase functions run on port 54321 locally
# Then register the ngrok URL with Telegram
```

---

## Build for production
```bash
npm run build
# Output in /dist — deploy to Vercel, Netlify, or any static host
```
