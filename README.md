# iFjora.io
Repository for ifjora webløsning (Fastify/Prisma/React + AI-tjeneste).

## Forutsetninger (installer før du starter)
- Node.js + npm
- MySQL (f.eks. via Homebrew `brew install mysql@8.4` og `brew services start mysql@8.4`)
- Python/Conda for AI-tjenesten (Miniconda/Anaconda)
- Ollama (for idé/VC-analysen): last ned fra https://ollama.com/download og kjør `ollama pull llama3.1:8b`

## Miljøvariabler (.env)
```
DATABASE_URL="mysql://app:app@localhost:3306/ifjora"
JWT_SECRET="sett-en-sterk-hemmelighet-her"
AI_API_URL="http://localhost:8001"
```

## Backend/DB (Node + MySQL)
1) Installer avhengigheter:
```
npm install
```
2) Sørg for at MySQL kjører (bruk 127.0.0.1 ved CLI):
```
mysql -h 127.0.0.1 -u app -papp -e "SELECT 1;"
```
Hvis MySQL klager på PID-fil/permission: slett pid/err med sudo og `chown -R $USER /opt/homebrew/var/mysql`, start på nytt: `/opt/homebrew/opt/mysql@8.4/bin/mysql.server start`.

3) Schema (allerede opprettet i repo): `Idea` har feltene title (TEXT), content (TEXT), market, techService, country, region, city, fundingTotal, fundingRounds, aiReply.
Hvis migrering feiler, kjør:
```
npx prisma generate
# og ev. manuell SQL hvis nødvendig:
mysql -h 127.0.0.1 -u app -papp -e "USE ifjora; ALTER TABLE Idea MODIFY content TEXT;"
```
4) Start backend:
```
npm run dev      # utvikling
# eller
npm run build && npm start  # produksjon
```

## Frontend (React/Vite)
```
cd client
npm install   # kun første gang
npm run client:dev
```

## AI-tjeneste (Python + FastAPI + Ollama)
1) I `AI/`-mappen, aktiver miljøet:
```
conda activate startup-ai
pip install -r requirements.txt
```
2) Start API:
```
cd AI
uvicorn service:app --host 0.0.0.0 --port 8001
```
3) (Valgfritt men anbefalt) Start Ollama for idé/VC-analyse:
```
ollama pull llama3.1:8b
ollama run llama3.1:8b   # la stå i egen terminal
```
Uten Ollama får du kun data-modell-score; med Ollama får du idé/VC-score og detaljerte kommentarer.

## Felter som sendes til AI (POST /api/ideas)
Krever bearer-token. Body:
```
{
  "title": "...",
  "content": "...",
  "market": "...",
  "techService": "...",
  "country": "...",
  "region": "...",
  "city": "...",
  "fundingTotal": 0,
  "fundingRounds": 0,
  "team": "Teamets erfaring/kompetanse"
}
```
Backend lagrer ideen og AI-svaret i databasen; innsikt-siden viser kombinert score, data-score, idé-score, styrker/svakheter og AI-kommentarer per kategori.

## API-endepunkter (backend)
- `POST /api/register` `{ email, password }`
- `POST /api/login` `{ email, password }`
- `GET /api/me`
- `PUT /api/me` `{ email?, password? }`
- `POST /api/ideas` (se feltene over)
- `GET /api/ideas` (dine ideer + analyse)
- `DELETE /api/ideas/:id` (slett egen idé)
- Admin: `GET/DELETE /api/admin/users` og `GET/DELETE /api/admin/ideas`
- `GET /api/health`

## Vanlige problemer
- **MySQL PID/ERR-feil:** fjern pid/err i `/opt/homebrew/var/mysql`, `chown -R $USER /opt/homebrew/var/mysql`, start MySQL på nytt.
- **Prisma migrate feiler:** kjør `npx prisma generate`. DB-skjemaet er allerede på plass; bruk manuell ALTER om nødvendig.
- **AI gir bare data-score:** sjekk at AI_API_URL peker til uvicorn (http://localhost:8001) og at Ollama kjører for idé/VC-score.  
