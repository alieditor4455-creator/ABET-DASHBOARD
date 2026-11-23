-- ABET Content OS update 1: Claude connector sign-in. Safe: adds new pieces only, keeps all data.
begin;
-- Sign-in for the Claude connector (OAuth 2.1 authorization code + PKCE).
-- The person signs in on the ABET site; a one-time code (valid 5 minutes, single use)
-- is handed to Claude, which exchanges it for a Supabase session. Claude then acts as
-- that person, so every row-level security rule still applies.

create table if not exists public.oauth_codes (
  code_hash text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  refresh_token text not null,
  code_challenge text not null,
  redirect_uri text not null,
  client_id text,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.oauth_codes enable row level security;
-- No policies: only the two functions below can touch this table.
revoke all on public.oauth_codes from anon, authenticated;

create or replace function public.oauth_redirect_allowed(p_redirect text) returns boolean
language sql immutable as $$
  select p_redirect ~ '^https://(claude\.ai|claude\.com)/api/mcp/auth_callback$'
      or p_redirect ~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?/'
$$;

-- Called by a signed-in, active team member while approving the connection.
create or replace function public.create_oauth_code(p_refresh_token text, p_code_challenge text, p_redirect_uri text, p_client_id text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_code text;
begin
  if auth.uid() is null or not public.is_member() then raise exception 'Sign in with an active ABET account first'; end if;
  if not public.oauth_redirect_allowed(p_redirect_uri) then raise exception 'This app is not allowed to connect'; end if;
  if coalesce(p_code_challenge, '') !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'Invalid code challenge'; end if;
  delete from public.oauth_codes where created_at < now() - interval '10 minutes';
  v_code := encode(gen_random_bytes(32), 'hex');
  insert into public.oauth_codes (code_hash, user_id, refresh_token, code_challenge, redirect_uri, client_id)
  values (encode(digest(v_code, 'sha256'), 'hex'), auth.uid(), p_refresh_token, p_code_challenge, p_redirect_uri, p_client_id);
  insert into public.activity (actor_id, via, message) values (auth.uid(), 'app', 'connected Claude to ABET Content OS');
  return v_code;
end $$;

-- Called by the connector's token endpoint. Returns the session refresh token once.
create or replace function public.redeem_oauth_code(p_code text, p_code_verifier text, p_redirect_uri text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare r public.oauth_codes; v_challenge text;
begin
  select * into r from public.oauth_codes where code_hash = encode(digest(coalesce(p_code, ''), 'sha256'), 'hex') for update;
  if r.code_hash is null or r.used or r.created_at < now() - interval '5 minutes' then raise exception 'invalid_grant'; end if;
  if r.redirect_uri <> p_redirect_uri then raise exception 'invalid_grant'; end if;
  v_challenge := rtrim(translate(encode(digest(coalesce(p_code_verifier, ''), 'sha256'), 'base64'), '+/', '-_'), '=');
  if v_challenge <> r.code_challenge then raise exception 'invalid_grant'; end if;
  update public.oauth_codes set used = true, refresh_token = '' where code_hash = r.code_hash;
  return r.refresh_token;
end $$;

revoke all on function public.create_oauth_code(text, text, text, text) from public, anon;
grant execute on function public.create_oauth_code(text, text, text, text) to authenticated;
revoke all on function public.redeem_oauth_code(text, text, text) from public;
grant execute on function public.redeem_oauth_code(text, text, text) to anon, authenticated;

-- Lets the connector record that an action came from Claude.
create or replace function public.log_claude_activity(p_message text, p_item_id uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into public.activity (item_id, actor_id, via, message)
  select p_item_id, auth.uid(), 'claude', left(p_message, 500) where public.is_member();
$$;
revoke all on function public.log_claude_activity(text, uuid) from public, anon;
grant execute on function public.log_claude_activity(text, uuid) to authenticated;

commit;
