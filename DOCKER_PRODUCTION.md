# PufferBlow Client Production Docker

This repository contains the webapp-only production stack.

Files:
- `docker-compose.prod.client.yml`
- `Dockerfile.prod`

## Run

```bash
docker compose -f docker-compose.prod.client.yml up -d --build
```

## Notes

- Exposes `3000:3000`
- Runs production server via `npm run start`
