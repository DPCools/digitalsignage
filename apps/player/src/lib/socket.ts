import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@signflow/types';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let onConnect: (() => void) | null = null;

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
  // Replace the previous handler so React Strict Mode double-invoke doesn't
  // accumulate duplicate 'connect' listeners on the singleton socket.
  if (onConnect) s.off('connect', onConnect);
  onConnect = () => s.emit('screen:join', { screenId, orgSlug });
  s.on('connect', onConnect);
  s.connect();
  return s;
}
