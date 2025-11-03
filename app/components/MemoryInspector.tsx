"use client";

import { useState } from "react";
import type { Memory } from "@/app/lib/api";
import { useMemoryLineage, useMemoryGraph } from "@/app/hooks/useMemory";
import { MemoryGraph } from "@/app/components/MemoryGraph";
import { MemoryNetworkGraph } from "@/app/components/MemoryNetworkGraph";
import { getMemory } from "@/app/lib/api";

type ViewMode = "lineage" | "network";

interface MemoryInspectorProps {
  memory: Memory | null;
}

export function MemoryInspector({ memory }: MemoryInspectorProps) {
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(memory?.id || null);
  const [viewMode, setViewMode] = useState<ViewMode>("network");
  const { data: lineage, isLoading } = useMemoryLineage(selectedMemoryId);
  const { data: graphData, isLoading: isLoadingGraph } = useMemoryGraph();

  const handleNodeClick = async (memoryId: string) => {
    try {
      const mem = await getMemory(memoryId);
      setSelectedMemoryId(memoryId);
    } catch (err) {
      console.error("Failed to load memory:", err);
    }
  };

  const displayMemory = memory || (lineage?.memory);

  return (
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div className="flex gap-2 p-4 bg-white rounded-lg shadow-md">
        <button
          onClick={() => setViewMode("network")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === "network"
              ? "bg-purple-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Full Network
        </button>
        <button
          onClick={() => setViewMode("lineage")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            viewMode === "lineage"
              ? "bg-purple-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
          disabled={!selectedMemoryId && !memory}
        >
          Lineage View
        </button>
        {graphData && (
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">{graphData.memories.length}</span>
            <span>memories</span>
            <span className="mx-2">•</span>
            <span className="font-medium">{graphData.relationships.length}</span>
            <span>relationships</span>
          </div>
        )}
      </div>

      {/* Graph View */}
      {viewMode === "network" && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ height: "600px" }}>
          {isLoadingGraph && (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-gray-500">Loading network graph...</p>
            </div>
          )}
          {graphData && !isLoadingGraph && (
            <MemoryNetworkGraph
              memories={graphData.memories}
              relationships={graphData.relationships}
              onNodeClick={handleNodeClick}
              selectedMemoryId={selectedMemoryId}
            />
          )}
        </div>
      )}

      {viewMode === "lineage" && (
        <div className="space-y-4">
          {!memory && !selectedMemoryId && (
            <div className="p-6 bg-white rounded-lg shadow-md">
              <p className="text-gray-500">Select a memory to view its lineage</p>
            </div>
          )}

          {displayMemory && (
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
                        displayMemory.status === "current"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
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
          )}
        </div>
      )}
    </div>
  );
}

