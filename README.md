# Meetly — Google Meet style video conferencing

A production-grade video meeting app: create a meeting, share the link, and join
with audio + video from any modern browser. Built with **Next.js (App Router)**,
**Tailwind CSS**, **Supabase** and **WebRTC**.

## Features

- 🎥 **HD audio & video** calls (WebRTC peer-to-peer mesh)
- 🔗 **Shareable meeting links** — anyone with the link can join, no account needed
- 🪟 **Pre-join lobby** with camera/mic preview and device selection
- 🖥️ **Screen sharing** with automatic spotlight layout
- 💬 **In-call chat** (persisted to Supabase)
- 👥 **Participants panel** with live mute / camera / sharing status
- 🔇 Mute mic / turn off camera, with status synced to everyone
- 📱 Responsive layout (desktop + mobile), Google-Meet-inspired dark UI

## How it works

- **Signaling** uses **Supabase Realtime** channels — `presence` to discover who
  is in the room and `broadcast` to exchange SDP offers/answers and ICE
  candidates. No separate signaling server is required.
- **Media** flows directly between browsers over WebRTC (a full mesh: one
  `RTCPeerConnection` per remote participant). This is ideal for small to medium
  meetings (roughly up to 6–8 participants). For larger rooms you would add an
  SFU such as LiveKit or mediasoup.
- **Persistence** (meetings + chat history) lives in **Supabase Postgres**.

## Prerequisites

- Node.js 18+ (tested on Node 22)
- A free [Supabase](https://supabase.com) project

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the dashboard go to **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. Go to **Project Settings → API** and copy the **Project URL** and the
   **anon public** key.

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

(Optional) Add TURN credentials for reliable connectivity behind strict
firewalls/NATs — see comments in `.env.local.example`.

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>. Click **New meeting**, then open the same link in
a second browser/device (or share it) to join.

> **Tip:** Browsers only allow camera/mic on `https://` or `localhost`. To test
> across devices on your LAN, deploy (e.g. Vercel) or use an HTTPS tunnel.

## Production build

```bash
npm run build
npm run start
```

### Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (and optional TURN) environment variables.
4. Deploy. HTTPS is provided automatically, so camera/mic work out of the box.

## Project structure

```
src/
  app/
    page.tsx                  # Home — create / join a meeting
    meeting/[code]/page.tsx   # Lobby → Room switch for a given meeting code
    layout.tsx, globals.css
  components/
    Lobby.tsx                 # Device preview + name entry before joining
    Room.tsx                  # Main meeting orchestrator (layout, toggles)
    VideoTile.tsx             # A single participant video/avatar tile
    Controls.tsx              # Bottom control bar
    ChatPanel.tsx             # In-call chat
    ParticipantsPanel.tsx     # People list + invite link
    Icons.tsx                 # SVG icon set
  hooks/
    useMeeting.ts             # WebRTC mesh + Supabase Realtime signaling
  lib/
    supabase.ts               # Supabase browser client
    types.ts                  # Shared TypeScript types
    utils.ts                  # Code generation, avatars, formatting
supabase/
  schema.sql                  # Database schema + RLS policies
```

## Security notes

This app uses **link-based access** (anyone with the code can join), so the RLS
policies in `schema.sql` allow the anonymous role to read/write meetings and
chat. If you need private meetings, add [Supabase
Auth](https://supabase.com/docs/guides/auth) and tighten the policies to require
authenticated users / membership checks.

## License

MIT
