# Záznam rozhodnutí

Krátké záznamy, proč jsme co zvolili. Nové rozhodnutí = nový záznam na konec; když se rozhodnutí
změní, starý záznam se neupravuje, jen se označí jako nahrazený a odkáže na nový.

Stavy: **navrženo** (čeká na schválení Jiřím), **přijato**, **nahrazeno**.

---

## D-001 Monorepo s pnpm workspaces

- Stav: navrženo (2026-11-21)
- Rozhodnutí: jedna aplikace `apps/web` a balíčky `packages/engine`, `viewer`, `drafting-standards`,
  `exercises`, `content`. Balíčky se konzumují jako TS zdroj (`transpilePackages`), bez build kroku.
  Turborepo až bude potřeba.
- Proč: zadání vyžaduje engine oddělený od UI kvůli pozdějšímu modulu stereometrie. Balíčky s jasnými
  hranicemi to vynutí lépe než složky v jedné aplikaci.

## D-002 Odborná pravidla v `packages/drafting-standards`

- Stav: navrženo (2026-11-21)
- Rozhodnutí: zadání zmiňuje `/lib/drafting-standards`; dáváme to do `packages/drafting-standards`.
- Proč: pravidla potřebuje engine, který je samostatný balíček. Pořád jeden modul s konstantami a testy.

## D-003 Boolovské operace: `manifold-3d`

- Stav: navrženo, podmíněno prototypem na začátku fáze 1 (2026-11-21)
- Rozhodnutí: `manifold-3d` (WASM) ve Web Workeru; `three-bvh-csg` jako záloha.
- Proč: garantuje uzavřené (manifold) výsledky, je rychlý a přenáší `originalID`, takže víme, ze kterého
  prvku vznikla každá plocha (osy děr, kóty, vysvětlení chyb). Licence Apache-2.0.

## D-004 Skryté hrany: analytický výpočet na CPU (přístup B)

- Stav: navrženo (2026-11-21)
- Rozhodnutí: 2D výkres = průmět hran, rozdělení v průsečících, test zákrytu paprskem přes BVH,
  doplněno o analytické obrysy válců a kružnice z `PartSpec`. GPU depth buffer jen pro „rentgen“ ve 3D.
  OpenCascade HLR odloženo pro případný import STEP.
- Proč: jediný z porovnaných přístupů, který dává přesné vektorové SVG a zároveň je deterministický
  a testovatelný v Node. Srovnání v `docs/plan.md`, kapitola 4.

## D-005 Hosting: Vercel

- Stav: navrženo (2026-11-21)
- Rozhodnutí: Vercel, funkce v regionu `fra1` (vedle Supabase ve Frankfurtu).
- Proč: nativní podpora Next.js App Router a náhledové deploye bez konfigurace. Cloudflare by vyžadoval
  adaptér OpenNext. Komerční provoz vyžaduje plán Pro.

## D-006 Obsah jako kód, úlohy ze seedu

- Stav: navrženo (2026-11-21)
- Rozhodnutí: moduly, lekce a typy úloh jsou v `packages/content` (verzované v gitu). DB ukládá slugy,
  `seed`, `engine_version` a výsledek.
- Proč: pro pilot nepotřebujeme CMS; úlohy jdou kdykoli přesně zrekonstruovat (náhled pro školitele,
  serverové ověření skóre pro certifikát).

## D-007 Každý pokus nese `org_id`

- Stav: navrženo (2026-11-21)
- Rozhodnutí: `attempts` a `certificates` mají `org_id` organizace, ve které vznikly; RLS pro školitele
  a adminy filtruje i podle něj.
- Proč: agenturní pracovník může být ve více firmách; firma A nesmí vidět jeho výsledky z firmy B.
  `org_id` je nullable kvůli budoucím individuálním (B2C) uživatelům.

## D-008 Souřadnice enginu: X doprava, Y dozadu, Z nahoru

- Stav: navrženo (2026-11-21)
- Rozhodnutí: engine pracuje v CAD konvenci (Z nahoru, mm), převod na three.js (Y nahoru) jen ve `viewer`.
  Směry pohledů a rozmístění podle evropského promítání jsou konstanty v `drafting-standards` s testy.
- Proč: odpovídá tomu, jak se o součástech mluví v praxi, a výpočty projekcí jsou čitelnější.

## D-009 i18n: next-intl, žádné texty natvrdo

- Stav: navrženo (2026-11-21)
- Rozhodnutí: next-intl s prefixem jazyka v URL; ESLint pravidlo zakazuje texty natvrdo v JSX.
- Proč: zadání požaduje přípravu na slovenštinu a němčinu.

## D-010 Žádné trackery třetích stran

- Stav: navrženo (2026-11-21)
- Rozhodnutí: jen nezbytné cookies, analytika anonymní (vlastní počítadla nebo Plausible, rozhodne Jiří).
- Proč: na školách jsou nezletilí žáci (15+), GDPR, a jednodušší komunikace se školami.
