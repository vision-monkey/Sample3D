-- 단체 기능: 초대 코드로 가입하는 비공개 단체, 단체 전용 그룹·멤버·순위
-- supabase-diff.sql 까지 실행한 DB에서 SQL Editor에 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전하며, 기존 기록은 그대로 전체 공개 순위에 남습니다.
--
-- 구조
--  * orgs         : 단체 (초대 코드는 관리자에게 보여주기 위해 원문, 관리자 코드는 해시로 저장)
--  * org_groups   : 단체 관리자가 만든 그룹 목록
--  * org_members  : 멤버 (브라우저에 저장되는 멤버 토큰의 해시만 저장)
--  * records.org_id : 단체 기록이면 단체 ID, 기존/전체 공개 기록은 NULL
--  * 단체 기록은 테이블 조회로는 보이지 않고, 멤버 토큰을 확인하는 함수로만 읽고 씁니다.
--  * 모든 테이블은 사이트에서 직접 읽거나 쓸 수 없습니다.

-- ---------------------------------------------------------------- 공용 도우미
create or replace function public.wp_games() returns text[]
language sql immutable as $$
  select array['report','risk','budget','approve','inbox','settle','urgent','match','pipeline','order','risk_hard','dodge','diff']
$$;

create or replace function public.wp_hash(t text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(coalesce(t, ''), 'UTF8')), 'hex')
$$;

-- 헷갈리는 글자(0/O, 1/I/L)를 뺀 대문자·숫자 코드
create or replace function public.wp_code(n int) returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  hex text := '';
  out text := '';
begin
  while length(hex) < n * 2 loop
    hex := hex || replace(gen_random_uuid()::text, '-', '');
  end loop;
  for i in 0 .. n - 1 loop
    out := out || substr(alphabet, (('x' || substr(hex, i * 2 + 1, 2))::bit(8)::int % length(alphabet)) + 1, 1);
  end loop;
  return out;
end $$;

-- 이름/그룹명 검사 (길이 + 금칙어)
create or replace function public.wp_label_ok(t text, max_len int) returns boolean
language sql immutable as $$
  select btrim(coalesce(t, '')) <> '' and char_length(btrim(t)) <= max_len and not public.wp_has_bad_word(t)
$$;

-- 게임별 점수 범위 검사 (submit_record / submit_org_record 공용)
create or replace function public.wp_score_ok(p_game text, p_score double precision, el double precision) returns boolean
language sql immutable as $$
  select coalesce(case p_game
    when 'report'    then p_score > 0    and p_score <= 1200   and el >= 15000 / p_score
    when 'risk'      then p_score >= 1   and p_score <= el + 1
    when 'budget'    then p_score >= 4   and p_score <= 200000 and el >= p_score / 200
    when 'approve'   then p_score >= 3   and p_score <= 600    and el >= 3
    when 'inbox'     then p_score >= 0   and p_score <= 60     and el >= 39
    when 'settle'    then p_score >= 1   and p_score <= 50     and el >= 59
    when 'urgent'    then p_score >= 100 and p_score <= 5000   and el >= 7
    when 'match'     then p_score >= 4   and p_score <= el + 1
    when 'pipeline'  then p_score >= 1   and p_score <= 357    and el >= p_score * 0.06
    when 'order'     then p_score >= 1   and p_score <= 60     and el >= 0.15 * p_score * p_score
    when 'risk_hard' then p_score >= 20  and p_score <= el + 1
    when 'dodge'     then p_score >= 1   and p_score <= 1800   and p_score <= el + 1
    when 'diff'      then p_score >= 15  and p_score <= 3600   and el >= 15
  end, false)
$$;

-- IP별 횟수 제한 (허용되면 기록하고 true)
create table if not exists public.rate_events (
  id   bigint generated always as identity primary key,
  ip   text        not null,
  kind text        not null,
  at   timestamptz not null default now()
);
create index if not exists rate_events_idx on public.rate_events (ip, kind, at desc);
alter table public.rate_events enable row level security;
revoke all on public.rate_events from anon, authenticated;

create or replace function public.wp_rate_ok(p_kind text, p_limit int, p_window interval) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_ip text := wp_client_ip();
begin
  if (select count(*) from rate_events where ip = v_ip and kind = p_kind and at > now() - p_window) >= p_limit then
    return false;
  end if;
  insert into rate_events (ip, kind) values (v_ip, p_kind);
  if random() < 0.02 then
    delete from rate_events where at < now() - interval '1 day';
  end if;
  return true;
end $$;

-- ---------------------------------------------------------------- 테이블
create table if not exists public.orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null check (char_length(name) between 1 and 30),
  invite_code text        not null unique,
  admin_hash  text        not null,
  created_at  timestamptz not null default now()
);
create table if not exists public.org_groups (
  id     bigint generated always as identity primary key,
  org_id uuid not null references public.orgs (id) on delete cascade,
  name   text not null check (char_length(name) between 1 and 20),
  unique (org_id, name)
);
create table if not exists public.org_members (
  id         bigint generated always as identity primary key,
  org_id     uuid        not null references public.orgs (id) on delete cascade,
  token_hash text        not null unique,
  name       text        not null check (char_length(name) between 1 and 16),
  group_name text        not null default '무소속' check (char_length(group_name) between 1 and 20),
  is_admin   boolean     not null default false,
  joined_at  timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index if not exists org_members_org_idx on public.org_members (org_id);

alter table public.orgs enable row level security;
alter table public.org_groups enable row level security;
alter table public.org_members enable row level security;
revoke all on public.orgs, public.org_groups, public.org_members from anon, authenticated;

-- 기록에 단체 표시 (기존 기록은 NULL = 전체 공개)
alter table public.records add column if not exists org_id uuid references public.orgs (id) on delete cascade;
alter table public.records add column if not exists member_id bigint references public.org_members (id) on delete set null;
create index if not exists records_org_idx on public.records (org_id, game_id, score);

-- 전체 공개 순위에는 단체 기록이 보이지 않게
drop policy if exists "records are readable" on public.records;
drop policy if exists "public records are readable" on public.records;
create policy "public records are readable"
  on public.records for select
  to anon, authenticated
  using (org_id is null);

-- ---------------------------------------------------------------- 기존 함수 정리 (게임 목록·점수 검사 공용화)
create or replace function public.start_session(p_game text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ip text := wp_client_ip();
  v_id uuid;
begin
  if not (p_game = any (wp_games())) then
    raise exception 'invalid_game';
  end if;
  if (select count(*) from game_sessions where ip = v_ip and started_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited';
  end if;
  delete from game_sessions where started_at < now() - interval '1 day';
  insert into game_sessions (game_id, ip) values (p_game, v_ip) returning id into v_id;
  return v_id;
end $$;

-- 세션 확인 공용: 유효하면 세션을 반환하고 서버가 잰 경과 시간을 함께 돌려준다
create or replace function public.wp_take_session(p_session uuid, p_score double precision, out s public.game_sessions, out el double precision)
language plpgsql security definer set search_path = public as $$
declare v_ip text := wp_client_ip();
begin
  select * into s from game_sessions where id = p_session for update;
  if not found or s.used_at is not null or s.started_at < now() - interval '3 hours' then
    raise exception 'invalid_session';
  end if;
  if (select count(*) from game_sessions where ip = v_ip and used_at > now() - interval '1 minute') >= 10 then
    raise exception 'rate_limited';
  end if;
  el := extract(epoch from now() - s.started_at);
  if wp_score_ok(s.game_id, p_score, el) is not true then
    raise exception 'invalid_score';
  end if;
end $$;

create or replace function public.submit_record(p_session uuid, p_name text, p_group text, p_score double precision)
returns json
language plpgsql security definer set search_path = public as $$
declare
  t       record;
  v_name  text := btrim(coalesce(p_name, ''));
  v_group text := coalesce(nullif(btrim(coalesce(p_group, '')), ''), '무소속');
  r       records;
begin
  if not wp_label_ok(v_name, 16) or not wp_label_ok(v_group, 20) then
    raise exception 'bad_name';
  end if;
  t := wp_take_session(p_session, p_score);
  update game_sessions set used_at = now() where id = (t.s).id;
  insert into records (game_id, name, group_name, score)
    values ((t.s).game_id, v_name, v_group, p_score)
    returning * into r;
  return row_to_json(r);
end $$;

create or replace function public.track(p_kind text, p_game text, p_visitor text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('visit', 'play', 'record')
     or (p_game is not null and not (p_game = any (wp_games())))
     or p_visitor is null or p_visitor !~ '^[A-Za-z0-9_-]{8,40}$' then
    return;
  end if;
  if (select count(*) from events where visitor = p_visitor and created_at > now() - interval '1 minute') >= 60 then
    return;
  end if;
  insert into events (kind, game_id, visitor) values (p_kind, p_game, p_visitor);
  if random() < 0.01 then
    delete from events where created_at < now() - interval '13 months';
  end if;
end $$;

-- ---------------------------------------------------------------- 단체 함수
-- 멤버 토큰 확인 (실패 시 not_member)
create or replace function public.wp_member(p_token text) returns public.org_members
language plpgsql security definer set search_path = public as $$
declare m org_members;
begin
  select * into m from org_members where token_hash = wp_hash(p_token);
  if not found then
    raise exception 'not_member';
  end if;
  if m.last_seen < now() - interval '10 minutes' then
    update org_members set last_seen = now() where id = m.id;
  end if;
  return m;
end $$;

create or replace function public.wp_require_admin(p_token text) returns public.org_members
language plpgsql security definer set search_path = public as $$
declare m org_members := wp_member(p_token);
begin
  if not m.is_admin then
    raise exception 'not_admin';
  end if;
  return m;
end $$;

create or replace function public.org_info(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare
  m org_members := wp_member(p_token);
  o orgs;
begin
  select * into o from orgs where id = m.org_id;
  return json_build_object(
    'org_id', o.id,
    'org_name', o.name,
    'me', json_build_object('id', m.id, 'name', m.name, 'group', m.group_name, 'is_admin', m.is_admin),
    'groups', coalesce((select json_agg(name order by name) from org_groups where org_id = o.id), '[]'::json),
    'members', (select count(*) from org_members where org_id = o.id),
    'invite_code', case when m.is_admin then o.invite_code end
  );
end $$;

create or replace function public.org_create(p_name text, p_member_name text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_name   text := btrim(coalesce(p_name, ''));
  v_member text := btrim(coalesce(p_member_name, ''));
  v_invite text;
  v_admin  text;
  v_token  text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_org    uuid;
begin
  if not wp_label_ok(v_name, 30) or not wp_label_ok(v_member, 16) then
    raise exception 'bad_name';
  end if;
  if not wp_rate_ok('org_create', 5, interval '1 hour') then
    raise exception 'rate_limited';
  end if;
  loop
    v_invite := wp_code(4) || '-' || wp_code(4);
    exit when not exists (select 1 from orgs where invite_code = v_invite);
  end loop;
  v_admin := wp_code(4) || '-' || wp_code(4) || '-' || wp_code(4);
  insert into orgs (name, invite_code, admin_hash) values (v_name, v_invite, wp_hash(v_admin)) returning id into v_org;
  insert into org_members (org_id, token_hash, name, is_admin) values (v_org, wp_hash(v_token), v_member, true);
  return json_build_object('token', v_token, 'org_name', v_name, 'invite_code', v_invite, 'admin_code', v_admin);
end $$;

create or replace function public.org_join(p_invite text, p_member_name text) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_member text := btrim(coalesce(p_member_name, ''));
  v_token  text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  o        orgs;
begin
  if not wp_label_ok(v_member, 16) then
    raise exception 'bad_name';
  end if;
  -- 성공·실패 모두 횟수에 포함 (초대 코드 무작위 대입 방지)
  if not wp_rate_ok('org_join', 20, interval '1 hour') then
    raise exception 'rate_limited';
  end if;
  select * into o from orgs where invite_code = upper(btrim(coalesce(p_invite, '')));
  if not found then
    raise exception 'invalid_invite';
  end if;
  if (select count(*) from org_members where org_id = o.id) >= 500 then
    raise exception 'org_full';
  end if;
  insert into org_members (org_id, token_hash, name) values (o.id, wp_hash(v_token), v_member);
  return json_build_object('token', v_token, 'org_name', o.name);
end $$;

create or replace function public.org_update_me(p_token text, p_name text, p_group text) returns json
language plpgsql security definer set search_path = public as $$
declare
  m       org_members := wp_member(p_token);
  v_name  text := btrim(coalesce(p_name, ''));
  v_group text := coalesce(nullif(btrim(coalesce(p_group, '')), ''), '무소속');
begin
  if not wp_label_ok(v_name, 16) then
    raise exception 'bad_name';
  end if;
  if v_group <> '무소속' and not exists (select 1 from org_groups where org_id = m.org_id and name = v_group) then
    raise exception 'invalid_group';
  end if;
  update org_members set name = v_name, group_name = v_group where id = m.id;
  return org_info(p_token);
end $$;

create or replace function public.org_leave(p_token text) returns void
language plpgsql security definer set search_path = public as $$
declare m org_members := wp_member(p_token);
begin
  delete from org_members where id = m.id;
end $$;

create or replace function public.org_claim_admin(p_token text, p_admin_code text) returns json
language plpgsql security definer set search_path = public as $$
declare m org_members := wp_member(p_token);
begin
  if not wp_rate_ok('org_admin', 10, interval '1 hour') then
    raise exception 'rate_limited';
  end if;
  if not exists (select 1 from orgs where id = m.org_id and admin_hash = wp_hash(upper(btrim(coalesce(p_admin_code, ''))))) then
    raise exception 'invalid_admin_code';
  end if;
  update org_members set is_admin = true where id = m.id;
  return org_info(p_token);
end $$;

create or replace function public.org_group_add(p_token text, p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare
  m      org_members := wp_require_admin(p_token);
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not wp_label_ok(v_name, 20) or v_name = '무소속' then
    raise exception 'bad_name';
  end if;
  if (select count(*) from org_groups where org_id = m.org_id) >= 50 then
    raise exception 'too_many_groups';
  end if;
  insert into org_groups (org_id, name) values (m.org_id, v_name) on conflict do nothing;
  return org_info(p_token);
end $$;

-- 그룹을 지우면 그 그룹 멤버는 무소속이 된다 (이미 등록된 기록의 그룹명은 그대로)
create or replace function public.org_group_remove(p_token text, p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare m org_members := wp_require_admin(p_token);
begin
  delete from org_groups where org_id = m.org_id and name = p_name;
  update org_members set group_name = '무소속' where org_id = m.org_id and group_name = p_name;
  return org_info(p_token);
end $$;

create or replace function public.org_member_list(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare m org_members := wp_require_admin(p_token);
begin
  return coalesce((
    select json_agg(json_build_object(
      'id', x.id, 'name', x.name, 'group', x.group_name, 'is_admin', x.is_admin,
      'joined_at', x.joined_at, 'last_seen', x.last_seen,
      'records', (select count(*) from records r where r.member_id = x.id)
    ) order by x.joined_at)
    from org_members x where x.org_id = m.org_id
  ), '[]'::json);
end $$;

-- 멤버 내보내기 (그 멤버의 기록은 단체 순위에 남는다)
create or replace function public.org_member_remove(p_token text, p_member_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare m org_members := wp_require_admin(p_token);
begin
  if p_member_id = m.id then
    raise exception 'cannot_remove_self';
  end if;
  delete from org_members where id = p_member_id and org_id = m.org_id;
  return org_member_list(p_token);
end $$;

create or replace function public.org_reset_invite(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare
  m        org_members := wp_require_admin(p_token);
  v_invite text;
begin
  loop
    v_invite := wp_code(4) || '-' || wp_code(4);
    exit when not exists (select 1 from orgs where invite_code = v_invite);
  end loop;
  update orgs set invite_code = v_invite where id = m.org_id;
  return org_info(p_token);
end $$;

-- 단체 기록 조회 ------------------------------------------------------------
create or replace function public.org_top(p_token text, p_game text, p_limit int, p_desc boolean, p_group text default null) returns json
language plpgsql security definer set search_path = public as $$
declare m org_members := wp_member(p_token);
begin
  return coalesce((
    select json_agg(row_to_json(t)) from (
      select id, game_id, name, group_name, score, created_at
      from records
      where org_id = m.org_id and game_id = p_game and (p_group is null or group_name = p_group)
      order by case when p_desc then -score else score end, created_at
      limit least(greatest(p_limit, 1), 100)
    ) t
  ), '[]'::json);
end $$;

create or replace function public.org_rank(p_token text, p_game text, p_score double precision, p_desc boolean) returns json
language plpgsql security definer set search_path = public as $$
declare m org_members := wp_member(p_token);
begin
  return json_build_object(
    'better', (select count(*) from records where org_id = m.org_id and game_id = p_game
                and case when p_desc then score >= p_score else score <= p_score end),
    'total', (select count(*) from records where org_id = m.org_id and game_id = p_game)
  );
end $$;

create or replace function public.org_recent(p_token text, p_limit int) returns json
language plpgsql security definer set search_path = public as $$
declare m org_members := wp_member(p_token);
begin
  return coalesce((
    select json_agg(row_to_json(t)) from (
      select id, game_id, name, group_name, score, created_at
      from records where org_id = m.org_id
      order by created_at desc
      limit least(greatest(p_limit, 1), 5000)
    ) t
  ), '[]'::json);
end $$;

create or replace function public.org_total(p_token text) returns bigint
language plpgsql security definer set search_path = public as $$
declare m org_members := wp_member(p_token);
begin
  return (select count(*) from records where org_id = m.org_id);
end $$;

-- 단체 기록 등록: 이름·그룹은 멤버 정보에서 가져온다
create or replace function public.submit_org_record(p_session uuid, p_token text, p_score double precision) returns json
language plpgsql security definer set search_path = public as $$
declare
  m org_members := wp_member(p_token);
  t record;
  r records;
begin
  t := wp_take_session(p_session, p_score);
  update game_sessions set used_at = now() where id = (t.s).id;
  insert into records (game_id, name, group_name, score, org_id, member_id)
    values ((t.s).game_id, m.name, m.group_name, p_score, m.org_id, m.id)
    returning * into r;
  return row_to_json(r);
end $$;

-- ---------------------------------------------------------------- 권한
do $$
declare f text;
begin
  foreach f in array array[
    'org_info(text)', 'org_create(text, text)', 'org_join(text, text)', 'org_update_me(text, text, text)',
    'org_leave(text)', 'org_claim_admin(text, text)', 'org_group_add(text, text)', 'org_group_remove(text, text)',
    'org_member_list(text)', 'org_member_remove(text, bigint)', 'org_reset_invite(text)',
    'org_top(text, text, int, boolean, text)', 'org_rank(text, text, double precision, boolean)',
    'org_recent(text, int)', 'org_total(text)', 'submit_org_record(uuid, text, double precision)',
    'start_session(text)', 'submit_record(uuid, text, text, double precision)', 'track(text, text, text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
  -- 내부 도우미는 사이트에서 직접 부를 수 없게
  foreach f in array array[
    'wp_rate_ok(text, int, interval)', 'wp_member(text)', 'wp_require_admin(text)',
    'wp_take_session(uuid, double precision)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
