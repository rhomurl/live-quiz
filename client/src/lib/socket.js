import { io } from 'socket.io-client';

export const socket = io({ reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 500, reconnectionDelayMax: 5_000 });
