-- Poptávky pilotu (D-030): zápis jen přes server, čtení a vyřízení jen správce platformy.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create function pg_temp.uid(name text) returns uuid language sql immutable as $$
  select md5('vk-test40-' || name)::uuid
$$;

create function pg_temp.login(name text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(name), 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.as_role(r text) returns void language plpgsql as $$
begin
  perform set_config('role', r, true);
  perform set_config('request.jwt.claims', '', true);
end $$;

grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
select pg_temp.uid(n), n || '@test40.invalid', jsonb_build_object('display_name', 'Jméno ' || n),
       'authenticated', 'authenticated'
  from unnest(array['staff', 'user']) as n;
insert into public.platform_admins (user_id) values (pg_temp.uid('staff'));

-- Stará poptávka, kterou má retence smazat.
insert into public.pilot_requests (segment, name, organization, email, consent_at, created_at)
values ('school', 'Stará', 'SPŠ Stará', 'stara@test40.invalid', now() - interval '25 months',
        now() - interval '25 months');

-- Anonym ani přihlášený uživatel nesmí volat ukládací funkci ani zapisovat do tabulky.
select pg_temp.as_role('anon');
select throws_ok(
  $$ select public.submit_pilot_request('company', 'Jan Novák', 'Firma s.r.o.', 'jan@test40.invalid') $$,
  '42501', null, 'anonym nemůže uložit poptávku přímo'
);
select throws_ok(
  $$ insert into public.pilot_requests (segment, name, organization, email, consent_at)
     values ('company', 'Jan', 'Firma', 'jan@test40.invalid', now()) $$,
  '42501', null, 'anonym nemůže zapisovat do tabulky'
);
select pg_temp.login('user');
select throws_ok(
  $$ select public.submit_pilot_request('company', 'Jan Novák', 'Firma s.r.o.', 'jan@test40.invalid') $$,
  '42501', null, 'přihlášený uživatel nemůže uložit poptávku přímo'
);

-- Server (service role) ukládá.
select pg_temp.as_role('service_role');
select isnt(
  public.submit_pilot_request('company', ' Jan Novák ', 'Firma s.r.o.', 'Jan@Test40.invalid',
                              '+420 777 123 456', 25, 'Máme 25 operátorů.'),
  null, 'server uloží poptávku'
);

select pg_temp.as_role('postgres');
select results_eq(
  $$ select name, email, headcount from public.pilot_requests where email like '%test40%' and name <> 'Stará' $$,
  $$ values ('Jan Novák'::text, 'jan@test40.invalid'::text, 25) $$,
  'jméno je oříznuté a e-mail malými písmeny'
);
select is(
  (select count(*)::int from public.pilot_requests where name = 'Stará'), 0,
  'poptávka starší než 24 měsíců se při dalším odeslání smaže'
);
select throws_ok(
  $$ select public.submit_pilot_request('company', 'J', 'Firma', 'x@test40.invalid') $$,
  '23514', null, 'příliš krátké jméno odmítne kontrola tabulky'
);
select throws_ok(
  $$ select public.submit_pilot_request('company', 'Jan', 'Firma', 'bez-zavinace') $$,
  '23514', null, 'neplatný e-mail odmítne kontrola tabulky'
);

-- Limit: nejvýš 3 poptávky z jedné adresy za 24 hodin.
select public.submit_pilot_request('school', 'Jan Novák', 'SPŠ', 'jan@test40.invalid');
select public.submit_pilot_request('school', 'Jan Novák', 'SPŠ', 'JAN@test40.invalid');
select throws_ok(
  $$ select public.submit_pilot_request('school', 'Jan Novák', 'SPŠ', 'jan@test40.invalid') $$,
  'P0001', 'RATE_LIMITED', 'čtvrtá poptávka z téže adresy za den se odmítne'
);

-- Běžný uživatel nevidí nic a nic nesmaže ani nevyřídí.
select pg_temp.login('user');
select is_empty(
  $$ select 1 from public.pilot_requests $$,
  'běžný uživatel nevidí žádné poptávky'
);
select throws_ok(
  $$ select public.set_pilot_request_handled(
       (select id from public.pilot_requests limit 1), true) $$,
  '42501', null, 'běžný uživatel nemůže poptávku vyřídit'
);
delete from public.pilot_requests;
select pg_temp.as_role('postgres');
select is(
  (select count(*)::int from public.pilot_requests where email = 'jan@test40.invalid'), 3,
  'běžný uživatel nic nesmazal'
);

-- Správce platformy vidí, vyřizuje a maže.
select pg_temp.login('staff');
select is(
  (select count(*)::int from public.pilot_requests where email = 'jan@test40.invalid'), 3,
  'správce platformy vidí poptávky'
);
select public.set_pilot_request_handled(
  (select id from public.pilot_requests where email = 'jan@test40.invalid' order by created_at limit 1),
  true);
select is(
  (select count(*)::int from public.pilot_requests
    where email = 'jan@test40.invalid' and handled_by = pg_temp.uid('staff')), 1,
  'správce platformy označí poptávku jako vyřízenou'
);
select throws_ok(
  $$ update public.pilot_requests set name = 'Změna' $$,
  '42501', null, 'přímá úprava poptávky není povolená nikomu z klientů'
);
delete from public.pilot_requests where email = 'jan@test40.invalid';
select is(
  (select count(*)::int from public.pilot_requests where email = 'jan@test40.invalid'), 0,
  'správce platformy poptávky smaže'
);

select * from finish();
rollback;
