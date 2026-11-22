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

## D-020 Webové UI cvičení (fáze 2)

- Stav: přijato (2026-11-21)
- Engine i exercises běží jen ve web workeru (`apps/web/workers/engine.worker.ts`): sestavení součásti,
  generování úlohy, pohledy s mutací, výkres možnosti (`buildOptionDrawing`) i hodnocení (`evaluate`).
  Hlavní bundle importuje z těchto balíčků jen typy, WASM v něm není (D-016). Výsledky se cachují
  ve workeru (síť a hrany) i v klientovi (odpovědi podle volání).
- „Výkres → model“: čtyři modely na jednom plátně (`PartGallery`, drei `View`), `frameloop="demand"`,
  společné natočení i měřítko. Slabé školní počítače tak drží jeden WebGL kontext místo čtyř a modely jde
  snadno porovnat. Bez WebGL jde úlohu jen přeskočit.
- Přiřazování pohledů: `@dnd-kit/core` pro myš a dotyk, plnohodnotná náhrada klávesnicí (vybrat kartu,
  pak místo; Enter nebo mezerník). Zpětná vazba nikdy jen barvou: ikona, text a vysvětlení podle kódu chyby.
- Průběh lekcí a dema se zatím drží jen v paměti (bez přihlášení); ukládání přijde s účty.
- ESLint `i18next/no-literal-string` ignoruje volání `t`, `ta`, `tm`… (překladače z `useTranslations`
  pro různé jmenné prostory).
- Pozn. k testům: Playwright snímek celé stránky může u plátna v režimu „na vyžádání“ ukázat starší snímek;
  snímek samotného prvku je aktuální. Testy proto ověřují stav přes atributy (`data-rotation`), ne pixely.

## D-021 Plný řez: výpočet, kreslení a interaktivní řez ve 3D

- Stav: přijato (2026-11-21). Odborné volby rozhodnuté podle běžné školní praxe (D-017);
  **před pilotem je má zkontrolovat učitel** (seznam níže).
- Výpočet: řez rovinou kolmou na hlavní osu počítá engine v čistém TypeScriptu nad sítí trojúhelníků
  (`packages/engine/src/section/`): trojúhelníky před rovinou se zahodí, protnuté se oříznou, hranice
  oříznuté sítě dá obrysy plochy řezu (díry v ploše zůstanou dírami) a plocha se uzavře triangulací
  (ořezávání uší s mosty k dírám). Zbytek součásti je opět uzavřené těleso, takže viditelnost hran za
  rovinou počítá stávající `projectView`. Manifold (`trimByPlane`, `slice`) jsme nepoužili, protože
  `createDrawing` dostává jen síť a stejný kód teď běží i v hlavním vlákně ve 3D prohlížeči při tažení
  roviny (podmodul `@vykresovna/engine/section` je bez WASM, D-016). Rovina přesně ve stěně součásti
  se posune o 0,0001 mm do zachované části.
- Výkres: `createDrawing(spec, mesh, { section: { spec: { axis, at, label }, view } })`. Pohled `view`
  se nahradí řezem (obdélník pohledu zůstává jako u celé součásti, takže pohledy zůstanou zarovnané),
  stopa roviny řezu se kreslí v prvním vhodném pohledu (nárys, pak půdorys; jde zadat nebo vypnout).
  Osy děr, které řez celé odebral, se v řezu nekreslí. Popisy se vejdou na výkres posunem všech pohledů.
  Výkres bez řezu je beze změny (snapshoty se nezměnily).
- Šrafy jsou přesné úsečky (ne vzor SVG), ukotvené k souřadnicím pohledu, takže všechny plochy jedné
  součásti mají stejný směr i rozteč. Plochy řezu mají třídu `sectionFace` (v UI lze podbarvit přes
  `--drawing-section-fill`).
- 3D: těleso se ořízne ořezávací rovinou three.js, hrany se oříznou na CPU, plocha řezu je přesný
  mnohoúhelník z enginu se šrafami ve stejném směru jako na výkrese (místo stencil bufferu: jednodušší,
  přesné a 3D i 2D vždy souhlasí). Rovina se posouvá tažením úchytu nebo posuvníkem; výkres A–A
  se v laboratoři přepočítá 250 ms po posledním posunu.
- Poloviční řez: jen typy (`HalfSectionSpec`), implementace později.
- Ke kontrole učitelem před pilotem:
  1. Rozteč šraf 2,5 mm (u výkresů 1 : 1), úhel 45° stoupající doprava.
  2. Stopa roviny řezu: přesah 5 mm za obrys, tlusté konce 6 mm (1 mm zasahují do obrysu), mezi nimi
     čerchovaná tenká čára přes celý pohled.
  3. Šipky: začínají na vnějším konci stopy, kolmo na ni, míří ve směru pohledu (ke zbylé části),
     délka 8 mm, plný hrot 3 mm se štíhlostí 15°. Písmeno (výška 5 mm) stojí vedle šipky na vnější straně.
  4. Nápis „A–A“ (výška 5 mm) vycentrovaný nad pohledem v řezu, 4 mm nad ním; písmena I, O a Q se
     nepoužívají.
  5. V řezu se nekreslí skryté hrany.
  6. Žebro řezané podélně se nešrafuje, jen ohraničí (i na styku se zbytkem součásti); ve 3D je plocha
     řezu žebra šrafovaná (ukazuje skutečný materiál).
  7. Osa díry se v řezu kreslí, pokud z díry po řezu něco zbylo.

## D-022 Kótování výkresů

- Stav: přijato (2026-11-21), odborné volby podle běžné školní praxe (D-017), **ke kontrole učitelem**.
- Kóty se odvozují z popisu součásti (`PartSpec`), ne ze sítě: `partDimensions(spec)` v
  `packages/engine/src/dimensions/semantic.ts`. Pro každou osu se kandidáti berou v pořadí celkový rozměr →
  tloušťka základní desky (když ji žebra přesahují) → velikosti prvků (a hloubka slepé díry) → polohy prvků
  a kóta se přijme, jen když spojuje dosud neurčené souřadnice (union-find). Tak je každý rozměr na výkrese
  jednou a nevzniká uzavřený řetězec kót. Průměry děr a zkosení se přidají vždy.
- Prvek, který se dotýká stěny, se kótuje od ní (velikost výřezu, osazení, hloubka drážky); prvek uvnitř
  velikostí a polohou od základny (levá, přední, spodní stěna). Poloha prvku ležícího na nakreslené ose
  souměrnosti se nekótuje. Díra: ⌀ u kružnice (šikmá kótovací čára přes střed, text na prodloužení vně
  kružnice), poloha středu od základny, u slepé díry hloubka válcové části bez kuželového dna.
- Zkosení 45° se kótuje zkráceně „8×45°“ na odvěsně v pohledu podél zkosené hrany.
- Volba pohledu: skutečný tvar prvku (+4), viditelná hrana na každém konci kóty (+2), skrytá (+1); při shodě
  nárys > půdorys > bokorys. Kóta, kterou nejde ukázat v žádném kresleném pohledu, se vynechá.
- Rozmístění: kóty vně obrysu na straně bližší prvku (při shodě vně sestavy pohledů), kratší blíž k obrysu,
  každá v nejbližší řadě, kde nepřekryje cizí text a kótovací čára nekříží cizí pomocnou čáru. Pomocné čáry
  se navzájem křížit smějí (osazení v rohu). Pomocná čára k hraně uvnitř pohledu (např. dno drážky) vede
  přes pohled; obrys, který pokračuje ve směru pomocné čáry, ji „posune“ až na svůj konec. Výkres se zvětší
  o místo pro kóty (okraje po sloupcích a řádcích mřížky), `VIEW_GAP_MM` zůstává 16 mm.
- Výkres bez `dimensions: true` je bajtově stejný jako dřív (pole `dimensions` v pohledu chybí).
- Konstanty v `packages/drafting-standards/src/dimensions.ts`; **ke kontrole učitelem**:
  - výška písma 3,5 mm, text 1 mm nad kótovací čarou, svislé kóty otočené o −90° (čtou se zprava),
  - pomocná čára začíná přímo na obrysu (mezera 0 mm) a přesahuje kótovací čáru o 2 mm,
  - první kótovací čára 10 mm od obrysu, další po 8 mm,
  - šipka plná, délka 3 mm, rozevření 20° (šířka asi 1 mm); šipky zvenku, když je kóta kratší než 7 mm,
  - text, který se mezi pomocné čáry nevejde, jde za konec kóty (kótovací čára se pod ním prodlouží),
  - celá čísla bez desetinné části, jinak desetinná čárka; „⌀“ před průměrem; zkosení „8×45°“,
  - hloubka slepé díry se kótuje k čárkovaným (skrytým) čarám, protože bez řezu jinak nejde
    (v řezu by se kótovala lépe; až bude řez, přesunout),
  - díry stejného průměru se kótují každá zvlášť (zatím ne „2× ⌀8“).
- Písmo kót ve SVG: DejaVu Sans / Liberation Sans / Arial (bezpatkové; šířka textu se odhaduje bez DOM
  podle nejširšího z nich), velikost tak, aby výška číslic byla 3,5 mm.

## D-023 Cvičení „Najdi chybu ve výkresu“ a jednoduchá adaptivita

- Stav: přijato (2026-11-21), odborné volby na seznam ke kontrole učitelem před pilotem (D-017)
- Chyba je vždy mutace **výkresu**, ne tělesa, a ve výkresu (nárys, půdorys, bokorys) je právě jedna:
  chybějící hrana, čára navíc, skrytá hrana plnou čarou, viditelná čárkovaně, americké rozmístění,
  prohozený půdorys a bokorys. Kód: `packages/exercises/src/find-error.ts`.
- „Chybějící hrana“ se volí jen tam, kde na jejím místě nezůstane jiná čára (jinak by z plné čáry byla
  čárkovaná a vypadalo by to jako záměna viditelnosti).
- „Čára navíc“ = rovná hrana prvku zrcadlená na druhou stranu pohledu (jako by prvek byl i tam). Nesmí
  se krýt s žádnou čárou ani osou a nesmí ležet blíž než 2 mm k rovnoběžné čáře. Id čáry `extra:<pohled>`.
- U hrany se dvěma přímkami se stejným id (dva obrysy díry `sil:cyl:<díra>`) jde změnit i jen jednu:
  `DrawingMutation.onLine` (aditivní pole). Obtížnost 5 tak umí „jedna skrytá čára díry plnou čarou“.
- Viditelnost chyby hlídá otisk **včetně rozmístění** (`placedDrawingFingerprint`: pořadí sloupce a řádku
  každého pohledu + `viewFingerprint`). Samotné `drawingFingerprint` na polohu pohledů nehledí, takže by
  chyby rozmístění nepoznalo. Rozmístění počítá `placeViews` stejným postupem jako `createDrawing`
  (test hlídá, že pro evropské rozmístění dá totéž co engine).
- Správná odpověď: klik do tolerance od čáry chyby (6 mm u obtížnosti 1, 3 mm u 5; mm výkresu),
  oblast 3 × 3 pohledu (klávesnice), která čáru protne, u chyb rozmístění tlačítko „Rozmístění pohledů je
  špatně“ nebo klik do půdorysu či bokorysu. Minutí vrací kód skutečné chyby a `MISSED_ERROR`.
- Výběr z klávesnice místo „virtuálního kurzoru“: každý pohled je skupina devíti tlačítek (šipky, Enter),
  stejná tlačítka zachytí i klik myší, který se pak bere jako přesný bod. Neprozrazuje, kde chyba je.
- Adaptivita (`packages/exercises/src/adaptivity.ts`, čisté funkce, subpath `@vykresovna/exercises/adaptivity`
  bez enginu, smí do hlavního bundlu): váhy kódů chyb s poločasem 4 pokusy (nebo v ms, když jsou časy),
  správná odpověď na úlohu zaměřenou na chybu váhu sníží. Typ cvičení se losuje ze seedu s vahou podle chyb,
  které se v něm procvičují; u „najdi chybu“ se nejčastější chyba předá generátoru jako `focus` (ten ji zkusí
  první). Obtížnost: 3 správně v řadě nahoru, 2 chyby v řadě dolů, vždy jen o 1, v rozsahu lekce.
- `focus` je vstup generátoru jako seed: úloha = (typ, seed, obtížnost, focus). Ukládá se s výsledkem
  (`TaskMeta.focus`, `FixedTask.focus`).
- Lekce mají na konci adaptivní úlohy (`Lesson.adaptive`): lekce 1–5 jednu, lekce 6 dvě. Vybírají se až ve
  chvíli, kdy na ně přijde řada, z historie relace v paměti (`apps/web/lib/session-history.ts`, nic se
  neukládá). Uživatel vidí jen poznámku „Úloha vybraná podle vašich chyb“.
- Demo zůstává na 5 úlohách: „najdi chybu“ (seed 4409, obtížnost 2) nahradila druhé přiřazování pohledů,
  takže demo ukazuje všechny čtyři typy cvičení.
- Ke kontrole učitelem: zda „čára navíc“ zrcadlením působí jako věrohodná chyba žáka, a zda je u chyby
  rozmístění správně i klik do pohledu (ne jen tlačítko).

## D-024 Cvičení „Řez“ a „Odečti kótu“, lekce 7–8 a závěrečný test (fáze 3)

- Stav: přijato (2026-11-22), odborné a didaktické volby na seznam ke kontrole učitelem
  (`docs/kontrola-ucitelem.md`).
- Kontrakt je jen rozšířený: `EXERCISE_KINDS` má na konci `section` a `dimension`, nové typy úloh
  (`SectionTask` = `SectionChooseTask | SectionPlaceTask`, `DimensionTask`), odpovědi (`SectionAnswer`
  s `optionId` nebo `at`, `DimensionAnswer` s `value`) a kódy chyb `SECTION_HOLE_HATCHED`,
  `SECTION_NOT_HATCHED`, `WRONG_SECTION_PLANE`, `SECTION_HIDDEN_EDGES`, `SECTION_WRONG_DIRECTION`,
  `DIMENSION_WRONG_FEATURE`, `DIMENSION_NOT_COMBINED`, `DIMENSION_ARITHMETIC`, `DIMENSION_WRONG`.
  Worker umí navíc `render-section`. Starší úlohy dávají pro stejný seed stejné zadání.
- **Řez, varianta „vyber řez A–A“** (60 % úloh): dané pohledy se stopou roviny (`CUTTING_PLANE_VIEW`:
  rovina kolmá na X nebo Z se zakreslí v nárysu, kolmá na Y v půdorysu), místo řezu je prázdné, čtyři
  možnosti. Rovina vede osou díry nebo napříč průchozí drážkou v polovině její délky; nejčastěji je
  kolmá na Y, tedy řez nahradí nárys (váhy rovin kolmých na Y / X / Z jsou 3 / 2 / 1, u drážky poloviční).
  Chybné možnosti: šrafy přes díru (součást bez prvku), bez šraf, jiná rovina, skryté hrany v řezu,
  pohled z opačné strany (zrcadlově), pozměněná součást. Lehčí obtížnosti dávají přednost zjevným
  chybám (šrafy), těžší jemnějším (směr pohledu, skryté hrany). Každá možnost má jiný otisk pohledu
  **i bez os** (dvě možnosti lišící se jen osou díry by byly prakticky stejné).
- Otisk pohledu v řezu zahrnuje plochy řezu (obrysy bez vrcholů ležících na přímce mezi sousedy),
  nešrafované plochy, šrafy a stopu roviny; pohled bez řezu má otisk stejný jako dřív.
- **Řez, varianta „umísti rovinu“** (40 %): vlevo řez A–A, vpravo 3D model s rovinou, kterou žák posouvá
  tažením úchytu, posuvníkem nebo šipkami (krok 0,5 mm). Správně je každá poloha, kde řez vypadá stejně
  (úseky mezi stěnami prvků, osy stejných děr), plus tolerance podle obtížnosti 3 / 2,5 / 2 / 1,5 / 1 mm,
  nejvýš 60 % vzdálenosti k nejbližšímu místu, kde se řez mění. Rovina, u které by tolerance vyšla pod
  1 mm, se pro tuto variantu nepoužije. Výchozí poloha je vždy mimo toleranci. Po chybě se ukáže řez
  v rovině žáka a tlačítko „Ukázat správnou rovinu“.
- **Odečti kótu**: výkres s kótami (nárys, půdorys, bokorys), otázka slovy („Jak daleko je osa díry od
  přední stěny?“), prvek zvýrazněný ve 3D, odpověď celé číslo v mm, tolerance 0. Obtížnost 1 se ptá hlavně
  na celkové rozměry a velikosti prvků, 2–3 i na polohy, hloubky a zkosení. Od obtížnosti 4 je část otázek
  složená (60 %, u 5 85 %): hodnota na výkrese není a spočítá se ze dvou kót (zbývající stěna za drážkou,
  vzdálenost díry od protější stěny; u 5 i poloha prvku od protější stěny ze tří kót). Výsledek složené
  otázky nesmí být číslo, které na výkrese je.
- Hodnocení kót: u složené otázky jedna z potřebných kót → `DIMENSION_NOT_COMBINED`, jiné číslo
  z výkresu → `DIMENSION_WRONG_FEATURE`, jinak `DIMENSION_ARITHMETIC`; u přímé otázky jiné číslo
  z výkresu → `DIMENSION_WRONG_FEATURE`, jinak `DIMENSION_WRONG`. Po odpovědi se zvýrazní kóty, ze
  kterých odpověď plyne.
- Lekce 7 „Řez a šrafování“ (2 živé obrazovky: rovina řezu a šrafy, úlohy obtížnosti 1–3 + 1 adaptivní),
  lekce 8 „Kóty: čtení rozměrů“ (2 obrazovky: odkud kam kóta měří, jak dopočítat; obtížnost 1–4 +
  1 adaptivní z kót nebo řezu).
- **Závěrečný test** (lekce 9): 12 pevných úloh ze všech šesti typů, obtížnost 2–4, dva stejné typy nejdou
  po sobě. Seedy úloh plynou z jednoho náhodného seedu testu (`finalTestTasks`), takže stejný seed = stejný
  test. Během testu se nic nehodnotí nahlas: po odpovědi rovnou další úloha, postup ukazuje jen
  „odpovězeno“. Na konci skóre, splněno / nesplněno (hranice `FINAL_TEST_PASS_THRESHOLD` = 75 %),
  rozpis podle typů a vysvětlení každé chyby. Nic se neukládá, certifikát je jen poznámka (přijde s účty).
- **Demo**: zůstává na 5 úlohách, výběr řezu A–A (seed 5549, obtížnost 2) nahradil druhý „chybějící
  pohled“. Řez s 3D modelem ukazuje to, čím se produkt liší, a demo tak má pět různých typů.
- SVG výkresu má třídu `vk-drawing` a všechna pravidla jeho `<style>` jsou omezená na ni (`scopeCss`),
  takže víc výkresů na stránce si styly nepřebíjí. Obejití přes inline styly (legenda, překryv „najdi
  chybu“, zásahová čára) jsou pryč. Kresba se nezměnila, snapshoty laboratoře jsou stejné.
- `ENGINE_VERSION` 0.4.0 (nové typy úloh, jiný otisk pohledu v řezu, jiné SVG).
- E2E testy volí seedy úloh přes `fixSeeds` (podvrhne `crypto.getRandomValues` pro jedno 32bitové číslo)
  a odpovídají podle testovacích atributů `data-test-*` (správná možnost, poloha roviny, hodnota kóty).

## D-025 Možnosti v úlohách se musí lišit viditelně

- Stav: přijato (2026-11-22)
- Zjištění: kontrola odlišnosti s přesností 0,001 mm propustila možnosti, které na obrazovce vypadají
  stejně (průchozí a slepá díra lišící se jen délkou osy, řez se skrytými hranami kratšími než milimetr,
  prvek zvětšený o zlomek milimetru). U úloh „chybějící pohled“ a „řez“ to bylo 15–30 % úloh u obtížností 2–4.
- Rozhodnutí: distraktory, karty pohledů a chyby ve výkresu se porovnávají vizuálním otiskem
  `visualFingerprint` (engine): bez os a se zaokrouhlením na `VISUAL_DIFFERENCE_MM` = 0,5 mm.
  Test `packages/exercises/test/visual-distinct.test.ts` to hlídá pro všechny typy výběru a obtížnosti.
- Důsledek: pro stejný seed mohou vzniknout jiné distraktory než dřív (nic se zatím neukládá).
