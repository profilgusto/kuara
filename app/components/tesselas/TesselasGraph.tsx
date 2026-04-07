"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
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
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  TesselaFilterBar,
  applyFilters,
  deriveFilterOptions,
  type FilterState,
} from "./TesselaFilterBar";

// maskColor must be a concrete color value (SVG fill attribute — CSS variables not supported).
// Everything else uses CSS variables (hsl(var(--*))) so the browser resolves them at
// paint time via the cascade, immune to JS hydration timing issues.
const MINIMAP_MASK = {
  dark:  "hsla(160, 30%, 4%, 0.72)",
  light: "hsla(120, 10%, 60%, 0.25)",
} as const;

interface GraphItem {
  id: string;
  slug: string;
  title: string;
  abstract?: string | null;
  publishedAt?: string | null;
  tags: string[];
  project: string[];
  stage: string;
  coverImage?: { url: string; alt?: string } | null;
  relatedTesselas: { id: string }[];
}

interface TesselasGraphProps {
  data: GraphItem[];
}

const statusConfig: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  "em-andamento": {
    label: "Em andamento",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  finalizado: {
    label: "Finalizado",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  incrementando: {
    label: "Incrementando",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
};

interface NodeData {
  title: string;
  abstract?: string | null;
  publishedAt?: string | null;
  slug: string;
  tags: string[];
  project: string[];
  stage: string;
  coverImage?: { url: string; alt?: string } | null;
  [key: string]: unknown;
}

// Custom Node — visually identical to the card on /tesselas, clickable
const TesselaNode = ({ data }: { data: NodeData }) => {
  const router = useRouter();
  const status = statusConfig[data.stage] || statusConfig["rascunho"];

  return (
    // Outer wrapper: rounded + shadow. No overflow-hidden — inner div handles clipping.
    // BT layout: target (citer) handle at bottom, source (cited) handle at top.
    <div
      className="group relative rounded-xl shadow-sm hover:shadow-md transition-all w-[280px] h-[160px] cursor-pointer"
      onClick={() => router.push(`/tesselas/${data.slug}`)}
    >
      {/* BT layout: arrows arrive from below (target = this citer node) */}
      <Handle type="target" position={Position.Bottom} className="w-2 h-2 opacity-0" />

      {/* Tag chips — top-right corner */}
      {data.tags?.length > 0 && (
        <div className="absolute top-2 right-2 z-20 flex flex-wrap justify-end gap-1 pointer-events-none">
          {(data.tags as string[]).slice(0, 3).map((tag: string) =>
            data.coverImage ? (
              <span
                key={tag}
                className="text-[9px] uppercase tracking-wider bg-black/40 text-white/80 px-1.5 py-0.5 rounded-sm backdrop-blur-sm"
              >
                {tag}
              </span>
            ) : (
              <span
                key={tag}
                className="text-[9px] uppercase tracking-wider border bg-background/80 text-muted-foreground px-1.5 py-0.5 rounded-sm"
              >
                {tag}
              </span>
            )
          )}
        </div>
      )}

      {data.coverImage ? (
        // Inner div clips image with rounded corners, outer div keeps shadow visible
        <div className="absolute inset-0 rounded-xl overflow-hidden">
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
          <div className="relative z-10 p-5 h-full flex flex-col justify-end text-left pointer-events-none">
            {data.project.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-white/60 mb-1">
                {data.project.join(" · ")}
              </span>
            )}
            <h2 className="font-semibold text-lg leading-snug text-white drop-shadow line-clamp-2">
              {data.title}
            </h2>
            {data.abstract && (
              <p className="text-sm text-white/80 line-clamp-2 drop-shadow mt-1">
                {data.abstract}
              </p>
            )}
            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-2 pt-2 mt-auto">
              {data.publishedAt && (
                <span className="text-[11px] text-white/60">
                  ·{" "}
                  {new Date(data.publishedAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
              <span
                className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ml-auto ${status.className}`}
              >
                {status.label}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 rounded-xl overflow-hidden border bg-card group-hover:border-primary/30 transition-all">
          <div className="p-5 h-full flex flex-col gap-2 text-left pointer-events-none">
            {data.project.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                {data.project.join(" · ")}
              </span>
            )}
            <h2 className="font-semibold text-lg leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {data.title}
            </h2>
            {data.abstract && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {data.abstract}
              </p>
            )}
            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-2 pt-2 mt-auto">
              {data.publishedAt && (
                <span className="text-[11px] text-muted-foreground">
                  ·{" "}
                  {new Date(data.publishedAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              )}
              <span
                className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ml-auto ${status.className}`}
              >
                {status.label}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* BT layout: arrows leave upward (source = this cited node) */}
      <Handle type="source" position={Position.Top} className="w-2 h-2 opacity-0" />
    </div>
  );
};

const nodeTypes = { tessela: TesselaNode };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildLayoutedElements(filteredData: GraphItem[]): { nodes: any[]; edges: any[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 280;
  const nodeHeight = 160;
  // BT = bottom-to-top: citers (sources of citations) render above cited nodes
  dagreGraph.setGraph({ rankdir: "BT", nodesep: 50, ranksep: 100 });

  const nodes = filteredData.map((item) => ({
    id: String(item.id),
    type: "tessela",
    data: {
      title: item.title,
      abstract: item.abstract,
      publishedAt: item.publishedAt,
      slug: item.slug,
      tags: item.tags,
      project: item.project,
      stage: item.stage,
      coverImage: item.coverImage,
    },
    position: { x: 0, y: 0 },
  }));

  nodes.forEach((n) => dagreGraph.setNode(n.id, { width: nodeWidth, height: nodeHeight }));

  const validNodeIds = new Set(nodes.map((n) => n.id));
  const seenEdges = new Set<string>();
  const edges: ReturnType<typeof buildEdge>[] = [];

  // Arrow: cited → citer
  filteredData.forEach((item) => {
    if (!Array.isArray(item.relatedTesselas)) return;
    item.relatedTesselas.forEach((rel) => {
      const citedId = String(rel.id);
      const citerId = String(item.id);
      const edgeId = `${citedId}-${citerId}`;
      if (
        validNodeIds.has(citedId) &&
        validNodeIds.has(citerId) &&
        !seenEdges.has(edgeId)
      ) {
        seenEdges.add(edgeId);
        edges.push(buildEdge(edgeId, citedId, citerId));
      }
    });
  });

  edges.forEach((e) => dagreGraph.setEdge(e.source, e.target));
  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const pos = dagreGraph.node(node.id);
    node.position = { x: pos.x - nodeWidth / 2, y: pos.y - nodeHeight / 2 };
    // BT layout: source (cited) handle at top, target (citer) handle at bottom
    (node as Record<string, unknown>).sourcePosition = Position.Top;
    (node as Record<string, unknown>).targetPosition = Position.Bottom;
  });

  return { nodes, edges };
}

function buildEdge(id: string, source: string, target: string) {
  return {
    id,
    source,
    target,
    animated: false,
    label: "",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: "#888",
    },
    style: { stroke: "#888", strokeWidth: 2 },
  };
}

export function TesselasGraph({ data }: TesselasGraphProps) {
  // Detect theme — default to dark (the app default) until mounted
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = !mounted || resolvedTheme !== "light";
  const maskColor = isDark ? MINIMAP_MASK.dark : MINIMAP_MASK.light;

  const [filters, setFilters] = useState<FilterState>({
    tags: [],
    projects: [],
    stages: [],
  });

  const { tags: allTags, projects: allProjects, stages: allStages } =
    useMemo(() => deriveFilterOptions(data), [data]);

  const filteredData = useMemo(
    () => applyFilters(data, filters),
    [data, filters]
  );

  const layouted = useMemo(
    () => buildLayoutedElements(filteredData),
    [filteredData]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges);

  // Sync ReactFlow state when filter-driven layout changes
  const prevLayoutRef = useRef(layouted);
  useEffect(() => {
    if (layouted !== prevLayoutRef.current) {
      prevLayoutRef.current = layouted;
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
    }
  }, [layouted, setNodes, setEdges]);

  function toggleTag(tag: string) {
    setFilters((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  }
  function toggleProject(project: string) {
    setFilters((f) => ({
      ...f,
      projects: f.projects.includes(project)
        ? f.projects.filter((p) => p !== project)
        : [...f.projects, project],
    }));
  }
  function toggleStage(stage: string) {
    setFilters((f) => ({
      ...f,
      stages: f.stages.includes(stage)
        ? f.stages.filter((s) => s !== stage)
        : [...f.stages, stage],
    }));
  }

  return (
    <div className="w-full h-full flex flex-col min-h-[600px]">
      {/* Filter bar */}
      {(allTags.length > 0 || allProjects.length > 0 || allStages.length > 0) && (
        <div className="px-4 pt-4 pb-3 border-b">
          <TesselaFilterBar
            allTags={allTags}
            allProjects={allProjects}
            allStages={allStages}
            filters={filters}
            onTagToggle={toggleTag}
            onProjectToggle={toggleProject}
            onStageToggle={toggleStage}
            onClear={() => setFilters({ tags: [], projects: [], stages: [] })}
          />
        </div>
      )}

      {/* Graph canvas */}
      <div className="flex-1 bg-background relative" style={{ borderRadius: "0 0 0.75rem 0.75rem", overflow: "hidden" }}>
        {/*
          Only CSS that cannot be set via ReactFlow props lives here.
          Background colors for minimap/controls are set via JS style props
          (immune to CSS cascade) to avoid being overridden by ReactFlow's
          bundled stylesheet which Next.js may inject after this tag.
        */}
        <style>{`
          /* Prevent ReactFlow's own colorMode styles from overriding Kuara's bg-background */
          .react-flow,
          .react-flow__renderer,
          .react-flow__container {
            background: transparent !important;
          }
          .react-flow__node-tessela {
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
            color: hsl(var(--foreground)) !important;
            width: 280px !important;
            height: 160px !important;
          }
          .react-flow__node-tessela.selected > div,
          .react-flow__node-tessela:focus > div {
            outline: 2px solid hsl(var(--primary));
            outline-offset: 2px;
            border-radius: 0.75rem;
          }
          /* Controls: force Kuara palette on each button (overrides ReactFlow's built-in light/dark themes).
             CSS variables resolve at paint time via the cascade — immune to JS hydration timing. */
          .react-flow__controls-button {
            background-color: hsl(var(--card)) !important;
            border-bottom-color: hsl(var(--border)) !important;
            fill: hsl(var(--foreground)) !important;
            color: hsl(var(--foreground)) !important;
          }
          .react-flow__controls-button:hover {
            background-color: hsl(var(--muted)) !important;
          }
          .react-flow__controls-button svg {
            fill: hsl(var(--foreground)) !important;
          }
          /* Minimap: CSS variable on the container div — transparent SVG lets it show through */
          .react-flow__minimap {
            background-color: hsl(var(--card)) !important;
          }
          .react-flow__minimap-node {
            fill: hsl(var(--primary)) !important;
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
          colorMode={isDark ? "dark" : "light"}
          attributionPosition="bottom-right"
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <Background
            gap={24}
            size={1}
            color="hsl(var(--primary))"
            className="opacity-[0.08]"
          />
          <Controls
            showInteractive={false}
            className="opacity-80 hover:opacity-100 transition-opacity"
            style={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              overflow: "hidden",
            }}
          />
          {/* maskColor must be a concrete value (SVG fill attr — CSS vars unsupported there) */}
          <MiniMap
            zoomable
            pannable
            className="opacity-80 hover:opacity-100 transition-opacity"
            style={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
            }}
            maskColor={maskColor}
            nodeColor="hsl(137 48% 46%)"
          />
        </ReactFlow>

        {filteredData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm pointer-events-none">
            Nenhuma tessela corresponde aos filtros selecionados.
          </div>
        )}
      </div>
    </div>
  );
}
