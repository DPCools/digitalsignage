import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@signflow/types';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (socket) return socket;
  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? '', {
    transports: ['websocket', 'polling'],
    autoConnect: false,
  });
  return socket;
}

export function connectSocket(screenId: string, orgSlug: string) {
  const s = getSocket();
  s.connect();
  s.on('connect', () => s.emit('screen:join', { screenId, orgSlug }));
  return s;
}
