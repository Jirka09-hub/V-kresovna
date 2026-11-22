# Ke kontrole učitelem před pilotem

Jiří svěřil odborná rozhodnutí Claudovi (D-017). Co nebylo jednoznačné, rozhodli jsme podle běžné
školní praxe. Tady je všechno na jednom místě, aby to učitel technického kreslení mohl projít
najednou. U každého bodu stačí odpovědět „ano, tak to učíme“, nebo napsat, jak to má být.

Nejrychlejší kontrola: projít laboratoř enginu (`/cs/laborator`, přepínače „Kóty“ a „Řez“), lekce
1–9 (`/cs/lekce`) a jednou si udělat závěrečný test. Odkaz v závorce vede na zápis v
`docs/decisions.md`, kde je zdůvodnění.

## Pohledy a čáry (D-017)

1. Slepá díra je vrtaná: dno je kužel s vrcholovým úhlem 120°. Hloubka díry v zadání je hloubka
   válcové části, kužel je navíc. Ve výkresu jsou dvě šikmé skryté čáry do vrcholu a osa díry sahá až
   za vrchol.
2. Osa souměrnosti se kreslí, jen když je součást souměrná podle střední roviny a aspoň jeden prvek
   leží uvnitř (nedotýká se obou konců). Holý kvádr ani prvek přes celou délku osu nemá.
3. Tloušťky čar: skupina 0,5 (tlustá 0,5 mm, tenká 0,25 mm).
4. Čárkování: skrytá hrana čárka 12× a mezera 3× tloušťky čáry; osa čerchovaná 24 / 3 / 0,5 / 3.
   Osy přesahují obrys o 3 mm.
5. Když se čáry kryjí, má přednost viditelná hrana, pak skrytá, pak stopa řezu, nakonec osa.

## Řez (D-021)

6. Šrafy: rozteč 2,5 mm (výkres 1 : 1), úhel 45° stoupající doprava, všechny plochy jedné součásti
   stejným směrem.
7. Stopa roviny řezu: přesahuje obrys o 5 mm, tlusté konce dlouhé 6 mm (1 mm zasahuje do obrysu),
   mezi nimi tenká čerchovaná čára přes celý pohled.
8. Šipky u stopy: na vnějším konci, kolmo na stopu, míří ve směru pohledu (ke zbylé části), délka
   8 mm, plný hrot 3 mm. Písmeno vysoké 5 mm stojí vedle šipky z vnější strany.
9. Nápis „A–A“ (5 mm) uprostřed nad řezem, 4 mm nad ním. Písmena I, O a Q se nepoužívají.
10. V řezu se nekreslí skryté hrany.
11. Žebro řezané podélně se nešrafuje, jen ohraničí. Ve 3D modelu je jeho plocha řezu šrafovaná
    (ukazuje skutečný materiál).
12. Osa díry se v řezu kreslí, pokud z díry po řezu něco zbylo, a to i tehdy, když díra celá leží
    za rovinou řezu (je tedy skrytá). Je to tak správně, nebo se osa skryté díry v řezu vynechává?
13. Stopa roviny řezu se kreslí v nárysu (rovina kolmá na osu X nebo Z), nebo v půdorysu (rovina
    kolmá na Y, řez pak nahradí nárys).

## Kóty (D-022)

14. Písmo kót 3,5 mm, text 1 mm nad kótovací čarou, svislé kóty se čtou zprava.
15. Pomocná čára začíná přímo na obrysu (bez mezery) a přesahuje kótovací čáru o 2 mm.
16. První kótovací čára 10 mm od obrysu, další vždy o 8 mm dál.
17. Šipky plné, délka 3 mm, rozevření 20°. U kóty kratší než 7 mm jsou šipky zvenku.
18. Text, který se mezi pomocné čáry nevejde, je za koncem kóty.
19. Celá čísla bez desetinné části, jinak desetinná čárka. Před průměrem „⌀“, zkosení „8×45°“.
20. Hloubka slepé díry se kótuje ke skrytým (čárkovaným) čarám, protože kóty jsou zatím jen u výkresů
    bez řezu.
21. Díry stejného průměru se kótují každá zvlášť (zatím ne „2× ⌀8“).
22. Každý rozměr je na výkrese jednou a kóty netvoří uzavřený řetězec. Prvek u stěny se kótuje od
    ní, prvek uvnitř velikostí a polohou od levé, přední nebo spodní stěny. Poloha prvku na ose
    souměrnosti se nekótuje.
23. Kóta je v pohledu, kde je vidět skutečný tvar prvku; při shodě nárys, pak půdorys, pak bokorys.

## Cvičení „Najdi chybu ve výkresu“ (D-023)

24. „Čára navíc“ vzniká zrcadlením hrany prvku na druhou stranu pohledu. Působí to jako chyba, kterou
    žák opravdu udělá?
25. U chyby v rozmístění pohledů uznáváme tlačítko „Rozmístění pohledů je špatně“ i klik do
    půdorysu nebo bokorysu. Je to tak v pořádku?
26. Tolerance kliknutí: 6 mm u nejlehčí úlohy, 3 mm u nejtěžší (v mm výkresu).

## Cvičení „Řez“ a „Odečti kótu“ (D-024)

27. Chybné možnosti u „Vyber řez A–A“: šrafy přes díru, bez šraf, řez jiným místem, skryté hrany v
    řezu, pohled z opačné strany (zrcadlově) a pozměněná součást. Odpovídají chybám, které žáci
    dělají? Chybí nějaká častá chyba?
28. „Umísti rovinu řezu“: uznáváme každou polohu, kde řez vypadá stejně, a navíc odchylku 3 mm
    (nejlehčí) až 1 mm (nejtěžší). Není to moc přísné nebo moc volné?
29. Otázky ke kótám jsou psané slovy, např. „Jak daleko je osa díry od přední stěny součásti?“ nebo
    „Kolik materiálu zbývá mezi drážkou a zadní stěnou součásti?“. Jsou srozumitelné a používají
    slova, která žáci znají?
30. Od obtížnosti 4 se část otázek ptá na rozměr, který na výkrese není a musí se spočítat ze dvou
    (u nejtěžší i tří) kót. Je to pro žáky SPŠ / SOU přiměřené?
31. Vysvětlení chyb (texty ve výsledku úlohy) jsou psané vlastními slovy, ne citací normy. Prosíme o
    kontrolu, že jsou věcně správně.

## Lekce a závěrečný test (D-024)

32. Lekce 7 „Řez a šrafování“ a 8 „Kóty: čtení rozměrů“ mají krátký výklad (dvě obrazovky) a pak
    úlohy. Je výklad věcně správný a stačí k tomu, aby žák úlohy zvládl?
33. Závěrečný test: 12 úloh ze všech šesti typů, obtížnost 2–4, během testu bez nápovědy a bez
    vyhodnocení, splněno od 75 % správných. Je délka, obtížnost a hranice rozumná?
