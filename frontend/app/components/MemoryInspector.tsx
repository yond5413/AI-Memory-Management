"use client";

import { useState, useEffect, useRef } from "react";
import type { Memory } from "@/app/lib/api";
import { useMemoryLineage, useMemoryGraph, memoryMutations } from "@/app/hooks/useMemory";
import { MemoryGraph } from "@/app/components/MemoryGraph";
import { MemoryNetworkGraph } from "@/app/components/MemoryNetworkGraph";
import { getMemory } from "@/app/lib/api";
import { useSWRConfig } from "swr";

type ViewMode = "lineage" | "network";

interface MemoryInspectorProps {
  memory: Memory | null;
}

export function MemoryInspector({ memory }: MemoryInspectorProps) {
  const { mutate } = useSWRConfig();
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(memory?.id || null);
  const [viewMode, setViewMode] = useState<ViewMode>("network");
  const [isDeleting, setIsDeleting] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  
  const { data: lineage, isLoading } = useMemoryLineage(selectedMemoryId);
  const { data: graphData, isLoading: isLoadingGraph } = useMemoryGraph();

  // Scroll to details when a memory is selected
  useEffect(() => {
    if (selectedMemoryId && detailsRef.current) {
      detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedMemoryId]);

  const handleNodeClick = async (memoryId: string) => {
    try {
      const mem = await getMemory(memoryId);
      setSelectedMemoryId(memoryId);
    } catch (err) {
      console.error("Failed to load memory:", err);
    }
  };

  const handleDelete = async () => {
    if (!selectedMemoryId) return;
    
    if (window.confirm("Are you sure you want to delete this memory? This action cannot be undone.")) {
      setIsDeleting(true);
      try {
        await memoryMutations.delete(selectedMemoryId);
        
        // Reset selection
        setSelectedMemoryId(null);
        
        // Refresh graph data
        mutate('/memories/graph');
        
        alert("Memory deleted successfully");
      } catch (error) {
        console.error("Failed to delete memory:", error);
        alert("Failed to delete memory");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Close details panel
  const handleCloseDetails = () => {
    setSelectedMemoryId(null);
  };

  const displayMemory = memory || (selectedMemoryId === lineage?.memory?.id ? lineage?.memory : null) || (graphData?.memories.find(m => m.id === selectedMemoryId));

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

      {/* Visualization Area */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ height: "600px" }}>
        {viewMode === "network" && (
          <>
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
                onRelationshipCreated={() => mutate('/memories/graph')}
              />
            )}
          </>
        )}

        {viewMode === "lineage" && (
          <div className="h-full overflow-auto p-4">
            {!memory && !selectedMemoryId && (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Select a memory to view its lineage</p>
              </div>
            )}

            {lineage && (
              <div className="h-full">
                <MemoryGraph lineage={lineage} onNodeClick={handleNodeClick} />
              </div>
            )}
            
            {isLoading && (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Loading lineage...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Persistent Details Panel */}
      {displayMemory && (
        <div ref={detailsRef} className="p-6 bg-white rounded-lg shadow-md space-y-4 relative border-t-4 border-purple-600">
          <div className="absolute top-4 right-4 flex gap-2">
            {/* Delete Button */}
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
              title="Delete Memory"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            
            {/* Close Button */}
            <button 
              onClick={handleCloseDetails}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-50"
              title="Close Details"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2 pr-20">Memory Details</h2>
            <div className="space-y-2">
              <p>
                <span className="font-medium">ID:</span> <span className="font-mono text-sm text-gray-600">{displayMemory.id}</span>
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
              <div className="pt-2">
                <span className="font-medium block mb-1">Content:</span>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-gray-800 leading-relaxed">
                  {displayMemory.content}
                </div>
              </div>
              <p className="text-sm text-gray-500 pt-2">
                <span className="font-medium">Created:</span>{" "}
                {new Date(displayMemory.created_at).toLocaleString()}
              </p>
              {displayMemory.metadata && Object.keys(displayMemory.metadata).length > 0 && (
                <div className="pt-2">
                  <span className="font-medium block mb-1">Metadata:</span>
                  <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-auto">
                    {JSON.stringify(displayMemory.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}