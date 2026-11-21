# CLAUDE.md – Výkresovna

Webová platforma pro výuku čtení technických výkresů pomocí interaktivních 3D modelů
(uživatel model otáčí, řeže a porovnává s 2D výkresem). Zákazníci: výrobní firmy (B2B), střední
průmyslové školy a SOU, později B2C modul stereometrie (připravit architekturu, nestavět).

## Stav projektu

- Krok 1 (plán) hotový jako návrh: `docs/plan.md`. **Čeká na schválení Jiřím**, teprve pak fáze 0.
- Aplikační kód zatím neexistuje. Příkazy níže jsou plánované a doplní se ve fázi 0.

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

| Česky | V kódu |
|---|---|
| nárys (pohled zepředu) | `front` |
| půdorys (pohled shora) | `top` |
| bokorys (pohled zleva) | `left` |
| pohled zprava / zdola / zezadu | `right` / `bottom` / `rear` |
| řez | `section` |
| průřez | `crossSection` |
| stopa roviny řezu | `cuttingPlaneLine` |
| kóta | `dimension` |
| šrafování | `hatching` |
| osa | `centerLine` |
| viditelná / skrytá hrana | `visibleEdge` / `hiddenEdge` |
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

## Konvence

- TypeScript strict. Žádné texty natvrdo v komponentách (vše přes `messages/*.json`).
- Každá nová tabulka: RLS zapnuté + politiky + pgTAP test izolace organizací.
- Úlohy jsou deterministické ze `seed`; ukládá se `seed` + `engine_version`.
- Distraktor musí mít jiný 2D otisk než správná odpověď (jinak se zahodí).
- Žádné trackery třetích stran, minimum osobních údajů.

## Příkazy (doplní se ve fázi 0)

```bash
pnpm install
pnpm dev            # Next.js vývojový server
pnpm lint
pnpm typecheck
pnpm test           # Vitest
pnpm test:e2e       # Playwright
pnpm db:test        # pgTAP testy RLS (vyžaduje Supabase CLI + Docker)
```
