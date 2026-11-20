import sqlite3
import json
import re
from ytmusicapi import YTMusic

DB_FILE = "music.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY,
        video_id TEXT UNIQUE,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        duration INTEGER,
        duration_formatted TEXT,
        cover TEXT,
        genre TEXT,
        color TEXT,
        audio_url TEXT,
        views TEXT,
        lyrics TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        cover TEXT,
        color TEXT,
        likes TEXT,
        track_count INTEGER,
        track_ids TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS genres (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        icon TEXT,
        track_ids TEXT
    )
    """)

    conn.commit()
    conn.close()

def parse_duration_to_seconds(dur_str):
    if not dur_str:
        return 210
    parts = dur_str.split(':')
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except Exception:
        return 210
    return 210

def clean_title(title):
    cleaned = re.sub(r'\s*[\(\[](Official|Lyric|Video|Audio|Music Video|HD|4K|Visualizer|Remastered|Original|Full Song).*?[\)\]]', '', title, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*\|\s*.*$', '', cleaned)
    return cleaned.strip()

def fetch_and_populate():
    print("Initializing SQLite Database for Old is Gold...")
    init_db()

    print("Connecting to YouTube Music via ytmusicapi...")
    yt = YTMusic()

    # Curated oldies searches to get the finest timeless classics
    categories = [
        # Bollywood Golden Era
        {"category": "Kishore Kumar", "genre": "Retro Bollywood", "query": "Kishore Kumar golden hits classics", "color": "#f59e0b"},
        {"category": "Mohammed Rafi", "genre": "Retro Bollywood", "query": "Mohammed Rafi hit songs evergreen", "color": "#eab308"},
        {"category": "Lata Mangeshkar", "genre": "Retro Bollywood", "query": "Lata Mangeshkar best old songs classics", "color": "#f97316"},
        {"category": "R.D. Burman", "genre": "Retro Bollywood", "query": "RD Burman evergreen hits", "color": "#d97706"},
        {"category": "Mukesh & Hemant", "genre": "Retro Bollywood", "query": "Mukesh old songs golden collection", "color": "#b45309"},
        {"category": "Ghazals & Soul", "genre": "Ghazals", "query": "Jagjit Singh best ghazals classic", "color": "#8b5cf6"},

        # Western Classic Rock & Pop
        {"category": "Classic Rock", "genre": "Classic Rock", "query": "Queen Beatles Eagles classic rock 70s", "color": "#ef4444"},
        {"category": "80s Pop & Disco", "genre": "80s Hits", "query": "80s greatest pop hits Michael Jackson ABBA", "color": "#ec4899"},
        {"category": "Vintage Jazz & Soul", "genre": "Vintage Classics", "query": "Frank Sinatra Elvis Presley golden oldies", "color": "#06b6d4"}
    ]

    all_tracks = []
    seen_video_ids = set()

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    category_track_map = {cat["category"]: [] for cat in categories}
    genre_tracks_map = {}

    for cat in categories:
        cat_name = cat["category"]
        genre = cat["genre"]
        query = cat["query"]
        color = cat["color"]
        print(f"Fetching Old is Gold tracks for '{cat_name}' with query: '{query}'...")

        try:
            results = yt.search(query, filter="songs", limit=15)
        except Exception as e:
            print(f"Error fetching for {cat_name}: {e}")
            continue

        for item in results:
            video_id = item.get("videoId")
            if not video_id or video_id in seen_video_ids:
                continue

            raw_title = item.get("title", "Untitled")
            title = clean_title(raw_title)

            # Extract artist
            artists_list = item.get("artists", [])
            artist_names = [a.get("name") for a in artists_list if a.get("name")]
            artist = ", ".join(artist_names) if artist_names else cat_name

            album_obj = item.get("album") or {}
            album = album_obj.get("name", f"{cat_name} Classics")

            dur_str = item.get("duration", "3:45")
            dur_sec = item.get("duration_seconds") or parse_duration_to_seconds(dur_str)

            # Skip full album hour-long videos
            if dur_sec > 600 or dur_sec < 45:
                continue

            thumbs = item.get("thumbnails", [])
            cover_url = ""
            if thumbs:
                cover_url = thumbs[-1].get("url", "")
            if not cover_url:
                cover_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

            track_id = f"gold-{video_id}"
            seen_video_ids.add(video_id)

            # Synchronized lyrics template
            lyrics_data = [
                {"time": 0, "text": f"♪ {title} - {artist} ♪"},
                {"time": 10, "text": "Old is Gold - Timeless Classic Melody"},
                {"time": 25, "text": "♪ Nostalgic instrumental introduction ♪"},
                {"time": 45, "text": f"Lyrics of {title}"},
                {"time": 80, "text": "Echoes of golden memories from the past"},
                {"time": 120, "text": "♪ Evergreen musical harmony ♪"},
                {"time": 160, "text": "Timeless song that never fades away"}
            ]

            track_record = {
                "id": track_id,
                "video_id": video_id,
                "title": title,
                "artist": artist,
                "album": album,
                "duration": dur_sec,
                "durationFormatted": dur_str if dur_str else f"{dur_sec // 60}:{dur_sec % 60:02d}",
                "cover": cover_url,
                "genre": genre,
                "color": color,
                "audio": f"https://www.youtube.com/watch?v={video_id}",
                "views": item.get("views", "Golden Classic"),
                "lyrics": lyrics_data
            }

            cursor.execute("""
            INSERT OR REPLACE INTO songs 
            (id, video_id, title, artist, album, duration, duration_formatted, cover, genre, color, audio_url, views, lyrics)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                track_record["id"],
                track_record["video_id"],
                track_record["title"],
                track_record["artist"],
                track_record["album"],
                track_record["duration"],
                track_record["durationFormatted"],
                track_record["cover"],
                track_record["genre"],
                track_record["color"],
                track_record["audio"],
                track_record["views"],
                json.dumps(lyrics_data)
            ))

            all_tracks.append(track_record)
            category_track_map[cat_name].append(track_id)
            if genre not in genre_tracks_map:
                genre_tracks_map[genre] = []
            genre_tracks_map[genre].append(track_id)

    conn.commit()
    print(f"Total Old is Gold classic songs inserted into SQLite: {len(all_tracks)}")

    # Curate Playlists with rich golden vintage cover imagery
    playlists_data = [
        {
            "id": "pl-kishore-rafi",
            "title": "Kishore Kumar & Rafi Sahab Legends",
            "description": "Evergreen voice of Kishore Da & Mohammed Rafi that defined the golden age of Indian music.",
            "cover": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80",
            "color": "#f59e0b",
            "likes": "45,820,100",
            "tracksCount": len(category_track_map.get("Kishore Kumar", []) + category_track_map.get("Mohammed Rafi", [])),
            "trackIds": (category_track_map.get("Kishore Kumar", []) + category_track_map.get("Mohammed Rafi", []))[:20]
        },
        {
            "id": "pl-lata-melody",
            "title": "Lata Mangeshkar: The Nightingale",
            "description": "Soul-stirring, timeless melodies by Bharat Ratna Lata Mangeshkar.",
            "cover": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80",
            "color": "#eab308",
            "likes": "52,430,700",
            "tracksCount": len(category_track_map.get("Lata Mangeshkar", [])),
            "trackIds": category_track_map.get("Lata Mangeshkar", [])
        },
        {
            "id": "pl-rd-burman",
            "title": "Pancham Da: R.D. Burman Magic",
            "description": "Revolutionary melodies and groovy retro rhythms by Pancham Da.",
            "cover": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80",
            "color": "#d97706",
            "likes": "38,190,400",
            "tracksCount": len(category_track_map.get("R.D. Burman", [])),
            "trackIds": category_track_map.get("R.D. Burman", [])
        },
        {
            "id": "pl-classic-rock-gold",
            "title": "Golden Era of Classic Rock",
            "description": "Timeless rock anthems from Queen, The Beatles, Eagles, Pink Floyd, and more.",
            "cover": "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop&q=80",
            "color": "#ef4444",
            "likes": "63,200,900",
            "tracksCount": len(category_track_map.get("Classic Rock", [])),
            "trackIds": category_track_map.get("Classic Rock", [])
        },
        {
            "id": "pl-vintage-jazz",
            "title": "Frank Sinatra & Elvis: Vintage Charm",
            "description": "Smooth 50s & 60s jazz, swing, crooners, and classic ballads.",
            "cover": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80",
            "color": "#06b6d4",
            "likes": "29,480,200",
            "tracksCount": len(category_track_map.get("Vintage Jazz & Soul", [])),
            "trackIds": category_track_map.get("Vintage Jazz & Soul", [])
        },
        {
            "id": "pl-ghazals-gold",
            "title": "Jagjit Singh: Timeless Ghazals",
            "description": "Heart-touching poetry and soothing strings for quiet evenings.",
            "cover": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&auto=format&fit=crop&q=80",
            "color": "#8b5cf6",
            "likes": "24,190,000",
            "tracksCount": len(category_track_map.get("Ghazals & Soul", [])),
            "trackIds": category_track_map.get("Ghazals & Soul", [])
        }
    ]

    for pl in playlists_data:
        cursor.execute("""
        INSERT OR REPLACE INTO playlists 
        (id, title, description, cover, color, likes, track_count, track_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            pl["id"],
            pl["title"],
            pl["description"],
            pl["cover"],
            pl["color"],
            pl["likes"],
            pl["tracksCount"],
            json.dumps(pl["trackIds"])
        ))

    genres_meta = [
        {"id": "retro-bollywood", "name": "Retro Bollywood", "color": "#b45309", "icon": "📻", "trackIds": genre_tracks_map.get("Retro Bollywood", [])},
        {"id": "classic-rock", "name": "Classic Rock", "color": "#b91c1c", "icon": "🎸", "trackIds": genre_tracks_map.get("Classic Rock", [])},
        {"id": "ghazals", "name": "Ghazals & Soul", "color": "#6b21a8", "icon": "🕯️", "trackIds": genre_tracks_map.get("Ghazals", [])},
        {"id": "80s-hits", "name": "80s Retro Hits", "color": "#be185d", "icon": "🪩", "trackIds": genre_tracks_map.get("80s Hits", [])},
        {"id": "vintage-classics", "name": "Vintage Jazz & Blues", "color": "#0e7490", "icon": "🎷", "trackIds": genre_tracks_map.get("Vintage Classics", [])}
    ]

    for g in genres_meta:
        cursor.execute("""
        INSERT OR REPLACE INTO genres
        (id, name, color, icon, track_ids)
        VALUES (?, ?, ?, ?, ?)
        """, (
            g["id"],
            g["name"],
            g["color"],
            g["icon"],
            json.dumps(g["trackIds"])
        ))

    conn.commit()
    conn.close()

    print("Writing updated tracks, playlists, and genres to src/data/tracks.js...")
    js_content = f"""// OLD IS GOLD - RETRO & CLASSIC EVERGREEN MUSIC DATABASE
// Total Tracks: {len(all_tracks)}
// Database: music.db (SQLite) via ytmusicapi

export const TRACKS = {json.dumps(all_tracks, indent=2)};

export const PLAYLISTS = {json.dumps(playlists_data, indent=2)};

export const GENRES = {json.dumps(genres_meta, indent=2)};
"""
    with open("src/data/tracks.js", "w", encoding="utf-8") as f:
        f.write(js_content)

    print("Old is Gold database population complete!")

if __name__ == "__main__":
    fetch_and_populate()
