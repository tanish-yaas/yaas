export const AI_CONFIG = {
  // Model IDs churn. Verify with the ListModels call, or at
  // https://ai.google.dev/gemini-api/docs/pricing (check the Free Tier column).
  model: "gemini-3.5-flash",
  fallbackModel: "gemini-3.1-flash-lite",

  promptVersion: "task-parse-v1",

  maxInputChars: 2000,
  minConfidenceToAutofill: 0.4,
} as const;