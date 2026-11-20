import { TRACKS, PLAYLISTS, GENRES } from './data/tracks.js';

// ============================================================================
// OLD IS GOLD - RETRO & CLASSIC EVERGREEN PLAYER
// Real YouTube Audio Streaming with 100% Synced Playback Controls
// ============================================================================
class OldIsGoldPlayerApp {
  constructor() {
    this.tracks = [...TRACKS];
    this.playlists = [...PLAYLISTS];
    this.genres = [...GENRES];

    this.currentTrack = this.tracks[0];
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = this.currentTrack.duration;
    this.volume = 0.85;
    this.isMuted = false;
    this.previousVolume = 0.85;
    this.isShuffle = false;
    this.repeatMode = 'off'; // 'off' | 'all' | 'one'

    // Local Storage for Likes
    const savedLikes = localStorage.getItem('oldisgold_liked_tracks');
    this.likedTrackIds = new Set(savedLikes ? JSON.parse(savedLikes) : [this.tracks[0].id, this.tracks[1]?.id]);

    // Navigation and View State
    this.activeView = 'home';
    this.activePlaylistId = null;
    this.activePanel = null; // null | 'lyrics' | 'queue'
    this.searchQuery = '';
    this.activeFilter = 'all';
    this.currentSearchSeq = 0;

    // Queue
    this.queue = [...this.tracks];
    this.queueIndex = 0;

    // Real YouTube Audio Engine
    this.ytPlayer = null;
    this.isPlayerReady = false;
    this.tickerId = null;

    // Timeline Drag State
    this.isDraggingProgress = false;
    this.isDraggingVolume = false;

    this.init();
  }

  init() {
    this.initYouTubePlayer();
    this.setupUIEventListeners();
    this.setupKeyboardShortcuts();
    this.renderSidebarPlaylists();
    this.updateLikedBadge();
    this.renderView('home');
    this.updatePlayerUI();
  }

  // ==========================================================================
  // REAL AUDIO ENGINE VIA YOUTUBE IFRAME API
  // ==========================================================================
  initYouTubePlayer() {
    const initPlayer = () => {
      if (window.YT && window.YT.Player) {
        this.ytPlayer = new window.YT.Player('ytPlayerContainer', {
          height: '200',
          width: '200',
          videoId: this.currentTrack.video_id,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0
          },
          events: {
            onReady: () => {
              this.isPlayerReady = true;
              this.ytPlayer.setVolume(this.volume * 100);
              console.log("Old is Gold Real Audio Engine Ready!");
            },
            onStateChange: (event) => {
              this.handleYTStateChange(event.data);
            },
            onError: (err) => {
              console.warn("YouTube player error:", err);
              this.showToast("Buffering next classic track...", "info");
              setTimeout(() => this.nextTrack(), 1500);
            }
          }
        });
      } else {
        setTimeout(initPlayer, 250);
      }
    };
    initPlayer();
  }

  handleYTStateChange(state) {
    // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
    if (state === window.YT.PlayerState.PLAYING) {
      this.isPlaying = true;
      this.updatePlayPauseIcon(true);
      this.startTimelineTicker();
    } else if (state === window.YT.PlayerState.PAUSED) {
      this.isPlaying = false;
      this.updatePlayPauseIcon(false);
      this.stopTimelineTicker();
    } else if (state === window.YT.PlayerState.ENDED) {
      this.isPlaying = false;
      this.updatePlayPauseIcon(false);
      this.stopTimelineTicker();
      this.handleTrackEnded();
    }
    this.refreshPlayingStatesInViews();
  }

  startTimelineTicker() {
    this.stopTimelineTicker();
    this.tickerId = setInterval(() => {
      if (this.ytPlayer && this.isPlayerReady && !this.isDraggingProgress) {
        const cur = this.ytPlayer.getCurrentTime() || 0;
        const dur = this.ytPlayer.getDuration() || this.currentTrack.duration;
        this.currentTime = cur;
        if (dur > 0) this.duration = dur;
        this.updateTimelineUI();
        if (this.activePanel === 'lyrics') {
          this.highlightCurrentLyric();
        }
      }
    }, 250);
  }

  stopTimelineTicker() {
    if (this.tickerId) {
      clearInterval(this.tickerId);
      this.tickerId = null;
    }
  }

  playTrack(track, queueList = null) {
    if (queueList) {
      this.queue = [...queueList];
      this.queueIndex = this.queue.findIndex(t => t.id === track.id);
      if (this.queueIndex === -1) this.queueIndex = 0;
    }

    this.currentTrack = track;
    this.currentTime = 0;
    this.duration = track.duration;

    this.updatePlayerUI();
    this.refreshPlayingStatesInViews();

    if (this.ytPlayer && this.isPlayerReady && track.video_id) {
      this.ytPlayer.loadVideoById(track.video_id);
      this.ytPlayer.playVideo();
      this.isPlaying = true;
      this.updatePlayPauseIcon(true);
      this.startTimelineTicker();
    }

    if (this.activePanel === 'lyrics') this.renderLyricsPanel();
    if (this.activePanel === 'queue') this.renderQueuePanel();
  }

  togglePlayPause() {
    if (!this.ytPlayer || !this.isPlayerReady) {
      this.showToast("Loading audio player...", "info");
      return;
    }

    if (this.isPlaying) {
      this.ytPlayer.pauseVideo();
    } else {
      this.ytPlayer.playVideo();
    }
  }

  nextTrack() {
    if (this.isShuffle) {
      const randomIndex = Math.floor(Math.random() * this.queue.length);
      this.queueIndex = randomIndex;
    } else {
      this.queueIndex = (this.queueIndex + 1) % this.queue.length;
    }
    const next = this.queue[this.queueIndex];
    this.playTrack(next);
    this.showToast(`Playing: ${next.title}`);
  }

  prevTrack() {
    if (this.currentTime > 3) {
      this.seekTo(0);
      return;
    }
    this.queueIndex = (this.queueIndex - 1 + this.queue.length) % this.queue.length;
    const prev = this.queue[this.queueIndex];
    this.playTrack(prev);
    this.showToast(`Playing: ${prev.title}`);
  }

  handleTrackEnded() {
    if (this.repeatMode === 'one') {
      this.seekTo(0);
      if (this.ytPlayer) this.ytPlayer.playVideo();
    } else {
      this.nextTrack();
    }
  }

  seekTo(seconds) {
    this.currentTime = Math.max(0, Math.min(seconds, this.duration));
    if (this.ytPlayer && this.isPlayerReady) {
      this.ytPlayer.seekTo(this.currentTime, true);
    }
    this.updateTimelineUI();
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.isMuted = this.volume === 0;
    if (this.ytPlayer && this.isPlayerReady) {
      this.ytPlayer.setVolume(this.volume * 100);
      if (this.isMuted) this.ytPlayer.mute();
      else this.ytPlayer.unMute();
    }
    this.updateVolumeUI();
  }

  toggleMute() {
    if (this.isMuted) {
      this.setVolume(this.previousVolume > 0 ? this.previousVolume : 0.85);
      this.isMuted = false;
    } else {
      this.previousVolume = this.volume;
      this.setVolume(0);
      this.isMuted = true;
    }
  }

  toggleLikeTrack(trackId) {
    if (this.likedTrackIds.has(trackId)) {
      this.likedTrackIds.delete(trackId);
      this.showToast("Removed from Golden Favorites");
    } else {
      this.likedTrackIds.add(trackId);
      this.showToast("Saved to Golden Favorites! ✨", "success");
    }
    localStorage.setItem('oldisgold_liked_tracks', JSON.stringify([...this.likedTrackIds]));
    this.updateLikedBadge();
    this.updatePlayerUI();
    this.refreshPlayingStatesInViews();
    if (this.activeView === 'liked') {
      this.renderView('liked');
    }
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    const btn = document.getElementById('shuffleBtn');
    btn.classList.toggle('active', this.isShuffle);
    this.showToast(`Shuffle is ${this.isShuffle ? 'ON' : 'OFF'}`);
  }

  toggleRepeat() {
    if (this.repeatMode === 'off') {
      this.repeatMode = 'all';
      this.showToast('Repeat all is ON');
    } else if (this.repeatMode === 'all') {
      this.repeatMode = 'one';
      this.showToast('Repeat one is ON');
    } else {
      this.repeatMode = 'off';
      this.showToast('Repeat is OFF');
    }
    const btn = document.getElementById('repeatBtn');
    btn.classList.toggle('active', this.repeatMode !== 'off');
    btn.setAttribute('title', `Repeat mode: ${this.repeatMode}`);
  }

  // ==========================================================================
  // UI UPDATES & SYNC
  // ==========================================================================
  updatePlayerUI() {
    if (!this.currentTrack) return;

    document.getElementById('playerTitle').textContent = this.currentTrack.title;
    document.getElementById('playerArtist').textContent = this.currentTrack.artist;
    document.getElementById('playerCover').src = this.currentTrack.cover;

    // Heart icon
    const heartBtn = document.getElementById('playerHeartBtn');
    const isLiked = this.likedTrackIds.has(this.currentTrack.id);
    heartBtn.classList.toggle('liked', isLiked);

    this.updatePlayPauseIcon(this.isPlaying);
    this.updateTimelineUI();
    this.updateVolumeUI();
  }

  updatePlayPauseIcon(isPlaying) {
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');
    const equalizer = document.getElementById('audioEqualizer');

    if (isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      equalizer.classList.add('playing');
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      equalizer.classList.remove('playing');
    }
  }

  updateTimelineUI() {
    const currentLbl = document.getElementById('currentTimeLabel');
    const durationLbl = document.getElementById('durationLabel');
    const fill = document.getElementById('progressBarFill');
    const handle = document.getElementById('progressBarHandle');

    currentLbl.textContent = this.formatTime(this.currentTime);
    durationLbl.textContent = this.formatTime(this.duration);

    const percent = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
    fill.style.width = `${percent}%`;
    handle.style.left = `${percent}%`;
  }

  updateVolumeUI() {
    const fill = document.getElementById('volumeSliderFill');
    const handle = document.getElementById('volumeSliderHandle');
    const highIcon = document.getElementById('volumeHighIcon');
    const mutedIcon = document.getElementById('volumeMutedIcon');

    const percent = this.volume * 100;
    fill.style.width = `${percent}%`;
    handle.style.left = `${percent}%`;

    if (this.volume === 0 || this.isMuted) {
      highIcon.style.display = 'none';
      mutedIcon.style.display = 'block';
    } else {
      highIcon.style.display = 'block';
      mutedIcon.style.display = 'none';
    }
  }

  updateLikedBadge() {
    const badge = document.getElementById('likedCountBadge');
    if (badge) badge.textContent = this.likedTrackIds.size;
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // ==========================================================================
  // VIEW NAVIGATION & RENDERING
  // ==========================================================================
  renderSidebarPlaylists() {
    const container = document.getElementById('sidebarPlaylistList');
    container.innerHTML = this.playlists.map(pl => `
      <div class="playlist-item ${this.activePlaylistId === pl.id ? 'active' : ''}" data-id="${pl.id}">
        📻 ${pl.title}
      </div>
    `).join('');

    container.querySelectorAll('.playlist-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        this.renderView('playlist', id);
      });
    });
  }

  renderView(viewName, param = null) {
    this.activeView = viewName;
    const container = document.getElementById('viewContainer');
    const searchInputWrapper = document.getElementById('searchInputWrapper');
    const filterChips = document.getElementById('filterChips');

    // Update active nav button
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    if (viewName === 'search') {
      searchInputWrapper.style.display = 'flex';
      filterChips.style.display = 'flex';
    } else {
      searchInputWrapper.style.display = 'none';
      filterChips.style.display = 'flex';
    }

    if (viewName === 'home') {
      this.renderHomeView(container);
    } else if (viewName === 'search') {
      this.renderSearchView(container, this.searchQuery);
    } else if (viewName === 'playlist') {
      this.renderPlaylistView(container, param || this.playlists[0].id);
    } else if (viewName === 'liked') {
      this.renderLikedSongsView(container);
    } else if (viewName === 'library') {
      this.renderLibraryView(container);
    }

    container.scrollTop = 0;
  }

  // HOME VIEW
  renderHomeView(container) {
    const hour = new Date().getHours();
    let greeting = "Golden Evening";
    if (hour < 12) greeting = "Golden Morning";
    else if (hour < 18) greeting = "Golden Afternoon";

    const quickTracks = this.tracks.slice(0, 6);

    container.innerHTML = `
      <div class="content-section">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
          <h1 class="section-title"><span class="golden-text">${greeting}</span></h1>
          <span style="font-size: 13px; color: #f59e0b; font-weight: 700;">183+ Evergreen Classics</span>
        </div>
        
        <!-- Quick Play Grid -->
        <div class="quick-play-grid">
          ${quickTracks.map(track => `
            <div class="quick-play-card" data-track-id="${track.id}">
              <img src="${track.cover}" alt="${track.title}" />
              <div class="card-info">
                <div>${track.title}</div>
                <div style="font-size: 12px; color: var(--spotify-subtext); font-weight: 500;">${track.artist}</div>
              </div>
              <button class="play-hover-btn golden-play-btn" title="Play ${track.title}">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#000000">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>

        <!-- Featured Playlists Section -->
        <div class="section-header">
          <h2 class="section-title">Timeless Collections</h2>
        </div>
        <div class="cards-grid" style="margin-bottom: 36px;">
          ${this.playlists.map(pl => `
            <div class="music-card" data-playlist-id="${pl.id}">
              <div class="card-img-wrapper">
                <img src="${pl.cover}" alt="${pl.title}" />
                <button class="card-floating-play golden-play-btn" title="Play ${pl.title}">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="#000000">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
              <div class="card-title">${pl.title}</div>
              <div class="card-desc">${pl.description}</div>
            </div>
          `).join('')}
        </div>

        <!-- Evergreen Legends Section -->
        <div class="section-header">
          <h2 class="section-title">All-Time Golden Tracks</h2>
        </div>
        <div class="cards-grid">
          ${this.tracks.slice(6, 30).map(track => `
            <div class="music-card" data-track-id="${track.id}">
              <div class="card-img-wrapper">
                <img src="${track.cover}" alt="${track.title}" />
                <button class="card-floating-play golden-play-btn" title="Play ${track.title}">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="#000000">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
              <div class="card-title">${track.title}</div>
              <div class="card-desc">${track.artist} • ${track.genre}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Attach listeners
    container.querySelectorAll('.quick-play-card, .music-card[data-track-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.trackId;
        const track = this.tracks.find(t => t.id === id);
        if (track) this.playTrack(track, this.tracks);
      });
    });

    container.querySelectorAll('.music-card[data-playlist-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.playlistId;
        this.renderView('playlist', id);
      });
    });
  }

  // Extract YouTube ID from URL or raw ID
  extractYouTubeId(input) {
    if (!input) return null;
    const trimmed = input.trim();
    const match = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }
    return null;
  }

  // Play direct YouTube link or ID
  async playDirectYouTube(rawInput) {
    const videoId = this.extractYouTubeId(rawInput);
    if (!videoId) {
      this.showToast("Please enter a valid YouTube link or 11-char Video ID", "info");
      return;
    }

    let title = `YouTube Track (${videoId})`;
    let artist = "YouTube Stream";
    let cover = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // Try to get title & author via public noembed API (supports CORS)
    try {
      const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.title) title = data.title;
        if (data.author_name) artist = data.author_name;
      }
    } catch (e) {
      console.log('Noembed fetch error:', e);
    }

    const newTrack = {
      id: `yt-${videoId}`,
      video_id: videoId,
      title: title,
      artist: artist,
      album: title,
      duration: 210,
      durationFormatted: "3:30",
      duration_formatted: "3:30",
      cover: cover,
      genre: "Golden Era & Hits",
      color: "#f59e0b",
      audio: `https://www.youtube.com/watch?v=${videoId}`
    };

    if (!this.tracks.find(t => t.id === newTrack.id)) {
      this.tracks.unshift(newTrack);
    }

    this.playTrack(newTrack, this.tracks);
    this.showToast(`Playing "${title}" ✨`, "success");
    if (this.activeView === 'search') {
      this.renderSearchView(document.getElementById('viewContainer'), title);
    }
  }

  // SEARCH VIEW
  renderSearchView(container, query = '') {
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      container.innerHTML = `
        <div class="content-section">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
            <h2 class="section-title">Browse Vintage & Golden Genres</h2>
            <span style="font-size: 13px; color: var(--spotify-subtext);">Search any song, artist, or YouTube link</span>
          </div>
          <div class="genre-cards-grid">
            ${this.genres.map(genre => `
              <div class="genre-card" style="background-color: ${genre.color};" data-genre-id="${genre.id}">
                <h3>${genre.name}</h3>
                <span class="genre-emoji">${genre.icon}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      container.querySelectorAll('.genre-card').forEach(card => {
        card.addEventListener('click', () => {
          const genreId = card.dataset.genreId;
          const genre = this.genres.find(g => g.id === genreId);
          if (genre) {
            const input = document.getElementById('searchInput');
            input.value = genre.name;
            this.searchQuery = genre.name;
            this.renderSearchView(container, genre.name);
          }
        });
      });
      return;
    }

    // Direct YouTube link or ID pasted into the main search box
    const directVideoId = this.extractYouTubeId(query);
    if (directVideoId) {
      container.innerHTML = `
        <div class="content-section" style="padding: 40px 20px; text-align: center;">
          <div class="golden-search-loader" style="margin: 0 auto 16px; width: 40px; height: 40px; border: 3px solid rgba(245,158,11,0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spinVinyl 1s linear infinite;"></div>
          <h2 style="font-size: 22px; margin-bottom: 8px;">Loading YouTube track...</h2>
          <p style="color: var(--spotify-subtext);">Fetching details for ID: ${directVideoId}</p>
        </div>
      `;
      this.playDirectYouTube(query);
      return;
    }

    let matchingTracks = this.tracks.filter(t => 
      t.title.toLowerCase().includes(trimmed) || 
      t.artist.toLowerCase().includes(trimmed) ||
      t.album.toLowerCase().includes(trimmed) ||
      t.genre.toLowerCase().includes(trimmed)
    );

    const renderResults = (tracksList, isLiveLoading = false) => {
      const topResult = tracksList[0];

      container.innerHTML = `
        <div class="content-section">
          ${isLiveLoading ? `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding: 10px 16px; background: rgba(245,158,11,0.1); border-radius: 8px; border: 1px solid rgba(245,158,11,0.2);">
              <div style="width: 16px; height: 16px; border: 2px solid rgba(245,158,11,0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spinVinyl 1s linear infinite;"></div>
              <span style="font-size: 13px; color: #fbbf24; font-weight: 600;">Searching YouTube Music for more new results...</span>
            </div>
          ` : ''}
          <div class="search-results-top">
            <!-- Top Result -->
            <div>
              <h2 class="section-title" style="margin-bottom: 16px;">Top Result</h2>
              <div class="top-result-card" data-track-id="${topResult.id}">
                <img src="${topResult.cover}" alt="${topResult.title}" />
                <h3>${topResult.title}</h3>
                <div class="artist-badge">${topResult.artist} • <span style="background: rgba(245,158,11,0.25); color: #fbbf24; padding: 2px 6px; border-radius: 4px; font-size: 11px;">CLASSIC</span></div>
                <button class="top-result-play-btn golden-play-btn" title="Play">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="#000000">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Matching Songs -->
            <div>
              <h2 class="section-title" style="margin-bottom: 16px;">Songs</h2>
              <table class="tracklist-table">
                <tbody>
                  ${tracksList.slice(0, 4).map((track, i) => `
                    <tr class="track-row ${this.currentTrack.id === track.id ? 'active' : ''}" data-track-id="${track.id}">
                      <td class="col-num">${i + 1}</td>
                      <td class="col-title">
                        <img class="track-mini-thumb" src="${track.cover}" alt="${track.title}" />
                        <div class="track-meta">
                          <span class="track-row-title">${track.title}</span>
                          <span class="track-row-artist">${track.artist}</span>
                        </div>
                      </td>
                      <td class="col-duration">${track.durationFormatted || '3:45'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <h2 class="section-title" style="margin-bottom: 16px;">All Matching Results (${tracksList.length})</h2>
          <div class="cards-grid">
            ${tracksList.map(track => `
              <div class="music-card" data-track-id="${track.id}">
                <div class="card-img-wrapper">
                  <img src="${track.cover}" alt="${track.title}" />
                  <button class="card-floating-play golden-play-btn" title="Play ${track.title}">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="#000000">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                </div>
                <div class="card-title">${track.title}</div>
                <div class="card-desc">${track.artist}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      container.querySelectorAll('[data-track-id]').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.trackId;
          const track = tracksList.find(t => t.id === id) || this.tracks.find(t => t.id === id);
          if (track) this.playTrack(track, tracksList);
        });
      });
    };

    const renderNoResults = () => {
      container.innerHTML = `
        <div class="content-section" style="text-align: center; padding: 50px 20px; max-width: 620px; margin: 0 auto;">
          <div style="font-size: 42px; margin-bottom: 14px;">📻</div>
          <h2 style="font-size: 22px; margin-bottom: 8px; color: #fff;">No songs found for "${query}"</h2>
          <p style="color: var(--spotify-subtext); margin-bottom: 24px; font-size: 14px; line-height: 1.5;">
            Check the spelling, search for another artist/track, or paste any YouTube URL / Video ID below to stream directly.
          </p>

          <div class="direct-yt-card" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 20px; text-align: left;">
            <div style="font-size: 14px; font-weight: 700; color: #f59e0b; margin-bottom: 6px;">⚡ Stream Any YouTube Track Directly</div>
            <p style="font-size: 12px; color: var(--spotify-subtext); margin-bottom: 12px;">Paste any YouTube video link or 11-char ID to play with retro vinyl controls:</p>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="directYtInput" placeholder="e.g. https://www.youtube.com/watch?v=... or Video ID" style="flex: 1; padding: 10px 14px; border-radius: 8px; border: 1px solid #3e3e3e; background: #121212; color: #fff; font-size: 13px; outline: none;" />
              <button id="directYtBtn" class="golden-play-btn" style="padding: 10px 20px; border-radius: 8px; background: #f59e0b; color: #000; font-weight: 700; border: none; cursor: pointer; white-space: nowrap;">Play</button>
            </div>
          </div>
        </div>
      `;

      const directInput = container.querySelector('#directYtInput');
      const directBtn = container.querySelector('#directYtBtn');
      if (directBtn && directInput) {
        const handleDirectPlay = () => {
          const val = directInput.value.trim();
          if (!val) return;
          this.playDirectYouTube(val);
        };
        directBtn.addEventListener('click', handleDirectPlay);
        directInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') handleDirectPlay();
        });
      }
    };

    // If local matches exist, show them right away
    if (matchingTracks.length > 0) {
      renderResults(matchingTracks, true);
    } else {
      // Show loading indicator while online search connects
      container.innerHTML = `
        <div class="content-section" style="text-align: center; padding: 60px 20px;">
          <div class="golden-search-loader" style="margin: 0 auto 16px; width: 44px; height: 44px; border: 3px solid rgba(245,158,11,0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spinVinyl 1s linear infinite;"></div>
          <h2 style="font-size: 24px; margin-bottom: 8px;">Searching YouTube Music for "${query}"...</h2>
          <p style="color: var(--spotify-subtext);">Connecting to online music database...</p>
        </div>
      `;
    }

    // Sequence ID to avoid race conditions with fast typing
    const searchSeq = ++this.currentSearchSeq;

    // Use relative /api/search for deployed apps (Vercel serverless) and local dev
    const apiBase = (window.location.hostname === 'localhost' && window.location.port === '5000')
      ? 'http://localhost:5000'
      : '';

    fetch(`${apiBase}/api/search?q=${encodeURIComponent(query)}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (this.currentSearchSeq !== searchSeq) return;

        if (data && data.results && data.results.length > 0) {
          data.results.forEach(newTrack => {
            if (!this.tracks.find(t => t.id === newTrack.id || (newTrack.video_id && t.video_id === newTrack.video_id))) {
              this.tracks.push(newTrack);
            }
          });
          const updatedMatching = this.tracks.filter(t => 
            t.title.toLowerCase().includes(trimmed) || 
            t.artist.toLowerCase().includes(trimmed) ||
            t.album.toLowerCase().includes(trimmed)
          );
          if (updatedMatching.length > 0) {
            renderResults(updatedMatching, false);
          } else {
            renderNoResults();
          }
        } else {
          if (matchingTracks.length > 0) {
            renderResults(matchingTracks, false);
          } else {
            renderNoResults();
          }
        }
      })
      .catch(err => {
        console.warn('Live backend search offline or error:', err);
        if (this.currentSearchSeq !== searchSeq) return;

        if (matchingTracks.length > 0) {
          renderResults(matchingTracks, false);
        } else {
          // Client-side fallback via iTunes API
          fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`)
            .then(res => res.json())
            .then(itunesData => {
              if (this.currentSearchSeq !== searchSeq) return;
              if (itunesData && itunesData.results && itunesData.results.length > 0) {
                itunesData.results.forEach(it => {
                  const id = `itunes-${it.trackId}`;
                  if (!this.tracks.find(t => t.id === id)) {
                    const durSec = Math.floor((it.trackTimeMillis || 210000) / 1000);
                    const m = Math.floor(durSec / 60);
                    const s = durSec % 60;
                    this.tracks.push({
                      id: id,
                      video_id: 'd0JpdfOLXI0', // fallback video id
                      title: it.trackName,
                      artist: it.artistName,
                      album: it.collectionName || it.trackName,
                      duration: durSec,
                      durationFormatted: `${m}:${s < 10 ? '0' : ''}${s}`,
                      cover: (it.artworkUrl100 || '').replace('100x100bb', '300x300bb'),
                      genre: it.primaryGenreName || 'Classics',
                      color: '#f59e0b'
                    });
                  }
                });
                const updated = this.tracks.filter(t =>
                  t.title.toLowerCase().includes(trimmed) ||
                  t.artist.toLowerCase().includes(trimmed)
                );
                if (updated.length > 0) {
                  renderResults(updated, false);
                } else {
                  renderNoResults();
                }
              } else {
                renderNoResults();
              }
            })
            .catch(() => {
              if (this.currentSearchSeq === searchSeq) renderNoResults();
            });
        }
      });
  }

  // PLAYLIST VIEW
  renderPlaylistView(container, playlistId) {
    this.activePlaylistId = playlistId;
    const playlist = this.playlists.find(p => p.id === playlistId) || this.playlists[0];
    const playlistTracks = playlist.trackIds.map(id => this.tracks.find(t => t.id === id)).filter(Boolean);

    const totalSeconds = playlistTracks.reduce((acc, t) => acc + t.duration, 0);
    const totalMinutes = Math.floor(totalSeconds / 60);

    container.innerHTML = `
      <div class="playlist-hero" style="background: linear-gradient(180deg, ${playlist.color}aa 0%, rgba(18, 18, 18, 0) 100%);">
        <img class="hero-cover" src="${playlist.cover}" alt="${playlist.title}" />
        <div class="hero-info">
          <span class="hero-type">Old is Gold Collection</span>
          <h1 class="hero-title">${playlist.title}</h1>
          <p class="hero-description">${playlist.description}</p>
          <div class="hero-meta">
            <span>Old is Gold</span>
            <span class="dot">•</span>
            <span>${playlist.likes} saves</span>
            <span class="dot">•</span>
            <span>${playlistTracks.length} songs, about ${totalMinutes} min</span>
          </div>
        </div>
      </div>

      <div class="playlist-action-bar">
        <button class="big-green-play-btn golden-play-btn" id="playlistPlayBtn" title="Play Playlist">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="#000000">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
        <button class="action-icon-btn" id="playlistHeartBtn" title="Save to Your Library">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
      </div>

      <div class="tracklist-container">
        <table class="tracklist-table">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>Title</th>
              <th>Album</th>
              <th style="text-align: right;">Duration</th>
            </tr>
          </thead>
          <tbody>
            ${playlistTracks.map((track, i) => `
              <tr class="track-row ${this.currentTrack.id === track.id ? 'active' : ''}" data-track-id="${track.id}">
                <td class="col-num">
                  <span class="num-text">${i + 1}</span>
                  <span class="play-hover-icon">▶</span>
                </td>
                <td class="col-title">
                  <img class="track-mini-thumb" src="${track.cover}" alt="${track.title}" />
                  <div class="track-meta">
                    <span class="track-row-title">${track.title}</span>
                    <span class="track-row-artist">${track.artist}</span>
                  </div>
                </td>
                <td class="col-album">${track.album}</td>
                <td class="col-duration">
                  <button class="row-heart-btn ${this.likedTrackIds.has(track.id) ? 'liked' : ''}" data-heart-id="${track.id}" title="Like">♥</button>
                  ${track.durationFormatted}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('playlistPlayBtn').addEventListener('click', () => {
      if (playlistTracks.length > 0) {
        this.playTrack(playlistTracks[0], playlistTracks);
      }
    });

    container.querySelectorAll('.track-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.row-heart-btn')) {
          const heartId = e.target.closest('.row-heart-btn').dataset.heartId;
          this.toggleLikeTrack(heartId);
          return;
        }
        const id = row.dataset.trackId;
        const track = this.tracks.find(t => t.id === id);
        if (track) this.playTrack(track, playlistTracks);
      });
    });

    this.renderSidebarPlaylists();
  }

  // LIKED SONGS VIEW
  renderLikedSongsView(container) {
    const likedTracks = this.tracks.filter(t => this.likedTrackIds.has(t.id));

    container.innerHTML = `
      <div class="playlist-hero" style="background: linear-gradient(180deg, #b45309aa 0%, rgba(18, 18, 18, 0) 100%);">
        <div class="hero-cover" style="background: linear-gradient(135deg, #f59e0b, #d97706, #78350f); display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 24 24" width="80" height="80" fill="#ffffff">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
        <div class="hero-info">
          <span class="hero-type">Collection</span>
          <h1 class="hero-title">Golden Favorites</h1>
          <p class="hero-description">Your hand-picked evergreen songs from the golden era.</p>
          <div class="hero-meta">
            <span>Old is Gold Listener</span>
            <span class="dot">•</span>
            <span>${likedTracks.length} classic songs</span>
          </div>
        </div>
      </div>

      <div class="playlist-action-bar">
        ${likedTracks.length > 0 ? `
          <button class="big-green-play-btn golden-play-btn" id="likedPlayBtn" title="Play Favorites">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="#000000">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        ` : ''}
      </div>

      <div class="tracklist-container">
        ${likedTracks.length === 0 ? `
          <div style="padding: 40px 0; text-align: center; color: var(--spotify-subtext);">
            <h3 style="color: #fff; margin-bottom: 8px;">No classic songs saved yet</h3>
            <p>Save songs by clicking the heart icon on any golden track.</p>
          </div>
        ` : `
          <table class="tracklist-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th>Title</th>
                <th>Album</th>
                <th style="text-align: right;">Duration</th>
              </tr>
            </thead>
            <tbody>
              ${likedTracks.map((track, i) => `
                <tr class="track-row ${this.currentTrack.id === track.id ? 'active' : ''}" data-track-id="${track.id}">
                  <td class="col-num">
                    <span class="num-text">${i + 1}</span>
                    <span class="play-hover-icon">▶</span>
                  </td>
                  <td class="col-title">
                    <img class="track-mini-thumb" src="${track.cover}" alt="${track.title}" />
                    <div class="track-meta">
                      <span class="track-row-title">${track.title}</span>
                      <span class="track-row-artist">${track.artist}</span>
                    </div>
                  </td>
                  <td class="col-album">${track.album}</td>
                  <td class="col-duration">
                    <button class="row-heart-btn liked" data-heart-id="${track.id}" title="Remove">♥</button>
                    ${track.durationFormatted}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;

    if (likedTracks.length > 0) {
      document.getElementById('likedPlayBtn').addEventListener('click', () => {
        this.playTrack(likedTracks[0], likedTracks);
      });
    }

    container.querySelectorAll('.track-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.row-heart-btn')) {
          const heartId = e.target.closest('.row-heart-btn').dataset.heartId;
          this.toggleLikeTrack(heartId);
          return;
        }
        const id = row.dataset.trackId;
        const track = this.tracks.find(t => t.id === id);
        if (track) this.playTrack(track, likedTracks);
      });
    });
  }

  // LIBRARY VIEW
  renderLibraryView(container) {
    container.innerHTML = `
      <div class="content-section">
        <h1 class="section-title" style="margin-bottom: 24px;">Your Vintage Collection</h1>
        
        <div class="cards-grid">
          <!-- Liked Songs Special Card -->
          <div class="music-card" id="likedSongsCard" style="background: linear-gradient(135deg, #b45309, #d97706); cursor: pointer;">
            <div style="height: 140px; display: flex; align-items: flex-end; padding: 12px;">
              <span style="font-size: 26px; font-weight: 800; color: #fff;">Golden Favorites</span>
            </div>
            <div class="card-desc" style="color: #ffffffd0; margin-top: 10px;">${this.likedTrackIds.size} saved classics</div>
          </div>

          <!-- All Playlists -->
          ${this.playlists.map(pl => `
            <div class="music-card" data-playlist-id="${pl.id}">
              <div class="card-img-wrapper">
                <img src="${pl.cover}" alt="${pl.title}" />
              </div>
              <div class="card-title">${pl.title}</div>
              <div class="card-desc">Collection • ${pl.tracksCount} songs</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('likedSongsCard').addEventListener('click', () => {
      this.renderView('liked');
    });

    container.querySelectorAll('[data-playlist-id]').forEach(el => {
      el.addEventListener('click', () => {
        this.renderView('playlist', el.dataset.playlistId);
      });
    });
  }

  refreshPlayingStatesInViews() {
    document.querySelectorAll('.track-row').forEach(row => {
      const id = row.dataset.trackId;
      const isActive = id === this.currentTrack.id;
      row.classList.toggle('active', isActive);
      const playIcon = row.querySelector('.play-hover-icon');
      if (playIcon) {
        playIcon.textContent = (isActive && this.isPlaying) ? '⏸' : '▶';
      }
    });
  }

  // ==========================================================================
  // RIGHT SIDE PANEL: LYRICS & QUEUE
  // ==========================================================================
  togglePanel(panelName) {
    const panel = document.getElementById('rightPanel');
    const lyricsBtn = document.getElementById('lyricsBtn');
    const queueBtn = document.getElementById('queueBtn');

    if (this.activePanel === panelName) {
      panel.style.display = 'none';
      this.activePanel = null;
      lyricsBtn.classList.remove('active');
      queueBtn.classList.remove('active');
    } else {
      panel.style.display = 'flex';
      this.activePanel = panelName;
      lyricsBtn.classList.toggle('active', panelName === 'lyrics');
      queueBtn.classList.toggle('active', panelName === 'queue');

      if (panelName === 'lyrics') {
        this.renderLyricsPanel();
      } else if (panelName === 'queue') {
        this.renderQueuePanel();
      }
    }
  }

  renderLyricsPanel() {
    const title = document.getElementById('rightPanelTitle');
    const content = document.getElementById('rightPanelContent');
    title.textContent = `Lyrics • ${this.currentTrack.title}`;

    const renderLines = (lyricsArray) => {
      if (!lyricsArray || lyricsArray.length === 0) {
        content.innerHTML = `<div style="padding: 40px 0; text-align: center; color: var(--spotify-subtext);">No lyrics available for this classic.</div>`;
        return;
      }

      content.innerHTML = `
        <div class="lyrics-container" id="lyricsScrollContainer">
          ${lyricsArray.map((l, i) => {
            const text = typeof l === 'string' ? l : l.text;
            const time = typeof l === 'object' && l.time !== undefined ? l.time : (i * 12);
            return `
              <div class="lyric-line" data-time="${time}" data-index="${i}">
                ${text}
              </div>
            `;
          }).join('')}
        </div>
      `;

      content.querySelectorAll('.lyric-line').forEach(line => {
        line.addEventListener('click', () => {
          const time = parseFloat(line.dataset.time);
          this.seekTo(time);
        });
      });

      this.highlightCurrentLyric();
    };

    renderLines(this.currentTrack.lyrics);

    if (this.currentTrack.video_id) {
      const apiBase = (window.location.hostname === 'localhost' && window.location.port === '5000') ? 'http://localhost:5000' : '';
      fetch(`${apiBase}/api/lyrics?videoId=${this.currentTrack.video_id}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.lyrics && data.lyrics.length > 0 && !data.lyrics[0].includes("No synced lyrics")) {
            const formatted = data.lyrics.map((line, idx) => ({
              time: idx * 10,
              text: line
            }));
            this.currentTrack.lyrics = formatted;
            renderLines(formatted);
          }
        })
        .catch(err => {
          console.log('Live lyrics error:', err);
        });
    }
  }

  highlightCurrentLyric() {
    if (!this.currentTrack.lyrics) return;
    const lines = document.querySelectorAll('.lyric-line');
    let activeIndex = -1;

    for (let i = 0; i < this.currentTrack.lyrics.length; i++) {
      if (this.currentTime >= this.currentTrack.lyrics[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }

    lines.forEach((line, idx) => {
      const isActive = idx === activeIndex;
      line.classList.toggle('active', isActive);
      if (isActive && !this.isDraggingProgress) {
        line.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  renderQueuePanel() {
    const title = document.getElementById('rightPanelTitle');
    const content = document.getElementById('rightPanelContent');
    title.textContent = 'Vintage Play Queue';

    content.innerHTML = `
      <div style="font-size: 13px; font-weight: 700; color: #fbbf24; margin-bottom: 8px;">Now Playing</div>
      <div class="queue-item active" style="margin-bottom: 20px;">
        <img src="${this.currentTrack.cover}" alt="${this.currentTrack.title}" />
        <div class="queue-item-info">
          <span class="queue-item-title">${this.currentTrack.title}</span>
          <span class="queue-item-artist">${this.currentTrack.artist}</span>
        </div>
      </div>

      <div style="font-size: 13px; font-weight: 700; color: var(--spotify-subtext); margin-bottom: 8px;">Next in Queue</div>
      <div class="queue-list">
        ${this.queue.slice(0, 30).map((track, i) => `
          <div class="queue-item" data-queue-index="${i}">
            <img src="${track.cover}" alt="${track.title}" />
            <div class="queue-item-info">
              <span class="queue-item-title">${track.title}</span>
              <span class="queue-item-artist">${track.artist}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    content.querySelectorAll('.queue-item[data-queue-index]').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.queueIndex);
        this.queueIndex = idx;
        this.playTrack(this.queue[idx]);
      });
    });
  }

  // ==========================================================================
  // EVENT LISTENERS & INTERACTION
  // ==========================================================================
  setupUIEventListeners() {
    document.getElementById('navHome').addEventListener('click', () => this.renderView('home'));
    document.getElementById('navSearch').addEventListener('click', () => this.renderView('search'));
    document.getElementById('navLibrary').addEventListener('click', () => this.renderView('library'));
    document.getElementById('logoBtn').addEventListener('click', () => this.renderView('home'));

    document.getElementById('likedSongsNavBtn').addEventListener('click', () => this.renderView('liked'));
    document.getElementById('createPlaylistBtn').addEventListener('click', () => {
      const name = prompt("Enter new vintage playlist name:", `Golden Playlist #${this.playlists.length + 1}`);
      if (name && name.trim()) {
        const newPl = {
          id: `pl-user-${Date.now()}`,
          title: name.trim(),
          description: "Curated vintage collection.",
          cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80",
          color: "#f59e0b",
          likes: "1",
          tracksCount: 2,
          trackIds: [this.tracks[0].id, this.tracks[1].id]
        };
        this.playlists.push(newPl);
        this.renderSidebarPlaylists();
        this.renderView('playlist', newPl.id);
        this.showToast(`Created collection "${name}"!`, "success");
      }
    });

    document.getElementById('navBackBtn').addEventListener('click', () => {
      if (this.activeView !== 'home') this.renderView('home');
    });
    document.getElementById('navForwardBtn').addEventListener('click', () => {
      if (this.activeView === 'home') this.renderView('search');
    });

    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    let searchDebounceTimer = null;
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      clearSearchBtn.style.display = this.searchQuery ? 'block' : 'none';
      if (this.activeView === 'search') {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          this.renderSearchView(document.getElementById('viewContainer'), this.searchQuery);
        }, 250);
      }
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      clearSearchBtn.style.display = 'none';
      if (this.activeView === 'search') {
        this.renderSearchView(document.getElementById('viewContainer'), '');
      }
    });

    // Player controls
    document.getElementById('playPauseBtn').addEventListener('click', () => this.togglePlayPause());
    document.getElementById('nextBtn').addEventListener('click', () => this.nextTrack());
    document.getElementById('prevBtn').addEventListener('click', () => this.prevTrack());
    document.getElementById('shuffleBtn').addEventListener('click', () => this.toggleShuffle());
    document.getElementById('repeatBtn').addEventListener('click', () => this.toggleRepeat());
    document.getElementById('playerHeartBtn').addEventListener('click', () => {
      if (this.currentTrack) this.toggleLikeTrack(this.currentTrack.id);
    });

    document.getElementById('lyricsBtn').addEventListener('click', () => this.togglePanel('lyrics'));
    document.getElementById('queueBtn').addEventListener('click', () => this.togglePanel('queue'));
    document.getElementById('closePanelBtn').addEventListener('click', () => this.togglePanel(this.activePanel));

    document.getElementById('volumeBtn').addEventListener('click', () => this.toggleMute());

    // Progress bar seeking
    const progressContainer = document.getElementById('progressBarContainer');
    progressContainer.addEventListener('mousedown', (e) => {
      this.isDraggingProgress = true;
      this.handleSeekEvent(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDraggingProgress) this.handleSeekEvent(e);
      if (this.isDraggingVolume) this.handleVolumeEvent(e);
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingProgress = false;
      this.isDraggingVolume = false;
    });

    // Volume slider dragging
    const volumeContainer = document.getElementById('volumeSliderContainer');
    volumeContainer.addEventListener('mousedown', (e) => {
      this.isDraggingVolume = true;
      this.handleVolumeEvent(e);
    });

    // Shortcuts modal
    const shortcutsModal = document.getElementById('shortcutsModal');
    document.getElementById('shortcutsBtn').addEventListener('click', () => {
      shortcutsModal.style.display = 'flex';
    });
    document.getElementById('closeShortcutsModal').addEventListener('click', () => {
      shortcutsModal.style.display = 'none';
    });
    shortcutsModal.addEventListener('click', (e) => {
      if (e.target === shortcutsModal) shortcutsModal.style.display = 'none';
    });

    // Fullscreen toggle
    document.getElementById('fullscreenBtn').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Filter chips
    document.querySelectorAll('.filter-chips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.dataset.filter;
        if (filter === 'all') {
          this.renderView('home');
        } else if (filter === 'bollywood') {
          const pl = this.playlists.find(p => p.id === 'pl-kishore-rafi');
          if (pl) this.renderView('playlist', pl.id);
        } else if (filter === 'rock') {
          const pl = this.playlists.find(p => p.id === 'pl-classic-rock-gold');
          if (pl) this.renderView('playlist', pl.id);
        } else if (filter === 'ghazal') {
          const pl = this.playlists.find(p => p.id === 'pl-ghazals-gold');
          if (pl) this.renderView('playlist', pl.id);
        }
      });
    });
  }

  handleSeekEvent(e) {
    const progressContainer = document.getElementById('progressBarContainer');
    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSeconds = ratio * this.duration;
    this.seekTo(targetSeconds);
  }

  handleVolumeEvent(e) {
    const volumeContainer = document.getElementById('volumeSliderContainer');
    const rect = volumeContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    this.setVolume(ratio);
  }

  // ==========================================================================
  // KEYBOARD SHORTCUTS
  // ==========================================================================
  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlayPause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.seekTo(this.currentTime + 5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.seekTo(this.currentTime - 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.setVolume(this.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.setVolume(this.volume - 0.1);
          break;
        case 'KeyM':
          this.toggleMute();
          break;
        case 'KeyL':
          if (this.currentTrack) this.toggleLikeTrack(this.currentTrack.id);
          break;
        case 'KeyN':
          this.nextTrack();
          break;
        case 'KeyP':
          this.prevTrack();
          break;
        case 'KeyS':
          this.toggleShuffle();
          break;
        case 'KeyR':
          this.toggleRepeat();
          break;
        case 'Slash':
          if (e.shiftKey) {
            const modal = document.getElementById('shortcutsModal');
            modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
          }
          break;
      }
    });
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'success' : ''}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }
}

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.oldIsGoldApp = new OldIsGoldPlayerApp();
});
