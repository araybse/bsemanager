# IRIS - Integrated Resource Intelligence System

**Professional project management and financial intelligence platform for civil engineering firms.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/araybse/bsemanager)

---

## What is IRIS?

IRIS (formerly BSE Manager) is an integrated platform that unifies:
- 💰 **Financial tracking** - QuickBooks sync, billing, rates
- 📊 **Project delivery** - Permits, submittals, timelines
- ⚡ **Real-time sync** - Automatic updates from QuickBooks
- 🔒 **Role-based access** - Admin, PM, and Employee views
- 🎯 **Phase-aware** - Track profitability by project phase

Built with Next.js 16, React 19, Supabase, and TailwindCSS.

---

## Features

### ✅ Phase 1 (Complete)
- Real-time QuickBooks webhook sync
- Parallel sync architecture (60% faster)
- Canonical rate resolution
- Frozen financial definitions
- Row-level security (25 tables)
- Database audit scripts
- Role-based dashboards

### 🚧 Phase 2 (In Progress)
- Permit submittal & approval tracking
- Task management (ClickUp replacement)
- Logged workflows & audit trails
- Enhanced financial insights
- Communication & collaboration tools

---

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- QuickBooks Online account (for sync features)

### Installation

```bash
# Clone the repo
git clone https://github.com/araybse/bsemanager.git
cd bsemanager

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Add your Supabase credentials
# NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Documentation

- **Setup:** See `docs/QUICKBOOKS_WEBHOOKS.md`
- **Rate Logic:** See `docs/RATE_RESOLUTION.md`
- **Financial Metrics:** See `docs/FINANCIAL_DEFINITIONS.md`
- **Sync Architecture:** See `docs/QB_SYNC_ARCHITECTURE.md`
- **Deployment:** See `docs/DEPLOYMENT_CHECKLIST.md`

---

## Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Production server

# Database
npm run db:migrate   # Run migrations
npm run db:reset     # Reset database

# Auditing
node scripts/audit/validate-data-integrity.mjs     # Data quality checks
node scripts/audit/compare-with-quickbooks.mjs     # QB comparison
node scripts/audit/test-rls-policies.mjs           # Security tests
```

---

## Architecture

- **Frontend:** Next.js 16 (App Router) + React 19
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Sync:** QuickBooks Online webhooks + REST API
- **Deploy:** Vercel (automatic from main branch)
- **Assets:** Logos in `public/logos/`

---

## Environment Variables

Required in `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# QuickBooks
QB_CLIENT_ID=your_qb_client_id
QB_CLIENT_SECRET=your_qb_client_secret
QB_WEBHOOK_TOKEN=your_webhook_token

# Security
INTERNAL_SYNC_TOKEN=generate_random_token_here

# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

Private - Blackstone Engineering

---

## Support

- **Issues:** Check GitHub Issues
- **Docs:** See `/docs` folder
- **Security:** Run audit scripts before deployment

---

**Built with ❤️ for Blackstone Engineering**
