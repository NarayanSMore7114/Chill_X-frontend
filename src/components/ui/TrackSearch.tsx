import { useState } from "react";
import { type Track, formatYouTubeTrack } from "@/lib/mock";

const BACKEND_URL =
  (import.meta.env["VITE_BACKEND_URL"] as string) || "http://localhost:8000";

interface TrackSearchProps {
  onSelectTrack: (track: Track) => void;
}

export function TrackSearch({ onSelectTrack }: TrackSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      // Normalize raw items through the formatter
      const formattedTracks: Track[] = (data.tracks || data.items || []).map(formatYouTubeTrack);
      setResults(formattedTracks);
    } catch (err) {
      console.error("Failed to fetch tracks:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs or artists on YouTube..."
          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium transition disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
        {results.map((track) => (
          <div
            key={track.id}
            onClick={() => onSelectTrack(track)}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/80 cursor-pointer transition border border-transparent hover:border-slate-700"
          >
            <img
              src={track.thumbnail}
              alt={track.title}
              className="w-12 h-12 rounded object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{track.title}</p>
              <p className="text-xs text-slate-400 truncate">{track.artist}</p>
            </div>
            <button
              type="button"
              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded"
            >
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}