import dagre from "@dagrejs/dagre";

const nodes = [
  { id: "node-1" },
  { id: "node-2" }
];

const edges = [
  { source: "node-1", target: "node-2" },
  { source: "node-2", target: "node-3" } // node-3 is NOT in nodes array
];

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

dagreGraph.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 100 });

nodes.forEach((node) => {
  dagreGraph.setNode(node.id, { width: 280, height: 130 });
});

edges.forEach((edge) => {
  dagreGraph.setEdge(edge.source, edge.target);
});

try {
  dagre.layout(dagreGraph);
  console.log("Layout successful");
  nodes.forEach(node => {
     console.log(node.id, dagreGraph.node(node.id));
  });
} catch (e) {
  console.error("Layout failed:", e);
}
