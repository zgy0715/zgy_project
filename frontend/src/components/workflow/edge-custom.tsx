'use client';

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from 'reactflow';

// Custom edge component for workflow connections
// Supports default (solid) and conditional (dashed) edge styles
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
  label,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Determine if this is a conditional edge
  const isConditional = data?.edgeType === 'conditional';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          strokeWidth: selected ? 2.5 : 1.5,
          stroke: selected ? '#6366f1' : '#52525b',
          strokeDasharray: isConditional ? '6 3' : undefined,
        }}
      />
      {/* Edge label for conditional branches */}
      {(label || data?.label) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={`
              rounded-md px-2 py-0.5 text-xs
              ${isConditional
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-surface-2 border border-surface-3 text-zinc-400'
              }
            `}
          >
            {(label ?? data?.label) as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
