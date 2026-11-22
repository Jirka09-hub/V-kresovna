-- Fáze 4: ukládání výsledků z lekcí (D-029).
--
-- Úloha je určená čtveřicí (typ, seed, obtížnost, focus) a verzí enginu (D-023). `focus` je
-- upřednostněný druh chyby u adaptivních úloh „najdi chybu“: bez něj by úlohu nešlo zpětně
-- vygenerovat stejně. Ukládá se proto u pokusu (null = bez upřednostnění).

alter table public.attempts
  add column focus text check (focus ~ '^[A-Z_]{1,40}$');

comment on column public.attempts.focus is
  'Upřednostněný druh chyby (vstup generátoru úlohy jako seed, D-023); null = žádný.';
