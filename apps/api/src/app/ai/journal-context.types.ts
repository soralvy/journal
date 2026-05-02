import { AiJournalContextSelectionMode } from '@repo/database';

export interface SelectJournalContextInput {
  userId: string;
  message: string;
  now?: Date;
  maxEntries?: number;
  maxTotalChars?: number;
}

export interface JournalContextLimits {
  maxEntries: number;
  maxTotalChars: number;
}

export interface JournalEntryContextCandidate {
  id: string;
  content: string;
  createdAt: Date;
}

export interface SelectedJournalContextItem {
  journalEntryId: string;
  content: string;
  journalEntryCreatedAt: Date;
  selectionMode: AiJournalContextSelectionMode;
  selectionReason: string;
  rank: number;
  includedCharCount: number;
  includedTokenEstimate: number;
  wasTruncated: boolean;
}

export interface SelectJournalContextResult {
  selectionMode: AiJournalContextSelectionMode;
  selectionReason: string;
  items: SelectedJournalContextItem[];
}
