import { createMemoryStorage } from './session.js';

const PREFIX = 'live-quiz.host.';
const KEYS = Object.freeze(['gameId', 'pin', 'hostSecret']);
const storage = () => typeof sessionStorage === 'undefined' ? createMemoryStorage() : sessionStorage;

export function createHostSession(target = storage()) {
  const read = (key) => target.getItem(`${PREFIX}${key}`) ?? undefined;
  const write = (key, value) => value ? target.setItem(`${PREFIX}${key}`, value) : target.removeItem(`${PREFIX}${key}`);
  return {
    load: () => Object.fromEntries(KEYS.map((key) => [key, read(key)]).filter(([, value]) => value)),
    save: (value) => KEYS.forEach((key) => write(key, value[key])),
    clear: () => KEYS.forEach((key) => write(key)),
  };
}

export const hostSession = createHostSession();
