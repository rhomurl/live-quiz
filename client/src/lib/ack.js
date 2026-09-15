export function acknowledgementError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function createAckEmitter(socket, { timeoutMs = 5_000 } = {}) {
  return {
    emitWithAck(event, payload) {
      if (!socket?.connected) return Promise.reject(acknowledgementError('OFFLINE'));
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(acknowledgementError('ACK_TIMEOUT')), timeoutMs);
        socket.emit(event, payload, (response) => {
          clearTimeout(timeout);
          if (response?.ok) resolve(response.data);
          else reject(acknowledgementError(response?.error ?? 'BAD_PAYLOAD'));
        });
      });
    },
  };
}

export const emitWithAck = (socket, event, payload, options) => createAckEmitter(socket, options).emitWithAck(event, payload);
