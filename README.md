# Duxi Codes

A pnpm monorepo hosting multiple applications on a single domain using path-based routing.

## 🏗️ Structure

```
duxi-codes/
├── apps/
│   ├── landing-page/     # Next.js landing page (/)
│   └── captable-app/     # Vite React cap table app (/captable)
├── supabase/             # Supabase configuration & Edge Functions
├── package.json          # Root pnpm configuration
├── pnpm-workspace.yaml   # Workspace definition
└── vercel.json           # Vercel routing configuration
```

## 🚀 Applications

### Landing Page (`/`)
- **Tech**: Next.js 14, TypeScript
- **Purpose**: Main homepage for duxi.codes

### Cap Table Timeline (`/captable`)
- **Tech**: Vite, React 18, TypeScript, Tailwind CSS
- **Purpose**: Cap table management for startups
- **Features**: Event-driven cap table, SAFE modeling, exit scenarios, team collaboration

## 📦 Development

### Prerequisites
- Node.js 18+
- pnpm 9+
- Docker (for Supabase local)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### Setup

```bash
# Install dependencies
pnpm install

# Start Supabase locally
supabase start

# Start Edge Functions
supabase functions serve --no-verify-jwt

# Start all apps in dev mode
pnpm dev

# Or start individually
pnpm dev:landing    # Landing page on :3000
pnpm dev:captable   # Captable app on :5173
```

### Build

```bash
# Build all apps
pnpm build

# Build individually
pnpm build:landing
pnpm build:captable
```

## 🌐 Deployment

### Vercel

1. Connect the GitHub repo to Vercel
2. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy

Routing is handled by `vercel.json`:
- `/` → Landing Page (Next.js)
- `/captable/*` → Cap Table App (Vite)

### Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Link: `supabase link --project-ref your-project-ref`
3. Push migrations: `supabase db push`
4. Deploy functions: `supabase functions deploy`

## 📁 Environment Variables

For local development, create `.env.local` in each app:

**apps/captable-app/.env.local**
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
```

For production, set in Vercel dashboard.

## 📄 License

MIT

