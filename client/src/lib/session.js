const PREFIX = 'live-quiz.player.';
const KEYS = Object.freeze(['gameId', 'pin', 'playerId', 'resumeToken', 'nickname']);

export function createMemoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
}

function browserStorage() { return typeof sessionStorage === 'undefined' ? createMemoryStorage() : sessionStorage; }

export function createPlayerSession(storage = browserStorage()) {
  const read = (key) => storage.getItem(`${PREFIX}${key}`) ?? undefined;
  const write = (key, value) => value ? storage.setItem(`${PREFIX}${key}`, value) : storage.removeItem(`${PREFIX}${key}`);
  return {
    load() {
      const saved = Object.fromEntries(KEYS.map((key) => [key, read(key)]).filter(([, value]) => value));
      const joinRequestId = read('joinRequestId');
      const recoveryRequestId = read('recoveryRequestId');
      return { ...saved, ...(joinRequestId && { joinRequestId }), ...(recoveryRequestId && { recoveryRequestId }) };
    },
    save(session) { KEYS.forEach((key) => write(key, session[key])); },
    clear() { [...KEYS, 'joinRequestId', 'recoveryRequestId'].forEach((key) => write(key)); },
    setPendingJoinRequestId(value) { write('joinRequestId', value); },
    setPendingRecoveryRequestId(value) { write('recoveryRequestId', value); },
    clearPendingJoinRequestId() { write('joinRequestId'); },
    clearPendingRecoveryRequestId() { write('recoveryRequestId'); },
  };
}

export const playerSession = createPlayerSession();
export const newRequestId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
