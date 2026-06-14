'use client';

import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  BackgroundVariant,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { AgentNode } from './agent-node';
import { CustomEdge } from './edge-custom';
import { WorkflowToolbar } from './workflow-toolbar';
import { NodeContextMenu } from './node-context-menu';
import { NodeConfigPanel } from './node-config-panel';
import { NodePalette } from './node-palette';
import { useWorkflowStore } from '@/stores/workflow-store';
import type { WorkflowNodeData } from '@/types';
import { generateId } from '@/lib/utils';

// Register custom node types — must be useMemo-wrapped to prevent infinite re-renders
const useNodeTypes = () =>
  useMemo(
    () => ({
      agent: AgentNode,
      trigger: AgentNode,
      condition: AgentNode,
      output: AgentNode,
      parallel: AgentNode,
      merge: AgentNode,
    }),
    []
  );

// Register custom edge types — must be useMemo-wrapped to prevent infinite re-renders
const useEdgeTypes = () =>
  useMemo(
    () => ({
      default: CustomEdge,
      conditional: CustomEdge,
      parallel: CustomEdge,
    }),
    []
  );

// Auto-layout positions for the 7-node DAG
const autoLayoutPositions: Record<string, { x: number; y: number }> = {
  'node-start': { x: 50, y: 200 },
  'node-coder': { x: 300, y: 200 },
  'node-reviewer': { x: 550, y: 200 },
  'node-condition': { x: 800, y: 200 },
  'node-tester': { x: 1050, y: 100 },
  'node-deployer': { x: 1300, y: 100 },
  'node-end': { x: 1550, y: 100 },
};

interface WorkflowEditorProps {
  projectId: string;
  workflowId: string;
}

export function WorkflowEditor({ projectId, workflowId }: WorkflowEditorProps) {
  const nodeTypes = useNodeTypes();
  const edgeTypes = useEdgeTypes();

  const currentWorkflow = useWorkflowStore((s) => s.currentWorkflow);
  const isExecuting = useWorkflowStore((s) => s.isExecuting);
  const isPaused = useWorkflowStore((s) => s.isPaused);
  const runWorkflow = useWorkflowStore((s) => s.runWorkflow);
  const pauseWorkflow = useWorkflowStore((s) => s.pauseWorkflow);
  const resumeWorkflow = useWorkflowStore((s) => s.resumeWorkflow);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const updateWorkflow = useWorkflowStore((s) => s.updateWorkflow);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);
  const addNode = useWorkflowStore((s) => s.addNode);

  const reactFlowInstance = useReactFlow();

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);

  // Config panel state
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);

  // Node palette state
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Convert store nodes to ReactFlow nodes
  const nodes: Node<WorkflowNodeData>[] = useMemo(
    () =>
      currentWorkflow?.nodes.map((n) => ({
        id: n.id,
        type: n.type ?? 'agent',
        position: n.position ?? { x: 0, y: 0 },
        data: n.data ?? { label: n.name, agentType: n.agentType },
      })) ?? [],
    [currentWorkflow?.nodes]
  );

  // Convert store edges to ReactFlow edges
  const edges: Edge[] = useMemo(
    () =>
      currentWorkflow?.edges.map((e, index) => ({
        id: e.id ?? `edge-${index}`,
        source: e.source,
        target: e.target,
        type: e.type ?? 'default',
        label: e.label,
        animated: e.animated ?? false,
        data: { edgeType: e.type, label: e.condition },
      })) ?? [],
    [currentWorkflow?.edges]
  );

  // Handle node position changes and sync back to store
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (!currentWorkflow) return;
      const updatedNodes = applyNodeChanges(changes, reactFlowInstance.getNodes());
      const storeNodes = currentWorkflow.nodes.map((n) => {
        const updated = updatedNodes.find((un) => un.id === n.id);
        if (updated && updated.position) {
          return { ...n, position: updated.position };
        }
        return n;
      });
      updateWorkflow(currentWorkflow.id, { nodes: storeNodes });
    },
    [currentWorkflow, updateWorkflow, reactFlowInstance]
  );

  // Handle edge changes and sync back to store
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (!currentWorkflow) return;
      const updatedEdges = applyEdgeChanges(changes, reactFlowInstance.getEdges());
      const storeEdges = updatedEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type as 'default' | 'conditional' | 'parallel' | undefined,
        label: e.label as string | undefined,
        animated: e.animated,
      }));
      updateWorkflow(currentWorkflow.id, { edges: storeEdges });
    },
    [currentWorkflow, updateWorkflow, reactFlowInstance]
  );

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!currentWorkflow || !connection.source) return;
      const newEdge = {
        id: `edge-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target!,
        type: 'default' as const,
        animated: false,
      };
      updateWorkflow(currentWorkflow.id, {
        edges: [...currentWorkflow.edges, newEdge],
      });
    },
    [currentWorkflow, updateWorkflow]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  // Handle node right-click context menu
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: { id: string }) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    []
  );

  // Close context menu on pane click
  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setConfigNodeId(null);
  }, []);

  // Handle node deletion (Delete key)
  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      deletedNodes.forEach((n) => removeNode(n.id));
    },
    [removeNode]
  );

  // Handle edge deletion (Delete key)
  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((e) => removeEdge(e.id));
    },
    [removeEdge]
  );

  // Handle double-click to open config panel
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setConfigNodeId(node.id);
    },
    []
  );

  // Context menu handlers
  const handleConfigureNode = useCallback((nodeId: string) => {
    setConfigNodeId(nodeId);
  }, []);

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      removeNode(nodeId);
    },
    [removeNode]
  );

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const node = currentWorkflow?.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const newId = `node-${generateId()}`;
      addNode({
        ...node,
        id: newId,
        name: `${node.name} (副本)`,
        position: {
          x: (node.position?.x ?? 0) + 50,
          y: (node.position?.y ?? 0) + 50,
        },
        data: {
          ...(node.data ?? {}),
          label: `${node.data?.label ?? node.name} (副本)`,
          status: 'pending',
        },
      });
    },
    [currentWorkflow, addNode]
  );

  // Auto-layout: reset node positions to default layout
  const handleAutoLayout = useCallback(() => {
    if (!currentWorkflow) return;
    const layoutNodes = currentWorkflow.nodes.map((n) => ({
      ...n,
      position: autoLayoutPositions[n.id] ?? n.position ?? { x: 0, y: 0 },
    }));
    updateWorkflow(currentWorkflow.id, { nodes: layoutNodes });
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 50);
  }, [currentWorkflow, updateWorkflow, reactFlowInstance]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    reactFlowInstance.zoomIn();
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance.zoomOut();
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  // Pause/resume handler
  const handlePause = useCallback(() => {
    if (isPaused) {
      resumeWorkflow();
    } else {
      pauseWorkflow();
    }
  }, [isPaused, pauseWorkflow, resumeWorkflow]);

  return (
    <div className="relative w-full h-full">
      {/* Floating toolbar */}
      <WorkflowToolbar
        onRun={runWorkflow}
        onPause={handlePause}
        onReset={resetWorkflow}
        onAutoLayout={handleAutoLayout}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        onAddNode={() => setPaletteOpen((v) => !v)}
        isExecuting={isExecuting}
        isPaused={isPaused}
        workflowStatus={currentWorkflow?.status ?? 'draft'}
      />

      {/* Node palette */}
      <NodePalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />

      {/* ReactFlow canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onPaneClick={onPaneClick}
        deleteKeyCode="Delete"
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        className="bg-surface-0"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#27272a"
        />
        <Controls
          className="!bg-surface-1 !border-surface-3"
          showInteractive={false}
        />
        <MiniMap
          nodeColor={(node) => {
            const status = node.data?.status;
            if (status === 'running') return '#3b82f6';
            if (status === 'thinking') return '#f59e0b';
            if (status === 'success') return '#22c55e';
            if (status === 'error') return '#ef4444';
            return '#3f3f46';
          }}
          className="!bg-surface-1 !border-surface-3"
          maskColor="rgba(9,9,11,0.7)"
        />
      </ReactFlow>

      {/* Context menu */}
      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onConfigure={handleConfigureNode}
          onDelete={handleDeleteNode}
          onDuplicate={handleDuplicateNode}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Config panel */}
      <NodeConfigPanel
        nodeId={configNodeId}
        onClose={() => setConfigNodeId(null)}
      />
    </div>
  );
}
