"use client";

import { useCallback, useMemo, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Panel,
  MarkerType,
  NodeProps,
  Handle,
  Position,
} from "reactflow";
import { toPng } from "html-to-image";
import "reactflow/dist/style.css";
import dagre from "@dagrejs/dagre";
import { User, Lock, ChevronDown, ChevronUp } from "lucide-react";
import Image from "next/image";

// Types
interface PersonData {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  firstNameAr?: string | null;
  middleNameAr?: string | null;
  lastNameAr?: string | null;
  nickname?: string | null;
  birthYear?: number | null;
  deathYear?: number | null;
  photoUrl?: string | null;
  gender?: string | null;
  isPrivate?: boolean;
  hideBirthYear?: boolean;
  tags?: string | null;
}

interface RelationshipData {
  id: string;
  type: string;
  subtype?: string | null;
  fromId: string;
  toId: string;
  startYear?: number | null;
  endYear?: number | null;
}

export interface FamilyTreeCanvasHandle {
  captureFullTree: () => Promise<void>;
}

interface FamilyTreeCanvasProps {
  people: PersonData[];
  relationships: RelationshipData[];
  onPersonClick: (personId: string) => void;
  onAddPerson: () => void;
  focusPersonId?: string | null;
  layoutMode: "ancestors" | "descendants" | "mixed";
  generations: number;
  spaceName?: string;
}

// Custom node component for person cards
function PersonNode({ data, selected }: NodeProps) {
  const person = data.person as PersonData;
  const fullName = [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ");
  const arabicName = (person.firstNameAr || person.middleNameAr || person.lastNameAr)
    ? [person.firstNameAr, person.middleNameAr, person.lastNameAr].filter(Boolean).join(" ")
    : null;
  const isDeceased = person.deathYear != null;

  return (
    <div
      className={`bg-white rounded-xl border-2 shadow-md px-3 py-2.5 min-w-[160px] max-w-[220px] cursor-pointer transition-all hover:shadow-lg ${
        selected ? "border-[#2b6cb0] shadow-blue-100" : "border-[#e2e8f0]"
      } ${data.focused ? "ring-2 ring-[#ed8936] ring-offset-2" : ""}`}
      onClick={() => data.onClick?.(person.id)}
    >
      <Handle type="target" position={Position.Top} className="!bg-[#2b6cb0] !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-[#2b6cb0] !w-2 !h-2 !border-0" />
      {/* Spouse handles */}
      <Handle type="target" position={Position.Left} id="spouse-left" className="!bg-[#38a169] !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Right} id="spouse-right" className="!bg-[#38a169] !w-2 !h-2 !border-0" />

      <div className="flex items-center gap-2.5">
        <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
          {person.photoUrl ? (
            <Image src={person.photoUrl} alt={fullName} fill className="object-cover" sizes="40px" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${
              person.gender === "male" ? "bg-blue-100 text-blue-500" :
              person.gender === "female" ? "bg-pink-100 text-pink-500" :
              "bg-gray-100 text-gray-400"
            }`}>
              <User className="w-5 h-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sm truncate leading-tight">{fullName}</span>
            {person.isPrivate && <Lock className="w-3 h-3 text-[#718096] flex-shrink-0" />}
          </div>
          {arabicName && (
            <p className="text-[11px] text-[#718096] leading-tight" dir="rtl">{arabicName}</p>
          )}
          <p className="text-[11px] text-[#718096] leading-tight mt-0.5">
            {person.nickname ? `"${person.nickname}" ` : ""}
            {!person.hideBirthYear && person.birthYear ? `b. ${person.birthYear}` : ""}
            {isDeceased ? ` - d. ${person.deathYear}` : ""}
          </p>
        </div>
      </div>

      {/* Collapse indicators */}
      {data.hasChildren && !data.expanded && (
        <div className="flex justify-center mt-1">
          <ChevronDown className="w-3.5 h-3.5 text-[#718096]" />
        </div>
      )}
      {data.hasParents && !data.expandedUp && (
        <div className="flex justify-center -mt-0.5 mb-0.5">
          <ChevronUp className="w-3.5 h-3.5 text-[#718096]" />
        </div>
      )}
    </div>
  );
}

const nodeTypes = { person: PersonNode };

// Dagre layout helper
const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;
const SPOUSE_GAP = 40;

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  spousePairs: [string, string][],
  direction: "TB" | "BT" = "TB"
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100, marginx: 40, marginy: 40 });

  // For spouse pairs, only add one "compound" node to dagre to keep them in the same rank
  const spousePartner = new Map<string, string>(); // partner → primary
  const primarySpouses = new Set<string>();
  for (const [a, b] of spousePairs) {
    // Pick whichever is already a primary, or default to `a`
    if (spousePartner.has(a)) continue; // already assigned
    if (primarySpouses.has(b)) {
      // b is already primary for someone else; make a primary too separately
      // skip pairing to avoid conflicts
      continue;
    }
    primarySpouses.add(a);
    spousePartner.set(b, a);
  }

  nodes.forEach((node) => {
    if (spousePartner.has(node.id)) {
      // This node is a spouse partner — give the primary extra width so dagre reserves space
      return;
    }
    const extraWidth = primarySpouses.has(node.id) ? NODE_WIDTH + SPOUSE_GAP : 0;
    g.setNode(node.id, { width: NODE_WIDTH + extraWidth, height: NODE_HEIGHT });
  });

  // Only feed parent-child edges to dagre (skip spouse edges)
  const spouseEdgeIds = new Set(
    edges.filter((e) => e.sourceHandle === "spouse-right" || e.targetHandle === "spouse-left").map((e) => e.id)
  );
  edges.forEach((edge) => {
    if (spouseEdgeIds.has(edge.id)) return;
    // Only add edge if both nodes are in the graph
    const src = spousePartner.has(edge.source) ? spousePartner.get(edge.source)! : edge.source;
    const tgt = spousePartner.has(edge.target) ? spousePartner.get(edge.target)! : edge.target;
    if (g.hasNode(src) && g.hasNode(tgt)) {
      g.setEdge(src, tgt);
    }
  });

  dagre.layout(g);

  const posMap = new Map<string, { x: number; y: number }>();
  nodes.forEach((node) => {
    if (spousePartner.has(node.id)) return;
    const n = g.node(node.id);
    if (!n) return;
    posMap.set(node.id, { x: n.x - NODE_WIDTH / 2, y: n.y - NODE_HEIGHT / 2 });
  });

  // Position spouse partners next to their primary
  for (const [partnerId, primaryId] of spousePartner.entries()) {
    const primaryPos = posMap.get(primaryId);
    if (primaryPos) {
      posMap.set(partnerId, {
        x: primaryPos.x + NODE_WIDTH + SPOUSE_GAP,
        y: primaryPos.y,
      });
    }
  }

  const layoutedNodes = nodes.map((node) => ({
    ...node,
    position: posMap.get(node.id) || { x: 0, y: 0 },
  }));

  return { nodes: layoutedNodes, edges };
}

const FamilyTreeCanvasInner = forwardRef<FamilyTreeCanvasHandle, FamilyTreeCanvasProps>(function FamilyTreeCanvasInner({
  people,
  relationships,
  onPersonClick,
  onAddPerson,
  focusPersonId,
  layoutMode,
  generations,
  spaceName,
}, ref) {
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const reactFlowInstance = useReactFlow();

  useImperativeHandle(ref, () => ({
    captureFullTree: async () => {
      const el = document.querySelector(".react-flow") as HTMLElement;
      if (!el) return;
      // Fit entire tree into view
      reactFlowInstance.fitView({ padding: 0.1 });
      // Wait for render
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      try {
        const dataUrl = await toPng(el, { backgroundColor: "#f8f9fa", pixelRatio: 2 });
        const link = document.createElement("a");
        link.download = `${spaceName || "family-tree"}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error("Export failed:", err);
      }
    },
  }), [reactFlowInstance, spaceName]);

  // Build visible nodes and edges based on layout mode and focus
  const { initialNodes, initialEdges } = useMemo(() => {
    if (people.length === 0) {
      return { initialNodes: [], initialEdges: [] };
    }

    const parentChildRels = relationships.filter((r) => r.type === "PARENT_CHILD");
    const spouseRels = relationships.filter((r) => r.type === "SPOUSE");

    // Build adjacency
    const childrenOf = new Map<string, string[]>();
    const parentsOf = new Map<string, string[]>();

    parentChildRels.forEach((r) => {
      if (!childrenOf.has(r.fromId)) childrenOf.set(r.fromId, []);
      childrenOf.get(r.fromId)!.push(r.toId);
      if (!parentsOf.has(r.toId)) parentsOf.set(r.toId, []);
      parentsOf.get(r.toId)!.push(r.fromId);
    });

    // Determine visible people
    let visibleIds = new Set<string>();

    if (focusPersonId && people.find((p) => p.id === focusPersonId)) {
      // BFS from focus person
      const queue: { id: string; depth: number; direction: "up" | "down" | "spouse" }[] = [
        { id: focusPersonId, depth: 0, direction: "down" },
      ];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const { id, depth, direction } = queue.shift()!;
        if (visited.has(`${id}-${direction}`)) continue;
        visited.add(`${id}-${direction}`);
        visibleIds.add(id);

        if (depth >= generations) continue;

        // Add spouses
        spouseRels.forEach((r) => {
          if (r.fromId === id) { visibleIds.add(r.toId); queue.push({ id: r.toId, depth, direction }); }
          if (r.toId === id) { visibleIds.add(r.fromId); queue.push({ id: r.fromId, depth, direction }); }
        });

        if (layoutMode !== "descendants" && (direction === "up" || direction === "down")) {
          // Parents
          const parents = parentsOf.get(id) || [];
          parents.forEach((pid) => queue.push({ id: pid, depth: depth + 1, direction: "up" }));
        }

        if (layoutMode !== "ancestors" && (direction === "down" || direction === "up")) {
          // Children
          const children = childrenOf.get(id) || [];
          children.forEach((cid) => queue.push({ id: cid, depth: depth + 1, direction: "down" }));
        }
      }
    } else {
      // Show all people
      people.forEach((p) => visibleIds.add(p.id));
    }

    // Filter collapsed
    const finalVisible = new Set<string>();
    visibleIds.forEach((id) => {
      finalVisible.add(id);
    });

    const personMap = new Map(people.map((p) => [p.id, p]));

    // Create nodes
    const nodes: Node[] = [];
    finalVisible.forEach((id) => {
      const person = personMap.get(id);
      if (!person) return;
      nodes.push({
        id: person.id,
        type: "person",
        position: { x: 0, y: 0 },
        data: {
          person,
          onClick: onPersonClick,
          focused: person.id === focusPersonId,
          hasChildren: (childrenOf.get(id) || []).length > 0,
          hasParents: (parentsOf.get(id) || []).length > 0,
          expanded: !collapsedNodes.has(id),
        },
      });
    });

    // Create edges
    const edges: Edge[] = [];

    parentChildRels.forEach((r) => {
      if (!finalVisible.has(r.fromId) || !finalVisible.has(r.toId)) return;
      const parent = personMap.get(r.fromId);
      const isPaternal = parent?.gender === "male";
      const isMaternalOrAdoptive = r.subtype === "adoptive" || r.subtype === "guardian";

      edges.push({
        id: r.id,
        source: r.fromId,
        target: r.toId,
        type: "smoothstep",
        style: {
          stroke: isMaternalOrAdoptive ? "#9f7aea" : isPaternal ? "#3182ce" : "#d53f8c",
          strokeWidth: 2,
          strokeDasharray: isMaternalOrAdoptive ? "6 3" : undefined,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: isPaternal ? "#3182ce" : "#d53f8c", width: 12, height: 12 },
        label: r.subtype && r.subtype !== "biological" ? r.subtype : undefined,
        labelStyle: { fontSize: 10, fill: "#718096" },
      });
    });

    spouseRels.forEach((r) => {
      if (!finalVisible.has(r.fromId) || !finalVisible.has(r.toId)) return;
      edges.push({
        id: r.id,
        source: r.fromId,
        target: r.toId,
        sourceHandle: "spouse-right",
        targetHandle: "spouse-left",
        type: "straight",
        style: { stroke: "#38a169", strokeWidth: 2, strokeDasharray: "8 4" },
        label: r.subtype === "partner" ? "Partner" : r.startYear ? `${r.startYear}` : undefined,
        labelStyle: { fontSize: 10, fill: "#38a169" },
      });
    });

    // Build spouse pairs for layout
    const spousePairs: [string, string][] = spouseRels
      .filter((r) => finalVisible.has(r.fromId) && finalVisible.has(r.toId))
      .map((r) => [r.fromId, r.toId]);

    // Apply dagre layout
    const direction = layoutMode === "ancestors" ? "BT" : "TB";
    const laid = getLayoutedElements(nodes, edges, spousePairs, direction);
    return { initialNodes: laid.nodes, initialEdges: laid.edges };
  }, [people, relationships, focusPersonId, layoutMode, generations, collapsedNodes, onPersonClick]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    onPersonClick(node.id);
  }, [onPersonClick]);

  if (people.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
          <User className="w-10 h-10 text-[#2b6cb0]" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Start Your Family Tree</h3>
        <p className="text-[#718096] mb-6 max-w-md">
          Add your first family member to begin building your tree.
        </p>
        <button
          onClick={onAddPerson}
          className="bg-[#2b6cb0] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Add First Person
        </button>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.1}
      maxZoom={2}
      attributionPosition="bottom-left"
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#e2e8f0" gap={20} size={1} />
      <Controls position="bottom-right" />
      <MiniMap
        nodeColor={(node) => {
          const person = node.data?.person as PersonData;
          if (!person) return "#e2e8f0";
          return person.gender === "male" ? "#bee3f8" : person.gender === "female" ? "#fed7e2" : "#e2e8f0";
        }}
        maskColor="rgba(248, 249, 250, 0.7)"
        position="bottom-left"
      />

      {/* Legend */}
      <Panel position="top-right">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg border border-[#e2e8f0] p-3 text-xs space-y-1.5 shadow-sm">
          <div className="font-medium text-[#1a202c] mb-1">Legend</div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-[#3182ce]" />
            <span className="text-[#718096]">Paternal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-[#d53f8c]" />
            <span className="text-[#718096]">Maternal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 border-t-2 border-dashed border-[#38a169]" />
            <span className="text-[#718096]">Spouse/Partner</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 border-t-2 border-dashed border-[#9f7aea]" />
            <span className="text-[#718096]">Adoptive/Guardian</span>
          </div>
        </div>
      </Panel>
    </ReactFlow>
  );
});

const FamilyTreeCanvas = forwardRef<FamilyTreeCanvasHandle, FamilyTreeCanvasProps>(function FamilyTreeCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <FamilyTreeCanvasInner ref={ref} {...props} />
    </ReactFlowProvider>
  );
});

export default FamilyTreeCanvas;
