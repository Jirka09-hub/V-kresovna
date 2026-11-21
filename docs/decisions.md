# Záznam rozhodnutí

Krátké záznamy, proč jsme co zvolili. Nové rozhodnutí = nový záznam na konec; když se rozhodnutí
změní, starý záznam se neupravuje, jen se označí jako nahrazený a odkáže na nový.

Stavy: **navrženo** (čeká na schválení Jiřím), **přijato**, **nahrazeno**.

---

## D-001 Monorepo s pnpm workspaces

- Stav: přijato (2026-11-21)
- Rozhodnutí: jedna aplikace `apps/web` a balíčky `packages/engine`, `viewer`, `drafting-standards`,
  `exercises`, `content`. Balíčky se konzumují jako TS zdroj (`transpilePackages`), bez build kroku.
  Turborepo až bude potřeba.
- Proč: zadání vyžaduje engine oddělený od UI kvůli pozdějšímu modulu stereometrie. Balíčky s jasnými
  hranicemi to vynutí lépe než složky v jedné aplikaci.

## D-002 Odborná pravidla v `packages/drafting-standards`

- Stav: přijato (2026-11-21)
- Rozhodnutí: zadání zmiňuje `/lib/drafting-standards`; dáváme to do `packages/drafting-standards`.
- Proč: pravidla potřebuje engine, který je samostatný balíček. Pořád jeden modul s konstantami a testy.

## D-003 Boolovské operace: `manifold-3d`

- Stav: přijato, podmíněno prototypem na začátku fáze 1 (2026-11-21)
- Rozhodnutí: `manifold-3d` (WASM) ve Web Workeru; `three-bvh-csg` jako záloha.
- Proč: garantuje uzavřené (manifold) výsledky, je rychlý a přenáší `originalID`, takže víme, ze kterého
  prvku vznikla každá plocha (osy děr, kóty, vysvětlení chyb). Licence Apache-2.0.

## D-004 Skryté hrany: analytický výpočet na CPU (přístup B)

- Stav: přijato (2026-11-21)
- Rozhodnutí: 2D výkres = průmět hran, rozdělení v průsečících, test zákrytu paprskem přes BVH,
  doplněno o analytické obrysy válců a kružnice z `PartSpec`. GPU depth buffer jen pro „rentgen“ ve 3D.
  OpenCascade HLR odloženo pro případný import STEP.
- Proč: jediný z porovnaných přístupů, který dává přesné vektorové SVG a zároveň je deterministický
  a testovatelný v Node. Srovnání v `docs/plan.md`, kapitola 4.

## D-005 Hosting: Vercel

- Stav: **nahrazeno** rozhodnutím D-011 (2026-11-21)
- Rozhodnutí: Vercel, funkce v regionu `fra1` (vedle Supabase ve Frankfurtu).
- Proč: nativní podpora Next.js App Router a náhledové deploye bez konfigurace. Cloudflare by vyžadoval
  adaptér OpenNext. Komerční provoz vyžaduje plán Pro.

## D-006 Obsah jako kód, úlohy ze seedu

- Stav: přijato (2026-11-21)
- Rozhodnutí: moduly, lekce a typy úloh jsou v `packages/content` (verzované v gitu). DB ukládá slugy,
  `seed`, `engine_version` a výsledek.
- Proč: pro pilot nepotřebujeme CMS; úlohy jdou kdykoli přesně zrekonstruovat (náhled pro školitele,
  serverové ověření skóre pro certifikát).

## D-007 Každý pokus nese `org_id`

- Stav: přijato (2026-11-21)
- Rozhodnutí: `attempts` a `certificates` mají `org_id` organizace, ve které vznikly; RLS pro školitele
  a adminy filtruje i podle něj.
- Proč: agenturní pracovník může být ve více firmách; firma A nesmí vidět jeho výsledky z firmy B.
  `org_id` je nullable kvůli budoucím individuálním (B2C) uživatelům.

## D-008 Souřadnice enginu: X doprava, Y dozadu, Z nahoru

- Stav: přijato (2026-11-21)
- Rozhodnutí: engine pracuje v CAD konvenci (Z nahoru, mm), převod na three.js (Y nahoru) jen ve `viewer`.
  Směry pohledů a rozmístění podle evropského promítání jsou konstanty v `drafting-standards` s testy.
- Proč: odpovídá tomu, jak se o součástech mluví v praxi, a výpočty projekcí jsou čitelnější.

## D-009 i18n: next-intl, žádné texty natvrdo

- Stav: přijato (2026-11-21)
- Rozhodnutí: next-intl s prefixem jazyka v URL; ESLint pravidlo zakazuje texty natvrdo v JSX.
- Proč: zadání požaduje přípravu na slovenštinu a němčinu.

## D-010 Žádné trackery třetích stran

- Stav: přijato (2026-11-21)
- Rozhodnutí: jen nezbytné cookies, analytika anonymní (vlastní počítadla nebo Plausible, rozhodne Jiří).
- Proč: na školách jsou nezletilí žáci (15+), GDPR, a jednodušší komunikace se školami.

## D-011 Hosting: Cloudflare Workers přes OpenNext

- Stav: přijato (2026-11-21), nahrazuje D-005
- Rozhodnutí: Next.js nasazujeme na Cloudflare Workers pomocí `@opennextjs/cloudflare`. Deploy přes
  Cloudflare Workers Builds napojené na GitHub (produkce z `main`, náhledy z větví).
- Proč: Jiří má na Cloudflare placený účet a chce tam hostovat. Adaptér OpenNext je oficiálně
  podporovaná cesta pro Next.js App Router na Workers.
- Důsledky: serverový kód musí běžet v runtime Workers (Node.js kompatibilita), bez nativních modulů;
  hlídat velikost Workeru; engine s WASM běží v prohlížeči. Notifikace e-mailem přes Cloudflare
  Email Routing místo Resend.

## D-012 Supabase projekt `vykresovna` v eu-central-1

- Stav: přijato (2026-11-21)
- Rozhodnutí: nový projekt `vykresovna` (ref `lzzbnvqkwbcjsbmktelm`, Frankfurt) v Jiřího organizaci, zatím
  plán Free. Před pilotem přejít na Pro (Free projekt se po týdnu nečinnosti uspí).
- Proč: zadání chce samostatný projekt; Frankfurt kvůli GDPR a latenci z ČR.

## D-013 Prototyp potvrdil `manifold-3d`, `three-bvh-csg` nepotřebujeme

- Stav: přijato (2026-11-21), upřesňuje D-003
- Zjištění: kvádr s dírou trvá v Node asi 12 ms, výsledek je vždy uzavřená síť a `originalID` u běhů
  trojúhelníků spolehlivě říká, ze kterého prvku plocha vznikla. WASM má 540 kB.
- Rozhodnutí: `three-bvh-csg` jsme dál nezkoušeli, `manifold-3d` je jediná knihovna pro boolovské operace.
  Válce mají 96 segmentů (násobek 4), takže obrysy děr leží přesně na průměru.

## D-014 Viditelnost hran: 2D test zakrytí místo raycastu přes BVH

- Stav: přijato (2026-11-21), upřesňuje D-004
- Rozhodnutí: u pravoúhlého promítání je paprsek k pozorovateli rovnoběžný se směrem pohledu, takže test
  zakrytí je jen „leží bod v průmětu trojúhelníku natočeného k pozorovateli a je ten trojúhelník blíž?“.
  Počítá se ve float64 s mřížkou pro zrychlení. `three-mesh-bvh` proto engine nepotřebuje.
- Proč: přesnější (float64 místo float32 v BVH), jednodušší, bez závislosti na three.js v enginu.
  Desítky milisekund na pohled.

## D-015 3D prohlížeč: tlusté viditelné hrany, tenké čárkované skryté

- Stav: přijato (2026-11-21)
- Rozhodnutí: viditelné hrany přes `Line` z drei (tloušťka v pixelech), skryté hrany v režimu „rentgen“
  tenké čárkované s testem hloubky `GreaterDepth`. Vykreslování jen na vyžádání (`frameloop="demand"`),
  `PerformanceMonitor` snižuje rozlišení na slabém HW. Bez WebGL se místo 3D ukáže hláška a výkres zůstane.
- Proč: vizuálně odpovídá výkresu (tlustá viditelná, tenká skrytá) a šetří slabé grafiky.

## D-016 Engine ve Web Workeru, WASM z `public/wasm`

- Stav: přijato (2026-11-21)
- Rozhodnutí: aplikace volá engine přes Web Worker (`apps/web/workers/engine.worker.ts`), `manifold.wasm`
  se při `dev`/`build` kopíruje do `public/wasm`. Klientský kód importuje z enginu jen typy a čisté
  podmoduly (`@vykresovna/engine/projection`, `@vykresovna/engine/fixtures`), aby se WASM nedostal do
  hlavního bundlu.
- `.npmrc` vytahuje `@types/*` do kořene, jinak typy three.js nevidí `@react-three/fiber`.

## D-017 Odborné otázky z fáze 1 rozhodnuty podle běžné praxe

- Stav: přijato (2026-11-21). Jiří svěřil odborná rozhodnutí Claudovi („udělej to správně dle
  nejlepšího uvážení“). **Před pilotem doporučujeme, aby výkresy prohlédl učitel technického kreslení.**
- Slepá díra je vrtaná: dno je kužel s vrcholovým úhlem 120° (`DRILL_POINT_ANGLE_DEG`). Hloubka v popisu
  součásti je hloubka válcové části, kužel je navíc; validace hlídá, aby dno neprorazilo protější stěnu.
  Ve výkresu jsou vidět dvě šikmé skryté čáry do vrcholu a osa díry sahá až za vrchol.
- Osy souměrnosti: kreslí se, když je součást souměrná podle střední roviny a aspoň jeden prvek leží
  uvnitř (nedotýká se obou konců). Holý kvádr ani prvek přes celou délku osu nevyvolá. Osa jde přes celý
  pohled s přesahem; osa díry, která na ní leží, se nekreslí podruhé.
- Skupina čar 0,5 (0,5 / 0,25 mm), poměry čárkování podle ISO 128 (čárka 12d, mezera 3d; čerchovaná
  24d / 3d / 0,5d / 3d), přesah os 3 mm a přednost čar viditelná > skrytá > stopa řezu > osa zůstávají.
  Značky `TODO(norma)` jsou odstraněné.

## D-018 Stabilní klíče ploch

- Stav: přijato (2026-11-21)
- Rozhodnutí: v klíči rovinné plochy `p:<n>:<faceID>` je místo `originalID` z manifoldu pořadí prvku
  (0 = základní kvádr, 1… = prvky v pořadí popisu).
- Proč: `originalID` je globální počítadlo instance WASM, takže id hran záviselo na tom, co se stavělo dřív.
  Distraktory, hodnocení a snapshoty potřebují stejná id při každém sestavení.

## D-019 Generátor úloh a otisk výkresu

- Stav: přijato (2026-11-21)
- Otisk pohledu (`viewFingerprint` v enginu): kanonický popis čar relativně k průmětu tělesa, zaokrouhlený
  na 0,001 mm, se sloučenými úseky na stejné přímce; skrytá čára pod viditelnou se nepočítá (není vidět).
  Obsahuje i kružnice a osy. Dva pohledy se stejným otiskem uživatel nerozliší.
- Generátor součástí: zamítací vzorkování s pravidly čitelnosti (`packages/exercises/src/layout.ts`):
  materiál i mezera mezi prvky aspoň 3 mm, prvek aspoň 4 mm, díry Ø 6–16 mm, prvky se nepřekrývají
  ani nedotýkají. Nejsou to normy, jen parametry generátoru, proto nejsou v `drafting-standards`.
- „Chybějící pohled“: distraktor z mutace tělesa, který má **oba dané pohledy stejné** jako správná
  součást, se zahazuje: jeho chybějící pohled by byl druhou správnou odpovědí. Nejtěžší distraktory
  (obtížnost 4–5) jsou proto chybné výkresy správné součásti (skrytá hrana plnou čarou, viditelná
  čárkovaně, chybějící hrana) a mutace tělesa, které se shodují aspoň v jednom daném pohledu.
- Distraktory se vybírají tak, aby měly různé kódy chyb, pokud to jde. Id součástí v možnostech jsou
  neutrální (`<id úlohy>/m1`…), aby z nich nešlo poznat správnou odpověď.
