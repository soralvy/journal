export class InvalidJournalContextInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidJournalContextInputError';
  }
}

export class InvalidJournalContextLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidJournalContextLimitError';
  }
}
