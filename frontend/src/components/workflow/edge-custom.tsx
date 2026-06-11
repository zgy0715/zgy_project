'use client';

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from 'reactflow';

// Custom edge component for workflow connections
export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  animated,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeClassName = [
    'stroke-surface-4',
    selected ? 'stroke-brand-500' : '',
    animated ? 'animated' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={edgeClassName}
        style={{
          strokeWidth: selected ? 2 : 1.5,
          stroke: selected ? '#6366f1' : '#3f3f46',
        }}
      />
      {/* Edge label for conditional branches */}
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="bg-surface-2 border border-surface-3 rounded-md px-2 py-0.5 text-xs text-zinc-400"
          >
            {data.label as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
