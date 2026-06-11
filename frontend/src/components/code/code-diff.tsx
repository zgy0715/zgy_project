'use client';

import { useMemo } from 'react';
import * as Diff from 'diff';

interface CodeDiffProps {
  oldCode: string;
  newCode: string;
  language?: string;
  fileName?: string;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export function CodeDiff({ oldCode, newCode, fileName }: CodeDiffProps) {
  const diffLines = useMemo(() => {
    const changes = Diff.diffLines(oldCode, newCode);
    const lines: DiffLine[] = [];
    let oldLine = 1;
    let newLine = 1;

    changes.forEach((change) => {
      const changeLines = change.value.split('\n');
      // Remove last empty element from split
      if (changeLines[changeLines.length - 1] === '') {
        changeLines.pop();
      }

      changeLines.forEach((line) => {
        if (change.added) {
          lines.push({ type: 'added', content: line, newLineNumber: newLine++ });
        } else if (change.removed) {
          lines.push({ type: 'removed', content: line, oldLineNumber: oldLine++ });
        } else {
          lines.push({
            type: 'unchanged',
            content: line,
            oldLineNumber: oldLine++,
            newLineNumber: newLine++,
          });
        }
      });
    });

    return lines;
  }, [oldCode, newCode]);

  const stats = useMemo(() => {
    const added = diffLines.filter((l) => l.type === 'added').length;
    const removed = diffLines.filter((l) => l.type === 'removed').length;
    return { added, removed };
  }, [diffLines]);

  return (
    <div className="border border-surface-3 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-1 border-b border-surface-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">
            {fileName ?? 'Diff View'}
          </span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-400">+{stats.added}</span>
            <span className="text-red-400">-{stats.removed}</span>
          </div>
        </div>
      </div>

      {/* Diff content */}
      <div className="overflow-x-auto font-mono text-xs">
        {diffLines.map((line, index) => (
          <div
            key={index}
            className={`flex ${
              line.type === 'added'
                ? 'bg-green-500/10'
                : line.type === 'removed'
                ? 'bg-red-500/10'
                : ''
            }`}
          >
            {/* Line numbers */}
            <div className="flex-shrink-0 w-20 flex">
              <span className="w-10 text-right pr-2 text-zinc-600 select-none">
                {line.oldLineNumber ?? ''}
              </span>
              <span className="w-10 text-right pr-2 text-zinc-600 select-none">
                {line.newLineNumber ?? ''}
              </span>
            </div>
            {/* Change indicator */}
            <span
              className={`w-5 text-center flex-shrink-0 ${
                line.type === 'added'
                  ? 'text-green-400'
                  : line.type === 'removed'
                  ? 'text-red-400'
                  : 'text-zinc-600'
              }`}
            >
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            {/* Content */}
            <pre className="flex-1 text-zinc-300 whitespace-pre overflow-x-auto">
              {line.content}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
