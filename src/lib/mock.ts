export interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string;
  url?: string;
  videoId?: string;
  duration?: number;
  votes?: string[];
  upvotes?: number;
}

export interface Listener {
  id: string;
  name: string;
  color: string;
}

export interface Message {
  id: string;
  userId: string;
  name: string;
  color: string;
  text: string;
  time: string;
}

export const AVATAR_COLORS = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-pink-500",
];

export function genCode(): string {
  const num = Math.floor(100 + Math.random() * 900);
  return `CHILL-${num}`;
}

export function thumb(videoId?: string): string {
  if (!videoId) return "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop";
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function fmt(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  }
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export const MOCK_TRACKS: Track[] = [
  {
    id: "M5OCLifZK1w",
    videoId: "M5OCLifZK1w",
    url: "M5OCLifZK1w",
    title: "Aarzoo",
    artist: "Noor Khan",
    duration: 227,
    votes: [],
    thumbnail: "https://img.youtube.com/vi/M5OCLifZK1w/hqdefault.jpg",
    upvotes: 0,
  },
  {
    id: "nwXAkF8OFCc",
    videoId: "nwXAkF8OFCc",
    url: "nwXAkF8OFCc",
    title: "Kashish",
    artist: "Ashish Bhatia",
    duration: 200,
    votes: [],
    thumbnail: "https://img.youtube.com/vi/nwXAkF8OFCc/hqdefault.jpg",
    upvotes: 0,
  },
  {
    id: "n2dVFdqMYGA",
    videoId: "n2dVFdqMYGA",
    url: "n2dVFdqMYGA",
    title: "Sahiba",
    artist: "Aditya Rikhari",
    duration: 183,
    votes: [],
    thumbnail: "https://img.youtube.com/vi/n2dVFdqMYGA/hqdefault.jpg",
    upvotes: 0,
  },
];

export const INITIAL_QUEUE: Track[] = MOCK_TRACKS;
export const CATALOG: Track[] = MOCK_TRACKS;

// SSR-safe HTML entity decoder
function decodeHTMLEntities(text: string): string {
  if (!text) return "";
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");
      return doc.documentElement.textContent || text;
    } catch {}
  }
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
}

// Parses ISO 8601 (PT1H4M13S, PT58S), "01:23:45", or raw seconds into integer seconds
export function parseDuration(rawDuration: unknown): number {
  if (typeof rawDuration === "number" && !isNaN(rawDuration) && rawDuration > 0) {
    return Math.round(rawDuration);
  }

  if (typeof rawDuration === "string") {
    const trimmed = rawDuration.trim();

    // 1. Check YouTube ISO 8601 string (e.g. PT1H2M30S, PT4M13S, PT45S)
    if (trimmed.startsWith("PT") || trimmed.startsWith("P")) {
      const hoursMatch = trimmed.match(/(\d+)H/);
      const minutesMatch = trimmed.match(/(\d+)M/);
      const secondsMatch = trimmed.match(/(\d+)S/);

      const hours = hoursMatch ? parseInt(hoursMatch[1]!, 10) : 0;
      const minutes = minutesMatch ? parseInt(minutesMatch[1]!, 10) : 0;
      const seconds = secondsMatch ? parseInt(secondsMatch[1]!, 10) : 0;

      const total = hours * 3600 + minutes * 60 + seconds;
      if (total > 0) return total;
    }

    // 2. Check time formats like "03:45" or "01:23:45"
    if (trimmed.includes(":")) {
      const parts = trimmed.split(":").map((p) => parseInt(p, 10));
      if (parts.every((p) => !isNaN(p))) {
        if (parts.length === 2) {
          return parts[0]! * 60 + parts[1]!;
        }
        if (parts.length === 3) {
          return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
        }
      }
    }

    // 3. Raw numeric string (e.g. "245")
    const num = Number(trimmed);
    if (!isNaN(num) && num > 0) {
      return Math.round(num);
    }
  }

  // Fallback placeholder duration (180s = 3:00) until the YouTube iframe plays and updates it
  return 180;
}

export function formatYouTubeTrack(item: any): Track {
  const videoId =
    (typeof item.id === "string" ? item.id : item.id?.videoId) ||
    item.videoId ||
    item.url ||
    "";

  const rawTitle = item.snippet?.title || item.title || "Unknown Title";
  const rawArtist = item.snippet?.channelTitle || item.artist || "YouTube Artist";

  // Check all possible locations where duration might be provided
  const durationValue =
    item.contentDetails?.duration ||
    item.duration ||
    item.durationSeconds ||
    item.lengthSeconds;

  return {
    id: videoId,
    videoId: videoId,
    url: videoId,
    title: decodeHTMLEntities(rawTitle),
    artist: decodeHTMLEntities(rawArtist),
    thumbnail:
      item.snippet?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.default?.url ||
      item.thumbnail ||
      thumb(videoId),
    duration: parseDuration(durationValue),
    votes: [],
    upvotes: 0,
  };
}