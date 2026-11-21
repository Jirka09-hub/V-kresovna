-- Základ databáze Výkresovny.
-- Schéma `app` pro pomocné funkce RLS (nejsou vystavené přes API).
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, anon, service_role;

comment on schema app is 'Pomocné funkce pro RLS politiky Výkresovny (není vystaveno přes Data API).';
