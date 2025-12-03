# iFjora.io
Repository for ifjora webløsning

## Kom i gang
1. Kopier `.env.example` til `.env` og oppdater om du bruker annen host/bruker/pass:
   ```
   DATABASE_URL="mysql://app:app@localhost:3306/ifjora"
   JWT_SECRET="en-lang-random-hemmelighet"
   ```
2. Sørg for at MySQL/MariaDB kjører (f.eks. `brew services start mysql@8.4`).
3. Installer avhengigheter:
   ```
   npm install
   ```
4. Kjør migrering for å opprette tabeller:
   ```
   XDG_CACHE_HOME=./.cache PRISMA_ENGINES_CACHE_DIR=./.prisma-engines npx prisma migrate dev --name init
   ```
   (Miljøvariablene for cache er nyttige hvis du får skrivefeil under generering.)
5. Start serveren:
   ```
   npm run build
   npm start
   ```
   For utvikling med auto-reload, prøv (kan kreve samme cache-variabler som over):
   ```
   TSX_IPC_PATH=./.cache/tsx npm run dev:watch
   ```

## Frontend (React)
- Start dev-server:
  ```
  npm run client:dev
  ```
- Bygg statiske filer:
  ```
  npm run client:build
  ```

## API-er
- `POST /api/register` — body `{ "email": "...", "password": "..." }`, lager bruker (passord hashes med Argon2). Svar inkluderer JWT.
- `POST /api/login` — body `{ "email": "...", "password": "..." }`, verifiserer bruker. Svar inkluderer JWT.
- `GET /api/me` — krever `Authorization: Bearer <token>`, henter egen profil.
- `PUT /api/me` — krever `Authorization: Bearer <token>`, oppdaterer egen e-post og/eller passord.
- `POST /api/ideas` — krever `Authorization: Bearer <token>`, body `{ "title": "...", "content": "..." }`, lagrer idé knyttet til innlogget bruker (AI-svarfelt finnes, men fylles ikke ennå).

`GET /api/health` gir en enkel status.

## Rask testing med curl
```
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"minst8tegn"}'
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"minst8tegn"}'
# Sett token=$(...) fra login-svaret:
curl -H "Authorization: Bearer $token" http://localhost:3000/api/me
curl -X POST http://localhost:3000/api/ideas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $token" \
  -d '{"title":"Min idé","content":"Beskrivelse"}'
```
