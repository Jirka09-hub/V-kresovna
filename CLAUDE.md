# CLAUDE.md – Výkresovna

Webová platforma pro výuku čtení technických výkresů pomocí interaktivních 3D modelů
(uživatel model otáčí, řeže a porovnává s 2D výkresem). Zákazníci: výrobní firmy (B2B), střední
průmyslové školy a SOU, později B2C modul stereometrie (připravit architekturu, nestavět).

## Stav projektu

- Plán schválen 2026-11-21 (`docs/plan.md`), hosting změněn na Cloudflare (D-011).
- Fáze 0 hotová a nasazená (PR #1).
- Fáze 1 (engine) hotová a čeká na Jiřího kontrolu 10 výkresů: stránka `/cs/laborator`,
  snapshoty v `packages/engine/test/__snapshots__/*.svg` a `apps/web/e2e/laborator.spec.ts-snapshots/`.
- Další: fáze 2 (cvičení 1–3, distraktory, demo) až po schválení výkresů.

## Jak pracujeme

- Postup po fázích 0–5 (viz `docs/plan.md`, kapitola 9). **Po každé fázi zastavit** a napsat: co je hotové,
  jak to vyzkoušet (konkrétní kroky), co doporučuji dál.
- Fáze 1: výkresy 10 testovacích součástí ukázat Jiřímu před pokračováním.
- Commitovat po logických krocích, zprávy česky, srozumitelně (např. `engine: viditelnost hran pro díry`).
- Rozhodnutí a jejich důvody zapisovat do `docs/decisions.md`; tento soubor průběžně aktualizovat.

## Odborná pravidla (kritické)

- Pouze **evropské promítání** (metoda E, první kvadrant). Vůči nárysu: půdorys pod, bokorys zleva vpravo,
  pohled zprava vlevo, pohled zdola nahoře, pohled zezadu úplně vpravo. Americké promítání jen jako výslovná
  výuková ukázka (konstanta `THIRD_ANGLE_DEMO_ONLY`).
- Čáry: viditelné hrany plná tlustá; skryté čárkovaná tenká; osy čerchovaná tenká; kótovací a pomocné plná
  tenká; stopa roviny řezu čerchovaná se zesílenými konci, šipkami a písmenem (A–A).
- Řez: šrafy tenké pod 45°. MVP plný řez, poloviční připravit.
- Kóty v mm bez jednotky, text nad kótovací čarou, čitelný zdola nebo zprava.
- Všechna pravidla jen v `packages/drafting-standards` (konstanty + testy). Nikde jinde žádná „magická čísla“
  z norem.
- **Nekopírovat text norem.** Vysvětlivky psát vlastními slovy.
- Když si nejsem jistý pravidlem: zeptat se Jiřího a označit v kódu `// TODO(norma)`. Nehádat.

## Terminologie (UI česky, identifikátory v kódu anglicky)

| Česky                                        | V kódu                                             |
| -------------------------------------------- | -------------------------------------------------- |
| nárys (pohled zepředu)                       | `front`                                            |
| půdorys (pohled shora)                       | `top`                                              |
| bokorys (pohled zleva)                       | `left`                                             |
| pohled zprava / zdola / zezadu               | `right` / `bottom` / `rear`                        |
| řez                                          | `section`                                          |
| průřez                                       | `crossSection`                                     |
| stopa roviny řezu                            | `cuttingPlaneLine`                                 |
| kóta                                         | `dimension`                                        |
| šrafování                                    | `hatching`                                         |
| osa                                          | `centerLine`                                       |
| viditelná / skrytá hrana                     | `visibleEdge` / `hiddenEdge`                       |
| díra, drážka, osazení, zkosení, výřez, žebro | `hole`, `slot`, `step`, `chamfer`, `cutout`, `rib` |

## Architektura (plánovaná)

- `apps/web`: Next.js App Router + TypeScript + Tailwind, next-intl, Supabase klienti.
- `packages/engine`: `PartSpec` → solid (`manifold-3d`), hrany, viditelnost (CPU, BVH), řezy, kóty, SVG.
  **Nesmí importovat React, Next.js, DOM ani Supabase.** Běží v prohlížeči, workeru i Node.
- `packages/viewer`: R3F + drei komponenty (prohlížeč, kostka orientace, animace rozložení, rovina řezu).
- `packages/drafting-standards`: odborná pravidla.
- `packages/exercises`: generátory úloh, distraktory, hodnocení s kódy chyb, adaptivita. Bez UI.
- `packages/content`: modul → lekce → úlohy jako data.
- `supabase/`: migrace, RLS, pgTAP testy.

Souřadnice enginu: X doprava, Y dozadu, Z nahoru, mm (viz D-008).

## Engine v kostce

- `buildPart(wasm, spec)` → `SolidMesh` (síť + původ ploch), `extractEdges` → logické hrany,
  `projectView` → viditelné/skryté úseky pohledu, `createDrawing` → rozmístění + osy, `drawingToSvg` → SVG.
- Id hran: `<plocha>|<plocha>#n` (např. `cyl:d1|p:2:3#0`), obrys válce `sil:cyl:d1`, osa `feature:d1`.
  Propojení 3D ↔ 2D řeší `apps/web/lib/engine/highlight.ts`.
- Nové testovací součásti patří do `packages/engine/src/fixtures/test-parts.ts`; po změně výkresu
  `pnpm test -u` a `pnpm --filter web test:e2e --update-snapshots`, změnu snapshotu vždy prohlédnout.

## Konvence

- TypeScript strict. Žádné texty natvrdo v komponentách (vše přes `messages/*.json`).
- Každá nová tabulka: RLS zapnuté + politiky + pgTAP test izolace organizací.
- Úlohy jsou deterministické ze `seed`; ukládá se `seed` + `engine_version`.
- Distraktor musí mít jiný 2D otisk než správná odpověď (jinak se zahodí).
- Žádné trackery třetích stran, minimum osobních údajů.

## Příkazy

```bash
pnpm install
pnpm dev                       # Next.js vývojový server (http://localhost:3000/cs)
pnpm lint                      # ESLint (včetně zákazu textů natvrdo a hranic balíčků)
pnpm format                    # Prettier
pnpm typecheck                 # tsc ve všech balíčcích
pnpm test                      # Vitest (balíčky + aplikace)
pnpm build && pnpm test:e2e    # Playwright proti produkčnímu buildu (next start)
pnpm --filter web cf:build     # build pro Cloudflare Workers (OpenNext)
pnpm --filter web cf:preview   # build + lokální běh ve workerd (wrangler)
pnpm db:start && pnpm db:test  # lokální Supabase (Docker) + pgTAP testy RLS
```

## Infrastruktura

- Supabase projekt `vykresovna`, ref `lzzbnvqkwbcjsbmktelm`, region eu-central-1 (plán Free; před pilotem Pro).
  Migrace v `supabase/migrations/`; na vzdálený projekt se zatím aplikují přes Supabase MCP a soubor
  se pojmenuje podle verze, kterou vrátí `list_migrations`, aby lokál a produkce seděly.
- Veřejné hodnoty Supabase jsou v `apps/web/.env` (publishable klíč je určený pro prohlížeč). Tajné klíče jen
  do `.env.local` / Cloudflare secrets.
- Cloudflare Workers přes `@opennextjs/cloudflare`, konfigurace `apps/web/wrangler.jsonc`. Deploy přes
  Cloudflare Workers Builds napojené na GitHub (postup v `README.md`).
- Poptávky z formuláře „Chci pilot“ chodí na e-mail, který zadal Jiří (viz projektová paměť), přes Cloudflare
  Email Routing.
- ESLint zůstává na v9: pluginy `eslint-config-next` zatím v10 nepodporují.
- Next.js 16 hlásí, že `middleware.ts` je zastaralý (nově `proxy.ts`). Zůstáváme u `middleware.ts`, protože
  OpenNext na Cloudflare podporuje jen edge middleware.
