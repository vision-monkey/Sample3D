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
      async top(g, limit) {
        return read(g.id).sort(cmp(g)).slice(0, limit).map((r) => norm(g.id, r));
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

    return {
      mode: 'remote',
      top(g, limit) {
        return get(`select=*&game_id=eq.${g.id}&${order(g)}&limit=${limit}`);
      },
      async rankOf(g, score) {
        const [better, all] = await Promise.all([
          count(`game_id=eq.${g.id}&score=${g.higher ? 'gte' : 'lte'}.${score}`),
          count(`game_id=eq.${g.id}`),
        ]);
        return { rank: better + 1, total: all + 1 };
      },
      async add(g, name, group, score) {
        // 순위 조회가 실패해도 등록은 진행한다
        const rank = await this.rankOf(g, score).then((r) => r.rank, () => null);
        const post = (body) =>
          fetch(base, {
            method: 'POST',
            headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
            body: JSON.stringify(body),
          });
        let res = await post({ game_id: g.id, name, group_name: group, score });
        // group_name 컬럼 추가(supabase.sql) 전의 DB라면 그룹 없이 등록한다
        if (res.status === 400) res = await post({ game_id: g.id, name, score });
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
    };
  }

  window.WP_DB = url && key ? remoteDB() : localDB();
})();
