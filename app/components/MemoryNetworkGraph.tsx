"use client";

import { useEffect, useCallback, useMemo } from "react";
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

interface MemoryNetworkGraphProps {
  memories: Memory[];
  relationships: Relationship[];
  onNodeClick?: (memoryId: string) => void;
  selectedMemoryId?: string | null;
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
}: MemoryNetworkGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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
    (event: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    },
    [onNodeClick]
  );

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
    <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden">
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

