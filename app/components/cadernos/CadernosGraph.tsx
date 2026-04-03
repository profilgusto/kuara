"use client";

import React, { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import Link from "next/link";

interface GraphItem {
  id: string;
  slug: string;
  title: string;
  tags: string[];
  project?: string;
  stage: string;
  relatedCadernos: { id: string }[];
}

interface CadernosGraphProps {
  data: GraphItem[];
}

const statusColorMap: Record<string, string> = {
  rascunho: "border-muted/30 bg-muted/20 hover:border-muted",
  "em-andamento": "border-amber-400 bg-amber-100 hover:border-amber-500",
  finalizado: "border-emerald-400 bg-emerald-100 hover:border-emerald-500",
  incrementando: "border-blue-400 bg-blue-100 hover:border-blue-500",
};

const statusTextMap: Record<string, string> = {
  rascunho: "text-muted-foreground",
  "em-andamento": "text-amber-800",
  finalizado: "text-emerald-800",
  incrementando: "text-blue-800",
};

// Custom Node component
const CadernoNode = ({ data }: { data: any }) => {
  const statusColor = statusColorMap[data.stage] || statusColorMap["rascunho"];
  const statusText = statusTextMap[data.stage] || statusTextMap["rascunho"];

  return (
    <div
      className={`p-4 w-[280px] rounded-xl border-2 shadow-sm transition-colors cursor-pointer group ${statusColor}`}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 opacity-0" />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span
            className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm bg-white/40 ${statusText}`}
          >
            {data.stage.replace("-", " ")}
          </span>
          {data.project && (
            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">
              {data.project}
            </span>
          )}
        </div>
        <h3 className="font-semibold text-sm leading-tight">
          <Link
            href={`/cadernos/${data.slug}`}
            className="hover:underline line-clamp-2"
          >
            {data.title}
          </Link>
        </h3>
        {data.tags && data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {data.tags.slice(0, 4).map((tag: string) => (
              <span
                key={tag}
                className="text-[10px] bg-background/50 text-foreground px-1.5 py-0.5 rounded-full whitespace-nowrap"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 opacity-0" />
    </div>
  );
};

const nodeTypes = {
  caderno: CadernoNode,
};

const getLayoutedElements = (nodes: any[], edges: any[], direction = "TB") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 280;
  const nodeHeight = 130;

  dagreGraph.setGraph({ rankdir: direction, nodesep: 50, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    // Adjusted translation for xyflow (top-left instead of center)
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
    node.targetPosition = Position.Top;
    node.sourcePosition = Position.Bottom;
  });

  return { nodes, edges };
};

export function CadernosGraph({ data }: CadernosGraphProps) {
  const initialElements = useMemo(() => {
    const nodes = data.map((item) => ({
      id: item.id,
      type: "caderno",
      data: {
        title: item.title,
        slug: item.slug,
        tags: item.tags,
        project: item.project,
        stage: item.stage,
      },
      position: { x: 0, y: 0 },
    }));

    const edges: any[] = [];
    data.forEach((item) => {
      item.relatedCadernos.forEach((rel) => {
        edges.push({
          id: `${item.id}-${rel.id}`,
          source: item.id,
          target: rel.id,
          animated: false,
          label: "",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: "#888",
          },
          style: {
            stroke: "#888",
            strokeWidth: 2,
          },
        });
      });
    });

    return getLayoutedElements(nodes, edges);
  }, [data]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialElements.edges);

  return (
    <div className="w-full h-full min-h-[600px] bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap zoomable pannable />
      </ReactFlow>
    </div>
  );
}
