'use client';

import { Play, Pause, RotateCcw, LayoutGrid, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WorkflowToolbarProps {
  onRun: () => void;
  onPause: () => void;
  onReset: () => void;
  onAutoLayout: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  isExecuting: boolean;
  isPaused?: boolean;
  workflowStatus: string;
}

export function WorkflowToolbar({
  onRun,
  onPause,
  onReset,
  onAutoLayout,
  onZoomIn,
  onZoomOut,
  onFitView,
  isExecuting,
  isPaused = false,
  workflowStatus,
}: WorkflowToolbarProps) {
  return (
    <div
      className={cn(
        'absolute top-4 left-1/2 -translate-x-1/2 z-10',
        'flex items-center gap-1 px-3 py-2 rounded-xl',
        'bg-surface-1/80 backdrop-blur-xl border border-surface-3',
        'shadow-lg shadow-black/20'
      )}
    >
      {/* Run / Pause group */}
      <div className="flex items-center gap-1 pr-2 border-r border-surface-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRun}
          disabled={isExecuting && !isPaused}
          className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-500/10"
          title={isPaused ? '继续工作流' : '运行工作流'}
        >
          <Play className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onPause}
          disabled={!isExecuting}
          className={cn(
            'h-8 w-8 hover:bg-amber-500/10',
            isPaused
              ? 'text-green-400 hover:text-green-300'
              : 'text-amber-400 hover:text-amber-300'
          )}
          title={isPaused ? '继续工作流' : '暂停工作流'}
        >
          {isPaused ? (
            <Play className="w-4 h-4" />
          ) : (
            <Pause className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Reset / Auto layout group */}
      <div className="flex items-center gap-1 px-2 border-r border-surface-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onReset}
          disabled={isExecuting && !isPaused}
          className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-surface-2"
          title="重置工作流"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onAutoLayout}
          className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-surface-2"
          title="自动布局"
        >
          <LayoutGrid className="w-4 h-4" />
        </Button>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-1 pl-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomIn}
          className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-surface-2"
          title="放大"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onFitView}
          className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-surface-2"
          title="适应画布"
        >
          <Maximize className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onZoomOut}
          className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-surface-2"
          title="缩小"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
      </div>

      {/* Running status indicator */}
      {isExecuting && !isPaused && (
        <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-surface-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          <span className="text-xs text-blue-400">运行中</span>
        </div>
      )}

      {/* Paused status indicator */}
      {isExecuting && isPaused && (
        <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-surface-3">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs text-amber-400">已暂停</span>
        </div>
      )}

      {!isExecuting && workflowStatus === 'completed' && (
        <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-surface-3">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-green-400">已完成</span>
        </div>
      )}
    </div>
  );
}
