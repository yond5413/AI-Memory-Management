"use client";

import { useState } from "react";
import { MemoryCreator } from "@/app/components/MemoryCreator";
import { SearchPanel } from "@/app/components/SearchPanel";
import { MemoryInspector } from "@/app/components/MemoryInspector";
import type { Memory } from "@/app/lib/api";

export default function Home() {
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Semantic Memory System</h1>
          <p className="text-gray-600 mt-2">Persistent, connected, and evolving memory for AI systems</p>
        </div>
      </header>

      <main className="mx-auto px-4 py-8" style={{ maxWidth: "1600px" }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <MemoryCreator onMemoryCreated={(memory) => setSelectedMemory(memory)} />
          <SearchPanel onMemorySelect={(memory) => setSelectedMemory(memory)} />
        </div>

        <div className="mt-6">
          <MemoryInspector memory={selectedMemory} />
        </div>
      </main>
    </div>
  );
}
