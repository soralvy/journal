export const AI_DEFAULT_MODEL = 'gpt-5.4-nano';
export const AI_MAX_OUTPUT_TOKENS = 800;

export const AI_MVP_ALLOWED_MODELS = [AI_DEFAULT_MODEL] as const;
const AI_MVP_ALLOWED_MODEL_VALUES: ReadonlySet<string> = new Set(AI_MVP_ALLOWED_MODELS);

export const AI_MVP_REASONING_POLICY = {
  deepModeEnabled: false,
  highReasoningEnabled: false,
  xhighReasoningEnabled: false,
} as const;

export interface MvpAiModelPolicy {
  model: string;
  maxOutputTokens: number;
  reasoning: typeof AI_MVP_REASONING_POLICY;
}

export const getMvpAiModelPolicy = (): MvpAiModelPolicy => ({
  model: AI_DEFAULT_MODEL,
  maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
  reasoning: AI_MVP_REASONING_POLICY,
});

export const isMvpAiModelAllowed = (model: string): boolean => {
  return AI_MVP_ALLOWED_MODEL_VALUES.has(model);
};
