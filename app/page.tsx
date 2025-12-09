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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="h-4 w-4 bg-foreground rounded-full animate-bounce"></div>
          <p className="text-sm text-muted font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl mb-3">
            Memory Engine
          </h1>
          <p className="text-lg text-muted max-w-2xl">
            Your personal, connected, and evolving intelligence layer.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Actions & Feed */}
          <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-6">
            <section className="bg-white dark:bg-zinc-900/50 rounded-xl border border-border p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">New Memory</h2>
              <MemoryCreator onMemoryCreated={(memory) => setSelectedMemory(memory)} />
            </section>

            <section className="bg-white dark:bg-zinc-900/50 rounded-xl border border-border p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Search & Recall</h2>
              <SearchPanel onMemorySelect={(memory) => setSelectedMemory(memory)} />
            </section>
          </div>

          {/* Right Column: Inspector */}
          <div className="lg:col-span-12 xl:col-span-7">
            <div className="bg-white dark:bg-zinc-900/50 rounded-xl border border-border p-6 shadow-sm min-h-[600px]">
              <MemoryInspector memory={selectedMemory} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
