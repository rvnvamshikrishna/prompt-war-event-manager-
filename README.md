# 🏟️ Smart Venue Assistant — Hack2Skill Prompt Wars Submission

> An AI-powered, offline-capable Progressive Web App (PWA) that transforms the attendee experience at large-scale sporting events.

---

## 🌎 Live Prototype
**[https://smart-venue-assistant-893417719749.us-central1.run.app](https://smart-venue-assistant-893417719749.us-central1.run.app)**

---

## 1. Chosen Vertical

**Smart Events & Venue Management**

Designed for large-scale sporting events, concerts, and festivals where crowd congestion, poor connectivity, and lack of real-time information are the primary pain points for both attendees and organizers.

---

## 2. Problem Statement

Attendees at major sporting venues consistently face:
- 📡 **Network blackouts** — cellular towers get overwhelmed by 50,000+ simultaneous users
- 🍔 **Unknown wait times** — no way to find the shortest food/restroom queue without physically walking there
- 🗺️ **Poor wayfinding** — stadium layouts are complex and static paper maps are useless
- 📢 **Missed announcements** — PA systems are inaudible over crowd noise
- 🧑‍💼 **Slow admin response** — organizers can't push updates without developer help

---

## 3. Solution Architecture

Two interconnected applications share a single Google Firebase Realtime Database as the live data layer:

```
┌─────────────────────┐        Firebase Realtime DB        ┌──────────────────────┐
│   Admin Portal      │  ──── push(venue_config/pins) ───▶ │  Attendee PWA        │
│   (admin.html)      │                                     │  (index.html)        │
│                     │ ◀─── onValue listener updates ───  │                      │
│  • Upload map       │                                     │  • Gemini Chatbot    │
│  • Drop map pins    │                                     │  • Live Dashboard    │
│  • Set wait times   │                                     │  • Interactive Map   │
│  • Live Congestion  │                                     │  • Offline PWA       │
│    Tracker (±5 min) │                                     │  • Haptic Alerts     │
└─────────────────────┘                                     └──────────────────────┘
```

---

## 4. Google Services Used

| Service | How It's Used |
|---|---|
| **Google Gemini 1.5 Flash** | Powers the natural-language Smart Assistant chatbot. Given user intent + live pin data as context, it determines the best location to recommend and returns a JSON response with a conversational reply and the exact destination pin ID. |
| **Google Firebase Realtime Database** | Acts as the live data backbone. The Admin Portal pushes wait-time updates to Firebase; the Attendee PWA subscribes via `onValue()`, so every attendee's screen updates in real-time (<1 second) when congestion changes. |

---

## 5. How the Solution Works

### Attendee Flow
1. Attendee opens the PWA on their phone — it loads/works **offline** thanks to the Service Worker cache.
2. They enter any ticket ID (e.g., `VIP-44`) to authenticate and personalise the session.
3. The **Smart Assistant** tab opens. They type naturally ("I'm hungry, where should I go?") or tap a quick-action chip.
4. **If Gemini is configured:** The query is sent to Gemini API with the full venue context (all pin names, types, current wait times). Gemini returns the best recommendation + draws an SVG route on the map.
5. **If Gemini is not configured:** A local keyword-pattern fallback assistant responds instantly offline.
6. The **Live Dashboard** shows all mapped amenities with colour-coded wait-time indicators (🟢 Green < 5 min, 🟡 Yellow 5–15 min, 🔴 Red > 15 min) that update live from Firebase.
7. The **Heatmap / Map** view shows the uploaded venue map with interactive beacons at every configured location.
8. **Dynamic Island alerts** vibrate the device and display critical event broadcasts.

### Admin Flow
1. Organiser opens `admin.html` on a tablet or laptop.
2. Uploads a stadium map (PNG/WebP/SVG) and clicks to drop pins at exact locations.
3. Fills in event details (name, schedule, WiFi password, emergency contact).
4. Pastes Gemini API Key and Firebase URL into the **Google API Configurations** section.
5. Clicks **Save & Publish** — config is pushed to Firebase and instantly appears on all attendee devices.
6. Uses the **Live Congestion Tracker** (±5 min buttons) to manually adjust wait times in real-time, simulating IoT sensor data input.

---

## 6. Key Features

- ✅ **Offline-first PWA** — works with zero cell signal via Service Worker + LocalStorage cache
- ✅ **Gemini AI Chatbot** — natural language queries with full venue context as system prompt
- ✅ **Firebase Realtime Sync** — sub-second wait-time updates across all devices
- ✅ **Live Congestion Tracker** — admin manually updates wait times, instantly reflecting on attendee dashboards
- ✅ **SVG Routing** — chatbot recommendations visually draw a path on the map
- ✅ **ARIA Accessibility** — `aria-live`, `aria-label`, `role` attributes on all dynamic content
- ✅ **Dark/Light Theme** — full theme toggle with CSS custom properties
- ✅ **Haptic Feedback** — device vibration pattern on alerts and authentication
- ✅ **Zero Node Modules** — all dependencies loaded via CDN; repo size stays well under 10MB

---

## 7. Assumptions Made

1. **IoT Simulation:** Real wait times in production would come from physical turnstiles or thermal cameras feeding directly into Firebase. For this demo, venue staff use the Admin Portal's Live Congestion Tracker (±5 min buttons) to input real-world observations. The Firebase pipeline is production-ready for hardware integration.

2. **Authentication:** The ticket ID login is a simplified mock for the demo. A production system would validate ticket IDs against a backend database or ticketing API (e.g., Eventbrite, Paytm Insider).

3. **Indoor Positioning:** True GPS doesn't work indoors. The current routing draws from a relative center point. A production deployment would use QR checkpoint scanning or BLE beacons to set the user's exact starting coordinate.

4. **Firebase Security Rules:** For this demo, Firebase rules are assumed to be set to open read (for attendees) and write (for admin). A production setup would use Firebase Authentication to restrict admin write access.

---

## 8. Setup & Running Locally

> **No build step required.** This is a pure HTML/CSS/JS PWA.

### Prerequisites
- A modern browser (Chrome recommended for full PWA + vibration support)
- A local HTTP server (e.g., VS Code Live Server, or `npx serve .`)

### Step 1: Clone the Repository
```bash
git clone https://github.com/rvnvamshikrishna/prompt-war-event-manager-.git
cd prompt-war-event-manager-
```

### Step 2: Serve Locally (Optional)
```bash
# Using npx serve
npx serve .
```

### 🛰️ Live Cloud URL (Recommended)
You can access the hosted version instantly at:
**[https://smart-venue-assistant-893417719749.us-central1.run.app](https://smart-venue-assistant-893417719749.us-central1.run.app)**

### Step 3: Configure Admin Portal
1. Open `http://localhost:3000/admin.html`
2. Fill in event details and upload a stadium map image
3. Click on the map to drop pins (food stalls, restrooms, gates)
4. In **Google API Configurations**:
   - Paste your **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Paste your **Firebase Realtime Database URL** from [Firebase Console](https://console.firebase.google.com)
5. Click **Save & Publish Event**

### Step 4: Open Attendee App
1. Open `http://localhost:3000/index.html`
2. Enter any ticket ID (e.g., `VIP-44`) and tap **Connect & Authenticate**
3. Ask the assistant anything: _"Where's the nearest food with a short wait?"_

### Firebase Setup (for Live Sync)
1. Go to [Firebase Console](https://console.firebase.google.com) → New Project
2. Enable **Realtime Database** → Start in test mode
3. Copy the database URL (e.g., `https://your-project-default-rtdb.firebaseio.com`)
4. Paste it into the Admin Portal's Firebase URL field

---

## 9. File Structure

```
prompt-war-event-manager-/
├── index.html      # Attendee PWA (Smart Assistant, Dashboard, Map)
├── app.js          # Attendee app logic (Firebase sync, Gemini chat, routing)
├── admin.html      # Admin Configuration Portal
├── admin.js        # Admin logic (map pins, live congestion, Firebase push)
├── style.css       # Shared design system (dark/light theme, animations)
├── manifest.json   # PWA manifest (installable on home screen)
├── sw.js           # Service Worker (offline caching)
└── README.md       # This file
```

---

## 10. Evaluation Criteria Mapping

| Criteria | Implementation |
|---|---|
| **Code Quality** | Modular functions, clear comments, ES modules, consistent naming |
| **Security** | API keys stored in LocalStorage only, never hardcoded in source; `type="password"` field for Gemini key |
| **Efficiency** | Firebase CDN (no npm), single HTTP request per chat message, `onValue` (WebSocket, not polling) |
| **Testing** | Works without API keys (full offline fallback), graceful error handling in Gemini/Firebase init |
| **Accessibility** | `aria-live`, `aria-label`, `role="region"` on dynamic cards, keyboard navigable, high-contrast status colors |
| **Google Services** | Gemini 1.5 Flash for intelligent chat reasoning + Firebase Realtime Database for live sync |

---

*Built with ❤️ using Google Antigravity for the Hack2Skill Prompt Wars Challenge.*
