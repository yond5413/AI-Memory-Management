"use client";

import { useState } from "react";
import type { Memory } from "@/app/lib/api";
import { useMemoryLineage } from "@/app/hooks/useMemory";
import { MemoryGraph } from "@/app/components/MemoryGraph";
import { getMemory } from "@/app/lib/api";

interface MemoryInspectorProps {
  memory: Memory | null;
}

export function MemoryInspector({ memory }: MemoryInspectorProps) {
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(memory?.id || null);
  const { data: lineage, isLoading } = useMemoryLineage(selectedMemoryId);

  const handleNodeClick = async (memoryId: string) => {
    try {
      const mem = await getMemory(memoryId);
      setSelectedMemoryId(memoryId);
    } catch (err) {
      console.error("Failed to load memory:", err);
    }
  };

  if (!memory && !selectedMemoryId) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <p className="text-gray-500">Select a memory to view details</p>
      </div>
    );
  }

  const displayMemory = memory || (lineage?.memory);

  if (!displayMemory) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <p className="text-gray-500">Loading memory...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-2">Memory Details</h2>
        <div className="space-y-2">
          <p>
            <span className="font-medium">ID:</span> {displayMemory.id}
          </p>
          <p>
            <span className="font-medium">Status:</span>{" "}
            <span
              className={`px-2 py-1 rounded text-sm ${
                displayMemory.status === "current" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
              }`}
            >
              {displayMemory.status}
            </span>
          </p>
          <p>
            <span className="font-medium">Content:</span>
          </p>
          <p className="p-3 bg-gray-50 rounded">{displayMemory.content}</p>
          <p>
            <span className="font-medium">Created:</span>{" "}
            {new Date(displayMemory.created_at).toLocaleString()}
          </p>
          {displayMemory.metadata && Object.keys(displayMemory.metadata).length > 0 && (
            <div>
              <span className="font-medium">Metadata:</span>
              <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto">
                {JSON.stringify(displayMemory.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {lineage && (
        <div>
          <h3 className="text-lg font-semibold mb-2">Lineage Graph</h3>
          <MemoryGraph lineage={lineage} onNodeClick={handleNodeClick} />
        </div>
      )}

      {isLoading && <p className="text-gray-500">Loading lineage...</p>}
    </div>
  );
}

