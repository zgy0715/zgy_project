'use client';

import { Button } from '@/components/ui/button';

interface WorkflowToolbarProps {
  onSave: () => void;
  onExecute: () => void;
  onAddNode: (type: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  isExecuting: boolean;
  isDirty: boolean;
}

export function WorkflowToolbar({
  onSave,
  onExecute,
  onAddNode,
  onZoomIn,
  onZoomOut,
  onFitView,
  isExecuting,
  isDirty,
}: WorkflowToolbarProps) {
  return (
    <div className="flex items-center justify-between bg-surface-1 border border-surface-3 rounded-xl px-4 py-2">
      {/* Left: Add nodes */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 mr-2">Add Node:</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddNode('agent')}
          className="text-xs"
        >
          🤖 Agent
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddNode('condition')}
          className="text-xs"
        >
          🔀 Condition
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddNode('parallel')}
          className="text-xs"
        >
          ⚡ Parallel
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddNode('output')}
          className="text-xs"
        >
          📤 Output
        </Button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Zoom controls */}
        <div className="flex items-center gap-1 mr-2">
          <Button variant="ghost" size="icon" onClick={onZoomOut} className="h-8 w-8">
            −
          </Button>
          <Button variant="ghost" size="icon" onClick={onFitView} className="h-8 w-8">
            ⊞
          </Button>
          <Button variant="ghost" size="icon" onClick={onZoomIn} className="h-8 w-8">
            +
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={!isDirty}
        >
          Save
        </Button>
        <Button
          size="sm"
          onClick={onExecute}
          disabled={isExecuting}
        >
          {isExecuting ? 'Running...' : '▶ Run'}
        </Button>
      </div>
    </div>
  );
}
