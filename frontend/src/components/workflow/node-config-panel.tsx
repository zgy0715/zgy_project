'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '@/stores/workflow-store';
import type { WorkflowNodeData } from '@/types';

interface NodeConfigPanelProps {
  nodeId: string | null;
  onClose: () => void;
}

const agentTypeOptions = [
  { value: 'coder', label: 'Coder（编码）' },
  { value: 'reviewer', label: 'Reviewer（审查）' },
  { value: 'tester', label: 'Tester（测试）' },
  { value: 'deployer', label: 'Deployer（部署）' },
];

export function NodeConfigPanel({ nodeId, onClose }: NodeConfigPanelProps) {
  const currentWorkflow = useWorkflowStore((s) => s.currentWorkflow);
  const updateNode = useWorkflowStore((s) => s.updateNode);

  const [name, setName] = useState('');
  const [agentType, setAgentType] = useState('coder');
  const [description, setDescription] = useState('');

  const node = currentWorkflow?.nodes.find((n) => n.id === nodeId);

  useEffect(() => {
    if (node) {
      setName(node.data?.label ?? node.name ?? '');
      setAgentType(node.data?.agentType ?? node.agentType ?? 'coder');
      setDescription(node.data?.description ?? '');
    }
  }, [node]);

  if (!nodeId || !node) return null;

  const handleSave = () => {
    const updates: Partial<WorkflowNodeData> = {
      label: name,
      agentType,
      description,
    };
    updateNode(nodeId, updates);
    onClose();
  };

  return (
    <div
      className={cn(
        'absolute top-0 right-0 h-full z-20',
        'w-80 bg-surface-1 border-l border-surface-3',
        'flex flex-col shadow-xl shadow-black/20'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3">
        <h3 className="text-sm font-medium text-white">节点配置</h3>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <Input
          id="node-name"
          label="名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="输入节点名称"
        />

        <div className="space-y-1.5">
          <label
            htmlFor="node-agent-type"
            className="block text-sm font-medium text-zinc-300"
          >
            Agent 类型
          </label>
          <select
            id="node-agent-type"
            value={agentType}
            onChange={(e) => setAgentType(e.target.value)}
            className={cn(
              'flex h-10 w-full rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm text-white',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
            )}
          >
            {agentTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="node-description"
            className="block text-sm font-medium text-zinc-300"
          >
            描述
          </label>
          <textarea
            id="node-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="输入节点描述"
            rows={4}
            className={cn(
              'flex w-full rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 text-sm text-white',
              'placeholder:text-zinc-500',
              'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
              'resize-none'
            )}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-surface-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          取消
        </Button>
        <Button variant="default" size="sm" onClick={handleSave}>
          保存
        </Button>
      </div>
    </div>
  );
}
