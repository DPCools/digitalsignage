# Fronting SignFlow with an existing Nginx Proxy Manager

SignFlow's own nginx (`infra-nginx-1` / `signflow-nginx`) still does the internal
path routing (`/`, `/socket.io/`, `/play/`, `/pair`, `/minio/`). It no longer
publishes port 80 to the host — Nginx Proxy Manager (NPM) terminates SSL and
forwards plain HTTP to it over a shared Docker network.

## 1. Find or create the shared network

If NPM already has an external network other stacks join, use its name.
Otherwise create one:

```sh
docker network create npm_shared
```

Connect your existing NPM container to it too (skip if NPM is already on a
network you're reusing):

```sh
docker network connect npm_shared <npm-container-name>
```

If you used a name other than `npm_shared`, update `infra/docker-compose.yml`
(`networks.npm_shared` → your name, and the `nginx` service's network list)
to match.

## 2. Start SignFlow

```sh
docker compose -f infra/docker-compose.yml up -d --build
```

`signflow-nginx` will join both `signflow_net` (internal) and `npm_shared`
(so NPM can reach it) — with no port published to the host.

## 3. Add the Proxy Host in NPM

- Domain: `bigmotoringworld.digitalsignflow.co.uk`
- Scheme: `http`
- Forward Hostname/IP: `signflow-nginx`
- Forward Port: `80`
- **Websockets Support: ON** — required for Socket.io (`/socket.io/`); if
  left off, real-time updates to players/dashboard silently break.
- SSL tab: request a new Let's Encrypt certificate, enable "Force SSL".

## 4. Switch the app's public URLs to https://

In `.env` on the VPS:

```
NEXTAUTH_URL=https://bigmotoringworld.digitalsignflow.co.uk
AUTH_URL=https://bigmotoringworld.digitalsignflow.co.uk
NEXT_PUBLIC_API_URL=https://bigmotoringworld.digitalsignflow.co.uk
NEXT_PUBLIC_SOCKET_URL=https://bigmotoringworld.digitalsignflow.co.uk
MINIO_PUBLIC_URL=https://bigmotoringworld.digitalsignflow.co.uk/minio
```

These are inlined at build time — after editing `.env`, rebuild:

```sh
docker compose -f infra/docker-compose.yml up -d --build
```
