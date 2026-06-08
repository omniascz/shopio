# Shopio — produkční nasazení (runbook)

Single-server Docker stack. Vše běží přes `docker compose`. Per `38-deployment-guide.md`.

## 0. Předpoklady
- Server (VPS) s Dockerem + Docker Compose v2, 4+ GB RAM, 2+ vCPU.
- 4 DNS A záznamy mířící na IP serveru: `shop.`, `admin.`, `api.`, `media.` (vaše doména).
- Otevřené porty **80 + 443** (pro Caddy / Let's Encrypt).

## 1. Konfigurace
```bash
git clone <repo> && cd shopio
cp .env.prod.example .env.prod
```
Vyplň v `.env.prod` (vygeneruj náhodné: `openssl rand -hex 32`):
- `POSTGRES_PASSWORD`, `SHOPIO_JWT_SECRET`, `SHOPIO_SESSION_PEPPER`, `MEILI_MASTER_KEY`, `MINIO_ROOT_PASSWORD`, `SHOPIO_SECRET_KEY` (32B hex — šifruje brány secrets at-rest).
- `SHOPIO_DOMAIN_*` = tvoje 4 domény. `SHOPIO_BASE_URL/ADMIN_URL/API_URL/S3_PUBLIC_URL` = `https://` verze.
- `PLATFORM_ADMIN_EMAILS` = tvůj e-mail (master-admin).
- Volitelné teď, povinné pro provoz: `SMTP_*` (Postmark/SES), `PACKETA_API_PASSWORD` (Zásilkovna), platební klíče.

## 2. Spuštění (s automatickým HTTPS)
```bash
docker compose -f docker-compose.prod.yml -f docker-compose.tls.yml \
  --env-file .env.prod up -d --build
```
- API kontejner při startu **spustí migrace** (idempotentní), pak server.
- Caddy si sám vyzvedne TLS certifikáty (chvíli to trvá; sleduj `docker compose logs -f caddy`).

Bez TLS (lokálně / za vlastním proxy): vynech `-f docker-compose.tls.yml` (služby publikují porty 3030/3031/4040).

## 3. Po prvním spuštění
- **Zapni RLS** (tvrdá tenant izolace): v Postgresu `ALTER ROLE shopio_app PASSWORD '...';`, nastav `DATABASE_URL_APP` v `.env.prod`, restartuj `api`. Bez toho RLS spí (explicitní tenant filtry zůstávají).
- Vytvoř MinIO bucket `shopio-media` (public-read) — admin konzole MinIO nebo `mc`.
- Zkontroluj health: `curl https://api.tvoje-domena/health/ready`.
- Zaregistruj se na storefront/admin, založ první tenant.

## 4. Zálohy (B5)
- Služba `backup` dělá **denní gzip dump** Postgresu do volume `backups` (retence 7 dní, konfigurovatelné `BACKUP_RETENTION_DAYS`).
- **Důležité:** volume `backups` měj mimo server (mount na síťové úložiště) NEBO nastav `BACKUP_S3_BUCKET` pro offsite kopii. Lokální záloha na stejném disku není záloha.
- Obnova:
  ```bash
  docker compose -f docker-compose.prod.yml exec -T postgres \
    sh -c 'gunzip | psql -U $POSTGRES_USER $POSTGRES_DB' < shopio-YYYYMMDD.sql.gz
  ```
- Ověř zálohu! Pravidelně zkus restore na test DB.

## 5. Monitoring
- Healthchecky: `/health/live`, `/health/ready` (Compose je už používá). Napoj externí uptime ping (UptimeRobot/BetterStack) na `https://api.../health/ready`.
- Error tracking: nastav `SENTRY_DSN` (až bude Sentry napojené v API — zatím placeholder).
- Logy: `docker compose -f docker-compose.prod.yml logs -f api`.

## 6. Aktualizace
```bash
git pull
docker compose -f docker-compose.prod.yml -f docker-compose.tls.yml --env-file .env.prod up -d --build
```
Migrace se spustí automaticky při restartu API.

## 7. Bezpečnostní checklist před ostrým provozem
- [ ] Všechny secrets v `.env.prod` jsou náhodné a unikátní.
- [ ] `DATABASE_URL_APP` nastaveno (RLS aktivní).
- [ ] `SHOPIO_SECRET_KEY` nastaveno (brány secrets šifrované).
- [ ] Zálohy tečou mimo server + restore ověřen.
- [ ] HTTPS funguje na všech 4 doménách.
- [ ] Uptime monitoring napojen.
- [ ] Reálné SMTP (SPF/DKIM/DMARC) + alespoň jedna ověřená platební brána.
