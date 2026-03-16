# Milestone Rewards — Next.js App

## Quick Deploy to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/milestone-rewards.git
git push -u origin main
```

### 2. Deploy on Vercel
1. Go to https://vercel.com
2. Click "Import Project" → select your GitHub repo
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click "Deploy"

### 3. Local Development
```bash
# Copy env template and fill in your keys
cp .env.local.example .env.local

# Install dependencies
npm install

# Run dev server
npm run dev
```

Open http://localhost:3000

## What's Inside
- `app/page.tsx` — The entire app (auth, setup, tracker, journal, settings)
- `lib/api.ts` — All Supabase API calls
- `lib/supabase.ts` — Supabase client
- `lib/themes.ts` — Theme definitions
- `app/globals.css` — All animations
- `public/icon.png` — App icon (md. logo)
- `public/manifest.json` — PWA manifest

## Features
- Email sign up / sign in
- 4-step journey setup (name, weight, milestones, theme)
- Partner invite codes
- Realtime sync across devices
- Sequential milestone locking
- Themed confetti per milestone
- Fireworks finale
- Journal with weight/mood/notes
- 4 color themes (Rose, Lavender, Mint, Sunset)
- PWA — add to home screen
