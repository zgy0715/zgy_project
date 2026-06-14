'use client';

import { Code, Search, TestTube, Rocket, GitBranch, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '@/stores/workflow-store';
import { generateId } from '@/lib/utils';
import type { NodeType } from '@/types';

interface NodePaletteProps {
  open: boolean;
  onClose: () => void;
}

interface PaletteItem {
  type: NodeType;
  agentType: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const paletteItems: PaletteItem[] = [
  {
    type: 'agent',
    agentType: 'coder',
    label: 'Coder',
    description: '代码编写与实现',
    icon: <Code className="w-5 h-5" />,
    color: '#3b82f6',
  },
  {
    type: 'agent',
    agentType: 'reviewer',
    label: 'Reviewer',
    description: '代码审查与检查',
    icon: <Search className="w-5 h-5" />,
    color: '#22c55e',
  },
  {
    type: 'agent',
    agentType: 'tester',
    label: 'Tester',
    description: '自动化测试执行',
    icon: <TestTube className="w-5 h-5" />,
    color: '#f59e0b',
  },
  {
    type: 'agent',
    agentType: 'deployer',
    label: 'Deployer',
    description: '部署与发布管理',
    icon: <Rocket className="w-5 h-5" />,
    color: '#a855f7',
  },
  {
    type: 'condition',
    agentType: 'condition',
    label: 'Condition',
    description: '条件分支判断',
    icon: <GitBranch className="w-5 h-5" />,
    color: '#f59e0b',
  },
  {
    type: 'output',
    agentType: 'output',
    label: 'Output',
    description: '输出与结果收集',
    icon: <CircleDot className="w-5 h-5" />,
    color: '#6366f1',
  },
];

export function NodePalette({ open, onClose }: NodePaletteProps) {
  const addNode = useWorkflowStore((s) => s.addNode);
  const currentWorkflow = useWorkflowStore((s) => s.currentWorkflow);

  if (!open) return null;

  const handleAddNode = (item: PaletteItem) => {
    const id = `node-${generateId()}`;
    // Calculate a default position offset from existing nodes
    const nodeCount = currentWorkflow?.nodes.length ?? 0;
    const x = 100 + (nodeCount % 5) * 250;
    const y = 100 + Math.floor(nodeCount / 5) * 150;

    addNode({
      id,
      agentType: item.agentType,
      name: item.label,
      type: item.type,
      position: { x, y },
      data: {
        label: item.label,
        agentType: item.agentType,
        description: item.description,
        status: 'pending',
      },
    });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30"
        onClick={onClose}
      />
      {/* Palette panel */}
      <div
        className={cn(
          'absolute top-14 left-1/2 -translate-x-1/2 z-40',
          'w-[420px] p-3 rounded-xl',
          'bg-surface-1/95 backdrop-blur-xl border border-surface-3',
          'shadow-xl shadow-black/30'
        )}
      >
        <p className="text-xs text-zinc-500 mb-2 px-1">选择要添加的节点类型</p>
        <div className="grid grid-cols-3 gap-2">
          {paletteItems.map((item) => (
            <button
              key={item.agentType}
              className={cn(
                'flex flex-col items-center gap-2 p-3 rounded-lg',
                'border border-surface-3 bg-surface-0/50',
                'hover:bg-surface-2 hover:border-surface-3',
                'transition-colors cursor-pointer'
              )}
              onClick={() => handleAddNode(item)}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: item.color + '20', color: item.color }}
              >
                {item.icon}
              </div>
              <span className="text-sm font-medium text-white">{item.label}</span>
              <span className="text-xs text-zinc-500 text-center leading-tight">
                {item.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
