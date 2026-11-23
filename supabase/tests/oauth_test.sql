-- OAuth code tests (run after permissions_test.sql in the same database).
\set ON_ERROR_STOP 0
create table pg_temp.r2 (name text, ok boolean);
grant all on pg_temp.r2 to authenticated, anon;
create or replace function pg_temp.c2(name text, stmt text, expect_error boolean) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin execute stmt; exception when others then failed := true; msg := sqlerrm; end;
  insert into pg_temp.r2 values (name, failed = expect_error);
  raise notice '% % %', case when failed = expect_error then 'PASS' else 'FAIL' end, name, coalesce('('||msg||')','');
end $$;

-- verifier "abc...": challenge = base64url(sha256(verifier))
select set_config('t.verifier', 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', false);
select set_config('t.challenge', 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', false);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
set role authenticated;
select pg_temp.c2('member creates code', $q$ select set_config('t.code', public.create_oauth_code('refresh-abc', current_setting('t.challenge'), 'https://claude.ai/api/mcp/auth_callback', 'c1'), false) $q$, false);
select pg_temp.c2('rejects foreign redirect', $q$ select public.create_oauth_code('r', current_setting('t.challenge'), 'https://evil.example/cb', 'c1') $q$, true);
select pg_temp.c2('member sees no stored codes', $q$ do $d$ declare n int; begin begin select count(*) into n from public.oauth_codes; exception when insufficient_privilege then n := 0; end; if n > 0 then raise exception 'leak'; end if; end $d$ $q$, false);
select pg_temp.c2('claude activity logged', $q$ select public.log_claude_activity('saved a script') $q$, false);
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.c2('anon cannot create code', $q$ select public.create_oauth_code('r', current_setting('t.challenge'), 'https://claude.ai/api/mcp/auth_callback', 'c1') $q$, true);
select pg_temp.c2('wrong verifier rejected', $q$ select public.redeem_oauth_code(current_setting('t.code'), 'wrong-verifier', 'https://claude.ai/api/mcp/auth_callback') $q$, true);
select pg_temp.c2('wrong redirect rejected', $q$ select public.redeem_oauth_code(current_setting('t.code'), current_setting('t.verifier'), 'https://claude.com/api/mcp/auth_callback') $q$, true);
select pg_temp.c2('correct redeem returns token', $q$ do $d$ begin if public.redeem_oauth_code(current_setting('t.code'), current_setting('t.verifier'), 'https://claude.ai/api/mcp/auth_callback') <> 'refresh-abc' then raise exception 'bad'; end if; end $d$ $q$, false);
select pg_temp.c2('code is single use', $q$ select public.redeem_oauth_code(current_setting('t.code'), current_setting('t.verifier'), 'https://claude.ai/api/mcp/auth_callback') $q$, true);
reset role;
select pg_temp.c2('token wiped after use', $q$ do $d$ begin if exists (select 1 from public.oauth_codes where refresh_token <> '') then raise exception 'kept'; end if; end $d$ $q$, false);

select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from pg_temp.r2;
