"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/AuthProvider";
import { Header } from "@/app/components/Header";
import { MemoryCreator } from "@/app/components/MemoryCreator";
import { SearchPanel } from "@/app/components/SearchPanel";
import { MemoryInspector } from "@/app/components/MemoryInspector";
import type { Memory } from "@/app/lib/api";

export default function Home() {
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto px-4 py-8" style={{ maxWidth: "1600px" }}>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">AI Memory System</h1>
          <p className="text-gray-600 mt-2">Your personal, connected, and evolving memory</p>
        </div>

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
