# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this app is

The **user** (attendee) app for an event management coursework project, built with Expo SDK 58 + Expo Router (TypeScript, strict). Users browse events, search them by name or date, and mark favourites. Keep the code simple and beginner-readable: plain `useState`/`useEffect`, `StyleSheet`, no state libraries or extra abstractions.

A separate native **Android admin app** creates events and uploads them to a PHP/MySQL cloud service. This app only **reads** from that service. The service lives outside this repo at `C:\laragon\www\eventmanagementapi` (served by Laragon Apache/MySQL).

## Commands

```bash
npx expo start            # dev server; press a (Android) or w (web)
npx tsc --noEmit          # typecheck
npm run lint              # eslint src __tests__ (`npx expo lint` errors on the ESLint version check here)
npm test                  # all Jest tests
npx jest __tests__/events-screen.test.tsx -t "searches by name"   # one test
npx expo export --platform android --output-dir <tmp dir>   # verify the bundle builds
```

The tests are in `__tests__/` (jest-expo preset + @testing-library/react-native v14, where `render` and `fireEvent.*` are async and must be awaited). `connection.test.ts` calls the **real** API at `http://localhost/eventmanagementapi`, so Laragon must be running. jest-expo stubs the global `fetch`, so that file installs a small `http`-based fetch. The other suites mock `getEvents`/`fetch`/AsyncStorage. TypeScript 6 doesn't load `@types` automatically, which is why `tsconfig.json` lists `"types": ["jest", "node"]`.

PHP API tests: `php tests/getevents_test.php` (run from the API folder; needs Apache running).

`npm run reset-project` points to `scripts/reset-project.js`, which has been deleted.

## Architecture

- `src/app/` holds the Expo Router routes. Right now `_layout.tsx` is a single `Stack`, and `index.tsx` is the only screen: search inputs, an All/Favourites toggle and the event `FlatList`. Non-route code lives directly in `src/`.
- `src/api.ts` contains `API_URL` and `getEvents(name, date)`, which calls `GET {API_URL}/getevents.php?name=&date=`. `API_URL` takes its host from `Constants.expoConfig.hostUri` (the dev machine's LAN IP that Expo serves from), and falls back to `localhost` on web and in Jest. Don't go back to `10.0.2.2`: in Expo Go on the emulator, the app's requests to it fail with ConnectException, even though `adb shell` can reach it. Requests time out after 10s.
- `src/favourites.ts` stores favourite event IDs as a JSON array in AsyncStorage (key `favourite_event_ids`). Favourites stay on the device and are never sent to the server. The "Favourites" view filters the events already loaded from the server, so a favourite that the current search hides won't appear.

### Server contract (`getevents.php`)

- The response is `{"success":true,"events":[...]}`. On error it is `{"success":false,"error":{"code","message"}}` with a 4xx/5xx status.
- Event fields: `id`, `name`, `date` (`DD/MM/YYYY`), `location`, `organiser`, `type`, `status`, `amount` (number), `description`, `contactEmail`, `contactPhone`.
- `id` is a string of the form `"<deviceId>-<localId>"`, because different admin devices can reuse the same local ID. Treat it as opaque.
- The `date` filter must be exactly `DD/MM/YYYY`; anything else returns 422. The `name` filter does a substring (`LIKE`) match.
- Data comes from the `cloud_events` table, which `uploadevent.php` fills from the admin app's full-snapshot uploads. If an admin re-uploads without an event, that event disappears from this app.
- The API has no authentication. Treat it as a local or development service.
