# Konvoy 🛣️

> Drive together. Arrive together.

A mobile app for groups travelling by convoy — live GPS sharing, coordinated stops, fuel cost optimization.

**Stack:** React Native + Expo + Supabase

---

## 🚀 Getting started

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase
1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. Go to **Settings → API** and copy your project URL and anon key

### 3. Configure environment
```bash
cp .env.local.example .env.local
```
Fill in your Supabase URL and anon key in `.env.local`.

### 4. Start the app
```bash
npx expo start
```
Scan the QR code with the **Expo Go** app on your phone.

---

## 📁 Project structure

```
konvoy/
├── app/                        # Screens (expo-router file-based routing)
│   ├── _layout.tsx             # Root navigation layout
│   ├── index.tsx               # Home / dashboard
│   ├── onboarding/
│   │   ├── index.tsx           # Welcome screen
│   │   ├── permissions.tsx     # Location & notification permissions
│   │   ├── profile.tsx         # Name, vehicle type, color
│   │   └── privacy.tsx         # Privacy settings
│   ├── convoy/
│   │   ├── create.tsx          # Create a new convoy (Sprint 2)
│   │   ├── join.tsx            # Join via QR or code (Sprint 2)
│   │   └── [id]/
│   │       ├── lobby.tsx       # Convoy lobby / member list (Sprint 2)
│   │       ├── map.tsx         # Live map screen (Sprint 3)
│   │       └── stops.tsx       # Stop planner (Sprint 3)
│   └── settings/
│       └── index.tsx           # Privacy & preferences
│
├── src/
│   ├── components/             # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── VehicleDot.tsx
│   ├── constants/
│   │   └── theme.ts            # Colors, spacing, typography
│   ├── hooks/                  # Custom React hooks (to be added)
│   ├── lib/
│   │   └── supabase.ts         # Supabase client
│   ├── store/                  # State management (to be added)
│   └── types/
│       └── index.ts            # TypeScript types (matches DB schema)
│
└── supabase/
    └── schema.sql              # Full database schema — run in Supabase SQL editor
```

---

## 🗺️ Sprint plan

| Sprint | Focus | Screens |
|--------|-------|---------|
| 1 ✅ | Scaffolding + onboarding | Welcome, Permissions, Profile, Privacy |
| 2 | Convoy create & join | Create convoy, Join (QR + code), Lobby |
| 3 | Live map | Map with dummy vehicles, GPS integration |
| 4 | Stops | Stop planner, voting, arrivals |
| 5 | Fuel & polish | Fuel price overlay, notifications, offline |

---

## 🎨 Design tokens

| Token | Value |
|-------|-------|
| Brand green | `#33a86d` |
| Background | `#0d0d0d` |
| Card | `#161616` |
| Elevated | `#1f1f1f` |
| Danger | `#E24B4A` |
