'use client';

import { use } from 'react';
import { ChatPanel } from '@/components/agents/chat-panel';
import { ThinkingChain } from '@/components/agents/thinking-chain';
import type { Agent, ChatMessage, ThinkingChain as ThinkingChainType } from '@/types';

// Mock data for demo
const mockAgents: Agent[] = [
  { id: 'a1', name: 'Planner', type: 'planner', status: 'idle', description: 'Plans project architecture', capabilities: ['planning'], model: 'gpt-4', projectId: 'proj-1', createdAt: '', updatedAt: '' },
  { id: 'a2', name: 'Coder', type: 'coder', status: 'idle', description: 'Writes and refactors code', capabilities: ['coding'], model: 'gpt-4', projectId: 'proj-1', createdAt: '', updatedAt: '' },
  { id: 'a3', name: 'Reviewer', type: 'reviewer', status: 'idle', description: 'Reviews code quality', capabilities: ['review'], model: 'gpt-4', projectId: 'proj-1', createdAt: '', updatedAt: '' },
  { id: 'a4', name: 'Tester', type: 'tester', status: 'idle', description: 'Generates and runs tests', capabilities: ['testing'], model: 'gpt-4', projectId: 'proj-1', createdAt: '', updatedAt: '' },
];

const mockMessages: ChatMessage[] = [
  {
    id: 'm1',
    role: 'user',
    content: 'Create a REST API endpoint for user registration with email validation',
    agentId: 'a2',
    projectId: 'proj-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'm2',
    role: 'assistant',
    content: `I'll create a user registration endpoint with email validation. Here's the implementation:

\`\`\`typescript
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { UserService } from '../services/user.service';
import { hashPassword } from '../utils/crypto';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('username').trim().isLength({ min: 3, max: 30 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, username } = req.body;
    const user = await UserService.create({ email, username, password: await hashPassword(password) });
    return res.status(201).json({ user });
  }
);

export default router;
\`\`\`

This includes email validation, password length requirements, and input sanitization.`,
    agentId: 'a2',
    projectId: 'proj-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  },
];

const mockThinkingChain: ThinkingChainType = {
  id: 'tc1',
  messageId: 'm2',
  agentId: 'a2',
  steps: [
    {
      id: 's1',
      agentId: 'a2',
      messageId: 'm2',
      step: 1,
      thought: 'User wants a registration endpoint. I need to consider validation, security, and error handling.',
      action: 'analyze_requirements',
      timestamp: '',
    },
    {
      id: 's2',
      agentId: 'a2',
      messageId: 'm2',
      step: 2,
      thought: 'I should use express-validator for input validation and bcrypt for password hashing.',
      action: 'select_dependencies',
      actionInput: 'express-validator, bcrypt',
      timestamp: '',
    },
    {
      id: 's3',
      agentId: 'a2',
      messageId: 'm2',
      step: 3,
      thought: 'Implementation complete. The endpoint validates email, enforces password length, and hashes the password before storage.',
      observation: 'Code generated successfully with proper validation and security measures.',
      timestamp: '',
    },
  ],
  finalAnswer: 'Registration endpoint created with email validation and password hashing.',
  totalTokens: 2500,
  duration: 3400,
};

export default function AgentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Agent Chat</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Interact with AI agents to build and manage your project
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chat panel */}
        <div className="lg:col-span-2 bg-surface-1 border border-surface-3 rounded-xl overflow-hidden h-[calc(100vh-240px)]">
          <ChatPanel
            agents={mockAgents}
            messages={mockMessages}
            isStreaming={false}
            onSendMessage={() => {}}
            onSelectAgent={() => {}}
            currentAgent={mockAgents[1]}
          />
        </div>

        {/* Thinking chain sidebar */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-400">Chain of Thought</h2>
          <ThinkingChain chain={mockThinkingChain} isExpanded />
        </div>
      </div>
    </div>
  );
}
