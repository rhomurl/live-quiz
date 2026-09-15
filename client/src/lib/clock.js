export const serverOffsetMs = (serverNowMs, clientNowMs = Date.now()) => serverNowMs - clientNowMs;
export const remainingMs = (endsAtMs, offsetMs, clientNowMs = Date.now()) => Math.max(0, endsAtMs - (clientNowMs + offsetMs));
export const formatCountdown = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
