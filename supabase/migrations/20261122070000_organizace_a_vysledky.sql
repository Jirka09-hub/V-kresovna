-- Fáze 4: organizace, role, skupiny, pozvánky, výsledky lekcí a certifikáty (D-026, D-027).
--
-- Zásady:
-- - RLS zapnuté na všech tabulkách v public; přímý zápis z klienta jen tam, kde stačí RLS
--   (vlastní pokusy, skupiny, přiřazení lekcí). Vše, co potřebuje ověření (kód, pozvánka,
--   certifikát, smazání účtu), jde přes funkce `security definer` se `search_path = ''`.
-- - Pomocné funkce pro politiky jsou ve schématu `app` (není vystavené přes Data API).
-- - Každý výsledek nese org_id, ve které vznikl; školitel vidí jen výsledky ze své organizace
--   a jen od účastníků svých skupin.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Typy
-- ---------------------------------------------------------------------------------------------

create type public.org_kind as enum ('company', 'school');
create type public.org_role as enum ('participant', 'trainer', 'org_admin');
create type public.group_role as enum ('participant', 'trainer');

-- ---------------------------------------------------------------------------------------------
-- Pomocné funkce bez přístupu k tabulkám
-- ---------------------------------------------------------------------------------------------

-- Kód pro připojení: 8 znaků bez snadno zaměnitelných (0/O, 1/I/L). 31^8 ≈ 8,5·10^11 možností.
create function app.new_code() returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  result text := '';
begin
  for i in 0..7 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

-- Normalizace kódu zadaného uživatelem (velká písmena, bez mezer a pomlček).
create function app.normalize_code(code text) returns text
language sql immutable
set search_path = ''
as $$ select upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g')) $$;

create function app.hash_token(token text) returns text
language sql immutable
set search_path = ''
as $$ select encode(extensions.digest(convert_to(token, 'UTF8'), 'sha256'), 'hex') $$;

-- ---------------------------------------------------------------------------------------------
-- Tabulky
-- ---------------------------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  kind public.org_kind not null default 'company',
  join_code text not null unique default app.new_code(),
  -- počet účastníků (školitelé a správci se nepočítají), D-027
  seat_limit integer not null default 30 check (seat_limit between 0 and 100000),
  -- licence platí včetně tohoto dne
  license_valid_until date not null,
  created_at timestamptz not null default now()
);
comment on table public.organizations is 'Firma nebo škola (zákazník).';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  -- přihlašovací jméno u účtů bez e-mailu (jinak null)
  username text unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  locale text not null default 'cs' check (locale in ('cs', 'sk', 'de', 'en')),
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Minimum osobních údajů: zobrazované jméno a přihlašovací jméno.';

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.platform_admins is 'Provozovatel Výkresovny: zakládá organizace a licence.';

create table public.platform_invitations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.platform_invitations is
  'Jednorázové odkazy pro správce platformy (zakládá je provozovatel ručně). Klient nemá přístup.';

create table public.memberships (
  -- odkaz na profiles (ne auth.users), aby šlo v API spojit členství se jménem
  user_id uuid not null references public.profiles (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  role public.org_role not null default 'participant',
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);
create index memberships_org_idx on public.memberships (org_id);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  join_code text unique default app.new_code(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create index groups_org_idx on public.groups (org_id);
comment on table public.groups is 'Skupina (třída, směna, kurz). Kód skupiny připojí rovnou do organizace i skupiny.';

create table public.group_members (
  group_id uuid not null,
  org_id uuid not null,
  user_id uuid not null,
  role public.group_role not null default 'participant',
  created_at timestamptz not null default now(),
  primary key (group_id, user_id),
  foreign key (group_id, org_id) references public.groups (id, org_id) on delete cascade,
  -- člen skupiny musí být členem organizace; odchodem z organizace zmizí i ze skupin
  foreign key (user_id, org_id) references public.memberships (user_id, org_id) on delete cascade,
  foreign key (user_id) references public.profiles (id) on delete cascade
);
create index group_members_user_idx on public.group_members (user_id);
create index group_members_org_user_idx on public.group_members (org_id, user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  role public.org_role not null,
  group_id uuid,
  -- komu je pozvánka určená (jméno nebo poznámka; e-mail se nevyžaduje)
  note text check (char_length(note) <= 120),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (group_id, org_id) references public.groups (id, org_id) on delete cascade
);
create index invitations_org_idx on public.invitations (org_id);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  module_slug text not null check (module_slug ~ '^[a-z0-9-]{1,64}$'),
  lesson_slug text not null check (lesson_slug ~ '^[a-z0-9-]{1,64}$'),
  due_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, module_slug, lesson_slug)
);

-- Jeden průchod lekcí nebo závěrečným testem.
create table public.lesson_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  module_slug text not null check (module_slug ~ '^[a-z0-9-]{1,64}$'),
  lesson_slug text not null check (lesson_slug ~ '^[a-z0-9-]{1,64}$'),
  task_count integer not null check (task_count between 1 and 50),
  engine_version text not null check (char_length(engine_version) <= 20),
  -- seed celé sady (závěrečný test); úlohy mají vlastní seed v attempts
  seed bigint,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  correct_count integer check (correct_count >= 0)
);
create index lesson_runs_org_user_idx on public.lesson_runs (org_id, user_id);
create index lesson_runs_user_idx on public.lesson_runs (user_id);

-- Každá odpověď na úlohu (jen přidávání). seed + engine_version stačí k zpětnému ověření.
create table public.attempts (
  id bigint generated always as identity primary key,
  run_id uuid references public.lesson_runs (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- null jen pro budoucí B2C (samostatní uživatelé); zatím politika vyžaduje organizaci
  org_id uuid references public.organizations (id) on delete cascade,
  module_slug text not null check (module_slug ~ '^[a-z0-9-]{1,64}$'),
  lesson_slug text not null check (lesson_slug ~ '^[a-z0-9-]{1,64}$'),
  task_index smallint check (task_index between 0 and 49),
  exercise_type text not null check (exercise_type ~ '^[a-z-]{1,32}$'),
  difficulty smallint not null check (difficulty between 1 and 5),
  seed bigint not null,
  engine_version text not null check (char_length(engine_version) <= 20),
  -- null = úloha přeskočena
  answer jsonb check (answer is null or pg_column_size(answer) <= 4096),
  is_correct boolean not null,
  score real not null check (score between 0 and 1),
  error_codes text[] not null default '{}' check (cardinality(error_codes) <= 20),
  duration_ms integer check (duration_ms between 0 and 86400000),
  created_at timestamptz not null default now(),
  unique (run_id, task_index)
);
create index attempts_org_user_idx on public.attempts (org_id, user_id, created_at desc);
create index attempts_user_idx on public.attempts (user_id, created_at desc);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete set null,
  module_slug text not null,
  run_id uuid references public.lesson_runs (id) on delete set null,
  score real not null check (score between 0 and 1),
  -- snímek v době vydání (pozdější přejmenování certifikát nemění)
  holder_name text not null,
  org_name text,
  verification_code text not null unique,
  issued_at timestamptz not null default now(),
  unique (user_id, org_id, module_slug)
);
create index certificates_org_idx on public.certificates (org_id);

-- ---------------------------------------------------------------------------------------------
-- Pomocné funkce pro politiky (security definer → nečtou přes RLS, nehrozí rekurze)
-- ---------------------------------------------------------------------------------------------

create function app.is_platform_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
$$;

create function app.is_org_member(p_org uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships where org_id = p_org and user_id = (select auth.uid())
  )
$$;

create function app.has_org_role(p_org uuid, p_roles public.org_role[]) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
     where org_id = p_org and user_id = (select auth.uid()) and role = any (p_roles)
  )
$$;

create function app.is_org_staff(p_org uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$ select app.has_org_role(p_org, array['trainer', 'org_admin']::public.org_role[]) $$;

create function app.is_org_admin(p_org uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$ select app.has_org_role(p_org, array['org_admin']::public.org_role[]) $$;

-- Vede přihlášený uživatel skupinu? (správce organizace vede všechny její skupiny)
create function app.can_manage_group(p_group uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.groups g
     where g.id = p_group
       and (
         app.is_org_admin(g.org_id)
         or exists (
           select 1 from public.group_members gm
            where gm.group_id = g.id and gm.user_id = (select auth.uid()) and gm.role = 'trainer'
              and app.is_org_staff(g.org_id)
         )
       )
  )
$$;

create function app.is_group_member(p_group uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members where group_id = p_group and user_id = (select auth.uid())
  )
$$;

-- Smí přihlášený uživatel vidět výsledky uživatele p_user z organizace p_org?
-- Sám sebe vždy; správce organizace všechny; školitel jen účastníky svých skupin v té organizaci.
create function app.can_view_results(p_org uuid, p_user uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_user = (select auth.uid())
      or (p_org is not null and app.is_org_admin(p_org))
      or (
        p_org is not null and app.is_org_staff(p_org) and exists (
          select 1
            from public.group_members t
            join public.group_members p on p.group_id = t.group_id
           where t.user_id = (select auth.uid()) and t.role = 'trainer' and t.org_id = p_org
             and p.user_id = p_user and p.org_id = p_org
        )
      )
$$;

-- Platí licence organizace dnes?
create function app.license_active(p_org uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizations
     where id = p_org and license_valid_until >= (now() at time zone 'Europe/Prague')::date
  )
$$;

create function app.free_seats(p_org uuid) returns integer
language sql stable security definer
set search_path = ''
as $$
  select o.seat_limit - (
    select count(*)::integer from public.memberships m where m.org_id = o.id and m.role = 'participant'
  )
  from public.organizations o where o.id = p_org
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Spouštěče
-- ---------------------------------------------------------------------------------------------

-- Profil vznikne s účtem (jméno a přihlašovací jméno z metadat, která nastaví server).
create function app.handle_new_user() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                  split_part(coalesce(new.email, ''), '@', 1), 'Uživatel'), 80),
    nullif(lower(new.raw_user_meta_data ->> 'username'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function app.handle_new_user();

-- Tvůrce skupiny ji automaticky vede.
create function app.handle_new_group() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.created_by is not null and exists (
    select 1 from public.memberships where user_id = new.created_by and org_id = new.org_id
  ) then
    insert into public.group_members (group_id, org_id, user_id, role)
    values (new.id, new.org_id, new.created_by, 'trainer')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_group_created
after insert on public.groups
for each row execute function app.handle_new_group();

-- Organizace nesmí přijít o posledního správce (kromě smazání účtu nebo celé organizace).
create function app.keep_last_org_admin() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.role = 'org_admin'
     and (tg_op = 'DELETE' or new.role <> 'org_admin')
     and exists (select 1 from auth.users where id = old.user_id)
     and exists (select 1 from public.organizations where id = old.org_id)
     and not exists (
       select 1 from public.memberships
        where org_id = old.org_id and role = 'org_admin' and user_id <> old.user_id
     )
  then
    raise exception 'LAST_ORG_ADMIN' using errcode = 'P0001',
      hint = 'Organizace musí mít aspoň jednoho správce.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger keep_last_org_admin
before update of role or delete on public.memberships
for each row execute function app.keep_last_org_admin();

-- Školitel ve skupině musí mít v organizaci roli školitele nebo správce.
create function app.check_group_trainer() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.role = 'trainer' and not exists (
    select 1 from public.memberships
     where user_id = new.user_id and org_id = new.org_id and role in ('trainer', 'org_admin')
  ) then
    raise exception 'NOT_TRAINER' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger check_group_trainer
before insert or update of role on public.group_members
for each row execute function app.check_group_trainer();

-- ---------------------------------------------------------------------------------------------
-- RLS a politiky
-- ---------------------------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.platform_invitations enable row level security;
alter table public.memberships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.invitations enable row level security;
alter table public.assignments enable row level security;
alter table public.lesson_runs enable row level security;
alter table public.attempts enable row level security;
alter table public.certificates enable row level security;

-- Výchozí práva: klient nesmí nic, povolujeme výslovně po tabulkách a sloupcích.
revoke all on all tables in schema public from anon, authenticated;

-- organizations: členové čtou; správce mění jen název; licence a zakládání jen funkce
grant select on public.organizations to authenticated;
grant update (name) on public.organizations to authenticated;
create policy organizations_select on public.organizations for select to authenticated
  using (app.is_org_member(id) or app.is_platform_admin());
create policy organizations_update on public.organizations for update to authenticated
  using (app.is_org_admin(id)) with check (app.is_org_admin(id));

-- profiles: sám sebe; školitel a správce vidí jména členů své organizace
grant select on public.profiles to authenticated;
grant update (display_name, locale) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.memberships m
       where m.user_id = profiles.id and app.is_org_staff(m.org_id)
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- platform_admins: jen vlastní řádek (aplikace pozná, že má ukázat správu platformy)
grant select on public.platform_admins to authenticated;
create policy platform_admins_select on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- platform_invitations: bez politik (jen service role)

-- memberships: vlastní; školitelé a správce celé organizace; role mění správce; odejít smí každý
grant select, delete on public.memberships to authenticated;
grant update (role) on public.memberships to authenticated;
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or app.is_org_staff(org_id) or app.is_platform_admin());
create policy memberships_update on public.memberships for update to authenticated
  using (app.is_org_admin(org_id)) with check (app.is_org_admin(org_id));
create policy memberships_delete on public.memberships for delete to authenticated
  using (user_id = (select auth.uid()) or app.is_org_admin(org_id));

-- groups: školitelé a správce organizace, členové skupiny; zakládá školitel/správce
grant select, insert, delete on public.groups to authenticated;
grant update (name, archived_at, join_code) on public.groups to authenticated;
create policy groups_select on public.groups for select to authenticated
  using (app.is_org_staff(org_id) or app.is_group_member(id));
create policy groups_insert on public.groups for insert to authenticated
  with check (app.is_org_staff(org_id) and created_by = (select auth.uid()));
create policy groups_update on public.groups for update to authenticated
  using (app.can_manage_group(id)) with check (app.can_manage_group(id));
create policy groups_delete on public.groups for delete to authenticated
  using (app.can_manage_group(id));

-- group_members: sám sebe; vedoucí skupiny a správce; zařazuje vedoucí nebo správce
grant select, insert, delete on public.group_members to authenticated;
grant update (role) on public.group_members to authenticated;
create policy group_members_select on public.group_members for select to authenticated
  using (user_id = (select auth.uid()) or app.can_manage_group(group_id) or app.is_org_admin(org_id));
create policy group_members_insert on public.group_members for insert to authenticated
  with check (app.can_manage_group(group_id));
create policy group_members_update on public.group_members for update to authenticated
  using (app.can_manage_group(group_id)) with check (app.can_manage_group(group_id));
create policy group_members_delete on public.group_members for delete to authenticated
  using (app.can_manage_group(group_id));

-- invitations: správce celé organizace, školitel své; vznik jen funkcí create_invitation
grant select, delete on public.invitations to authenticated;
create policy invitations_select on public.invitations for select to authenticated
  using (app.is_org_admin(org_id) or (created_by = (select auth.uid()) and app.is_org_staff(org_id)));
create policy invitations_delete on public.invitations for delete to authenticated
  using (app.is_org_admin(org_id) or (created_by = (select auth.uid()) and app.is_org_staff(org_id)));

-- assignments: členové skupiny čtou, vedoucí skupiny spravuje
grant select, insert, delete on public.assignments to authenticated;
grant update (due_at) on public.assignments to authenticated;
create policy assignments_select on public.assignments for select to authenticated
  using (app.is_group_member(group_id) or app.can_manage_group(group_id));
create policy assignments_insert on public.assignments for insert to authenticated
  with check (app.can_manage_group(group_id) and created_by = (select auth.uid()));
create policy assignments_update on public.assignments for update to authenticated
  using (app.can_manage_group(group_id)) with check (app.can_manage_group(group_id));
create policy assignments_delete on public.assignments for delete to authenticated
  using (app.can_manage_group(group_id));

-- lesson_runs: vlastní zakládá jen v organizaci, kde je členem a licence platí; dokončení funkcí
grant select, insert on public.lesson_runs to authenticated;
create policy lesson_runs_select on public.lesson_runs for select to authenticated
  using (app.can_view_results(org_id, user_id));
create policy lesson_runs_insert on public.lesson_runs for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id is not null and app.is_org_member(org_id) and app.license_active(org_id)
    and finished_at is null and correct_count is null
  );

-- attempts: vlastní pokusy do vlastního nedokončeného průchodu; nikdo je nemění ani nemaže
grant select, insert on public.attempts to authenticated;
create policy attempts_select on public.attempts for select to authenticated
  using (app.can_view_results(org_id, user_id));
create policy attempts_insert on public.attempts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id is not null and app.is_org_member(org_id) and app.license_active(org_id)
    and (
      run_id is null or exists (
        select 1 from public.lesson_runs r
         where r.id = run_id and r.user_id = (select auth.uid()) and r.org_id = attempts.org_id
           and r.lesson_slug = attempts.lesson_slug and r.finished_at is null
           and attempts.task_index is not null and attempts.task_index < r.task_count
      )
    )
  );

-- certificates: vlastní; školitel/správce podle pravidel výsledků; vznik jen funkcí
grant select on public.certificates to authenticated;
create policy certificates_select on public.certificates for select to authenticated
  using (app.can_view_results(org_id, user_id));

-- Průběh lekcí (pro účastníka i přehled školitele); security_invoker → platí RLS tabulky runs.
create view public.lesson_progress with (security_invoker = true) as
select
  r.user_id,
  r.org_id,
  r.module_slug,
  r.lesson_slug,
  count(*) filter (where r.finished_at is not null)::integer as finished_runs,
  max(r.correct_count::real / r.task_count) filter (where r.finished_at is not null) as best_score,
  max(r.finished_at) as last_finished_at,
  max(r.started_at) as last_started_at
from public.lesson_runs r
group by r.user_id, r.org_id, r.module_slug, r.lesson_slug;
revoke all on public.lesson_progress from anon, authenticated;
grant select on public.lesson_progress to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Funkce volané z aplikace (RPC)
-- ---------------------------------------------------------------------------------------------

-- Náhled kódu před registrací (anonym smí): kam se uživatel připojí a jestli to jde.
create function public.join_code_preview(p_code text)
returns table (org_name text, group_name text, status text)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_code text := app.normalize_code(p_code);
  v_org public.organizations;
  v_group public.groups;
begin
  select * into v_group from public.groups where join_code = v_code and archived_at is null;
  if found then
    select * into v_org from public.organizations where id = v_group.org_id;
  else
    select * into v_org from public.organizations where join_code = v_code;
  end if;
  if v_org.id is null then
    return query select null::text, null::text, 'invalid'::text;
    return;
  end if;
  return query select v_org.name, v_group.name,
    case
      when not app.license_active(v_org.id) then 'license_expired'
      when app.free_seats(v_org.id) <= 0 then 'no_seats'
      else 'ok'
    end;
end;
$$;

-- Připojení přihlášeného uživatele kódem organizace nebo skupiny (jako účastník).
create function public.join_organization(p_code text)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text := app.normalize_code(p_code);
  v_org_id uuid;
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  select id, org_id into v_group_id, v_org_id
    from public.groups where join_code = v_code and archived_at is null;
  if v_org_id is null then
    select id into v_org_id from public.organizations where join_code = v_code;
  end if;
  if v_org_id is null then
    raise exception 'INVALID_CODE' using errcode = 'P0001';
  end if;
  if not app.license_active(v_org_id) then
    raise exception 'LICENSE_EXPIRED' using errcode = 'P0001';
  end if;

  -- zámek organizace, aby dva souběžní uživatelé nepřekročili počet míst
  perform 1 from public.organizations where id = v_org_id for update;
  if not exists (select 1 from public.memberships where user_id = v_uid and org_id = v_org_id) then
    if app.free_seats(v_org_id) <= 0 then
      raise exception 'NO_SEATS' using errcode = 'P0001';
    end if;
    insert into public.memberships (user_id, org_id, role) values (v_uid, v_org_id, 'participant');
  end if;
  if v_group_id is not null then
    insert into public.group_members (group_id, org_id, user_id, role)
    values (v_group_id, v_org_id, v_uid, 'participant')
    on conflict do nothing;
  end if;
  return v_org_id;
end;
$$;

-- Pozvánka: správce kohokoli, školitel jen účastníky do skupin, které vede (nebo bez skupiny).
-- Vrací jednorázový token (v DB je jen jeho otisk).
create function public.create_invitation(
  p_org uuid, p_role public.org_role, p_group uuid default null, p_note text default null,
  p_valid_days integer default 14
)
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not (app.is_org_admin(p_org) or app.is_platform_admin()) then
    if not (app.is_org_staff(p_org) and p_role = 'participant'
            and (p_group is null or app.can_manage_group(p_group))) then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;
  if p_group is not null and not exists (select 1 from public.groups where id = p_group and org_id = p_org) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.invitations (org_id, role, group_id, note, token_hash, expires_at, created_by)
  values (p_org, p_role, p_group, nullif(trim(p_note), ''), app.hash_token(v_token),
          now() + make_interval(days => least(greatest(p_valid_days, 1), 60)), (select auth.uid()));
  return v_token;
end;
$$;

create function public.invitation_preview(p_token text)
returns table (org_name text, group_name text, role public.org_role, status text)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
begin
  select * into v_inv from public.invitations where token_hash = app.hash_token(p_token);
  if v_inv.id is null then
    return query select null::text, null::text, null::public.org_role, 'invalid'::text;
    return;
  end if;
  return query
    select o.name, g.name, v_inv.role,
      case
        when v_inv.accepted_at is not null then 'used'
        when v_inv.expires_at < now() then 'expired'
        when not app.license_active(o.id) then 'license_expired'
        when v_inv.role = 'participant' and app.free_seats(o.id) <= 0 then 'no_seats'
        else 'ok'
      end
      from public.organizations o
      left join public.groups g on g.id = v_inv.group_id
     where o.id = v_inv.org_id;
end;
$$;

create function public.accept_invitation(p_token text)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.invitations;
  v_current public.org_role;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  select * into v_inv from public.invitations where token_hash = app.hash_token(p_token) for update;
  if v_inv.id is null then
    raise exception 'INVALID_INVITATION' using errcode = 'P0001';
  elsif v_inv.accepted_at is not null then
    raise exception 'INVITATION_USED' using errcode = 'P0001';
  elsif v_inv.expires_at < now() then
    raise exception 'INVITATION_EXPIRED' using errcode = 'P0001';
  elsif not app.license_active(v_inv.org_id) then
    raise exception 'LICENSE_EXPIRED' using errcode = 'P0001';
  end if;

  perform 1 from public.organizations where id = v_inv.org_id for update;
  select role into v_current from public.memberships where user_id = v_uid and org_id = v_inv.org_id;
  if v_current is null then
    if v_inv.role = 'participant' and app.free_seats(v_inv.org_id) <= 0 then
      raise exception 'NO_SEATS' using errcode = 'P0001';
    end if;
    insert into public.memberships (user_id, org_id, role) values (v_uid, v_inv.org_id, v_inv.role);
  elsif v_inv.role > v_current then
    -- pořadí výčtu: participant < trainer < org_admin; pozvánka roli jen zvyšuje
    update public.memberships set role = v_inv.role where user_id = v_uid and org_id = v_inv.org_id;
  end if;
  if v_inv.group_id is not null then
    insert into public.group_members (group_id, org_id, user_id, role)
    values (v_inv.group_id, v_inv.org_id, v_uid,
            case when v_inv.role = 'participant' then 'participant' else 'trainer' end::public.group_role)
    on conflict (group_id, user_id) do update set role = excluded.role;
  end if;
  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return v_inv.org_id;
end;
$$;

-- Dokončení průchodu: spočítá správné odpovědi z uložených pokusů. Všechny úlohy musí mít pokus.
create function public.finish_lesson_run(p_run uuid)
returns integer
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_run public.lesson_runs;
  v_answered integer;
  v_correct integer;
begin
  select * into v_run from public.lesson_runs
   where id = p_run and user_id = (select auth.uid()) for update;
  if v_run.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_run.finished_at is not null then
    return v_run.correct_count;
  end if;
  select count(*), count(*) filter (where is_correct)
    into v_answered, v_correct
    from public.attempts where run_id = p_run;
  if v_answered < v_run.task_count then
    raise exception 'RUN_INCOMPLETE' using errcode = 'P0001';
  end if;
  update public.lesson_runs set finished_at = now(), correct_count = v_correct where id = p_run;
  return v_correct;
end;
$$;

-- Pravidla certifikátu (D-027). Hodnoty musí odpovídat packages/content (hlídá test v aplikaci):
-- závěrečný test modulu = lekce 'zaverecny-test', hranice FINAL_TEST_PASS_THRESHOLD = 0.75.
create function app.certificate_rules(
  out final_lesson_slug text, out pass_threshold real
)
language sql immutable
set search_path = ''
as $$ select 'zaverecny-test'::text, 0.75::real $$;

-- Vydání certifikátu po úspěšném závěrečném testu. Vrací ověřovací kód (u opakování stejný).
create function public.issue_certificate(p_run uuid)
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_run public.lesson_runs;
  v_rules record;
  v_score real;
  v_code text;
begin
  select * into v_rules from app.certificate_rules();
  select * into v_run from public.lesson_runs where id = p_run and user_id = v_uid;
  if v_run.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_run.lesson_slug <> v_rules.final_lesson_slug or v_run.finished_at is null then
    raise exception 'NOT_A_FINISHED_TEST' using errcode = 'P0001';
  end if;
  if not app.is_org_member(v_run.org_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_score := v_run.correct_count::real / v_run.task_count;
  if v_score < v_rules.pass_threshold then
    raise exception 'NOT_PASSED' using errcode = 'P0001';
  end if;

  select verification_code into v_code from public.certificates
   where user_id = v_uid and org_id = v_run.org_id and module_slug = v_run.module_slug;
  if v_code is not null then
    return v_code;
  end if;
  v_code := app.new_code() || app.new_code();
  insert into public.certificates
    (user_id, org_id, module_slug, run_id, score, holder_name, org_name, verification_code)
  select v_uid, v_run.org_id, v_run.module_slug, v_run.id, v_score, p.display_name, o.name, v_code
    from public.profiles p, public.organizations o
   where p.id = v_uid and o.id = v_run.org_id;
  return v_code;
end;
$$;

-- Veřejné ověření certifikátu podle kódu (anonym smí; vrací jen údaje vytištěné na certifikátu).
create function public.verify_certificate(p_code text)
returns table (holder_name text, org_name text, module_slug text, score real, issued_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select c.holder_name, c.org_name, c.module_slug, c.score, c.issued_at
    from public.certificates c
   where c.verification_code = app.normalize_code(p_code)
$$;

-- Nový kód organizace nebo skupiny (starý přestane platit).
create function public.regenerate_join_code(p_org uuid default null, p_group uuid default null)
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_code text := app.new_code();
begin
  if p_group is not null then
    if not app.can_manage_group(p_group) then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
    update public.groups set join_code = v_code where id = p_group;
  elsif p_org is not null then
    if not app.is_org_admin(p_org) then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
    update public.organizations set join_code = v_code where id = p_org;
  else
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_code;
end;
$$;

-- Správa platformy: založení organizace a úprava licence.
create function public.create_organization(
  p_name text, p_kind public.org_kind, p_seat_limit integer, p_valid_until date
)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not app.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.organizations (name, kind, seat_limit, license_valid_until)
  values (trim(p_name), p_kind, p_seat_limit, p_valid_until)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.update_organization_license(
  p_org uuid, p_seat_limit integer, p_valid_until date
)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.organizations
     set seat_limit = p_seat_limit, license_valid_until = p_valid_until
   where id = p_org;
end;
$$;

-- Přehled organizací pro správu platformy (počty bez osobních údajů).
create function public.platform_organizations()
returns table (
  id uuid, name text, kind public.org_kind, join_code text, seat_limit integer,
  license_valid_until date, participants integer, staff integer, created_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select o.id, o.name, o.kind, o.join_code, o.seat_limit, o.license_valid_until,
           (select count(*)::integer from public.memberships m where m.org_id = o.id and m.role = 'participant'),
           (select count(*)::integer from public.memberships m where m.org_id = o.id and m.role <> 'participant'),
           o.created_at
      from public.organizations o
     order by o.created_at desc;
end;
$$;

-- Smazání vlastního účtu: kaskádou zmizí profil, členství, pokusy i certifikáty.
create function public.delete_my_account()
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

-- Funkce jen pro server (service role): zařazení nově založeného účtu, oprávnění k akcím přes
-- Auth Admin API (založení účtů školitelem, nové heslo účastníkovi).

-- Smí volající (p_actor) spravovat účet p_target? Správce organizace u členů své organizace
-- (kromě jiných správců), školitel u účastníků svých skupin.
create function public.can_manage_account(p_actor uuid, p_target uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_actor <> p_target and exists (
    select 1
      from public.memberships t
      join public.memberships a on a.org_id = t.org_id and a.user_id = p_actor
     where t.user_id = p_target
       and (
         (a.role = 'org_admin' and t.role <> 'org_admin')
         or (
           a.role in ('trainer', 'org_admin') and t.role = 'participant' and exists (
             select 1 from public.group_members ga
              join public.group_members gt on gt.group_id = ga.group_id
             where ga.user_id = p_actor and ga.role = 'trainer' and gt.user_id = p_target
           )
         )
       )
  )
$$;

-- Zařazení účtu (vytvořeného serverem) do organizace a případně skupiny jako účastníka.
-- Server předem ověří oprávnění volajícího (školitel skupiny / správce).
create function public.add_participant(p_user uuid, p_org uuid, p_group uuid default null)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not app.license_active(p_org) then
    raise exception 'LICENSE_EXPIRED' using errcode = 'P0001';
  end if;
  perform 1 from public.organizations where id = p_org for update;
  if not exists (select 1 from public.memberships where user_id = p_user and org_id = p_org) then
    if app.free_seats(p_org) <= 0 then
      raise exception 'NO_SEATS' using errcode = 'P0001';
    end if;
    insert into public.memberships (user_id, org_id, role) values (p_user, p_org, 'participant');
  end if;
  if p_group is not null then
    insert into public.group_members (group_id, org_id, user_id, role)
    values (p_group, p_org, p_user, 'participant')
    on conflict do nothing;
  end if;
end;
$$;

-- Přijetí pozvánky správce platformy (server ji volá s id právě přihlášeného uživatele).
create function public.accept_platform_invitation(p_token text, p_user uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_inv public.platform_invitations;
begin
  select * into v_inv from public.platform_invitations
   where token_hash = app.hash_token(p_token) for update;
  if v_inv.id is null or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'INVALID_INVITATION' using errcode = 'P0001';
  end if;
  insert into public.platform_admins (user_id) values (p_user) on conflict do nothing;
  update public.platform_invitations set accepted_at = now(), accepted_by = p_user where id = v_inv.id;
end;
$$;

create function public.platform_invitation_valid(p_token text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_invitations
     where token_hash = app.hash_token(p_token) and accepted_at is null and expires_at >= now()
  )
$$;

-- Práva k funkcím: výchozí execute pro public odebrat a povolit výslovně.
revoke all on function
  public.join_code_preview(text),
  public.join_organization(text),
  public.create_invitation(uuid, public.org_role, uuid, text, integer),
  public.invitation_preview(text),
  public.accept_invitation(text),
  public.finish_lesson_run(uuid),
  public.issue_certificate(uuid),
  public.verify_certificate(text),
  public.regenerate_join_code(uuid, uuid),
  public.create_organization(text, public.org_kind, integer, date),
  public.update_organization_license(uuid, integer, date),
  public.platform_organizations(),
  public.delete_my_account(),
  public.can_manage_account(uuid, uuid),
  public.add_participant(uuid, uuid, uuid),
  public.accept_platform_invitation(text, uuid),
  public.platform_invitation_valid(text)
from public, anon, authenticated;

grant execute on function
  public.join_code_preview(text),
  public.invitation_preview(text),
  public.verify_certificate(text)
to anon, authenticated;

grant execute on function
  public.join_organization(text),
  public.create_invitation(uuid, public.org_role, uuid, text, integer),
  public.accept_invitation(text),
  public.finish_lesson_run(uuid),
  public.issue_certificate(uuid),
  public.regenerate_join_code(uuid, uuid),
  public.create_organization(text, public.org_kind, integer, date),
  public.update_organization_license(uuid, integer, date),
  public.platform_organizations(),
  public.delete_my_account()
to authenticated;

grant execute on function
  public.can_manage_account(uuid, uuid),
  public.add_participant(uuid, uuid, uuid),
  public.accept_platform_invitation(text, uuid),
  public.platform_invitation_valid(text)
to service_role;

grant all on all tables in schema public to service_role;
