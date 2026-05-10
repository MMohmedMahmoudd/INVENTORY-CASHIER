# InvenPOS - Setup & Deployment Guide

## Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account (free tier works)

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **API Keys** (Settings → API)
3. Note your **Service Role Key** (keep secret)

---

## 2. Run Database Migrations

In the **Supabase SQL Editor** (project → SQL editor), run each file in order:

```
migrations/001_initial_schema.sql   ← Tables, indexes, constraints
migrations/002_functions_triggers.sql ← Functions, triggers
migrations/003_rls_policies.sql     ← Row Level Security policies
migrations/004_seed_data.sql        ← Roles, permissions, categories, settings
```

### Create Storage Bucket

In Supabase → Storage, create a public bucket named **`products`** for product images.

Also create a public bucket named **`avatars`** for user avatars.

---

## 3. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 4. Create First Admin User

1. Go to Supabase → Authentication → Users → "Invite user"
2. Enter your email
3. In SQL editor, run:

```sql
-- Get the user ID from auth.users
-- Then update their profile to admin role
UPDATE user_profiles
SET role_id = '00000000-0000-0000-0000-000000000001'
WHERE auth_user_id = (
  SELECT id FROM auth.users WHERE email = 'your@email.com'
);
```

---

## 5. Install Dependencies & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

---

## 6. Production Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard or CLI
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

### In Supabase:
- Go to Authentication → URL Configuration
- Add your Vercel URL to **Site URL** and **Redirect URLs**

---

## Architecture Overview

```
src/
├── app/
│   ├── (auth)/          Auth pages (login, forgot-pw, reset-pw)
│   ├── (dashboard)/     All protected pages
│   │   ├── dashboard/   Main analytics dashboard
│   │   ├── products/    Product CRUD
│   │   ├── categories/  Category management
│   │   ├── suppliers/   Supplier management
│   │   ├── customers/   Customer management
│   │   ├── inventory/   Stock management + logs
│   │   ├── pos/         Point of Sale / Cashier
│   │   ├── sales/       Sales history
│   │   ├── purchases/   Purchase orders
│   │   ├── reports/     Analytics & charts
│   │   ├── qr/          QR generator + scanner
│   │   ├── users/       User management
│   │   ├── roles/       Role management
│   │   ├── permissions/ Permission matrix
│   │   ├── settings/    System settings
│   │   ├── profile/     User profile
│   │   └── activity-logs/ Audit trail
│   └── actions/         Server Actions
├── components/
│   ├── ui/              shadcn-compatible components
│   ├── layout/          Sidebar, Header, Command palette
│   ├── shared/          DataTable, PageHeader, StatCard
│   ├── dashboard/       Dashboard-specific components
│   └── providers/       Auth, Query, Theme providers
├── hooks/               Custom React hooks
├── lib/                 Supabase client, utils, constants
├── store/               Zustand stores (auth, cart, ui)
├── types/               TypeScript types
└── middleware.ts         Route protection
migrations/
├── 001_initial_schema.sql
├── 002_functions_triggers.sql
├── 003_rls_policies.sql
└── 004_seed_data.sql
```

---

## Key Features

| Feature | Technology |
|---------|-----------|
| Auth | Supabase Auth (email/password) |
| Database | PostgreSQL via Supabase |
| Real-time | Supabase Realtime |
| Storage | Supabase Storage |
| RBAC | Custom role/permission system |
| QR Codes | `qrcode` + `html5-qrcode` |
| Charts | Recharts |
| Forms | react-hook-form + Zod |
| State | Zustand |
| Data fetching | TanStack Query |
| UI | shadcn/ui + Radix UI |
| Animations | Framer Motion |

---

## Security

- All database tables have Row Level Security (RLS) enabled
- Admins can access everything; Managers are restricted by permissions
- Service role key is server-side only (never exposed to client)
- Zod validation on all forms
- SQL injection protected via Supabase's parameterized queries
- CSRF protected by Next.js and Supabase SSR session handling

---

## Default Credentials (After Setup)

Create your first admin via Supabase dashboard — there are no default credentials for security reasons.
