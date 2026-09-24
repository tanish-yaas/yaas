import { cache } from "react";
import { auth } from "@/auth";

/**
 * The signed-in session, once per request.
 *
 * Sessions are database-backed, so every auth() call is a session lookup plus
 * a user lookup. Two things ask for it on every single page — the root layout,
 * for the interface scale, and getCurrentContext, for everything else — and
 * neither knew about the other, so both pairs of queries ran. cache() is
 * per-request, which is exactly the scope the answer is good for.
 */
export const currentSession = cache(async () => auth());
