import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@signflow/types';
import { reportSocketConnected, reportSocketDisconnected } from './connectivity';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let onConnect: (() => void) | null = null;
let onDisconnect: (() => void) | null = null;
let onConnectError: (() => void) | null = null;

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
  // Replace previous handlers so React Strict Mode double-invoke doesn't
  // accumulate duplicate listeners on the singleton socket.
  if (onConnect) s.off('connect', onConnect);
  if (onDisconnect) s.off('disconnect', onDisconnect);
  if (onConnectError) s.off('connect_error', onConnectError);

  onConnect = () => {
    s.emit('screen:join', { screenId, orgSlug });
    reportSocketConnected();
  };
  onDisconnect = () => reportSocketDisconnected();
  onConnectError = () => reportSocketDisconnected();

  s.on('connect', onConnect);
  s.on('disconnect', onDisconnect);
  s.on('connect_error', onConnectError);
  s.connect();
  return s;
}
