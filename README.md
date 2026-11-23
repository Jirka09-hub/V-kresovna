# Výkresovna

Interaktivní trenažér čtení technických výkresů na 3D modelech (pracovní název).

- Plán a architektura: [`docs/plan.md`](docs/plan.md)
- Rozhodnutí: [`docs/decisions.md`](docs/decisions.md)
- Konvence a příkazy pro vývoj: [`CLAUDE.md`](CLAUDE.md)

## Rychlý start

```bash
corepack enable          # zapne pnpm podle package.json
pnpm install
pnpm dev                 # http://localhost:3000/cs
```

## Nasazení na Cloudflare Workers (jednorázové napojení)

Aplikace běží na Cloudflare Workers přes adaptér OpenNext. Nasazení zajišťuje **Cloudflare Workers Builds**:
po napojení repozitáře se každý push do `main` nasadí do produkce a každá jiná větev dostane náhledovou adresu.

1. V Cloudflare dashboardu otevři **Workers & Pages** → **Create** → **Import a repository**
   (případně **Connect to Git**) a vyber GitHub repozitář `V-kresovna`. Pokud Cloudflare k repozitáři
   ještě nemá přístup, nech se provést instalací aplikace Cloudflare na GitHubu.
2. Nastavení projektu:
   - **Project name:** `vykresovna` (musí sedět s `name` v `apps/web/wrangler.jsonc`)
   - **Production branch:** `main`
   - **Root directory / Path:** `/` (kořen repozitáře, kvůli pnpm workspace a lockfile)
   - **Build command:** `pnpm --filter web cf:build`
   - **Deploy command:** `pnpm --filter web exec wrangler deploy`
   - **Non-production branch deploy command:** `pnpm --filter web exec wrangler versions upload`
3. V **Settings → Variables and secrets** (pro build) přidej:
   - `NODE_VERSION` = `22`
   - `PNPM_VERSION` = `10.28.0`
4. Ulož a spusť první build. Aplikace pak poběží na `https://vykresovna.<tvůj-účet>.workers.dev`.
5. Kontrola: otevři `/api/health`. Má vrátit `"ok": true` a `"supabase": "ok"`.

Vlastní doménu přidáme později v **Settings → Domains & Routes**.

### Upozornění e-mailem na poptávku pilotu (až bude doména)

Poptávky z formuláře „Chci pilot“ se vždy uloží do databáze a jsou v `/cs/platforma`. E-mail navíc
posílá Cloudflare Email Service, který potřebuje doménu spravovanou Cloudflare a placený plán Workers.

1. Doména v Cloudflare (DNS u Cloudflare), v dashboardu **Email → Email Sending** ji přidej
   a nech Cloudflare nastavit DNS záznamy.
2. Do `apps/web/wrangler.jsonc` přidej vazbu (adresu příjemce stačí mít v proměnné níže):
   ```jsonc
   "send_email": [{ "name": "PILOT_EMAIL" }],
   ```
3. Ve Workeru **Settings → Variables and secrets** (runtime) přidej `PILOT_NOTIFY_TO` (kam chodí
   upozornění) a `PILOT_NOTIFY_FROM` (např. `poptavky@<doména>`).
4. Po nasazení odešli zkušební poptávku. Když e-mail nepřijde, chyba je v logu Workeru
   („pilot: e-mail se nepodařilo odeslat“), poptávka zůstane v databázi.

## Struktura

```
apps/web                    Next.js aplikace (UI, stránky, server actions)
packages/drafting-standards odborná pravidla technického kreslení + testy
packages/engine             geometrie, projekce, viditelnost hran, SVG výkres
packages/viewer             3D prohlížeč (React Three Fiber)
packages/exercises          úlohy, distraktory, hodnocení
packages/content            obsah modulů a lekcí
supabase/                   migrace a pgTAP testy RLS
```
