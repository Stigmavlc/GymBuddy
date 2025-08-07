# 💪 GymBuddy

A gym buddy coordination app that automatically schedules workout sessions between partners with gamification and smart notifications.

## Features

- 📅 **Smart Scheduling**: Automatic coordination of gym sessions between partners
- 🎮 **Gamification**: Badges, streaks, and achievements to keep you motivated
- 📱 **Multi-Channel Notifications**: SMS, push, and email notifications
- 📊 **Analytics Dashboard**: Track your progress and workout statistics
- 🌙 **Dark Mode**: Built-in dark/light theme support
- 📱 **Mobile Responsive**: Works perfectly on all devices

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Library**: ShadCN UI (Radix UI + Tailwind CSS)
- **Backend**: Serverless functions (Vercel/Netlify)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Notifications**: Twilio (SMS) + OneSignal (Push)
- **Calendar Integration**: Google Calendar API
- **Deployment**: GitHub Pages

## Development

### Prerequisites

- Node.js 20+
- npm or pnpm

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

### Project Structure

```
src/
├── components/
│   ├── ui/           # ShadCN UI components
│   ├── calendar/     # Availability calendar components
│   ├── dashboard/    # Dashboard and analytics
│   ├── auth/         # Authentication components
│   └── layout/       # Layout components
├── pages/            # Page components
├── hooks/            # Custom React hooks
├── services/         # API services
├── types/            # TypeScript type definitions
└── lib/              # Utilities and helpers
```

## Deployment

The app is automatically deployed to GitHub Pages when changes are pushed to the main branch.

- **Live Demo**: https://yourusername.github.io/GymBuddy/
- **Staging**: Deployed from pull requests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.