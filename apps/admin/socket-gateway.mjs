// Standalone Socket.io gateway on port 3002.
// Players connect here. The admin app emits via the same Redis adapter,
// this process forwards events to connected screens.
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const f of [resolve(__dirname, '.env.local'), resolve(__dirname, '../../.env')]) {
    try {
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
      break;
    } catch { /* try next */ }
  }
}
loadEnv();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PORT = 3002;

const pubClient = new Redis(REDIS_URL);
const subClient = pubClient.duplicate();
pubClient.on('error', (e) => console.error('[gateway] Redis pub:', e.message));
subClient.on('error', (e) => console.error('[gateway] Redis sub:', e.message));

const httpServer = createServer((_, res) => {
  res.writeHead(200); res.end('SignFlow socket gateway\n');
});

const io = new Server(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});
io.adapter(createAdapter(pubClient, subClient));

io.on('connection', (socket) => {
  socket.on('screen:join', ({ screenId, orgSlug }) => {
    socket.join(`org:${orgSlug}`);
    socket.join(`org:${orgSlug}:screen:${screenId}`);
    console.log(`[gateway] joined org=${orgSlug} screen=${screenId}`);
  });
});

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[gateway] port ${PORT} already in use — another instance is running, exiting cleanly`);
    process.exit(0);
  }
  throw err;
});
httpServer.listen(PORT, () => console.log(`[gateway] listening on :${PORT}`));
