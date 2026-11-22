-- Ukládání výsledků z lekcí a akce v „Můj účet“ tak, jak je volá aplikace (D-029).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create function pg_temp.uid(name text) returns uuid language sql immutable as $$
  select md5('vk-test30-' || name)::uuid
$$;

create function pg_temp.login(name text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(name), 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

grant execute on all functions in schema pg_temp to authenticated;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
select pg_temp.uid(n), n || '@test30.invalid', jsonb_build_object('display_name', 'Jméno ' || n),
       'authenticated', 'authenticated'
  from unnest(array['admin', 'trainer', 'p1', 'p2', 'expired']) as n;

insert into public.organizations (id, name, join_code, seat_limit, license_valid_until) values
  ('00000000-0000-0000-0030-00000000000a', 'Firma 30', 'TTTTTTTA', 10, current_date + 30),
  ('00000000-0000-0000-0030-00000000000c', 'Prošlá 30', 'TTTTTTTC', 10, current_date - 1);

insert into public.memberships (user_id, org_id, role) values
  (pg_temp.uid('admin'), '00000000-0000-0000-0030-00000000000a', 'org_admin'),
  (pg_temp.uid('trainer'), '00000000-0000-0000-0030-00000000000a', 'trainer'),
  (pg_temp.uid('p1'), '00000000-0000-0000-0030-00000000000a', 'participant'),
  (pg_temp.uid('p2'), '00000000-0000-0000-0030-00000000000a', 'participant'),
  (pg_temp.uid('expired'), '00000000-0000-0000-0030-00000000000c', 'participant');

insert into public.groups (id, org_id, name, join_code, created_by) values
  ('00000000-0000-0000-0030-0000000000a1', '00000000-0000-0000-0030-00000000000a', 'Třída 1', 'TTTTTGR1', pg_temp.uid('trainer')),
  ('00000000-0000-0000-0030-0000000000a2', '00000000-0000-0000-0030-00000000000a', 'Třída 2', 'TTTTTGR2', pg_temp.uid('trainer'));

insert into public.group_members (group_id, org_id, user_id, role) values
  ('00000000-0000-0000-0030-0000000000a1', '00000000-0000-0000-0030-00000000000a', pg_temp.uid('p1'), 'participant'),
  ('00000000-0000-0000-0030-0000000000a2', '00000000-0000-0000-0030-00000000000a', pg_temp.uid('p2'), 'participant');

insert into public.assignments (group_id, module_slug, lesson_slug, due_at, created_by) values
  ('00000000-0000-0000-0030-0000000000a1', 'pohledy-a-rezy', 'diry-a-osy', now() + interval '7 days', pg_temp.uid('trainer')),
  ('00000000-0000-0000-0030-0000000000a2', 'pohledy-a-rezy', 'rez-a-srafovani', null, pg_temp.uid('trainer'));

-- ---------------------------------------------------------------------------------------------
-- Průchod lekcí jako v aplikaci: založit průchod, pokusy (i se `focus` a přeskočenou úlohou), uzavřít
-- ---------------------------------------------------------------------------------------------

select pg_temp.login('p1');
create temp table run30 (id uuid);
grant all on run30 to authenticated;
with r as (
  insert into public.lesson_runs (org_id, module_slug, lesson_slug, task_count, engine_version)
  values ('00000000-0000-0000-0030-00000000000a', 'pohledy-a-rezy', 'diry-a-osy', 2, '0.4.0')
  returning id
)
insert into run30 select id from r;
select is((select count(*)::int from run30), 1, 'účastník založí průchod lekcí');

select lives_ok($$
  insert into public.attempts (run_id, org_id, module_slug, lesson_slug, task_index, exercise_type,
    difficulty, seed, engine_version, answer, is_correct, score, error_codes, duration_ms, focus)
  values ((select id from run30), '00000000-0000-0000-0030-00000000000a', 'pohledy-a-rezy',
    'diry-a-osy', 0, 'find-error', 3, 123, '0.4.0', '{"pick":"layout"}', false, 0,
    array['MISSED_ERROR', 'TOP_SIDE_SWAPPED'], 5300, 'TOP_SIDE_SWAPPED')
$$, 'pokus se zapíše i s upřednostněnou chybou (focus)');

select throws_ok($$
  insert into public.attempts (run_id, org_id, module_slug, lesson_slug, task_index, exercise_type,
    difficulty, seed, engine_version, is_correct, score, focus)
  values ((select id from run30), '00000000-0000-0000-0030-00000000000a', 'pohledy-a-rezy',
    'diry-a-osy', 1, 'find-error', 3, 124, '0.4.0', false, 0, 'neplatný kód')
$$, '23514', null, 'focus musí být kód chyby');

select lives_ok($$
  insert into public.attempts (run_id, org_id, module_slug, lesson_slug, task_index, exercise_type,
    difficulty, seed, engine_version, answer, is_correct, score)
  values ((select id from run30), '00000000-0000-0000-0030-00000000000a', 'pohledy-a-rezy',
    'diry-a-osy', 1, 'missing-view', 2, 125, '0.4.0', null, false, 0)
$$, 'přeskočená úloha = pokus bez odpovědi');

select is(public.finish_lesson_run((select id from run30)), 0, 'průchod se uzavře');
select is(
  (select finished_runs from public.lesson_progress where lesson_slug = 'diry-a-osy'), 1,
  'průběh lekce ukazuje dokončený průchod'
);
select is(
  (select focus from public.attempts where task_index = 0 and run_id = (select id from run30)),
  'TOP_SIDE_SWAPPED', 'focus jde přečíst zpět (adaptivita napříč relacemi)'
);

-- ---------------------------------------------------------------------------------------------
-- Přiřazené lekce: účastník vidí jen přiřazení svých skupin
-- ---------------------------------------------------------------------------------------------

select results_eq(
  $$ select a.lesson_slug from public.assignments a join public.groups g on g.id = a.group_id
      where g.org_id = '00000000-0000-0000-0030-00000000000a' $$,
  array['diry-a-osy'], 'účastník vidí přiřazení jen své skupiny'
);

-- ---------------------------------------------------------------------------------------------
-- Prošlá licence: průchod ani pokus nejde zapsat
-- ---------------------------------------------------------------------------------------------

select pg_temp.login('expired');
select throws_ok($$
  insert into public.lesson_runs (org_id, module_slug, lesson_slug, task_count, engine_version)
  values ('00000000-0000-0000-0030-00000000000c', 'pohledy-a-rezy', 'diry-a-osy', 1, '0.4.0')
$$, '42501', null, 'po vypršení licence se průchod nezaloží');
select throws_ok($$
  insert into public.attempts (org_id, module_slug, lesson_slug, exercise_type, difficulty, seed,
    engine_version, is_correct, score)
  values ('00000000-0000-0000-0030-00000000000c', 'pohledy-a-rezy', 'diry-a-osy', 'dimension', 1, 1,
    '0.4.0', true, 1)
$$, '42501', null, 'po vypršení licence se pokus nezapíše');

-- ---------------------------------------------------------------------------------------------
-- Můj účet: jméno, odchod z organizace, poslední správce
-- ---------------------------------------------------------------------------------------------

select pg_temp.login('p2');
update public.profiles set display_name = 'Petra Nová';
select pg_temp.admin();
select is((select display_name from public.profiles where id = pg_temp.uid('p2')), 'Petra Nová',
  'účastník si změní zobrazované jméno');
select is((select display_name from public.profiles where id = pg_temp.uid('p1')), 'Jméno p1',
  'cizí jméno se nezmění');

select pg_temp.login('p2');
delete from public.memberships where org_id = '00000000-0000-0000-0030-00000000000a';
select pg_temp.admin();
select is(
  (select count(*)::int from public.memberships where user_id = pg_temp.uid('p2')), 0,
  'účastník opustí organizaci'
);
select is(
  (select count(*)::int from public.group_members where user_id = pg_temp.uid('p2')), 0,
  'odchodem z organizace zmizí i ze skupin'
);
select is(
  (select count(*)::int from public.memberships where user_id = pg_temp.uid('p1')), 1,
  'ostatní členství zůstanou'
);

select pg_temp.login('admin');
select throws_ok(
  $$ delete from public.memberships where user_id = pg_temp.uid('admin') $$,
  'P0001', 'LAST_ORG_ADMIN', 'poslední správce organizaci neopustí'
);

select * from finish();
rollback;
