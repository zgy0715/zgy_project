'use client';

import { useCallback, useMemo } from 'react';
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
import { useWorkflowStore } from '@/stores/workflow-store';
import type { WorkflowNodeData } from '@/types';

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
  const runWorkflow = useWorkflowStore((s) => s.runWorkflow);
  const resetWorkflow = useWorkflowStore((s) => s.resetWorkflow);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const updateWorkflow = useWorkflowStore((s) => s.updateWorkflow);

  const reactFlowInstance = useReactFlow();

  // Convert store nodes to ReactFlow nodes
  const nodes: Node<WorkflowNodeData>[] = useMemo(
    () =>
      currentWorkflow?.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })) ?? [],
    [currentWorkflow?.nodes]
  );

  // Convert store edges to ReactFlow edges
  const edges: Edge[] = useMemo(
    () =>
      currentWorkflow?.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        label: e.label,
        animated: e.animated ?? false,
        data: { edgeType: e.type, label: e.condition },
      })) ?? [],
    [currentWorkflow?.edges]
  );

  // Handle node position changes and sync back to store
  // Use reactFlowInstance.getNodes() instead of the memoized `nodes` to avoid
  // stale closure values when React batches updates.
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
  // Use reactFlowInstance.getEdges() instead of the memoized `edges` to avoid
  // stale closure values when React batches updates.
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

  // Auto-layout: reset node positions to default layout
  const handleAutoLayout = useCallback(() => {
    if (!currentWorkflow) return;
    const layoutNodes = currentWorkflow.nodes.map((n) => ({
      ...n,
      position: autoLayoutPositions[n.id] ?? n.position,
    }));
    updateWorkflow(currentWorkflow.id, { nodes: layoutNodes });
    // Fit view after layout
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

  // Pause handler (placeholder — store doesn't have pause logic yet)
  const handlePause = useCallback(() => {
    // Could be extended with pause logic in the store
  }, []);

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
        isExecuting={isExecuting}
        workflowStatus={currentWorkflow?.status ?? 'draft'}
      />

      {/* ReactFlow canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
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
    </div>
  );
}
