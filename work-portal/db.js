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
    };
  }

  window.WP_DB = url && key ? remoteDB() : localDB();
})();
