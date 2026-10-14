create role mazi_app nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
create schema mazi;
revoke all on schema mazi from public, anon, authenticated;
grant usage on schema mazi to mazi_app;
alter default privileges for role postgres in schema mazi revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema mazi revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema mazi revoke all on sequences from public, anon, authenticated;
grant connect on database postgres to mazi_app;
