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

## 4. Add a second host for the player subdomain

Admin and player are separate Next.js apps that both generate
`/_next/static/...` asset URLs at their own root — sharing one hostname means
whichever app nginx's catch-all doesn't match 404s on its own JS/CSS the
moment it loads. `infra/nginx/nginx.conf` already routes any hostname whose
*first* label is `player` straight to the player app — it doesn't care how
many labels come after that — so:

- **Use a single-level subdomain of your base domain** — e.g.
  `player.digitalsignflow.co.uk` — **not** a second level nested under an
  org subdomain (`player.bigmotoringworld.digitalsignflow.co.uk`).
  Cloudflare's free Universal SSL certificate only covers the apex domain
  plus *one* wildcard level (`*.digitalsignflow.co.uk`); a second level
  isn't covered by that cert at all and will fail TLS negotiation
  (`ERR_SSL_VERSION_OR_CIPHER_MISMATCH`) even once the DNS record exists,
  unless you pay for Cloudflare's Advanced Certificate Manager add-on.
  The player app is a single shared instance for the whole platform
  anyway (org context comes from the pairing token stored on the device,
  not the hostname), so a single-level subdomain is also the more
  correct fit, not just the cheaper one.
- DNS: add an A record (or CNAME) for `player.digitalsignflow.co.uk`
  pointing at the same target as your main domain record — if that
  record is proxied through Cloudflare (orange cloud), proxy this one
  too, the same way.
- If you're also using NPM (rather than relying on Cloudflare alone for
  TLS): add a second Proxy Host for `player.digitalsignflow.co.uk`, same
  Forward Hostname/IP and Port (`80`) as the main host, Websockets
  Support **ON**, and its own Let's Encrypt certificate + Force SSL.

Kiosks/screens should then use `https://player.digitalsignflow.co.uk/pair`,
not a `/pair` path under the admin domain, and not a subdomain nested
under the org's own subdomain.

## 5. Switch the app's public URLs to https://

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
