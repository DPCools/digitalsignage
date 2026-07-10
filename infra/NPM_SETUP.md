# Fronting SignFlow with a remote Nginx Proxy Manager

Nginx Proxy Manager (NPM) runs on a **separate machine**, not this VPS. It
terminates SSL and reverse-proxies plain HTTP over the network to this VPS's
public IP on port 80, where `signflow-nginx` (already published on host port
80 — no change needed there) does the internal path routing to
admin/player/socket/minio.

```
Internet → NPM (separate host, SSL termination)
             → http://<this-VPS-public-IP>:80 → signflow-nginx → admin/player/minio
```

## 1. DNS

Point `bigmotoringworld.digitalsignflow.co.uk`'s A record at the **NPM
machine's** public IP, not this VPS's. NPM is what the internet talks to;
this VPS is the backend it forwards to.

## 2. Firewall on this VPS

Port 80 needs to be reachable by the NPM machine. Restrict it to NPM's IP
specifically rather than leaving it open to the whole internet, e.g. with
`ufw`:

```sh
sudo ufw allow from <npm-machine-ip> to any port 80 proto tcp
```

If a security-group / cloud firewall sits in front of this VPS, mirror the
same restriction there.

## 3. Add the Proxy Host in NPM

- Domain: `bigmotoringworld.digitalsignflow.co.uk`
- Scheme: `http`
- Forward Hostname/IP: this VPS's public IP (or a private/VPN IP if NPM and
  this VPS share one — preferred, since traffic between them is plain HTTP)
- Forward Port: `80`
- **Websockets Support: ON** — required for Socket.io (`/socket.io/`); if
  left off, real-time updates to players/dashboard silently break.
- SSL tab: request a new Let's Encrypt certificate, enable "Force SSL".

## 4. Switch the app's public URLs to https://

In `.env` on this VPS:

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
