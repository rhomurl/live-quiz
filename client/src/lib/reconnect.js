const INVALID_RESUME_SESSION_ERRORS = new Set(['BAD_RESUME_TOKEN', 'BAD_SECRET', 'GAME_NOT_FOUND', 'UNAUTHORIZED']);

// Network and acknowledgement failures do not prove that a tab's credentials are stale.
export const shouldDiscardResumeSession = (errorCode) => INVALID_RESUME_SESSION_ERRORS.has(errorCode);
