"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};
const alwaysTrue = () => true;
const alwaysFalse = () => false;

/**
 * True once the browser has taken over. Anything that reaches for `document` —
 * a portal target, a measured rect — waits on this.
 *
 * A mount effect calling setState would answer the same question at the cost of
 * an extra render pass on every visit, so this reads the answer instead.
 */
export function useHydrated() {
  return useSyncExternalStore(noSubscribe, alwaysTrue, alwaysFalse);
}
