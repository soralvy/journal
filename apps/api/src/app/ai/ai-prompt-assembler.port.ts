import { Injectable } from '@nestjs/common';

import { assembleJournalChatPrompt, type AssembleJournalChatPromptInput } from './ai-prompt-assembler';

export const AI_PROMPT_ASSEMBLER = Symbol('AI_PROMPT_ASSEMBLER');

export interface AiPromptAssemblerPort {
  assembleJournalChatPrompt(input: AssembleJournalChatPromptInput): ReturnType<typeof assembleJournalChatPrompt>;
}

@Injectable()
export class DefaultAiPromptAssembler implements AiPromptAssemblerPort {
  assembleJournalChatPrompt(input: AssembleJournalChatPromptInput): ReturnType<typeof assembleJournalChatPrompt> {
    return assembleJournalChatPrompt(input);
  }
}
