// Utility functions for DeepAgent platform

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

// Merge Tailwind CSS classes with conflict resolution
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date string to human-readable format
export function formatDate(date: string | Date, pattern = 'MMM dd, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern);
}

// Format date as relative time (e.g., "2 hours ago")
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

// Truncate text with ellipsis
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// Generate a random ID (for client-side use only)
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
}

// Format number with compact notation (e.g., 1.2K, 3.4M)
export function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

// Format token count for display
export function formatTokens(tokens: number): string {
  return formatCompactNumber(tokens);
}

// Delay execution (useful for simulating loading states)
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Check if running in browser
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// Normalize an API list payload into an array.
//
// List endpoints are documented to return a real array in `data`, but older
// gateway builds wrapped it (paged `content`, or a named collection such as
// `agents` / `workflows`). Accept all of those shapes instead of assuming.
const LIST_KEYS = [
  'content',
  'items',
  'list',
  'data',
  'agents',
  'workflows',
  'files',
  'activities',
  'templates',
  'messages',
] as const;

export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of LIST_KEYS) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

// Extract a human-readable message from an unknown thrown value.
// Handles axios errors without resorting to `any`.
export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const maybeResponse = (error as { response?: { data?: { message?: unknown } } }).response;
    const apiMessage = maybeResponse?.data?.message;
    if (typeof apiMessage === 'string' && apiMessage.length > 0) {
      return apiMessage;
    }
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return fallback;
}

// Get file language from extension
export function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
  };
  return langMap[ext] ?? 'plaintext';
}

// Map language name to Monaco editor language identifier
export function getMonacoLanguage(language: string): string {
  const map: Record<string, string> = {
    java: 'java',
    python: 'python',
    typescript: 'typescript',
    tsx: 'typescript',
    javascript: 'javascript',
    jsx: 'javascript',
    yaml: 'yaml',
    xml: 'xml',
    json: 'json',
    markdown: 'markdown',
    dockerfile: 'dockerfile',
    sql: 'sql',
    css: 'css',
    html: 'html',
    shell: 'shell',
    plaintext: 'plaintext',
  };
  return map[language] ?? 'plaintext';
}
