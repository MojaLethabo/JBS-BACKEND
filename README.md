# JBS Access — Backend (Railway)

Express + Prisma REST API. Deployed on **Railway**, connected to **Supabase** PostgreSQL.

## Stack
- Node.js / TypeScript / Express
- Prisma ORM → Supabase (PostgreSQL)
- JWT auth via `jose`

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Create organizer account |
| POST | `/auth/login` | — | Login, returns JWT token |
| GET | `/auth/me` | Bearer | Get current organizer |
| GET | `/events` | Bearer | List organizer's events |
| POST | `/events` | Bearer | Create event |
| GET | `/events/:id` | Bearer | Event detail + guest list |
| POST | `/checkin` | Bearer | Scan QR token |
| GET | `/register/:eventToken` | — | Verify registration link |
| POST | `/register` | — | Submit guest registration |

## Local Development

```bash
cp .env.example .env
# Fill in your Supabase URLs and AUTH_SECRET

npm install
npm run db:push       # push schema to Supabase
npm run db:seed       # optional: seed demo organizer
npm run dev           # starts on port 3001
```

## Deploy to Railway

1. Push this folder to a GitHub repo (or use Railway CLI)
2. Create a new Railway project → **Deploy from GitHub repo**
3. Add environment variables from `.env.example`
4. Railway auto-detects Node.js via `railway.json`
5. Set `FRONTEND_URL` to your Vercel frontend URL (for CORS)

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → Database**
3. Copy the **Transaction pooler** URL → `DATABASE_URL` (port 6543)
4. Copy the **Direct connection** URL → `DIRECT_URL` (port 5432)
5. Run `npm run db:push` to create all tables
