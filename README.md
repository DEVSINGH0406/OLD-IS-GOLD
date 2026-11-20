# 📻 Old is Gold - Spotify Clone & Real Music Streaming App

A modern, responsive music web application inspired by Spotify with a golden retro aesthetic. Powered by the official YouTube Audio Engine and instant serverless search for any song in the world.

![Old is Gold Banner](https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80)

---

## ✨ Features

- 🔍 **Instant Universal Search (ASAP)**:
  - Search any song, artist, or album with sub-second response times.
  - Powered by a Vercel Serverless Function (`/api/search`) using YouTube's direct API with zero-config deployment.
  - Instant **0ms client-side memory cache** for instant responses as you type.
  - Paste any direct YouTube URL (e.g. `https://youtube.com/watch?v=...`) or 11-character Video ID to stream immediately.
- 🎵 **Real Audio Engine**:
  - Streams full audio tracks via the official YouTube IFrame API.
  - 100% synchronized playback controls: Play/Pause, Timeline seek, Volume drag, Mute/Unmute.
  - Shuffle, Repeat (One / All / Off), and Next / Previous queue navigation.
- 📻 **Curated Vintage & Golden Playlists**:
  - Over 183+ preloaded evergreen tracks across Retro Bollywood, Classic Rock, Ghazals, and Golden Era.
  - Create and manage custom user collections stored in `localStorage`.
  - Save tracks to Golden Favorites with the interactive Heart button.
- 📝 **Synced Lyrics & Play Queue Panel**:
  - Real-time lyrics highlighting synced with playback position.
  - Interactive right-side drawer panel with queue reordering and playback controls.
- ⌨️ **Keyboard Shortcuts**:
  - Press `?` anywhere to view keyboard shortcuts.
  - `Space` to Play/Pause, `←`/`→` to Seek, `↑`/`↓` for Volume, `M` for Mute, `L` to Like, `N`/`P` for Next/Previous.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (Modern Glassmorphism & Vinyl Grooves), Vanilla JavaScript (ES Modules).
- **Bundler**: [Vite](https://vitejs.dev/) for fast builds and optimized asset chunks.
- **Backend / Serverless**: Node.js Vercel Serverless Functions in `/api` for live search & lyrics.
- **Audio Stream**: YouTube IFrame Player API.

---

## 🚀 Getting Started Locally

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/DEVSINGH0406/OLD-IS-GOLD.git
   cd OLD-IS-GOLD
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:3500`.

4. Build for production:
   ```bash
   npm run build
   ```

---

## 🌐 Deploy to Vercel

1. Push this repository to GitHub.
2. Import the project in [Vercel](https://vercel.com/).
3. Framework Preset: **Vite**
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Click **Deploy**. Vercel will automatically build the static frontend and deploy the `/api/search` serverless functions.

---

## 📜 License

MIT License. Designed with ❤️ for timeless music lovers.
