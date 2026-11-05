/**
 * Written to the AI writing stream while waiting for a slow model, so that
 * proxies keep the connection open. Readers remove it from the output.
 */
export const AI_KEEP_ALIVE = "​";

/** Precedes an error message at the end of the AI writing stream. */
export const AI_ERROR_MARK = "\u0000";
