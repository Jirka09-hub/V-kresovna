-- Fáze 5: poptávky z formuláře „Chci pilot“ (D-030).
-- Klient do tabulky nesmí vůbec: zápis jen přes funkci, kterou volá server se service role klíčem
-- (po kontrole formuláře a pastí na roboty). Číst a vyřizovat smí jen správci platformy.

create type public.pilot_segment as enum ('company', 'school');

create table public.pilot_requests (
  id uuid primary key default gen_random_uuid(),
  segment public.pilot_segment not null,
  name text not null check (char_length(name) between 2 and 120),
  organization text not null check (char_length(organization) between 2 and 160),
  email text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone ~ '^[0-9 +()/-]{6,30}$'),
  headcount integer check (headcount between 1 and 100000),
  message text check (char_length(message) <= 2000),
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null
);

create index pilot_requests_created_at on public.pilot_requests (created_at desc);
create index pilot_requests_email on public.pilot_requests (lower(email), created_at desc);

alter table public.pilot_requests enable row level security;

create policy pilot_requests_select on public.pilot_requests
  for select to authenticated
  using (app.is_platform_admin());

create policy pilot_requests_delete on public.pilot_requests
  for delete to authenticated
  using (app.is_platform_admin());

revoke all on public.pilot_requests from anon, authenticated;
grant select, delete on public.pilot_requests to authenticated;

-- Jak dlouho poptávky držíme (D-030): 24 měsíců od odeslání, pak se smažou.
create function app.pilot_retention() returns interval
language sql immutable
set search_path = ''
as $$ select interval '24 months' $$;

-- Uložení poptávky. Volá jen server (service role). Omezení proti zahlcení: z jedné adresy nejvýš
-- 3 poptávky za 24 hodin, celkem nejvýš 30 za hodinu. Zároveň smaže poptávky starší než retence,
-- takže retence platí bez plánovače úloh.
create function public.submit_pilot_request(
  p_segment public.pilot_segment,
  p_name text,
  p_organization text,
  p_email text,
  p_phone text default null,
  p_headcount integer default null,
  p_message text default null
)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_email text := lower(trim(p_email));
begin
  -- Souběžná odeslání se seřadí, aby limity platily i při náporu.
  perform pg_advisory_xact_lock(hashtext('pilot_requests'));

  if (select count(*) from public.pilot_requests
       where lower(email) = v_email and created_at > now() - interval '24 hours') >= 3
     or (select count(*) from public.pilot_requests
          where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  delete from public.pilot_requests where created_at < now() - app.pilot_retention();

  insert into public.pilot_requests
    (segment, name, organization, email, phone, headcount, message, consent_at)
  values
    (p_segment, trim(p_name), trim(p_organization), v_email, nullif(trim(p_phone), ''),
     p_headcount, nullif(trim(p_message), ''), now())
  returning id into v_id;
  return v_id;
end;
$$;

-- Označení poptávky jako vyřízené (nebo zpět). Jen správce platformy.
create function public.set_pilot_request_handled(p_id uuid, p_handled boolean)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.pilot_requests
     set handled_at = case when p_handled then now() end,
         handled_by = case when p_handled then (select auth.uid()) end
   where id = p_id;
end;
$$;

revoke all on function
  public.submit_pilot_request(public.pilot_segment, text, text, text, text, integer, text),
  public.set_pilot_request_handled(uuid, boolean),
  app.pilot_retention()
from public, anon, authenticated;

grant execute on function
  public.submit_pilot_request(public.pilot_segment, text, text, text, text, integer, text)
to service_role;
grant execute on function public.set_pilot_request_handled(uuid, boolean) to authenticated;
