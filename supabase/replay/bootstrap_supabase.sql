-- Pecas minimas do Supabase que as migrations assumem (papeis anon/authenticated/service_role, schemas extensions e auth com
-- auth.uid()/auth.jwt()/auth.identities e os privilegios padrao do schema public). SO para o replay local (replay.sh); NAO rodar no Supabase.
-- Pecas minimas do Supabase que as migrations assumem (papeis, schemas extensions/auth, privilegios padrao em public).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create schema auth;
create table auth.identities (provider_id text, user_id uuid, identity_data jsonb, provider text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
