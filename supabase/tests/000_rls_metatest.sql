-- Metatest: každá tabulka ve schématu public musí mít zapnuté RLS
-- a žádná politika nesmí bezpodmínečně povolovat všechno (using (true)).
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and not c.relrowsecurity $$,
  'všechny tabulky v public mají zapnuté RLS'
);

select is_empty(
  $$ select tablename || '.' || policyname
       from pg_policies
      where schemaname = 'public'
        and (qual = 'true' or with_check = 'true') $$,
  'žádná politika v public nepovoluje všechno bez podmínky'
);

select * from finish();
rollback;
