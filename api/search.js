// Vercel Serverless Function: GET /api/search?q=...
// Fast, robust YouTube search for deployed and local apps

function parseDurationToSeconds(str) {
  if (!str) return 210;
  const parts = str.split(':').map(Number);
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  return 210;
}

function extractYouTubeId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  // Standard watch URL: youtube.com/watch?v=VIDEO_ID
  const watchMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  // Direct 11 character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export default async function handler(req, res) {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Support both standard Node req.url / req.query and Express-like req.query
  const urlObj = new URL(req.url, 'http://localhost');
  const query = (req.query?.q || urlObj.searchParams.get('q') || '').trim();

  if (!query) {
    return res.status(200).json({ count: 0, results: [] });
  }

  // 1. Direct YouTube Video ID or URL detected
  const directId = extractYouTubeId(query);
  if (directId) {
    try {
      const oembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${directId}`);
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        const singleTrack = {
          id: `yt-${directId}`,
          video_id: directId,
          title: oembed.title || 'YouTube Song',
          artist: oembed.author_name || 'YouTube',
          album: oembed.title || 'YouTube Music',
          duration: 210,
          durationFormatted: '3:30',
          duration_formatted: '3:30',
          cover: `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`,
          genre: 'Classics & Hits',
          color: '#f59e0b',
          audio: `https://www.youtube.com/watch?v=${directId}`
        };
        return res.status(200).json({ query, count: 1, results: [singleTrack] });
      }
    } catch {
      // Fallback below
    }
  }

  const results = [];

  // 2. Fetch YouTube search HTML
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' song')}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (response.ok) {
      const html = await response.text();
      const match = html.match(/var ytInitialData = ({.+?});<\/script>/) || html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);

      if (match) {
        const data = JSON.parse(match[1]);
        const sections = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

        for (const sec of sections) {
          const items = sec.itemSectionRenderer?.contents || [];
          for (const item of items) {
            const v = item.videoRenderer;
            if (v && v.videoId) {
              const videoId = v.videoId;
              const title = v.title?.runs?.[0]?.text || '';
              const artist = v.ownerText?.runs?.[0]?.text || 'Classic Artist';
              const durationFormatted = v.lengthText?.simpleText || '3:30';
              const durSec = parseDurationToSeconds(durationFormatted);
              const thumbs = v.thumbnail?.thumbnails || [];
              const cover = thumbs.length > 0 ? thumbs[thumbs.length - 1].url : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

              results.push({
                id: `yt-${videoId}`,
                video_id: videoId,
                title: title,
                artist: artist,
                album: title,
                duration: durSec,
                durationFormatted: durationFormatted,
                duration_formatted: durationFormatted,
                cover: cover,
                genre: 'Classics & Hits',
                color: '#f59e0b',
                audio: `https://www.youtube.com/watch?v=${videoId}`
              });

              if (results.length >= 15) break;
            }
          }
          if (results.length >= 15) break;
        }
      }
    }
  } catch (err) {
    console.error('YouTube search error:', err);
  }

  // 3. Fallback: if YouTube search returned 0 results (e.g. temporary IP block), query iTunes API
  if (results.length === 0) {
    try {
      const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`);
      if (itunesRes.ok) {
        const itunesData = await itunesRes.json();
        if (itunesData.results && itunesData.results.length > 0) {
          for (const it of itunesData.results) {
            const trackId = `itunes-${it.trackId}`;
            const durSec = Math.floor((it.trackTimeMillis || 210000) / 1000);
            const m = Math.floor(durSec / 60);
            const s = durSec % 60;
            const durFormatted = `${m}:${s < 10 ? '0' : ''}${s}`;
            const cover = (it.artworkUrl100 || '').replace('100x100bb', '300x300bb');

            results.push({
              id: trackId,
              video_id: directId || 'd0JpdfOLXI0', // Playable fallback if no direct video ID
              title: it.trackName,
              artist: it.artistName,
              album: it.collectionName || it.trackName,
              duration: durSec,
              durationFormatted: durFormatted,
              duration_formatted: durFormatted,
              cover: cover,
              genre: it.primaryGenreName || 'Classics',
              color: '#f59e0b',
              audio: it.previewUrl || ''
            });
          }
        }
      }
    } catch (itunesErr) {
      console.error('iTunes fallback error:', itunesErr);
    }
  }

  return res.status(200).json({
    query,
    count: results.length,
    results
  });
}
