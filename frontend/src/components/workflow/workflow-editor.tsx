'use client';

import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { AgentNode } from './agent-node';
import { CustomEdge } from './edge-custom';
import { WorkflowToolbar } from './workflow-toolbar';
import { useWorkflowStore } from '@/stores/workflow-store';
import type { WorkflowNode, WorkflowEdge } from '@/types';

// Register custom node types
const nodeTypes = {
  agent: AgentNode,
};

// Register custom edge types
const edgeTypes = {
  conditional: CustomEdge,
  parallel: CustomEdge,
};

interface WorkflowEditorProps {
  projectId: string;
  workflowId: string;
}

export function WorkflowEditor({ projectId, workflowId }: WorkflowEditorProps) {
  const currentWorkflow = useWorkflowStore((s) => s.currentWorkflow);
  const addNode = useWorkflowStore((s) => s.addNode);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const isExecuting = useWorkflowStore((s) => s.isExecuting);

  // Initialize nodes and edges from store
  const initialNodes = useMemo(
    () =>
      currentWorkflow?.nodes.map((n) => ({
        id: n.id,
        type: n.type === 'agent' ? 'agent' : 'default',
        position: n.position,
        data: n.data,
      })) ?? [],
    [currentWorkflow?.nodes]
  );

  const initialEdges = useMemo(
    () =>
      currentWorkflow?.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        label: e.label,
        animated: e.animated,
        data: { label: e.condition },
      })) ?? [],
    [currentWorkflow?.edges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  // Add new node to the canvas
  const handleAddNode = useCallback(
    (type: string) => {
      const newNode: WorkflowNode = {
        id: crypto.randomUUID(),
        type: type as WorkflowNode['type'],
        position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
        data: {
          label: `New ${type}`,
          agentType: type,
          status: 'idle',
        },
      };
      addNode(newNode);
      setNodes((nds) => [
        ...nds,
        {
          id: newNode.id,
          type: type === 'agent' ? 'agent' : 'default',
          position: newNode.position,
          data: newNode.data,
        },
      ]);
    },
    [addNode, setNodes]
  );

  return (
    <div className="flex flex-col h-full">
      <WorkflowToolbar
        onSave={() => {}}
        onExecute={() => {}}
        onAddNode={handleAddNode}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onFitView={() => {}}
        isExecuting={isExecuting}
        isDirty={false}
      />

      <div className="flex-1 mt-2 rounded-xl overflow-hidden border border-surface-3">
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
          className="bg-surface-0"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#27272a" />
          <Controls className="!bg-surface-1 !border-surface-3" />
          <MiniMap
            nodeColor={(node) => {
              const status = node.data?.status;
              if (status === 'running') return '#3b82f6';
              if (status === 'success') return '#22c55e';
              if (status === 'error') return '#ef4444';
              return '#3f3f46';
            }}
            className="!bg-surface-1 !border-surface-3"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
