import { AiChatMessageRole, AiContentRetentionStatus, type Prisma } from '@repo/database';

import type { PromptRecentChatMessage } from './ai-prompt-assembler';

const RECENT_CHAT_MESSAGE_LIMIT = 10;

export interface FindRecentAiChatMessagesInput {
  userId: string;
  threadId: string;
  beforeSequence: number;
}

export type AiChatRecentMessagesClient = Pick<Prisma.TransactionClient, 'aiChatMessage'>;

const recentMessageSelect = {
  role: true,
  content: true,
} satisfies Prisma.AiChatMessageSelect;

type RecentMessageRecord = Prisma.AiChatMessageGetPayload<{ select: typeof recentMessageSelect }>;

const isNonBlank = (content: string): boolean => {
  return /\S/u.test(content);
};

const mapRole = (role: AiChatMessageRole): PromptRecentChatMessage['role'] => {
  switch (role) {
    case AiChatMessageRole.USER: {
      return 'user';
    }
    case AiChatMessageRole.ASSISTANT: {
      return 'assistant';
    }
  }
};

export const findRecentAiChatMessages = async (
  prisma: AiChatRecentMessagesClient,
  input: FindRecentAiChatMessagesInput,
): Promise<PromptRecentChatMessage[]> => {
  const messages = await prisma.aiChatMessage.findMany({
    where: {
      userId: input.userId,
      threadId: input.threadId,
      sequence: {
        lt: input.beforeSequence,
      },
      contentRetentionStatus: AiContentRetentionStatus.ACTIVE,
      contentDeletedAt: null,
      content: {
        not: null,
      },
    },
    orderBy: {
      sequence: 'desc',
    },
    take: RECENT_CHAT_MESSAGE_LIMIT,
    select: recentMessageSelect,
  });

  return messages
    .toReversed()
    .filter((message): message is RecentMessageRecord & { content: string } => {
      return message.content !== null && isNonBlank(message.content);
    })
    .map((message) => ({
      role: mapRole(message.role),
      content: message.content,
    }));
};
