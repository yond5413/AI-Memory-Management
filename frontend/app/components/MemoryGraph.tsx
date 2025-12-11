"use client";

import { useEffect, useCallback } from "react";
import ReactFlow, { Background, Controls, Node, Edge, useNodesState, useEdgesState } from "reactflow";
import "reactflow/dist/style.css";
import type { LineageResponse } from "@/app/lib/api";

interface MemoryGraphProps {
  lineage: LineageResponse | null;
  onNodeClick?: (memoryId: string) => void;
}

export function MemoryGraph({ lineage, onNodeClick }: MemoryGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Update graph when lineage changes
  useEffect(() => {
    if (!lineage) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const memoryNodes: Node[] = [
      {
        id: lineage.memory.id,
        type: "default",
        position: { x: 250, y: 100 },
        data: {
          label: lineage.memory.content.substring(0, 50) + "...",
          memory: lineage.memory,
        },
        style: {
          background: lineage.memory.status === "current" ? "#10b981" : "#6b7280",
          color: "#fff",
          padding: "10px",
          borderRadius: "8px",
          minWidth: "200px",
        },
      },
    ];

    // Add related memories
    const relatedNodes: Node[] = lineage.related_memories
      .filter((mem) => mem.id !== lineage.memory.id)
      .map((mem, idx) => ({
        id: mem.id,
        type: "default",
        position: { x: 100 + idx * 200, y: 300 },
        data: {
          label: mem.content.substring(0, 50) + "...",
          memory: mem,
        },
        style: {
          background: mem.status === "current" ? "#10b981" : "#6b7280",
          color: "#fff",
          padding: "10px",
          borderRadius: "8px",
          minWidth: "200px",
        },
      }));

    const graphEdges: Edge[] = lineage.relationships.map((rel) => ({
      id: rel.id,
      source: rel.from_memory,
      target: rel.to_memory,
      label: rel.type,
      style: {
        stroke: rel.type === "update" ? "#ef4444" : rel.type === "derive" ? "#8b5cf6" : "#3b82f6",
      },
    }));

    setNodes([...memoryNodes, ...relatedNodes]);
    setEdges(graphEdges);
  }, [lineage, setNodes, setEdges]);

  const onNodeClickHandler = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    },
    [onNodeClick]
  );

  return (
    <div style={{ width: "100%", height: "600px" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickHandler}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

