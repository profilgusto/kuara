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
  coverImage?: { url: string; alt?: string } | null;
  relatedCadernos: { id: string }[];
}

interface CadernosGraphProps {
  data: GraphItem[];
}

const statusConfig: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  "em-andamento": { label: "Em andamento", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  finalizado: { label: "Finalizado", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  incrementando: { label: "Incrementando", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
};

// Custom Node component
const CadernoNode = ({ data }: { data: any }) => {
  const status = statusConfig[data.stage] || statusConfig["rascunho"];

  return (
    <div className="group relative block rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md border bg-card hover:border-primary/30 w-[280px] h-[160px]">
      <Handle type="target" position={Position.Top} className="w-2 h-2 opacity-0" />
      
      {data.coverImage ? (
        <>
          <img
            src={data.coverImage.url}
            alt={data.coverImage.alt ?? data.title}
            className="absolute inset-0 object-cover w-full h-full"
          />
          <div
            className="absolute inset-0 z-0"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.55)",
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
            }}
          />
          <div className="relative z-10 p-5 space-y-1 h-full flex flex-col justify-end text-left pointer-events-none">
            {data.project && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-white/60">
                {data.project}
              </span>
            )}
            <h2 className="font-semibold text-lg leading-snug text-white drop-shadow line-clamp-2">
              {data.title}
            </h2>
            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-2 pt-2 mt-auto">
              <span className={`text-[10px] pointer-events-auto uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ml-auto ${status.className}`}>
                {status.label}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="p-5 h-full flex flex-col gap-2 relative z-10 text-left pointer-events-none">
          <h2 className="font-semibold text-lg leading-snug text-foreground transition-colors line-clamp-2">
            {data.title}
          </h2>

          {data.project && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {data.project}
            </p>
          )}

          {(data.tags?.length > 0 || data.stage) && (
            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-2 pt-2 mt-auto">
              {data.tags?.slice(0, 2).map((tag: string) => (
                <span key={tag} className="text-[11px] pointer-events-auto text-muted-foreground border bg-background px-1.5 py-0.5 rounded-sm whitespace-nowrap">
                  {tag}
                </span>
              ))}
              <span className={`text-[10px] pointer-events-auto uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ml-auto ${status.className}`}>
                {status.label}
              </span>
            </div>
          )}
        </div>
      )}
      
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
      id: String(item.id),
      type: "caderno",
      data: {
        title: item.title,
        slug: item.slug,
        tags: item.tags,
        project: item.project,
        stage: item.stage,
        coverImage: item.coverImage,
      },
      position: { x: 0, y: 0 },
    }));

    const validNodeIds = new Set(nodes.map((n) => n.id));
    const edges: any[] = [];
    
    data.forEach((item) => {
      if (Array.isArray(item.relatedCadernos)) {
        item.relatedCadernos.forEach((rel) => {
          const sourceId = String(item.id);
          const targetId = String(rel.id);
          
          if (validNodeIds.has(sourceId) && validNodeIds.has(targetId)) {
            edges.push({
              id: `${sourceId}-${targetId}`,
              source: sourceId,
              target: targetId,
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
          }
        });
      }
    });

    return getLayoutedElements(nodes, edges);
  }, [data]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialElements.edges);

  return (
    <div className="w-full h-full min-h-[600px] bg-background relative" style={{ borderRadius: '0.75rem', overflow: 'hidden' }}>
      <style>{`
        .react-flow__node-caderno {
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
          box-shadow: none !important;
          color: hsl(var(--foreground)) !important;
          width: 280px;
          height: 160px;
        }
        .react-flow__controls button {
          background-color: hsl(var(--card));
          border-bottom: 1px solid hsl(var(--border));
          fill: hsl(var(--foreground));
          transition: background-color 0.2s;
        }
        .react-flow__controls button:hover {
          background-color: hsl(var(--muted));
        }
        .react-flow__minimap {
          background-color: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
        }
        .react-flow__minimap-mask {
          fill: hsl(var(--background));
          opacity: 0.7;
        }
      `}</style>
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
        <Background gap={24} size={1} color="hsl(var(--primary))" className="opacity-[0.08]" />
        <Controls showInteractive={false} className="opacity-80 hover:opacity-100 transition-opacity" />
        <MiniMap zoomable pannable nodeColor="hsl(var(--primary))" className="opacity-80 hover:opacity-100 transition-opacity" />
      </ReactFlow>
    </div>
  );
}
