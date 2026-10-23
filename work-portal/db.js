// 실적(기록) 저장소.
// config.js에 Supabase 주소/키가 있으면 공유 서버에, 없으면 이 브라우저(localStorage)에 저장한다.
// 모든 메서드는 Promise를 반환하며 기록 형식은 { id, gameId, name, group, score, t }.
// 그룹이 없는 기존 기록은 '무소속'으로 취급한다.
(function () {
  'use strict';
  const cfg = window.WP_CONFIG || {};
  const url = (cfg.supabaseUrl || '').replace(/\/+$/, '');
  const key = cfg.supabaseAnonKey || '';
  const TABLE = cfg.table || 'records';
  const NO_GROUP = '무소속';

  // 방문 통계용 브라우저별 임의 ID (개인 식별 정보 아님)
  function visitorId() {
    try {
      let v = localStorage.getItem('wp_vid');
      if (!v) {
        const a = new Uint8Array(12);
        crypto.getRandomValues(a);
        v = 'v' + Array.from(a, (b) => (b % 36).toString(36)).join('');
        localStorage.setItem('wp_vid', v);
      }
      return v;
    } catch (e) {
      return null;
    }
  }

  /* ---------------- 로컬 (브라우저) ---------------- */
  function localDB() {
    const k = (id) => 'wp_rec_' + id;
    const read = (id) => {
      try {
        return JSON.parse(localStorage.getItem(k(id))) || [];
      } catch (e) {
        return [];
      }
    };
    const write = (id, list) => {
      try {
        localStorage.setItem(k(id), JSON.stringify(list));
      } catch (e) { /* 저장 불가 환경은 무시 */ }
    };
    const cmp = (g) => (a, b) => (g.higher ? b.score - a.score : a.score - b.score) || a.t - b.t;
    const norm = (gameId, r) => ({ id: r.id || String(r.t), gameId, name: r.name, group: r.group || NO_GROUP, score: r.score, t: r.t });
    return {
      mode: 'local',
      async startSession() {
        return null;
      },
      track() {},
      // group을 주면 해당 그룹 기록만
      async top(g, limit, group) {
        return read(g.id)
          .map((r) => norm(g.id, r))
          .filter((r) => !group || r.group === group)
          .sort(cmp(g))
          .slice(0, limit);
      },
      async rankOf(g, score) {
        const list = read(g.id);
        const better = list.filter((r) => (g.higher ? r.score >= score : r.score <= score)).length;
        return { rank: better + 1, total: list.length + 1 };
      },
      async add(g, name, group, score) {
        const { rank } = await this.rankOf(g, score);
        const t = Date.now();
        const r = { id: t + '-' + Math.random().toString(36).slice(2, 8), name, group, score, t };
        const list = read(g.id);
        list.push(r);
        write(g.id, list.sort(cmp(g)).slice(0, 100));
        return { id: r.id, rank };
      },
      async recent(games, n) {
        return games
          .flatMap((g) => read(g.id).map((r) => norm(g.id, r)))
          .sort((a, b) => b.t - a.t)
          .slice(0, n);
      },
      async total(games) {
        return games.reduce((s, g) => s + read(g.id).length, 0);
      },
      // 그룹 집계용 전체 기록
      async all(games) {
        return games.flatMap((g) => read(g.id).map((r) => norm(g.id, r)));
      },
    };
  }

  /* ---------------- 공유 서버 (Supabase REST) ---------------- */
  function remoteDB() {
    const base = `${url}/rest/v1/${TABLE}`;
    // 레거시 anon 키(JWT)는 Authorization에도 넣고, 새 publishable 키(sb_publishable_...)는 apikey만 보낸다.
    const auth = key.startsWith('eyJ') ? { Authorization: 'Bearer ' + key } : {};
    const headers = (extra) => Object.assign({ apikey: key }, auth, extra);
    const norm = (r) => ({ id: String(r.id), gameId: r.game_id, name: r.name, group: r.group_name || NO_GROUP, score: Number(r.score), t: Date.parse(r.created_at) });

    async function get(qs) {
      const res = await fetch(`${base}?${qs}`, { headers: headers() });
      if (!res.ok) throw new Error('조회 실패 (' + res.status + ')');
      return (await res.json()).map(norm);
    }
    async function count(qs) {
      const res = await fetch(`${base}?select=id${qs ? '&' + qs : ''}`, {
        method: 'HEAD',
        headers: headers({ Prefer: 'count=exact' }),
      });
      if (!res.ok) throw new Error('조회 실패 (' + res.status + ')');
      const cr = res.headers.get('content-range') || '';
      return parseInt(cr.split('/')[1], 10) || 0;
    }
    const order = (g) => `order=score.${g.higher ? 'desc' : 'asc'},created_at.asc`;

    // supabase-secure.sql 의 함수 호출. 실패 시 status/code/서버 메시지를 담은 에러를 던진다.
    async function rpc(fn, body) {
      const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const e = new Error((data && data.message) || 'HTTP ' + res.status);
        e.status = res.status;
        throw e;
      }
      return data;
    }
    const REJECT = {
      invalid_score: '비정상적인 기록으로 판단되어 등록할 수 없습니다.',
      bad_name: '사용할 수 없는 단어가 들어간 이름 또는 그룹명입니다.',
      rate_limited: '등록이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
      invalid_session: '플레이 정보가 만료되었습니다. 다시 플레이해 주세요.',
    };
    const friendly = (e) => {
      if (!REJECT[e.message]) return e;
      const f = new Error(REJECT[e.message]);
      f.friendly = true;
      return f;
    };

    return {
      mode: 'remote',
      top(g, limit, group) {
        const gq = group ? `&group_name=eq.${encodeURIComponent(group)}` : '';
        return get(`select=*&game_id=eq.${g.id}${gq}&${order(g)}&limit=${limit}`);
      },
      async rankOf(g, score) {
        const [better, all] = await Promise.all([
          count(`game_id=eq.${g.id}&score=${g.higher ? 'gte' : 'lte'}.${score}`),
          count(`game_id=eq.${g.id}`),
        ]);
        return { rank: better + 1, total: all + 1 };
      },
      // 방문/플레이/등록 통계 (supabase-stats.sql). 실패해도 무시한다.
      track(kind, gameId) {
        const v = visitorId();
        if (v) rpc('track', { p_kind: kind, p_game: gameId || null, p_visitor: v }).catch(() => {});
      },
      // 게임 시작 시 서버에 플레이 세션을 연다. 보안 SQL 적용 전 DB면 null.
      startSession(g) {
        return rpc('start_session', { p_game: g.id }).catch(() => null);
      },
      async add(g, name, group, score, session) {
        // 순위 조회가 실패해도 등록은 진행한다
        const rank = await this.rankOf(g, score).then((r) => r.rank, () => null);
        if (session) {
          try {
            const row = await rpc('submit_record', { p_session: session, p_name: name, p_group: group, p_score: score });
            return { id: String(row.id), rank };
          } catch (e) {
            if (e.status !== 404) throw friendly(e);
            // 함수가 없으면(보안 SQL 적용 전) 아래 직접 등록으로 진행
          }
        }
        const post = (body) =>
          fetch(base, {
            method: 'POST',
            headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
            body: JSON.stringify(body),
          });
        let res = await post({ game_id: g.id, name, group_name: group, score });
        // group_name 컬럼 추가(supabase.sql) 전의 DB라면 그룹 없이 등록한다
        if (res.status === 400) res = await post({ game_id: g.id, name, score });
        if (res.status === 401 || res.status === 403) {
          const f = new Error('보안 확인을 시작하지 못했습니다. 새로고침 후 다시 플레이해 주세요.');
          f.friendly = true;
          throw f;
        }
        if (!res.ok) throw new Error('등록 실패 (' + res.status + ')');
        const [row] = await res.json();
        return { id: String(row.id), rank };
      },
      recent(games, n) {
        return get(`select=*&order=created_at.desc&limit=${n}`);
      },
      total() {
        return count('');
      },
      // 그룹 집계용: 최근 기록 최대 5,000건
      all() {
        return get('select=*&order=created_at.desc&limit=5000');
      },
      // 단체 기능에서 재사용
      _rpc: rpc,
      _norm: norm,
      _friendly: friendly,
    };
  }

  /* ---------------- 단체 (supabase-org.sql) ---------------- */
  const ORG_ERRORS = {
    invalid_invite: '초대 코드가 올바르지 않습니다.',
    not_member: '단체 멤버가 아닙니다. 탈퇴했거나 관리자가 내보냈을 수 있습니다.',
    not_admin: '단체 관리자만 할 수 있습니다.',
    invalid_admin_code: '관리자 코드가 올바르지 않습니다.',
    invalid_group: '단체에 없는 그룹입니다.',
    too_many_groups: '그룹은 최대 50개까지 만들 수 있습니다.',
    org_full: '단체 인원이 가득 찼습니다 (최대 500명).',
    cannot_remove_self: '자기 자신은 내보낼 수 없습니다. 단체 나가기를 이용하세요.',
    bad_name: '사용할 수 없는 이름입니다. 비어 있거나 너무 길거나 금칙어가 들어 있습니다.',
    rate_limited: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
  };
  const fail = (msg, extra) => Object.assign(new Error(msg), { friendly: true }, extra);
  const orgError = (e) => {
    if (ORG_ERRORS[e.message]) return fail(ORG_ERRORS[e.message], { code: e.message });
    if (e.status === 404) return fail('단체 기능이 아직 준비되지 않았습니다. (supabase-org.sql 실행 필요)', { code: 'not_ready' });
    return e;
  };

  // 단체 범위의 기록 저장소: 전체 공개 저장소와 같은 모양으로 동작한다
  function orgDB(base, token) {
    const call = (fn, body) => base._rpc(fn, Object.assign({ p_token: token }, body)).catch((e) => Promise.reject(orgError(e)));
    const rows = (list) => (list || []).map(base._norm);
    return {
      top(g, limit, group) {
        return call('org_top', { p_game: g.id, p_limit: limit, p_desc: g.higher, p_group: group || null }).then(rows);
      },
      async rankOf(g, score) {
        const r = await call('org_rank', { p_game: g.id, p_score: score, p_desc: g.higher });
        return { rank: r.better + 1, total: r.total + 1 };
      },
      // 이름·그룹은 서버의 멤버 정보로 등록된다
      async add(g, name, group, score, session) {
        const rank = await this.rankOf(g, score).then((r) => r.rank, () => null);
        if (!session) throw fail('보안 확인을 시작하지 못했습니다. 새로고침 후 다시 플레이해 주세요.');
        try {
          const row = await base._rpc('submit_org_record', { p_session: session, p_token: token, p_score: score });
          return { id: String(row.id), rank };
        } catch (e) {
          const oe = orgError(e);
          throw oe.friendly ? oe : base._friendly(e);
        }
      },
      recent(games, n) {
        return call('org_recent', { p_limit: n }).then(rows);
      },
      total() {
        return call('org_total', {});
      },
      all() {
        return call('org_recent', { p_limit: 5000 }).then(rows);
      },
    };
  }

  const base = url && key ? remoteDB() : localDB();
  const ls = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    set(k, v) {
      try {
        v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
      } catch (e) { /* 저장 불가 환경은 무시 */ }
    },
  };
  const token = () => ls.get('wp_org_token');
  let scope = ls.get('wp_scope') === 'org' ? 'org' : 'public';
  const active = () => (scope === 'org' && token() && base.mode === 'remote' ? orgDB(base, token()) : base);

  const orgCall = (fn, body) => {
    if (base.mode !== 'remote') return Promise.reject(fail('단체 기능은 공유 서버에 연결되어 있을 때만 쓸 수 있습니다.'));
    return base._rpc(fn, body).catch((e) => Promise.reject(orgError(e)));
  };
  const withToken = (fn, body) => orgCall(fn, Object.assign({ p_token: token() }, body));
  const saveToken = (r) => {
    ls.set('wp_org_token', r.token);
    scope = 'org';
    ls.set('wp_scope', 'org');
    return r;
  };

  const api = {
    get mode() {
      return base.mode;
    },
    // 'org' 이면 순위 조회·기록 등록이 내 단체 범위로 동작한다
    get scope() {
      return scope === 'org' && token() && base.mode === 'remote' ? 'org' : 'public';
    },
    setScope(s) {
      scope = s === 'org' ? 'org' : 'public';
      ls.set('wp_scope', scope);
    },
    startSession: (g) => base.startSession(g),
    track: (kind, gameId) => base.track(kind, gameId),
    org: {
      get available() {
        return base.mode === 'remote';
      },
      get joined() {
        return !!token();
      },
      info: () => withToken('org_info', {}),
      create: (name, member) => orgCall('org_create', { p_name: name, p_member_name: member }).then(saveToken),
      join: (invite, member) => orgCall('org_join', { p_invite: invite, p_member_name: member }).then(saveToken),
      updateMe: (name, group) => withToken('org_update_me', { p_name: name, p_group: group }),
      claimAdmin: (code) => withToken('org_claim_admin', { p_admin_code: code }),
      groupAdd: (name) => withToken('org_group_add', { p_name: name }),
      groupRemove: (name) => withToken('org_group_remove', { p_name: name }),
      members: () => withToken('org_member_list', {}),
      removeMember: (id) => withToken('org_member_remove', { p_member_id: id }),
      resetInvite: () => withToken('org_reset_invite', {}),
      async leave() {
        await withToken('org_leave', {}).catch((e) => {
          if (e.code !== 'not_member') throw e;
        });
        api.org.forget();
      },
      // 이 브라우저의 단체 정보 삭제 (내보내졌을 때 등)
      forget() {
        ls.set('wp_org_token', null);
        scope = 'public';
        ls.set('wp_scope', 'public');
      },
    },
  };
  ['top', 'rankOf', 'add', 'recent', 'total', 'all'].forEach((k) => {
    api[k] = (...args) => {
      const d = active();
      return d[k](...args);
    };
  });
  window.WP_DB = api;
})();
