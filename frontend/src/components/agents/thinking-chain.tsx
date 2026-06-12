'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ThinkingChain as ThinkingChainType } from '@/types';

interface ThinkingChainProps {
  chain: ThinkingChainType;
  defaultExpanded?: boolean;
}

export function ThinkingChain({
  chain,
  defaultExpanded = false,
}: ThinkingChainProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-surface-3 rounded-lg overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-3 py-2 bg-surface-1 hover:bg-surface-2 transition-colors text-left"
      >
        <span className="text-sm">🧠</span>
        <span className="text-xs font-medium text-zinc-300">
          {isExpanded ? '收起思考过程' : '查看思考过程'}
        </span>
        <span className="text-xs text-zinc-500">
          {chain.steps.length} 步
          {chain.duration ? ` · ${chain.duration}ms` : ''}
        </span>
        <span
          className={cn(
            'ml-auto text-xs text-zinc-500 transition-transform duration-200',
            isExpanded && 'rotate-90'
          )}
        >
          ▸
        </span>
      </button>

      {/* Expandable steps */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-surface-3">
              {chain.steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="px-3 py-2.5 bg-surface-0"
                >
                  <div className="flex items-start gap-2.5">
                    {/* Step number circle */}
                    <div className="w-5 h-5 rounded-full bg-brand-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-medium text-brand-400">
                        {index + 1}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Thought */}
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {step.thought}
                      </p>

                      {/* Action + Observation inline */}
                      {step.action && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <code className="bg-surface-2 px-1.5 py-0.5 rounded text-brand-400 font-mono">
                            {step.action}
                          </code>
                          {step.actionInput && (
                            <span className="text-zinc-500">
                              {step.actionInput}
                            </span>
                          )}
                        </div>
                      )}

                      {step.observation && (
                        <p className="text-[11px] text-zinc-500">
                          {step.observation}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Final answer */}
            {chain.finalAnswer && (
              <div className="px-3 py-2 bg-surface-1 border-t border-surface-3">
                <span className="text-[11px] font-medium text-green-400">
                  结论
                </span>
                <p className="text-xs text-zinc-300 mt-0.5">
                  {chain.finalAnswer}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
