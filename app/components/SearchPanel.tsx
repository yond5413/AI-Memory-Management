"use client";

import { useState } from "react";
import { searchMemories, type Memory } from "@/app/lib/api";

export function SearchPanel({ onMemorySelect }: { onMemorySelect?: (memory: Memory) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const searchResults = await searchMemories(query);
      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Semantic Search</h2>
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories..."
            className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
        </div>
      </form>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <div className="space-y-2">
        {results.map((memory) => (
          <div
            key={memory.id}
            onClick={() => onMemorySelect?.(memory)}
            className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
          >
            <p className="text-sm font-medium">{memory.content.substring(0, 100)}...</p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(memory.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
        {results.length === 0 && query && !isLoading && !error && (
          <p className="text-gray-500 text-sm">No results found</p>
        )}
      </div>
    </div>
  );
}


