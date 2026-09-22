# Production VPS Deployment (Docker)

Three containers: `aadya-web` (Nginx + static Vite build), `aadya-api`
(Node/Express/Prisma), `aadya-db` (Postgres 16). See `docker-compose.prod.yml`,
`Dockerfile.frontend`, `server/Dockerfile`.

## 0. Before you start: check what's already on the VPS

```bash
docker ps
docker network ls
```

If a Traefik container is already running and owns host ports 80/443, do
**not** bind `aadya-web`/`aadya-api` to host ports directly. Instead:

1. Find Traefik's actual Docker network name: `docker inspect <traefik-container> --format '{{json .NetworkSettings.Networks}}'`.
2. Find its certificate resolver name from its own compose file / static config (`--certificatesresolvers.<name>.acme...`).
3. In `.env.production`, set `TRAEFIK_NETWORK=<that network name>` and `TRAEFIK_CERT_RESOLVER=<that resolver name>`.
4. In `docker-compose.prod.yml`, change the `aadya_public` network at the bottom to:
   ```yaml
   aadya_public:
     external: true
     name: traefik_public   # replace with the real name
   ```

If there is **no** existing reverse proxy, add `ports: ["80:80"]` (web) and
front it with your own TLS termination, or install Traefik fresh and label
these services as already configured.

## 1. Clone and configure

```bash
git clone https://github.com/singhdaksh7/aadhya- aadya
cd aadya
cp .env.production.example .env.production
# edit .env.production: real DB password, JWT secrets, FRONTEND_URL,
# ADMIN_*, Razorpay/SMTP keys if available, DOMAIN, TRAEFIK_* if applicable
```

Generate strong secrets:
```bash
openssl rand -base64 48   # run twice, for JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
openssl rand -base64 24   # for POSTGRES_PASSWORD
```

## 2. Validate the compose config before building anything

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production config
```

This must succeed with no undefined critical variables. Fix `.env.production`
until it does — do not proceed otherwise.

## 3. Build images

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build
```

## 4. Start the database first, then migrate

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d aadya-db
docker compose -f docker-compose.prod.yml --env-file .env.production exec aadya-db pg_isready -U aadya

# Run migrations from a one-off container using the same image/env as the API:
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm aadya-api npx prisma migrate deploy
```

Never run `prisma migrate dev` or `prisma migrate reset` against this database.

## 5. Create the first admin (and only the admin — no demo catalog)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm aadya-api node prisma/seed.js
```

`SEED_DEMO_CATALOG` must be unset/`false` in `.env.production` (it is, by
default in `.env.production.example`) so this only creates the admin user
from `ADMIN_NAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD` — it will not populate the
store with placeholder products.

## 6. Bring everything up

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f aadya-api
```

## 7. Verify

```bash
curl -f https://api-store.<domain>/api/health
curl -I https://store.<domain>/
```

Then walk through the smoke test in the final report: homepage, shop,
product page, cart, register/login, admin login + create product, storefront
picks it up, checkout preview, order creation, track order, newsletter.

## Webhook URL (Razorpay)

Configure in the Razorpay dashboard once TEST (or live) keys are set:

```
https://api-store.<domain>/api/webhooks/razorpay
```

## Database backup / restore

Volume: `aadya_postgres_data`.

**Backup:**
```bash
docker compose -f docker-compose.prod.yml exec aadya-db \
  pg_dump -U aadya -d aadya -F c -f /tmp/aadya-$(date +%Y%m%d-%H%M%S).dump
docker cp aadya-db:/tmp/aadya-<timestamp>.dump ./backups/
```

**Restore** (destructive — only run deliberately, never automated):
```bash
docker cp ./backups/aadya-<timestamp>.dump aadya-db:/tmp/restore.dump
docker compose -f docker-compose.prod.yml exec aadya-db \
  pg_restore -U aadya -d aadya --clean --if-exists /tmp/restore.dump
```

## Redeploying after a code change

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm aadya-api npx prisma migrate deploy
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```
