# Convoi 🛣️

> Drive together. Arrive together.

**Convoi** is a cross-platform mobile app for groups travelling together by car (a _convoy_). It keeps everyone connected on long, multi-car road trips: live GPS sharing, coordinated stops, an AI-powered trip planner, in-app turn-by-turn navigation, and fuel-price comparison.

Built as a bachelor thesis project by Eren Sahbaz (Erasmushoegeschool Brussel - MCT) with **React Native + Expo** and a **Supabase** backend.

> The npm package / repository is still named `konvoy`; the product name is **Convoi**.

---

## ✨ Features

- **Live convoy map** — every member's vehicle is shared in real time over Supabase Realtime, with heading, speed and online / weak-signal / offline status.
- **AI trip planner** — a multi-step wizard (origin, destination, days, cars, stop preferences, overnight style) that generates **3 complete day-by-day routes** (Fast / Comfort / Leisure) using a Large Language Model. Stops are geocoded to real Google Places, geographically re-ordered, and fuel stops spaced realistically.
- **In-app navigation** — a full-screen, Waze-style turn-by-turn screen (heading-up map, route polyline that follows the road, road-snapped position marker, live speed, instruction banner) powered by the Google Directions API.
- **Coordinated stops** — propose, confirm, drag-to-reorder and mark arrival at stops; the convoy only advances to the next stop once everyone has arrived.
- **Status broadcasts & SOS** — quick status buttons ("running late", "fuel stop", "emergency"…) broadcast to all members in real time.
- **Fuel price overlay** — compare fuel prices along the route.
- **Authentication** — anonymous (guest) sessions, email/password, and Google OAuth via Supabase Auth.

---

## 🧱 Tech stack

| Layer      | Technology                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework  | [Expo](https://docs.expo.dev/) SDK 54 · [React Native](https://reactnative.dev/) 0.81 · [React](https://react.dev/) 19                                                                |
| Language   | [TypeScript](https://www.typescriptlang.org/) 5.9 (strict)                                                                                                                            |
| Routing    | [Expo Router](https://docs.expo.dev/router/introduction/) (file-based)                                                                                                                |
| State      | [Zustand](https://zustand.docs.pmnd.rs/)                                                                                                                                              |
| Backend    | [Supabase](https://supabase.com/docs) — Postgres, Auth, Realtime, RLS                                                                                                                 |
| Maps & nav | [react-native-maps](https://github.com/react-native-maps/react-native-maps) + [Google Maps Platform](https://developers.google.com/maps/documentation) (Directions, Places, Maps SDK) |
| AI planner | [Groq API](https://console.groq.com/docs) running [Llama 3.3 70B](https://console.groq.com/docs/models) (OpenAI-compatible, JSON mode)                                                |
| Location   | [expo-location](https://docs.expo.dev/versions/latest/sdk/location/) (BestForNavigation)                                                                                              |
| Animation  | [react-native-reanimated](https://docs.swmansion.com/react-native-reanimated/) + [gesture-handler](https://docs.swmansion.com/react-native-gesture-handler/)                          |
| Misc       | expo-haptics · expo-auth-session · [AsyncStorage](https://react-native-async-storage.github.io/async-storage/) · react-native-draggable-flatlist                                      |

---

## 🚀 Getting started

### Prerequisites

- Node.js 18+
- [Expo Go](https://expo.dev/go) on a physical device, or an Android / iOS emulator
- A Supabase project, a Google Maps Platform key, and a Groq API key

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, create the schema (tables: `users`, `convoys`, `convoy_members`, `live_positions`, `stops`, `stop_arrivals`, `stop_votes`, `status_events`, `notifications`).
3. Add the real-time tables to the publication so `postgres_changes` events are delivered:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE stops;
   -- repeat for live_positions, convoy_members, stop_arrivals, status_events
   ```
4. The Supabase URL and anon key are configured in `src/lib/supabase.ts`.

### 3. Configure environment

Create a `.env` file in the project root. `EXPO_PUBLIC_*` variables are inlined at bundle time, so re-run with `--clear` after editing them.

```env
EXPO_PUBLIC_GOOGLE_MAPS_KEY=your_directions_api_key
EXPO_PUBLIC_GOOGLE_PLACES_KEY=your_places_api_key
EXPO_PUBLIC_GROQ_KEY=your_groq_api_key
```

> For native builds, the Google **Maps SDK** key also goes in `app.json`
> (`ios.config.googleMapsApiKey` / `android.config.googleMaps.apiKey`).

### 4. Start the app

```bash
npx expo start --clear      # --clear is needed after .env or dependency changes
```

Scan the QR code with the **Expo Go** app on your phone.

---

## 📁 Project structure

```
app/                       # Expo Router screens (file-based routing)
  _layout.tsx              # Root layout: auth bootstrap + route protection
  index.tsx                # Home
  auth/                    # Sign in / sign up
  onboarding/              # Onboarding, permissions, profile, privacy
  plan/                    # AI trip-planner wizard (step1–step5 + results)
  convoy/
    create.tsx  join.tsx   # Create / join a convoy
    [id]/
      overview.tsx         # Trip overview (route timeline, distances, crew)
      lobby.tsx  map.tsx   # Lobby + live map
      stops.tsx            # Stop management (propose / reorder / arrive)
      navigate.tsx         # In-app turn-by-turn navigation
      summary.tsx          # Post-trip summary
  convoy/fuel/             # Fuel price overlay
src/
  lib/
    supabase.ts            # Supabase client
    auth.ts                # User row bootstrap
    gemini.ts              # LLM wrapper (Groq, JSON mode, retries)
    planner.ts             # AI route generation + fuel-stop thinning
    places.ts              # Google Places geocoding
    directions.ts          # Google Directions driving distances (cached)
    geo.ts                 # Haversine + nearest-neighbour stop ordering
    tripStats.ts
  store/                   # Zustand stores (user, plan)
  components/              # Reusable UI (neumorphic design system)
  constants/theme.ts       # Colors, spacing, typography tokens
  types/index.ts           # Domain model
```

---

## 🎨 Design tokens

| Token       | Value     |
| ----------- | --------- |
| Background  | `#0d0d0d` |
| Card        | `#161616` |
| Elevated    | `#1f1f1f` |
| Danger      | `#E24B4A` |

---

## 📚 Sources & References

The libraries, APIs and algorithms this project is built on:

1. **Expo — documentation & SDK** — https://docs.expo.dev/
2. **React Native — documentation** — https://reactnative.dev/docs/getting-started
3. **React — documentation** — https://react.dev/
4. **TypeScript — documentation** — https://www.typescriptlang.org/docs/
5. **Expo Router — file-based routing** — https://docs.expo.dev/router/introduction/
6. **Zustand — state management** — https://zustand.docs.pmnd.rs/
7. **Supabase — Database, Auth & Realtime** — https://supabase.com/docs
8. **supabase-js — JavaScript client reference** — https://supabase.com/docs/reference/javascript/introduction
9. **react-native-maps** — https://github.com/react-native-maps/react-native-maps
10. **Google Maps Platform — Directions API** — https://developers.google.com/maps/documentation/directions/overview
11. **Google Maps Platform — Places API** — https://developers.google.com/maps/documentation/places/web-service/overview
12. **Google — Encoded Polyline Algorithm Format** — https://developers.google.com/maps/documentation/utilities/polylinealgorithm
13. **Groq — API & supported models (Llama 3.3 70B)** — https://console.groq.com/docs/models
14. **Expo Location SDK** — https://docs.expo.dev/versions/latest/sdk/location/
15. **React Native Reanimated** — https://docs.swmansion.com/react-native-reanimated/
16. **Haversine formula (great-circle distance)** — https://en.wikipedia.org/wiki/Haversine_formula
17. **Nearest-neighbour heuristic (route ordering)** — https://en.wikipedia.org/wiki/Nearest_neighbour_algorithm

---

## 📝 License & academic note

This project was developed as a bachelor thesis. It is provided for educational and demonstration purposes. All third-party trademarks (Google, Supabase, Groq, Expo) belong to their respective owners.
