# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GymBuddy is a React-based web application that helps gym partners coordinate their workout schedules automatically. The app uses ShadCN UI components, Supabase for backend services, and deploys to GitHub Pages.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Library**: ShadCN UI (Radix UI + Tailwind CSS v3)
- **Backend**: Supabase (PostgreSQL + Auth)
- **Deployment**: GitHub Pages
- **Build Tool**: Vite
- **Package Manager**: npm

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Project Structure

```
src/
├── components/
│   ├── ui/           # ShadCN UI components (auto-generated)
│   ├── calendar/     # Availability calendar components
│   ├── dashboard/    # Dashboard and analytics components
│   ├── auth/         # Authentication components
│   └── layout/       # Layout components
├── pages/            # Page components
├── hooks/            # Custom React hooks (useAuth, etc.)
├── services/         # API services (auth.ts)
├── types/            # TypeScript type definitions
└── lib/              # Utilities (utils.ts, supabase.ts)
```

## Key Configuration Files

- `components.json` - ShadCN UI configuration
- `tailwind.config.js` - Tailwind CSS configuration with ShadCN theme
- `vite.config.ts` - Vite configuration with path aliases
- `tsconfig.json` & `tsconfig.app.json` - TypeScript configuration
- `.github/workflows/deploy.yml` - GitHub Pages deployment workflow

## Environment Setup

1. Copy `.env.example` to `.env`
2. Set up Supabase project and add credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. Run the database schema from `supabase/schema.sql`

## Database Schema

The app uses the following main tables:
- `users` - User profiles and preferences
- `availability` - User availability slots
- `sessions` - Scheduled gym sessions
- `badges` - Achievement badges
- `user_badges` - User badge unlocks
- `challenges` - Periodic challenges
- `user_challenges` - User challenge progress

## Adding ShadCN Components

```bash
# Add individual components
npx shadcn@latest add [component-name]

# Example: Add a new component
npx shadcn@latest add select
```

## Authentication Flow

The app uses Supabase Auth with:
- Email/password authentication
- Google OAuth integration
- Row Level Security (RLS) policies
- Automatic profile creation

## Development Notes

- All components use ShadCN UI with Tailwind CSS
- TypeScript is configured with strict mode
- Path aliases are set up (`@/` points to `src/`)
- Dark mode is supported through ShadCN theming
- The app is mobile-responsive

## Deployment

- Automatic deployment to GitHub Pages via GitHub Actions
- Builds are triggered on push to main branch
- Base path is configured for `/GymBuddy/` in vite.config.ts

## Future Implementation

The basic foundation is complete. Next features to implement:
1. Availability calendar interface
2. Session matching algorithm
3. Notification system integration
4. Analytics dashboard
5. Gamification features