export const AI_CONFIG = {
  // Model IDs churn. Verify with the ListModels call, or at
  // https://ai.google.dev/gemini-api/docs/pricing (check the Free Tier column).
  //
  // Both are "lite" deliberately, and not as a compromise. Benchmarked against
  // the real parse schema, the lite models answered in ~1.2s where the full
  // flash models took 4-6s or were refusing requests outright — and they were
  // *more* accurate on the case this prompt is most fragile about: 3.6-flash
  // read "next monday" as a week later than the date table it was given, which
  // is the calendar-arithmetic mistake buildDateAnchors exists to prevent.
  // The lite pair got every case right.
  //
  // The fallback is the moving alias on purpose. The primary is pinned so its
  // behaviour is predictable, while the fallback follows whatever Google
  // currently ships — so if a pinned id is retired, the chain still resolves.
  model: "gemini-3.5-flash-lite",
  fallbackModel: "gemini-flash-lite-latest",

  // The monthly deliverables report reads a whole month of spreadsheet rows at
  // once and has to hold dozens of videos straight. The lite pair above is
  // tuned for one-line parses and starts dropping rows at that size, so this
  // one job gets the bigger model. A moving alias on purpose: it should follow
  // whatever Google currently ships as their best flash model, and the pinned
  // lite model above is the fallback if the alias ever stops resolving.
  reportModel: "gemini-flash-latest",

  promptVersion: "task-parse-v3",

  maxInputChars: 2000,
  minConfidenceToAutofill: 0.4,
} as const;