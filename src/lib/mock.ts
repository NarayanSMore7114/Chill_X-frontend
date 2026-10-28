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
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
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

function decodeHTMLEntities(text: string): string {
  if (!text) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");
    return doc.documentElement.textContent || text;
  } catch {
    return text;
  }
}

export function formatYouTubeTrack(item: any): Track {
  const videoId = typeof item.id === "string" ? item.id : item.id?.videoId || item.videoId || "";
  const rawTitle = item.snippet?.title || item.title || "Unknown Title";
  const rawArtist = item.snippet?.channelTitle || item.artist || "YouTube Artist";

  return {
    id: videoId,
    videoId: videoId,
    url: videoId,
    title: decodeHTMLEntities(rawTitle),
    artist: decodeHTMLEntities(rawArtist),
    thumbnail:
      item.snippet?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.default?.url ||
      thumb(videoId),
    duration: item.duration || 180,
    votes: [],
    upvotes: 0,
  };
}