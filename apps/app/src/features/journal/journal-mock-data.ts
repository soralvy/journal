export interface RecentReflection {
  date: string;
  title: string;
}

export type AssistantMessageAuthor = 'assistant' | 'user';

export interface AssistantMessage {
  author: AssistantMessageAuthor;
  text: string;
}

export const recentReflections: RecentReflection[] = [
  {
    date: 'Oct 24',
    title: 'Acceptance of the Uncontrollable',
  },
  {
    date: 'Oct 23',
    title: 'Morning Gratitude',
  },
  {
    date: 'Oct 22',
    title: 'Evening Review: Virtue',
  },
];

export const assistantMessages: AssistantMessage[] = [
  {
    author: 'assistant',
    text: "I've noticed a focus on external stressors in your recent entries. Would you like to practice the Dichotomy of Control?",
  },
  {
    author: 'user',
    text: 'Yes, help me reframe my current stress through that lens.',
  },
  {
    author: 'assistant',
    text: 'Start by naming the event plainly. Remove judgment from the sentence and describe only what happened.',
  },
  {
    author: 'user',
    text: 'A deadline moved up, and I felt like the whole week was taken from me.',
  },
  {
    author: 'assistant',
    text: 'The deadline is outside your control. Your next action, pace, attention, and honesty about tradeoffs remain yours.',
  },
  {
    author: 'assistant',
    text: 'Try writing one sentence that begins with: "What is mine to govern now is..."',
  },
  {
    author: 'user',
    text: 'What is mine to govern now is the first useful hour, not the entire week.',
  },
  {
    author: 'assistant',
    text: 'Good. Make that concrete: choose one small action that expresses steadiness rather than urgency.',
  },
  {
    author: 'assistant',
    text: "When you finish today's entry, mark what you practiced: patience, clarity, courage, or restraint.",
  },
];
