import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { ServerToClientEvents, ClientToServerEvents, InterServerEvents } from '@signflow/types';

type SocketServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents>;

let io: SocketServer | null = null;

export function getSocketServer(): SocketServer {
  if (io) return io;

  const pubClient = new Redis(process.env.REDIS_URL!);
  const subClient = pubClient.duplicate();

  io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents>({
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  io.adapter(createAdapter(pubClient, subClient));

  io.on('connection', (socket) => {
    socket.on('screen:join', ({ screenId, orgSlug }) => {
      socket.join(`org:${orgSlug}`);
      socket.join(`screen:${screenId}`);
    });
  });

  return io;
}

export async function emitToScreen(
  orgSlug: string,
  screenId: string,
  event: keyof ServerToClientEvents,
  payload?: unknown
): Promise<void> {
  const server = getSocketServer();
  (server.to(`screen:${screenId}`) as unknown as { emit: (e: string, p?: unknown) => void })
    .emit(event, payload);
}

export async function emitToOrg(
  orgSlug: string,
  event: keyof ServerToClientEvents,
  payload?: unknown
): Promise<void> {
  const server = getSocketServer();
  (server.to(`org:${orgSlug}`) as unknown as { emit: (e: string, p?: unknown) => void })
    .emit(event, payload);
}
