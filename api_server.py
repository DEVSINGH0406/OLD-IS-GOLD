import http.server
import socketserver
import json
import sqlite3
import urllib.parse
from ytmusicapi import YTMusic

PORT = 5000
DB_FILE = "music.db"

yt_client = None

def get_yt():
    global yt_client
    if yt_client is None:
        yt_client = YTMusic()
    return yt_client

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

class MusicAPIRequestHandler(http.server.BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def respond_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        # GET /api/songs
        if path == '/api/songs':
            conn = get_db_connection()
            limit = int(params.get('limit', [100])[0])
            genre = params.get('genre', [None])[0]

            if genre:
                rows = conn.execute("SELECT * FROM songs WHERE genre = ? LIMIT ?", (genre, limit)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM songs LIMIT ?", (limit,)).fetchall()

            songs = []
            for r in rows:
                song = dict(r)
                if song.get('lyrics'):
                    try:
                        song['lyrics'] = json.loads(song['lyrics'])
                    except Exception:
                        pass
                songs.append(song)
            conn.close()
            return self.respond_json(200, {"count": len(songs), "songs": songs})

        # GET /api/playlists
        elif path == '/api/playlists':
            conn = get_db_connection()
            rows = conn.execute("SELECT * FROM playlists").fetchall()
            playlists = []
            for r in rows:
                pl = dict(r)
                if pl.get('track_ids'):
                    try:
                        pl['track_ids'] = json.loads(pl['track_ids'])
                    except Exception:
                        pass
                playlists.append(pl)
            conn.close()
            return self.respond_json(200, {"playlists": playlists})

        # GET /api/genres
        elif path == '/api/genres':
            conn = get_db_connection()
            rows = conn.execute("SELECT * FROM genres").fetchall()
            genres = []
            for r in rows:
                g = dict(r)
                if g.get('track_ids'):
                    try:
                        g['track_ids'] = json.loads(g['track_ids'])
                    except Exception:
                        pass
                genres.append(g)
            conn.close()
            return self.respond_json(200, {"genres": genres})

        # GET /api/search?q=... (Live Search using SQLite + ytmusicapi fallback)
        elif path == '/api/search':
            query = params.get('q', [''])[0].strip()
            if not query:
                return self.respond_json(200, {"results": []})

            # Search local database first
            conn = get_db_connection()
            like_q = f"%{query}%"
            rows = conn.execute("""
                SELECT * FROM songs 
                WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? OR genre LIKE ?
                LIMIT 20
            """, (like_q, like_q, like_q, like_q)).fetchall()

            results = [dict(r) for r in rows]
            conn.close()

            # If fewer than 5 local matches, query live YouTube Music via ytmusicapi
            if len(results) < 5:
                try:
                    yt = get_yt()
                    yt_results = yt.search(query, filter="songs", limit=10)
                    conn = get_db_connection()
                    for item in yt_results:
                        video_id = item.get("videoId")
                        if not video_id:
                            continue
                        title = item.get("title", "")
                        artists_list = item.get("artists", [])
                        artist = ", ".join([a.get("name") for a in artists_list if a.get("name")])
                        album = (item.get("album") or {}).get("name", title)
                        dur_str = item.get("duration", "3:30")
                        dur_sec = item.get("duration_seconds", 210)
                        thumbs = item.get("thumbnails", [])
                        cover = thumbs[-1].get("url") if thumbs else f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

                        song_id = f"yt-{video_id}"
                        # Save new song to SQLite database
                        conn.execute("""
                        INSERT OR IGNORE INTO songs 
                        (id, video_id, title, artist, album, duration, duration_formatted, cover, genre, color, audio_url, views)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            song_id, video_id, title, artist, album, dur_sec, dur_str,
                            cover, "Pop", "#1db954",
                            "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3",
                            item.get("views", "")
                        ))

                        results.append({
                            "id": song_id,
                            "video_id": video_id,
                            "title": title,
                            "artist": artist,
                            "album": album,
                            "duration": dur_sec,
                            "duration_formatted": dur_str,
                            "cover": cover,
                            "genre": "Pop",
                            "color": "#1db954"
                        })
                    conn.commit()
                    conn.close()
                except Exception as e:
                    print(f"Error querying ytmusicapi live search: {e}")

            return self.respond_json(200, {"query": query, "count": len(results), "results": results})

        # GET /api/lyrics?videoId=...
        elif path == '/api/lyrics':
            video_id = params.get('videoId', [''])[0].strip()
            if not video_id:
                return self.respond_json(400, {"error": "Missing videoId parameter"})

            try:
                yt = get_yt()
                watch = yt.get_watch_playlist(videoId=video_id)
                lyrics_browse_id = watch.get('lyrics')
                if lyrics_browse_id:
                    lyrics_data = yt.get_lyrics(lyrics_browse_id)
                    raw_lyrics = lyrics_data.get('lyrics', '')
                    # Format lines into timestamped or display structure
                    lines = [line.strip() for line in raw_lyrics.split('\n') if line.strip()]
                    return self.respond_json(200, {"videoId": video_id, "lyrics": lines})
                else:
                    return self.respond_json(200, {"videoId": video_id, "lyrics": ["No synced lyrics available for this YouTube Music track."]})
            except Exception as e:
                return self.respond_json(500, {"error": str(e)})

        else:
            return self.respond_json(404, {"error": "Not Found"})

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), MusicAPIRequestHandler) as httpd:
        print(f"YouTube Music + SQLite API Server running at http://localhost:{PORT}")
        httpd.serve_forever()

if __name__ == '__main__':
    run_server()
