# CLAUDE.md – Výkresovna

Webová platforma pro výuku čtení technických výkresů pomocí interaktivních 3D modelů
(uživatel model otáčí, řeže a porovnává s 2D výkresem). Zákazníci: výrobní firmy (B2B), střední
průmyslové školy a SOU, později B2C modul stereometrie (připravit architekturu, nestavět).

## Stav projektu

- Plán schválen 2026-11-21 (`docs/plan.md`), hosting změněn na Cloudflare (D-011).
- Fáze 0 hotová a nasazená (PR #1).
- Fáze 1 (engine) hotová (PR #2), Jiří výkresy schválil. Laboratoř enginu: `/cs/laborator`,
  snapshoty v `packages/engine/test/__snapshots__/*.svg` a `apps/web/e2e/laborator.spec.ts-snapshots/`.
- Jiří svěřil odborná rozhodnutí Claudovi (D-017): nejasnosti řeš podle běžné praxe, zapiš do
  `docs/decisions.md` a před pilotem doporuč kontrolu učitelem. Jiřího se na normy neptej.
- Fáze 2: generátor úloh a distraktory hotové (D-019), webové UI hotové (D-020): `/cs/demo`
  (ukázka → 5 úloh → shrnutí), `/cs/lekce` a `/cs/lekce/<slug>`.
  Cvičení v `apps/web/components/exercises/`, obsah lekcí v `packages/content`. Jiří schválil (PR #3).
- Kótování (D-022): `createDrawing(spec, mesh, { dimensions: true })`, kód v `packages/engine/src/dimensions/`,
  pravidla v `packages/drafting-standards/src/dimensions.ts`, snapshoty `packages/engine/test/__snapshots__/dims/`.
  V laboratoři přepínač „Kóty“.
- Řez (D-021): `createDrawing(spec, mesh, { section: { spec: { axis, at, label }, view } })`, kód
  v `packages/engine/src/section/` (bez WASM, podmodul `@vykresovna/engine/section`), pravidla
  v `packages/drafting-standards/src/section.ts`, testovací řezy `SECTION_TEST_CASES`
  (`packages/engine/src/fixtures/section-parts.ts`, snapshoty `rez-*.svg`). 3D: `PartViewer`
  s `sectionPlane` + `onSectionChange`. V laboratoři přepínač „Řez“ a posuvník roviny.
- Fáze 3: cvičení 4 „Najdi chybu ve výkresu“ a adaptivita (D-023): `packages/exercises/src/find-error.ts`,
  `adaptivity.ts` (čisté, subpath `@vykresovna/exercises/adaptivity`), UI `FindError.tsx`; na konci lekcí
  adaptivní úlohy z historie relace.
- Fáze 3 dokončená (D-024) a sloučená (PR #4, 2026-11-22): cvičení 5 „Řez“ (vyber řez A–A / umísti rovinu,
  `packages/exercises/src/section.ts`, UI `Section.tsx`) a 6 „Odečti kótu“ (`dimension.ts`, `Dimension.tsx`).
  Lekce 1–9 dostupné: 7 řez, 8 kóty (živé úvody `SectionDemo`, `DimensionDemo`), 9 závěrečný test
  (`FINAL_TEST` v `packages/content`, UI `FinalTest.tsx`, nic se neukládá). Demo: 5 úloh pěti typů.
  Styly SVG výkresu omezené na třídu `vk-drawing` (`scopeCss`). `ENGINE_VERSION` 0.4.0.
- Fáze 4, účty (D-026, D-027): migrace `supabase/migrations/20261122070000_organizace_a_vysledky.sql`,
  pgTAP `supabase/tests/010_organizace.sql`. Účty zakládá jen server (`lib/supabase/admin.ts`,
  `SUPABASE_SECRET_KEY`), přihlášení e-mailem nebo jménem (`lib/auth/login-id.ts`, technická doména
  `ucet.vykresovna.invalid`), připojení `/cs/pripojit?kod=`, pozvánky `/cs/pozvanka/<token>`, aktivní
  organizace v cookie `vk_org`, klientský `useViewer()` (`components/auth/ViewerContext.tsx`).
- Fáze 4, správa (D-028): `/cs/skolitel` (skupiny, matice postupu, hromadné účty, CSV), `/cs/sprava`
  (správce organizace), `/cs/platforma` (provozovatel: organizace a licence).
- Fáze 4, výsledky a certifikát (D-029): lekce a test ukládají přihlášenému s platnou licencí průchod
  a pokusy z prohlížeče (`apps/web/lib/results/`, `TaskSequence onOutcome`), adaptivita čte posledních
  60 pokusů z DB. Certifikát: PDF v prohlížeči (`lib/certificate/pdf.ts`, písmo `public/fonts/`), ověření
  `/cs/overeni/<kód>`. `/cs/ucet`: jméno, heslo, odchod z organizace, certifikáty, smazání účtu.
  `ENGINE_VERSION` je v `packages/engine/src/version.ts` (subpath `@vykresovna/engine/version`).
- Seznam ke kontrole učitelem před pilotem: `docs/kontrola-ucitelem.md` (při novém odborném rozhodnutí
  doplnit i tam).

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
- Když si nejsem jistý pravidlem: rozhodnout podle běžné praxe, zapsat do `docs/decisions.md` a dát na
  seznam ke kontrole učitelem před pilotem (Jiří tak rozhodl, viz D-017).
- Slepá díra = vrtaná, kuželové dno 120°. Osy souměrnosti jen u souměrně umístěných prvků.

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
- Id hran: `<plocha>|<plocha>#n` (např. `cyl:d1|p:0:3#0`; `p:<pořadí prvku>:<faceID>`, 0 = základ),
  obrys válce `sil:cyl:d1`, kuželové dno `cone:d1`, osa díry `feature:d1`, osa souměrnosti `feature:symmetry:x`.
  Propojení 3D ↔ 2D řeší `apps/web/lib/engine/highlight.ts`.
- Nové testovací součásti patří do `packages/engine/src/fixtures/test-parts.ts`; po změně výkresu
  `pnpm test -u` a `pnpm --filter web test:e2e --update-snapshots`, změnu snapshotu vždy prohlédnout.

## Konvence

- TypeScript strict. Žádné texty natvrdo v komponentách (vše přes `messages/*.json`).
- Každá nová tabulka: RLS zapnuté + politiky + pgTAP test izolace organizací.
- Úlohy jsou deterministické ze `seed`; ukládá se `seed` + `engine_version`.
- E2E: seedy úloh pevně přes `fixSeeds(page, [...])` z `apps/web/e2e/helpers.ts`, správné odpovědi
  z testovacích atributů `data-test-*` (`data-test-correct`, `data-test-answer-at`, `data-test-answer`).
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
pnpm db:env                    # apps/web/.env.local s lokální Supabase (build + e2e s účty míří na ni)
pnpm db:types                  # typy databáze z lokální Supabase
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
