'use client';

import { cn } from '@/lib/utils';
import type { ThinkingChain as ThinkingChainType } from '@/types';

interface ThinkingChainProps {
  chain: ThinkingChainType;
  isExpanded?: boolean;
}

export function ThinkingChain({ chain, isExpanded = false }: ThinkingChainProps) {
  return (
    <div className="border border-surface-3 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-1">
        <div className="flex items-center gap-2">
          <span className="text-sm">🧠</span>
          <span className="text-sm font-medium text-white">Chain of Thought</span>
          <span className="text-xs text-zinc-500">
            {chain.steps.length} steps
            {chain.duration && ` · ${chain.duration}ms`}
          </span>
        </div>
        {chain.totalTokens && (
          <span className="text-xs text-zinc-500">
            {chain.totalTokens} tokens
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="divide-y divide-surface-3">
        {chain.steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              'px-4 py-3 bg-surface-0',
              !isExpanded && index > 2 && 'hidden'
            )}
          >
            <div className="flex items-start gap-3">
              {/* Step number */}
              <div className="w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-zinc-400">{index + 1}</span>
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                {/* Thought */}
                <div>
                  <span className="text-xs font-medium text-violet-400">
                    Thought
                  </span>
                  <p className="text-sm text-zinc-300 mt-0.5">{step.thought}</p>
                </div>

                {/* Action */}
                {step.action && (
                  <div>
                    <span className="text-xs font-medium text-blue-400">
                      Action
                    </span>
                    <p className="text-sm text-zinc-300 mt-0.5">
                      <code className="bg-surface-2 px-1.5 py-0.5 rounded text-xs font-mono">
                        {step.action}
                      </code>
                      {step.actionInput && (
                        <span className="text-zinc-400 ml-1">
                          {step.actionInput}
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {/* Observation */}
                {step.observation && (
                  <div>
                    <span className="text-xs font-medium text-green-400">
                      Observation
                    </span>
                    <p className="text-sm text-zinc-400 mt-0.5">
                      {step.observation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Final answer */}
      {chain.finalAnswer && (
        <div className="px-4 py-3 bg-surface-1 border-t border-surface-3">
          <span className="text-xs font-medium text-brand-400">
            Final Answer
          </span>
          <p className="text-sm text-white mt-1">{chain.finalAnswer}</p>
        </div>
      )}
    </div>
  );
}
