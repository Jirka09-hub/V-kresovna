-- Izolace organizací a rolí (docs/plan.md 6.4, D-026).
-- Dvě organizace A a B; v každé správce, školitelé a účastníci; agenturní pracovník je členem obou.
begin;
create extension if not exists pgtap with schema extensions;
select plan(68);

-- ---------------------------------------------------------------------------------------------
-- Pomocníci
-- ---------------------------------------------------------------------------------------------

create function pg_temp.uid(name text) returns uuid language sql immutable as $$
  select md5('vk-test-' || name)::uuid
$$;

create function pg_temp.mkuser(name text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values (pg_temp.uid(name), name || '@test.invalid',
          jsonb_build_object('display_name', 'Jméno ' || name), 'authenticated', 'authenticated')
$$;

-- přepnutí na přihlášeného uživatele (do konce transakce nebo do dalšího volání)
create function pg_temp.login(name text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(name), 'role', 'authenticated')::text, true);
end $$;

create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;

create function pg_temp.admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

-- ---------------------------------------------------------------------------------------------
-- Data
-- ---------------------------------------------------------------------------------------------

select pg_temp.mkuser(n) from unnest(array[
  'a_admin', 'a_trainer1', 'a_trainer2', 'a_p1', 'a_p2',
  'b_admin', 'b_trainer', 'b_p1', 'agent', 'outsider', 'platform'
]) as n;

insert into public.platform_admins (user_id) values (pg_temp.uid('platform'));

insert into public.organizations (id, name, kind, join_code, seat_limit, license_valid_until) values
  ('00000000-0000-0000-0000-00000000000a', 'Firma A', 'company', 'AAAAAAAA', 4, current_date + 30),
  ('00000000-0000-0000-0000-00000000000b', 'Škola B', 'school', 'BBBBBBBB', 10, current_date + 30),
  ('00000000-0000-0000-0000-00000000000c', 'Prošlá C', 'company', 'CCCCCCCC', 10, current_date - 1);

insert into public.memberships (user_id, org_id, role) values
  (pg_temp.uid('a_admin'), '00000000-0000-0000-0000-00000000000a', 'org_admin'),
  (pg_temp.uid('a_trainer1'), '00000000-0000-0000-0000-00000000000a', 'trainer'),
  (pg_temp.uid('a_trainer2'), '00000000-0000-0000-0000-00000000000a', 'trainer'),
  (pg_temp.uid('a_p1'), '00000000-0000-0000-0000-00000000000a', 'participant'),
  (pg_temp.uid('a_p2'), '00000000-0000-0000-0000-00000000000a', 'participant'),
  (pg_temp.uid('agent'), '00000000-0000-0000-0000-00000000000a', 'participant'),
  (pg_temp.uid('b_admin'), '00000000-0000-0000-0000-00000000000b', 'org_admin'),
  (pg_temp.uid('b_trainer'), '00000000-0000-0000-0000-00000000000b', 'trainer'),
  (pg_temp.uid('b_p1'), '00000000-0000-0000-0000-00000000000b', 'participant'),
  (pg_temp.uid('agent'), '00000000-0000-0000-0000-00000000000b', 'participant');

insert into public.groups (id, org_id, name, join_code, created_by) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'A1', 'GRPAAAA1', pg_temp.uid('a_trainer1')),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 'A2', 'GRPAAAA2', pg_temp.uid('a_trainer2')),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'B1', 'GRPBBBB1', pg_temp.uid('b_trainer'));

insert into public.group_members (group_id, org_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', pg_temp.uid('a_p1'), 'participant'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', pg_temp.uid('agent'), 'participant'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', pg_temp.uid('a_p2'), 'participant'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', pg_temp.uid('b_p1'), 'participant'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', pg_temp.uid('agent'), 'participant');

-- průchody a pokusy (po jednom pokusu na průchod)
insert into public.lesson_runs (id, user_id, org_id, module_slug, lesson_slug, task_count, engine_version) values
  ('00000000-0000-0000-0001-000000000001', pg_temp.uid('a_p1'), '00000000-0000-0000-0000-00000000000a', 'pohledy-a-rezy', 'koty', 1, '0.4.0'),
  ('00000000-0000-0000-0001-000000000002', pg_temp.uid('agent'), '00000000-0000-0000-0000-00000000000a', 'pohledy-a-rezy', 'koty', 1, '0.4.0'),
  ('00000000-0000-0000-0001-000000000003', pg_temp.uid('agent'), '00000000-0000-0000-0000-00000000000b', 'pohledy-a-rezy', 'koty', 1, '0.4.0'),
  ('00000000-0000-0000-0001-000000000004', pg_temp.uid('a_p2'), '00000000-0000-0000-0000-00000000000a', 'pohledy-a-rezy', 'koty', 1, '0.4.0'),
  ('00000000-0000-0000-0001-000000000005', pg_temp.uid('b_p1'), '00000000-0000-0000-0000-00000000000b', 'pohledy-a-rezy', 'koty', 1, '0.4.0');

insert into public.attempts (run_id, user_id, org_id, module_slug, lesson_slug, task_index, exercise_type, difficulty, seed, engine_version, is_correct, score)
select r.id, r.user_id, r.org_id, r.module_slug, r.lesson_slug, 0, 'dimension', 2, 42, '0.4.0', true, 1
  from public.lesson_runs r;

-- ---------------------------------------------------------------------------------------------
-- Anonym
-- ---------------------------------------------------------------------------------------------

select pg_temp.anon();
select throws_ok($$ select * from public.organizations $$, '42501', null, 'anonym nečte organizace');
select throws_ok($$ select * from public.attempts $$, '42501', null, 'anonym nečte pokusy');
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anonym nečte profily');
select throws_ok($$ select * from public.lesson_progress $$, '42501', null, 'anonym nečte průběh lekcí');
select is((select status from public.join_code_preview('grpa-aaa1')), 'ok', 'anonym vidí náhled kódu skupiny (normalizace kódu)');
select is((select group_name from public.join_code_preview('GRPAAAA1')), 'A1', 'náhled kódu ukáže skupinu');
select is((select status from public.join_code_preview('NEEXISTUJE')), 'invalid', 'neplatný kód');
select is((select status from public.join_code_preview('CCCCCCCC')), 'license_expired', 'prošlá licence v náhledu');
select throws_ok($$ select public.join_organization('AAAAAAAA') $$, '42501', null, 'anonym nemůže volat připojení');

-- ---------------------------------------------------------------------------------------------
-- Účastník
-- ---------------------------------------------------------------------------------------------

select pg_temp.login('a_p1');
select results_eq($$ select name from public.organizations $$, array['Firma A'], 'účastník vidí jen svou organizaci');
select is((select count(*)::int from public.attempts), 1, 'účastník vidí jen své pokusy');
select is((select count(*)::int from public.profiles), 1, 'účastník vidí jen svůj profil');
select is((select count(*)::int from public.memberships), 1, 'účastník vidí jen své členství');
select is((select count(*)::int from public.groups), 1, 'účastník vidí jen svou skupinu');
select is((select count(*)::int from public.group_members), 1, 'účastník vidí jen své zařazení');
select throws_ok(
  $$ insert into public.attempts (org_id, module_slug, lesson_slug, exercise_type, difficulty, seed, engine_version, is_correct, score)
     values ('00000000-0000-0000-0000-00000000000b', 'pohledy-a-rezy', 'koty', 'dimension', 1, 1, '0.4.0', true, 1) $$,
  '42501', null, 'účastník nezapíše pokus do cizí organizace');
select throws_ok(
  $$ insert into public.attempts (user_id, org_id, module_slug, lesson_slug, exercise_type, difficulty, seed, engine_version, is_correct, score)
     values (md5('vk-test-a_p2')::uuid, '00000000-0000-0000-0000-00000000000a', 'pohledy-a-rezy', 'koty', 'dimension', 1, 1, '0.4.0', true, 1) $$,
  '42501', null, 'účastník nezapíše pokus za jiného');
select throws_ok(
  $$ insert into public.attempts (run_id, org_id, module_slug, lesson_slug, task_index, exercise_type, difficulty, seed, engine_version, is_correct, score)
     values ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-00000000000a', 'pohledy-a-rezy', 'koty', 0, 'dimension', 1, 1, '0.4.0', true, 1) $$,
  '42501', null, 'účastník nezapíše pokus do cizího průchodu');
select lives_ok(
  $$ insert into public.lesson_runs (id, org_id, module_slug, lesson_slug, task_count, engine_version)
     values ('00000000-0000-0000-0001-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'pohledy-a-rezy', 'zaverecny-test', 4, '0.4.0') $$,
  'účastník založí vlastní průchod');
select throws_ok(
  $$ insert into public.lesson_runs (org_id, module_slug, lesson_slug, task_count, engine_version, finished_at, correct_count)
     values ('00000000-0000-0000-0000-00000000000a', 'pohledy-a-rezy', 'zaverecny-test', 1, '0.4.0', now(), 1) $$,
  '42501', null, 'průchod nejde založit rovnou jako dokončený');
select throws_ok($$ update public.lesson_runs set correct_count = 4 $$, '42501', null, 'průchod nejde upravit přímo');
select throws_ok($$ delete from public.attempts $$, '42501', null, 'pokusy nejde mazat');
update public.memberships set role = 'org_admin';
select is((select role::text from public.memberships), 'participant', 'účastník si nezmění roli (politika update)');
select throws_ok($$ update public.organizations set seat_limit = 999 $$, '42501', null, 'licenci nemění ani člen (sloupec)');

-- dokončení průchodu a certifikát
insert into public.attempts (run_id, org_id, module_slug, lesson_slug, task_index, exercise_type, difficulty, seed, engine_version, is_correct, score)
values
  ('00000000-0000-0000-0001-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'pohledy-a-rezy', 'zaverecny-test', 0, 'section', 2, 1, '0.4.0', true, 1),
  ('00000000-0000-0000-0001-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'pohledy-a-rezy', 'zaverecny-test', 1, 'section', 2, 2, '0.4.0', true, 1);
select throws_ok($$ select public.finish_lesson_run('00000000-0000-0000-0001-0000000000f1') $$,
  'P0001', 'RUN_INCOMPLETE', 'nedokončený průchod nejde uzavřít');
select throws_ok($$ select public.issue_certificate('00000000-0000-0000-0001-0000000000f1') $$,
  'P0001', 'NOT_A_FINISHED_TEST', 'certifikát až po dokončení');
insert into public.attempts (run_id, org_id, module_slug, lesson_slug, task_index, exercise_type, difficulty, seed, engine_version, is_correct, score)
values
  ('00000000-0000-0000-0001-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'pohledy-a-rezy', 'zaverecny-test', 2, 'section', 2, 3, '0.4.0', true, 1),
  ('00000000-0000-0000-0001-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'pohledy-a-rezy', 'zaverecny-test', 3, 'section', 2, 4, '0.4.0', false, 0);
select throws_ok(
  $$ insert into public.attempts (run_id, org_id, module_slug, lesson_slug, task_index, exercise_type, difficulty, seed, engine_version, is_correct, score)
     values ('00000000-0000-0000-0001-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'pohledy-a-rezy', 'zaverecny-test', 4, 'section', 2, 5, '0.4.0', true, 1) $$,
  '42501', null, 'pokus mimo počet úloh průchodu nejde zapsat');
select is(public.finish_lesson_run('00000000-0000-0000-0001-0000000000f1'), 3, 'průchod se uzavře se 3 správnými ze 4');
select throws_ok(
  $$ insert into public.attempts (run_id, org_id, module_slug, lesson_slug, task_index, exercise_type, difficulty, seed, engine_version, is_correct, score)
     values ('00000000-0000-0000-0001-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'pohledy-a-rezy', 'zaverecny-test', 0, 'section', 2, 1, '0.4.0', true, 1) $$,
  '42501', null, 'do uzavřeného průchodu už nic');
select matches(public.issue_certificate('00000000-0000-0000-0001-0000000000f1'), '^[A-Z2-9]{16}$', 'certifikát při 75 % vydán');
select is((select count(*)::int from public.certificates), 1, 'účastník vidí svůj certifikát');
select is((select best_score::real from public.lesson_progress where lesson_slug = 'zaverecny-test'), 0.75::real, 'průběh lekce ukazuje nejlepší skóre');

-- ---------------------------------------------------------------------------------------------
-- Školitelé
-- ---------------------------------------------------------------------------------------------

select pg_temp.login('a_trainer1');
select results_eq(
  $$ select r.id::text from public.lesson_runs r order by r.id $$,
  array['00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0001-0000000000f1'],
  'školitel vidí průchody jen svých účastníků a jen z této organizace (agent z B ne)');
select is((select count(*)::int from public.attempts where user_id = pg_temp.uid('agent')), 1,
  'školitel nevidí pokusy agenta z jiné firmy');
select is((select count(*)::int from public.attempts where user_id = pg_temp.uid('a_p2')), 0,
  'školitel nevidí účastníky cizí skupiny');
select is((select count(*)::int from public.certificates), 1, 'školitel vidí certifikát svého účastníka');
select is((select count(*)::int from public.profiles where display_name like 'Jméno b_%'), 0, 'školitel nevidí jména z jiné organizace');
select is((select count(*)::int from public.profiles where display_name = 'Jméno a_p2'), 1, 'školitel vidí jména členů své organizace');
select throws_ok(
  $$ insert into public.groups (org_id, name) values ('00000000-0000-0000-0000-00000000000b', 'cizí') $$,
  '42501', null, 'školitel nezaloží skupinu v cizí organizaci');
select lives_ok(
  $$ insert into public.groups (id, org_id, name) values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000000a', 'A3') $$,
  'školitel založí skupinu ve své organizaci');
select is((select role::text from public.group_members where group_id = '00000000-0000-0000-0000-0000000000a3' and user_id = pg_temp.uid('a_trainer1')),
  'trainer', 'zakladatel skupinu automaticky vede');
select throws_ok(
  $$ insert into public.assignments (group_id, module_slug, lesson_slug) values ('00000000-0000-0000-0000-0000000000a2', 'pohledy-a-rezy', 'koty') $$,
  '42501', null, 'školitel nepřiřadí lekci cizí skupině');
select lives_ok(
  $$ insert into public.assignments (group_id, module_slug, lesson_slug) values ('00000000-0000-0000-0000-0000000000a1', 'pohledy-a-rezy', 'koty') $$,
  'školitel přiřadí lekci své skupině');
select throws_ok($$ select public.create_invitation('00000000-0000-0000-0000-00000000000a', 'trainer') $$,
  '42501', null, 'školitel nepozve dalšího školitele');
select throws_ok($$ select public.create_invitation('00000000-0000-0000-0000-00000000000a', 'participant', '00000000-0000-0000-0000-0000000000a2') $$,
  '42501', null, 'školitel nepozve do cizí skupiny');
select is((select count(*)::int from public.memberships where org_id = '00000000-0000-0000-0000-00000000000b'), 0,
  'školitel nevidí členství v jiné organizaci');

select pg_temp.login('b_trainer');
select results_eq($$ select r.id::text from public.lesson_runs r order by r.id $$,
  array['00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0001-000000000005'],
  'školitel B vidí agenta jen s výsledky z B');

-- ---------------------------------------------------------------------------------------------
-- Správci organizací
-- ---------------------------------------------------------------------------------------------

select pg_temp.login('a_admin');
select is((select count(*)::int from public.lesson_runs), 4, 'správce A vidí všechny průchody z A a nic z B');
select is((select count(*)::int from public.organizations), 1, 'správce A vidí jen svou organizaci');
update public.organizations set name = 'Hack' where id = '00000000-0000-0000-0000-00000000000b';
select is((select count(*)::int from public.organizations where name = 'Hack'), 0, 'správce A nepřejmenuje B');
select throws_ok($$ update public.organizations set license_valid_until = '2099-01-01' $$, '42501', null, 'správce nemění licenci');
select throws_ok($$ delete from public.memberships where user_id = md5('vk-test-a_admin')::uuid $$,
  'P0001', 'LAST_ORG_ADMIN', 'poslední správce nemůže odejít');
select lives_ok($$ update public.memberships set role = 'trainer' where user_id = md5('vk-test-a_p2')::uuid $$, 'správce mění role');
update public.memberships set role = 'participant' where user_id = pg_temp.uid('a_p2');

-- pozvánka školitele a přijetí
create temp table inv as select public.create_invitation('00000000-0000-0000-0000-00000000000a', 'trainer', null, 'nový školitel') as token;
grant select on inv to authenticated;
select pg_temp.login('b_admin');
select is((select count(*)::int from public.invitations), 0, 'správce B nevidí pozvánky A');
select pg_temp.login('outsider');
select is((select role::text from public.invitation_preview((select token from inv))), 'trainer', 'náhled pozvánky');
select is(public.accept_invitation((select token from inv)), '00000000-0000-0000-0000-00000000000a'::uuid, 'pozvánka přijata');
select is((select role::text from public.memberships where org_id = '00000000-0000-0000-0000-00000000000a' and user_id = pg_temp.uid('outsider')), 'trainer', 'nový člen má roli z pozvánky');
select throws_ok($$ select public.accept_invitation((select token from inv)) $$, 'P0001', 'INVITATION_USED', 'pozvánka je jednorázová');

-- ---------------------------------------------------------------------------------------------
-- Připojení kódem, místa a licence
-- ---------------------------------------------------------------------------------------------

select pg_temp.login('b_p1');
-- A má 4 místa, obsazená 3 účastníky (a_p1, a_p2, agent) → b_p1 se ještě vejde
select is(public.join_organization('grpa aaa1'), '00000000-0000-0000-0000-00000000000a'::uuid, 'připojení kódem skupiny');
select is((select count(*)::int from public.group_members where group_id = '00000000-0000-0000-0000-0000000000a1' and user_id = pg_temp.uid('b_p1')), 1,
  'kód skupiny zařadí i do skupiny');
select pg_temp.login('b_trainer');
select throws_ok($$ select public.join_organization('AAAAAAAA') $$, 'P0001', 'NO_SEATS', 'plná organizace nepřijme dalšího účastníka');
select throws_ok($$ select public.join_organization('CCCCCCCC') $$, 'P0001', 'LICENSE_EXPIRED', 'prošlá licence nepřijme nikoho');

-- ---------------------------------------------------------------------------------------------
-- Správa platformy a smazání účtu
-- ---------------------------------------------------------------------------------------------

select throws_ok($$ select public.create_organization('X', 'company', 5, current_date + 10) $$, '42501', null, 'organizaci nezaloží běžný uživatel');
select pg_temp.login('platform');
select lives_ok($$ select public.create_organization('Nová D', 'school', 25, current_date + 365) $$, 'správce platformy založí organizaci');
-- (sdílená lokální databáze může obsahovat organizace z e2e testů, proto jen testovací)
select is((select count(*)::int from public.platform_organizations()
            where name in ('Firma A', 'Škola B', 'Prošlá C', 'Nová D')), 4,
          'správce platformy vidí přehled organizací');

select pg_temp.admin();
create temp table code as select verification_code from public.certificates limit 1;
grant select on code to anon;
select pg_temp.anon();
select is((select holder_name from public.verify_certificate((select verification_code from code))), 'Jméno a_p1', 'veřejné ověření certifikátu');

select pg_temp.login('a_p1');
select lives_ok($$ select public.delete_my_account() $$, 'smazání vlastního účtu');
select pg_temp.admin();
select is((select count(*)::int from public.attempts where user_id = pg_temp.uid('a_p1')), 0, 'se smazaným účtem zmizí i pokusy');

select * from finish();
rollback;
