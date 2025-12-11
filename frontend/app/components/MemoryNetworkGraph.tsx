"use client";

import { useEffect, useCallback, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import type { Memory, Relationship } from "@/app/lib/api";
import { createRelationship } from "@/app/lib/api";

interface MemoryNetworkGraphProps {
  memories: Memory[];
  relationships: Relationship[];
  onNodeClick?: (memoryId: string) => void;
  selectedMemoryId?: string | null;
  onRelationshipCreated?: () => void;
}

// Create dagre graph layout
const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = "TB"
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, ranksep: 150, nodesep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 200, height: 80 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 100,
        y: nodeWithPosition.y - 40,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export function MemoryNetworkGraph({
  memories,
  relationships,
  onNodeClick,
  selectedMemoryId,
  onRelationshipCreated,
}: MemoryNetworkGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [connectionMode, setConnectionMode] = useState(false);
  const [firstNode, setFirstNode] = useState<string | null>(null);
  const [isCreatingRelationship, setIsCreatingRelationship] = useState(false);

  // Update graph when data changes
  useEffect(() => {
    if (!memories || memories.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Create nodes from memories
    const memoryNodes: Node[] = memories.map((mem) => {
      const isSelected = selectedMemoryId === mem.id;
      const isOutdated = mem.status === "outdated";

      return {
        id: mem.id,
        type: "default",
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: {
          label: mem.content.substring(0, 50) + (mem.content.length > 50 ? "..." : ""),
          memory: mem,
        },
        style: {
          background: isSelected
            ? "#8b5cf6"
            : isOutdated
            ? "#4b5563"
            : "#10b981",
          color: "#fff",
          padding: "12px 16px",
          borderRadius: "12px",
          minWidth: "200px",
          maxWidth: "200px",
          border: isSelected ? "3px solid #a78bfa" : "2px solid transparent",
          boxShadow: isSelected
            ? "0 0 20px rgba(139, 92, 246, 0.6)"
            : "0 4px 6px rgba(0, 0, 0, 0.3)",
          fontSize: "12px",
          fontWeight: "500",
          transition: "all 0.2s ease",
        },
      };
    });

    // Create edges from relationships
    const relationshipEdges: Edge[] = relationships.map((rel) => {
      const edgeColor =
        rel.type === "update"
          ? "#ef4444"
          : rel.type === "derive"
          ? "#8b5cf6"
          : rel.type === "related"
          ? "#10b981"
          : "#3b82f6";

      return {
        id: rel.id,
        source: rel.from_memory,
        target: rel.to_memory,
        label: rel.type,
        type: "smoothstep",
        animated: rel.type === "derive",
        style: {
          stroke: edgeColor,
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 20,
          height: 20,
        },
        labelStyle: {
          fill: edgeColor,
          fontWeight: 600,
          fontSize: 10,
        },
        labelBgStyle: {
          fill: "#1a1a1a",
          fillOpacity: 0.8,
        },
      };
    });

    // Apply dagre layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      memoryNodes,
      relationshipEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [memories, relationships, selectedMemoryId, setNodes, setEdges]);

  const onNodeClickHandler = useCallback(
    async (event: React.MouseEvent, node: Node) => {
      if (connectionMode) {
        // Handle connection mode
        if (!firstNode) {
          // Select first node
          setFirstNode(node.id);
        } else if (firstNode !== node.id) {
          // Create relationship between first and second node
          setIsCreatingRelationship(true);
          try {
            await createRelationship(firstNode, {
              to: node.id,
              type: "related",
              description: "Manually connected",
            });
            // Reset connection mode
            setFirstNode(null);
            setConnectionMode(false);
            // Notify parent to refresh
            if (onRelationshipCreated) {
              onRelationshipCreated();
            }
          } catch (error) {
            console.error("Failed to create relationship:", error);
            alert("Failed to create connection. Please try again.");
          } finally {
            setIsCreatingRelationship(false);
          }
        }
      } else if (onNodeClick) {
        onNodeClick(node.id);
      }
    },
    [connectionMode, firstNode, onNodeClick, onRelationshipCreated]
  );

  const toggleConnectionMode = useCallback(() => {
    setConnectionMode((prev) => !prev);
    setFirstNode(null);
  }, []);

  const cancelConnection = useCallback(() => {
    setConnectionMode(false);
    setFirstNode(null);
  }, []);

  if (!memories || memories.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-lg">
        <p className="text-gray-400 text-lg">
          No memories yet. Create your first memory to see the network graph.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden relative">
      {connectionMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-purple-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            <span className="font-semibold">
              {firstNode
                ? "Click on a second node to connect"
                : "Click on a node to start connecting"}
            </span>
          </div>
          <button
            onClick={cancelConnection}
            disabled={isCreatingRelationship}
            className="px-3 py-1 bg-white text-purple-600 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
      
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={toggleConnectionMode}
          disabled={isCreatingRelationship}
          className={`px-4 py-2 rounded-lg shadow-lg font-semibold transition-all disabled:opacity-50 ${
            connectionMode
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {connectionMode ? "Exit Connect Mode" : "Connect Nodes"}
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickHandler}
        fitView
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={2}
      >
        <Background
          color="#4b5563"
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
        />
        <Controls className="bg-gray-800 border-gray-700" />
      </ReactFlow>
    </div>
  );
}

