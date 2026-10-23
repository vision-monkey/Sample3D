(function () {
  'use strict';

  /* ---------------- 랜덤 아이디 ---------------- */
  const ADJ = [
    '달리는', '졸린', '배고픈', '퇴근하는', '야근하는', '행복한', '수상한', '용감한', '느긋한', '바쁜척하는',
    '출근한', '커피마시는', '멍때리는', '춤추는', '날아가는', '몰래보는', '신난', '우아한', '귀여운', '엉뚱한',
    '조용한', '반짝이는', '뒹구는', '꾸벅이는', '월급받는', '칼퇴하는', '점심먹는', '회의하는', '노래하는', '숨어있는',
  ];
  const NOUN = [
    '만두', '고양이', '감자', '펭귄', '대리', '과장', '부장', '인턴', '판다', '다람쥐',
    '호떡', '김밥', '수달', '두부', '붕어빵', '너구리', '햄스터', '오리', '떡볶이', '고등어',
    '라면', '스테이플러', '복사기', '모니터', '키보드', '결재판', '포스트잇', '탕비실', '단무지', '찐빵',
  ];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const randomName = () => pick(ADJ) + ' ' + pick(NOUN);

  /* ---------------- 저장소 ---------------- */
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) { /* 저장 불가 환경은 무시 */ }
    },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);

  const GAMES = window.WP_GAMES;
  const byId = Object.fromEntries(GAMES.map((g) => [g.id, g]));

  const NO_GROUP = '무소속';
  const getName = () => store.get('wp_name', '');
  function setName(n) {
    store.set('wp_name', n);
    renderUser();
  }
  const getGroup = () => store.get('wp_group', '') || NO_GROUP;
  function setGroup(gr) {
    store.set('wp_group', gr === NO_GROUP ? '' : gr);
    renderUser();
  }
  const cleanGroup = (v) => v.trim().slice(0, 20) || NO_GROUP;

  // 금칙어 (서버 supabase-secure.sql 의 wp_has_bad_word 와 같은 목록)
  const BAD_WORDS = [
    '시발', '씨발', '씨팔', '시팔', '쉬발', 'ㅅㅂ', 'ㅆㅂ', '병신', '븅신', 'ㅂㅅ', '좆', '존나', '졸라', '지랄', 'ㅈㄹ',
    '개새', '새끼', '섀끼', '미친놈', '미친년', '염병', '엠창', '느금', '니애미', '니미럴', '애미', '애비', '썅', '쌍놈', '쌍년',
    '꺼져', '닥쳐', '보지', '자지', '섹스', 'sex', 'fuck', 'shit', 'bitch', 'nigger',
  ];
  const hasBadWord = (t) => {
    const s = String(t).toLowerCase().replace(/[\s\p{P}\p{S}\d]/gu, '');
    return BAD_WORDS.some((w) => s.includes(w));
  };
  // 이름/그룹 입력값 검사. 문제 있으면 오류 문구, 없으면 ''
  const profileError = (name, group) =>
    hasBadWord(name) || hasBadWord(group) ? '사용할 수 없는 단어가 들어 있습니다. 다른 이름이나 그룹명을 입력해 주세요.' : '';
  const groupTag = (gr) => `<span class="grp${gr === NO_GROUP ? ' none' : ''}">${esc(gr)}</span>`;

  // 담당자명 + 그룹명 입력 칸 (설정 창, 실적 등록 창 공용)
  const profileFields = () => `
        <label class="lbl" for="nmInput">담당자명 <span class="muted">(선택 · 미입력 시 랜덤 아이디)</span></label>
        <div class="row">
          <input class="inp" id="nmInput" maxlength="16" autocomplete="off" placeholder="예) ${esc(randomName())}" value="${esc(getName())}" />
          <button class="btn" id="nmRand" title="랜덤 아이디">🎲 랜덤</button>
        </div>
        <label class="lbl" for="grInput">그룹명 <span class="muted">(선택 · 미입력 시 무소속)</span></label>
        <input class="inp full" id="grInput" maxlength="20" autocomplete="off" placeholder="예) 개발1팀, 3층 탕비실파" value="${esc(getGroup() === NO_GROUP ? '' : getGroup())}" />`;

  const DB = window.WP_DB;

  const today = () => new Date().toISOString().slice(0, 10);
  function countPlay() {
    const p = store.get('wp_plays', { d: '', n: 0 });
    store.set('wp_plays', p.d === today() ? { d: p.d, n: p.n + 1 } : { d: today(), n: 1 });
  }
  const playsToday = () => {
    const p = store.get('wp_plays', { d: '', n: 0 });
    return p.d === today() ? p.n : 0;
  };

  function fmtDate(t) {
    const d = new Date(t);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /* ---------------- 상태 ---------------- */
  const main = $('#main');
  let current = null; // 실행 중인 게임 인스턴스
  let bossOn = false;
  let modalOn = false;
  let viewSeq = 0; // 화면 전환 시 증가 → 늦게 도착한 조회 결과는 버린다
  const paused = () => bossOn || modalOn;

  function stopGame() {
    if (current) {
      current.destroy && current.destroy();
      current = null;
    }
  }

  /* ---------------- 레이아웃 ---------------- */
  function renderNav() {
    const items = [
      `<div class="nav-sec">메인</div>`,
      `<a href="#/" data-nav=""><span class="nav-ico">▦</span>대시보드</a>`,
      `<a href="#/ranking" data-nav="ranking"><span class="nav-ico">▲</span>실적 현황</a>`,
      `<a href="#/groups" data-nav="groups"><span class="nav-ico">⚑</span>그룹 대항전</a>`,
      `<div class="nav-sec">업무 모듈</div>`,
      ...GAMES.map((g) => `<a href="#/game/${g.id}" data-nav="game/${g.id}"><span class="nav-code">${g.code.slice(3)}</span>${g.title}</a>`),
    ];
    $('#nav').innerHTML = items.join('');
  }
  function setActiveNav(key) {
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
  }
  function renderUser() {
    const n = getName();
    $('#userName').textContent = n || '게스트';
    $('#userGroup').textContent = getGroup();
    $('#avatar').textContent = n ? n.trim().split(' ').pop()[0] : '?';
  }
  function tickClock() {
    const d = new Date();
    const w = '일월화수목금토'[d.getDay()];
    const p = (n) => String(n).padStart(2, '0');
    $('#clock').textContent = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} (${w}) ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  const LOADING = '<div class="empty">불러오는 중…</div>';
  const errHTML = (e) => `<div class="empty err">실적을 불러오지 못했습니다.<br><span class="sm">${esc(e.message)}</span></div>`;
  // 비동기 조회 결과를 현재 화면이 그대로일 때만 sel 위치에 그린다
  function fill(sel, promise, render, onError = errHTML) {
    const seq = viewSeq;
    const put = (html) => {
      const el = seq === viewSeq && $(sel);
      if (el) el.innerHTML = html;
    };
    return promise.then((v) => put(render(v)), (e) => put(onError(e)));
  }

  function boardHTML(g, list, limit, highlightId) {
    if (!list.length) return '<div class="empty">등록된 실적이 없습니다.</div>';
    const me = getName();
    return `<table class="tbl rank-tbl"><thead><tr><th>순위</th><th>담당자</th><th class="r">실적</th><th class="r hide-sm">등록일시</th></tr></thead><tbody>${list
      .slice(0, limit)
      .map((r, i) => {
        const cls = [r.id === highlightId ? 'hl' : '', me && r.name === me ? 'me' : ''].join(' ');
        return `<tr class="${cls}"><td><span class="rk rk${i + 1}">${i + 1}</span></td><td class="wrap">${esc(r.name)} ${groupTag(r.group)}</td><td class="r b">${g.fmt(r.score)}</td><td class="r muted hide-sm">${fmtDate(r.t)}</td></tr>`;
      })
      .join('')}</tbody></table>`;
  }

  /* ---------------- 대시보드 ---------------- */
  function renderDashboard() {
    const me = getName();

    main.innerHTML = `
      <div class="page-head">
        <div>
          <div class="crumb">홈 › 대시보드</div>
          <h1>업무 현황 대시보드</h1>
          <p class="sub">${me ? esc(me) + '님, ' : ''}오늘도 성실한 업무 처리 부탁드립니다.</p>
        </div>
        <div class="head-actions">
          <button class="btn" id="btnName">사용자 설정</button>
          <a class="btn primary" href="#/game/${GAMES[Math.floor(Math.random() * GAMES.length)].id}">+ 신규 업무 처리</a>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi"><div class="kpi-l">등록 업무 모듈</div><div class="kpi-v">${GAMES.length}<small>개</small></div><div class="kpi-d up">정상 가동</div></div>
        <div class="kpi"><div class="kpi-l">금일 처리 건수</div><div class="kpi-v">${playsToday()}<small>건</small></div><div class="kpi-d">${today()} 기준</div></div>
        <div class="kpi"><div class="kpi-l">누적 실적 등록</div><div class="kpi-v"><span id="kpiTotal">…</span><small>건</small></div><div class="kpi-d">전체 업무 합산</div></div>
        <div class="kpi"><div class="kpi-l">내 1위 업무</div><div class="kpi-v"><span id="kpiTop">…</span><small>개</small></div><div class="kpi-d" id="kpiTopD">${me ? esc(me) : '담당자 미설정'}</div></div>
      </div>

      <div class="layout-2">
        <section class="panel">
          <div class="panel-h"><span>업무 모듈 목록</span><span class="muted sm">총 ${GAMES.length}건</span></div>
          <div class="panel-b p0 scroll-x">
            <table class="tbl mod-tbl">
              <thead><tr><th class="hide-sm">업무코드</th><th>업무명</th><th class="hide-sm">내용</th><th class="r">최고 실적</th><th class="hide-sm">담당자</th><th></th></tr></thead>
              <tbody>${GAMES
                .map((g) => `
                <tr>
                  <td class="hide-sm"><span class="badge">${g.code}</span></td>
                  <td class="b"><a href="#/game/${g.id}">${g.title}</a></td>
                  <td class="muted hide-sm desc">${g.short}</td>
                  <td class="r" id="best-${g.id}"><span class="muted">…</span></td>
                  <td class="hide-sm" id="owner-${g.id}"><span class="muted">…</span></td>
                  <td class="r"><a class="btn sm" href="#/game/${g.id}">처리</a></td>
                </tr>`)
                .join('')}</tbody>
            </table>
          </div>
        </section>

        <div class="col">
          <section class="panel">
            <div class="panel-h"><span>공지사항</span><span class="muted sm">더보기 ›</span></div>
            <div class="panel-b p0">
              <ul class="notice">
                <li><span class="tag red">필독</span>4분기 정보보안 교육 이수 안내<span class="muted">10-20</span></li>
                <li><span class="tag">시스템</span>ESC 키로 보고서 화면 즉시 전환 기능 추가<span class="muted">10-18</span></li>
                <li><span class="tag">인사</span>사내 동호회 신규 회원 모집<span class="muted">10-15</span></li>
                <li><span class="tag">총무</span>탕비실 커피머신 교체 완료<span class="muted">10-11</span></li>
                <li><span class="tag">시스템</span>${DB.mode === 'remote' ? '업무 실적이 전사 공유 서버에 집계됩니다' : '업무 실적은 현재 PC 브라우저에 저장됩니다'}<span class="muted">10-02</span></li>
              </ul>
            </div>
          </section>
          <section class="panel">
            <div class="panel-h"><span>최근 실적 등록</span></div>
            <div class="panel-b p0" id="dashRecent">${LOADING}</div>
          </section>
        </div>
      </div>`;
    $('#btnName').addEventListener('click', openNameModal);

    const seq = viewSeq;
    Promise.all(GAMES.map((g) => DB.top(g, 1)))
      .then((tops) => {
        if (seq !== viewSeq) return;
        let myTop = 0;
        GAMES.forEach((g, i) => {
          const best = tops[i][0];
          if (best && me && best.name === me) myTop++;
          $('#best-' + g.id).innerHTML = best ? g.fmt(best.score) : '<span class="muted">-</span>';
          $('#owner-' + g.id).innerHTML = best ? esc(best.name) : '<span class="muted">미지정</span>';
        });
        $('#kpiTop').textContent = myTop;
        $('#kpiTopD').classList.toggle('up', myTop > 0);
      })
      .catch((e) => {
        if (seq !== viewSeq) return;
        $('#kpiTop').textContent = '-';
        GAMES.forEach((g) => ($('#best-' + g.id).innerHTML = $('#owner-' + g.id).innerHTML = '<span class="muted">-</span>'));
        toast('실적 서버에 연결하지 못했습니다 · ' + esc(e.message));
      });
    fill('#kpiTotal', DB.total(GAMES), (n) => n.toLocaleString(), () => '-');
    fill('#dashRecent', DB.recent(GAMES, 6), (recent) =>
      recent.length
        ? `<table class="tbl"><tbody>${recent
            .filter((r) => byId[r.gameId])
            .map((r) => {
              const g = byId[r.gameId];
              return `<tr><td><span class="badge gray">${g.code}</span></td><td class="wrap">${esc(r.name)} ${groupTag(r.group)}</td><td class="r b">${g.fmt(r.score)}</td><td class="r muted">${fmtDate(r.t)}</td></tr>`;
            })
            .join('')}</tbody></table>`
        : '<div class="empty">아직 등록된 실적이 없습니다.</div>'
    );
  }

  /* ---------------- 실적 현황 ---------------- */
  let rankGroup = ''; // 실적 현황 그룹 필터 ('' = 전체)
  function renderRanking() {
    main.innerHTML = `
      <div class="page-head">
        <div>
          <div class="crumb">홈 › 실적 현황</div>
          <h1>업무별 실적 현황</h1>
          <p class="sub">업무 모듈별 상위 5명의 처리 실적입니다.</p>
        </div>
        <div class="head-actions">
          <label class="muted sm" for="rkGroup">그룹</label>
          <select class="inp sel" id="rkGroup"><option value="">전체</option></select>
        </div>
      </div>
      <div class="rank-grid">${GAMES.map(
        (g) => `
        <section class="panel">
          <div class="panel-h"><span><span class="badge">${g.code}</span> ${g.title}</span><a class="muted sm" href="#/game/${g.id}">상세 ›</a></div>
          <div class="panel-b p0" id="rk-${g.id}">${LOADING}</div>
        </section>`
      ).join('')}</div>`;
    const sel = $('#rkGroup');
    const load = () => GAMES.forEach((g) => fill('#rk-' + g.id, DB.top(g, 5, rankGroup), (list) => boardHTML(g, list, 5)));
    const seq = viewSeq;
    DB.all(GAMES)
      .then((rows) => {
        if (seq !== viewSeq) return;
        const groups = [...new Set([getGroup(), rankGroup, ...rows.map((r) => r.group)].filter(Boolean))].sort((a, b) =>
          a === NO_GROUP ? 1 : b === NO_GROUP ? -1 : a.localeCompare(b, 'ko')
        );
        sel.innerHTML = '<option value="">전체</option>' + groups.map((gr) => `<option value="${esc(gr)}">${esc(gr)}${gr === getGroup() ? ' (내 그룹)' : ''}</option>`).join('');
        sel.value = rankGroup;
      })
      .catch(() => {});
    sel.addEventListener('change', () => {
      rankGroup = sel.value;
      load();
    });
    load();
  }

  /* ---------------- 그룹 대항전 ---------------- */
  const POINTS = [10, 7, 5, 3, 2, 1]; // 업무별 그룹 순위 점수 (1~6위)
  function groupStandings(rows) {
    const total = new Map();
    const perGame = {};
    const entry = (gr) => {
      if (!total.has(gr)) total.set(gr, { group: gr, points: 0, wins: 0, members: new Set(), count: 0 });
      return total.get(gr);
    };
    for (const r of rows) {
      if (r.group === NO_GROUP || !byId[r.gameId]) continue;
      const e = entry(r.group);
      e.members.add(r.name);
      e.count++;
    }
    for (const g of GAMES) {
      const best = new Map(); // group -> 최고 기록
      for (const r of rows) {
        if (r.gameId !== g.id || r.group === NO_GROUP) continue;
        const b = best.get(r.group);
        if (!b || (g.higher ? r.score > b.score : r.score < b.score) || (r.score === b.score && r.t < b.t)) best.set(r.group, r);
      }
      const ranked = [...best.values()].sort((a, b) => (g.higher ? b.score - a.score : a.score - b.score) || a.t - b.t);
      ranked.forEach((r, i) => {
        const e = entry(r.group);
        e.points += POINTS[i] || 0;
        if (i === 0) e.wins++;
      });
      perGame[g.id] = ranked;
    }
    const list = [...total.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || b.count - a.count);
    return { list, perGame };
  }

  function renderGroups() {
    const mine = getGroup();
    main.innerHTML = `
      <div class="page-head">
        <div>
          <div class="crumb">홈 › 그룹 대항전</div>
          <h1>그룹 대항전</h1>
          <p class="sub">업무별 그룹 최고 기록 순위로 점수를 매깁니다 (1위 ${POINTS.join(' · ')}점 …). 무소속은 제외됩니다.</p>
        </div>
        <div class="head-actions">
          <span class="badge gray">내 그룹: ${esc(mine)}</span>
          <button class="btn" id="btnGroup">그룹 설정</button>
        </div>
      </div>
      <section class="panel">
        <div class="panel-h"><span>종합 순위</span></div>
        <div class="panel-b p0 scroll-x" id="grTotal">${LOADING}</div>
      </section>
      <div class="rank-grid mt">${GAMES.map(
        (g) => `
        <section class="panel">
          <div class="panel-h"><span><span class="badge">${g.code}</span> ${g.title}</span><a class="muted sm" href="#/game/${g.id}">상세 ›</a></div>
          <div class="panel-b p0" id="gr-${g.id}">${LOADING}</div>
        </section>`
      ).join('')}</div>`;
    $('#btnGroup').addEventListener('click', openNameModal);
    const seq = viewSeq;
    const empty = '<div class="empty">그룹 기록이 없습니다.<br><span class="sm">사용자 설정에서 그룹명을 정하고 실적을 등록해 보세요.</span></div>';
    DB.all(GAMES).then(
      (rows) => {
        if (seq !== viewSeq) return;
        const { list, perGame } = groupStandings(rows);
        $('#grTotal').innerHTML = list.length
          ? `<table class="tbl rank-tbl"><thead><tr><th>순위</th><th>그룹</th><th class="r">총점</th><th class="r">1위 업무</th><th class="r hide-sm">참여 인원</th><th class="r hide-sm">등록 건수</th></tr></thead><tbody>${list
              .map(
                (e, i) => `<tr class="${e.group === mine ? 'me' : ''}"><td><span class="rk rk${i + 1}">${i + 1}</span></td><td class="wrap">${esc(e.group)}</td><td class="r b">${e.points}점</td><td class="r">${e.wins}개</td><td class="r hide-sm">${e.members.size}명</td><td class="r hide-sm">${e.count}건</td></tr>`
              )
              .join('')}</tbody></table>`
          : empty;
        GAMES.forEach((g) => {
          const ranked = perGame[g.id];
          $('#gr-' + g.id).innerHTML = ranked.length
            ? `<table class="tbl rank-tbl"><thead><tr><th>순위</th><th>그룹</th><th>대표 선수</th><th class="r">최고 실적</th></tr></thead><tbody>${ranked
                .slice(0, 5)
                .map(
                  (r, i) => `<tr class="${r.group === mine ? 'me' : ''}"><td><span class="rk rk${i + 1}">${i + 1}</span></td><td class="wrap">${esc(r.group)}</td><td class="wrap">${esc(r.name)}</td><td class="r b">${g.fmt(r.score)}</td></tr>`
                )
                .join('')}</tbody></table>`
            : '<div class="empty">그룹 기록이 없습니다.</div>';
        });
      },
      (e) => {
        if (seq !== viewSeq) return;
        $('#grTotal').innerHTML = errHTML(e);
        GAMES.forEach((g) => ($('#gr-' + g.id).innerHTML = '<div class="empty">-</div>'));
      }
    );
  }

  /* ---------------- 게임 화면 ---------------- */
  function renderGame(g) {
    main.innerHTML = `
      <div class="page-head">
        <div>
          <div class="crumb">홈 › 업무 모듈 › ${g.code}</div>
          <h1>${g.title}</h1>
          <p class="sub">${g.desc}</p>
        </div>
        <div class="head-actions">
          <span class="badge">${g.code}</span>
          <span class="badge gray">평가 기준: ${g.higher ? '높을수록 우수' : '낮을수록 우수'}</span>
        </div>
      </div>
      <div class="layout-2${g.wide ? ' single' : ''}">
        <section class="panel">
          <div class="panel-h">
            <span>작업 영역 <span class="status" id="gStatus">대기</span></span>
            <span class="panel-tools"><button class="btn sm hidden" id="gStop">중단</button></span>
          </div>
          <div class="panel-b game-area" id="gArea"></div>
        </section>
        <aside class="panel">
          <div class="panel-h"><span>실적 순위 TOP 10</span>
            <span class="seg" id="gScope"><button data-s="all">전체</button><button data-s="mine">내 그룹</button></span>
          </div>
          <div class="panel-b p0" id="gBoard">${LOADING}</div>
        </aside>
      </div>`;
    $('#gStop').addEventListener('click', () => {
      stopGame();
      renderIntro(g);
    });
    $('#gScope').addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      boardScope = b.dataset.s;
      renderBoard(g);
    });
    renderIntro(g);
    renderBoard(g);
  }

  let boardScope = 'all'; // 게임 화면 순위표 범위: 전체 / 내 그룹
  function renderBoard(g, highlightId) {
    const scope = $('#gScope');
    if (scope) {
      scope.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.s === boardScope));
      scope.querySelector('[data-s="mine"]').textContent = '내 그룹 (' + getGroup() + ')';
    }
    const group = boardScope === 'mine' ? getGroup() : '';
    fill('#gBoard', DB.top(g, 10, group), (list) =>
      list.length || !group ? boardHTML(g, list, 10, highlightId) : `<div class="empty">${esc(group)} 그룹의 실적이 없습니다.</div>`
    );
  }

  function setStatus(text, cls) {
    const s = $('#gStatus');
    if (!s) return;
    s.textContent = text;
    s.className = 'status ' + (cls || '');
    $('#gStop').classList.toggle('hidden', cls !== 'run');
  }

  function renderIntro(g, last) {
    setStatus('대기');
    const area = $('#gArea');
    area.innerHTML = `
      <div class="intro">
        <div class="intro-grid">
          <div>
            <h3>업무 처리 절차</h3>
            <ol class="steps">${g.howto.map((h) => `<li>${h}</li>`).join('')}</ol>
          </div>
          <table class="kv">
            <tr><th>업무코드</th><td>${g.code}</td></tr>
            <tr><th>평가 기준</th><td>${g.higher ? '높을수록 우수' : '낮을수록 우수'}</td></tr>
            <tr><th>최고 실적</th><td id="introBest"><span class="muted">…</span></td></tr>
            ${last != null ? `<tr><th>최근 처리</th><td class="b">${last}</td></tr>` : ''}
          </table>
        </div>
        <div class="intro-actions"><button class="btn primary lg" id="gStart">${last != null ? '다시 처리' : '업무 시작'}</button></div>
      </div>`;
    $('#gStart').addEventListener('click', () => startGame(g));
    fill(
      '#introBest',
      DB.top(g, 1),
      ([best]) => (best ? `${g.fmt(best.score)} <span class="muted">(${esc(best.name)})</span>` : '-'),
      () => '-'
    );
  }

  function startGame(g) {
    stopGame();
    countPlay();
    setStatus('진행중', 'run');
    const area = $('#gArea');
    area.innerHTML = '';
    let ended = false;
    const session = DB.startSession(g); // 서버 점수 검증용 플레이 세션 (Promise)
    DB.track('play', g.id);
    const ctx = {
      paused,
      finish(score) {
        if (ended) return;
        ended = true;
        stopGame();
        setStatus('완료', 'done');
        showResult(g, score, session);
      },
      fail(msg) {
        if (ended) return;
        ended = true;
        stopGame();
        setStatus('반려', 'fail');
        showFail(g, msg);
      },
    };
    current = g.mount(area, ctx);
  }

  /* ---------------- 모달 ---------------- */
  function openModal(html, onClose) {
    modalOn = true;
    const back = $('#modalBack');
    $('#modal').innerHTML = html;
    back.classList.remove('hidden');
    back._onClose = onClose;
  }
  function closeModal() {
    modalOn = false;
    const back = $('#modalBack');
    back.classList.add('hidden');
    const cb = back._onClose;
    back._onClose = null;
    if (cb) cb();
  }

  function showResult(g, score, session) {
    openModal(
      `<div class="modal-h">업무 처리 완료 보고</div>
      <div class="modal-b">
        <table class="kv">
          <tr><th>업무</th><td>${g.code} ${g.title}</td></tr>
          <tr><th>처리 실적</th><td class="result">${g.fmt(score)}</td></tr>
          <tr><th>예상 순위</th><td id="mRank"><span class="muted">조회 중…</span></td></tr>
        </table>
        ${profileFields()}
        <p class="form-err hidden" id="mErr"></p>
      </div>
      <div class="modal-f">
        <button class="btn" id="mSkip">등록 안 함</button>
        <button class="btn primary" id="mSave">실적 등록</button>
      </div>`,
      () => renderIntro(g, g.fmt(score))
    );
    const inp = $('#nmInput');
    $('#nmRand').addEventListener('click', () => {
      inp.value = randomName();
      inp.focus();
    });
    $('#mSkip').addEventListener('click', closeModal);
    fill('#mRank', DB.rankOf(g, score), (pr) => `<b>${pr.rank}위</b> <span class="muted">/ ${pr.total}건</span>`, () => '<span class="muted">-</span>');
    let saving = false;
    const save = async () => {
      if (saving) return;
      const err = $('#mErr');
      const name = inp.value.trim().slice(0, 16) || randomName();
      const group = cleanGroup($('#grInput').value);
      const bad = profileError(name, group);
      if (bad) {
        err.textContent = bad;
        err.classList.remove('hidden');
        return;
      }
      saving = true;
      const btn = $('#mSave');
      btn.disabled = $('#mSkip').disabled = true;
      btn.textContent = '등록 중…';
      setName(name);
      setGroup(group);
      inp.value = name;
      try {
        const r = await DB.add(g, name, group, score, await session);
        DB.track('record', g.id);
        closeModal();
        renderBoard(g, r.id);
        toast(`실적이 등록되었습니다 · ${esc(name)}${r.rank ? ` · ${r.rank}위` : ''}`);
      } catch (e) {
        saving = false;
        btn.disabled = $('#mSkip').disabled = false;
        btn.textContent = '다시 등록';
        err.textContent = e.friendly ? e.message : '실적 등록에 실패했습니다. 잠시 후 다시 시도해 주세요. (' + e.message + ')';
        err.classList.remove('hidden');
      }
    };
    $('#mSave').addEventListener('click', save);
    [inp, $('#grInput')].forEach((el) =>
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) save();
      })
    );
    setTimeout(() => $('#mSave').focus(), 0);
  }

  function showFail(g, msg) {
    openModal(
      `<div class="modal-h fail">업무 반려</div>
      <div class="modal-b"><p>${esc(msg)}</p><p class="muted">실적이 집계되지 않았습니다.</p></div>
      <div class="modal-f"><button class="btn" id="mClose">닫기</button><button class="btn primary" id="mRetry">재처리</button></div>`,
      null
    );
    $('#mClose').addEventListener('click', () => {
      closeModal();
      renderIntro(g);
    });
    $('#mRetry').addEventListener('click', () => {
      closeModal();
      startGame(g);
    });
  }

  function openNameModal() {
    openModal(
      `<div class="modal-h">사용자 설정</div>
      <div class="modal-b">
        ${profileFields()}
        <p class="form-err hidden" id="mErr"></p>
        <p class="muted sm">실적 등록 시 이 이름과 그룹이 기본으로 사용됩니다.</p>
      </div>
      <div class="modal-f"><button class="btn" id="mCancel">취소</button><button class="btn primary" id="mSave">저장</button></div>`,
      () => {
        const h = location.hash;
        if (!h || h === '#/') renderDashboard();
        else if (h === '#/groups') renderGroups();
        else if (h.startsWith('#/game/') && byId[h.slice(7)] && !current) renderBoard(byId[h.slice(7)]);
      }
    );
    const inp = $('#nmInput');
    $('#nmRand').addEventListener('click', () => (inp.value = randomName()));
    $('#mCancel').addEventListener('click', closeModal);
    const save = () => {
      const name = inp.value.trim().slice(0, 16) || randomName();
      const group = cleanGroup($('#grInput').value);
      const bad = profileError(name, group);
      if (bad) {
        $('#mErr').textContent = bad;
        $('#mErr').classList.remove('hidden');
        return;
      }
      setName(name);
      setGroup(group);
      closeModal();
      toast(`${esc(name)} (${esc(group)})(으)로 설정되었습니다`);
    };
    $('#mSave').addEventListener('click', save);
    [inp, $('#grInput')].forEach((el) =>
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) save();
      })
    );
    setTimeout(() => inp.focus(), 0);
  }

  let toastTimer = 0;
  function toast(html) {
    const t = $('#toast');
    t.innerHTML = html;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------------- 보스 화면 (ESC) ---------------- */
  const BOSS_TITLE = '2026_4Q_매출실적_최종_v3(진짜최종).xlsx - 스프레드시트';
  const APP_TITLE = document.title;
  function buildBoss() {
    const regions = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
    const prods = ['A제품군', 'B제품군', 'C솔루션'];
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const cols = 'ABCDEFGHIJ'.split('');
    const rows = [['구분', '지역', '10월', '11월', '12월', '4Q 합계', '목표', '달성률', '전년比', '비고']];
    let sum = 0;
    regions.forEach((r, i) => {
      const m = [0, 1, 2].map(() => Math.round(800 + rnd() * 4200));
      const tot = m[0] + m[1] + m[2];
      const goal = Math.round(tot * (0.85 + rnd() * 0.3));
      sum += tot;
      rows.push([prods[i % 3], r, ...m.map((v) => v.toLocaleString()), tot.toLocaleString(), goal.toLocaleString(), ((tot / goal) * 100).toFixed(1) + '%', (rnd() * 20 - 5).toFixed(1) + '%', tot > goal ? '' : '확인필요']);
    });
    rows.push(['합계', '', '', '', '', sum.toLocaleString(), '', '', '', '']);
    while (rows.length < 32) rows.push(Array(10).fill(''));
    $('#boss').innerHTML = `
      <div class="xl-top"><span class="xl-logo">▦</span><span class="xl-name">${BOSS_TITLE}</span><span class="xl-saved">저장됨 ✓</span></div>
      <div class="xl-menu">${['파일', '홈', '삽입', '페이지 레이아웃', '수식', '데이터', '검토', '보기', '도움말'].map((m, i) => `<span class="${i === 1 ? 'on' : ''}">${m}</span>`).join('')}</div>
      <div class="xl-ribbon"><span>붙여넣기</span><span>맑은 고딕 ▾</span><span>11 ▾</span><b>가</b><i>가</i><u>가</u><span>│</span><span>≡ 가운데 맞춤</span><span>%</span><span>,</span><span>│</span><span>조건부 서식 ▾</span><span>표 서식 ▾</span><span>Σ 자동 합계 ▾</span></div>
      <div class="xl-fx"><span class="xl-cell">F19</span><span class="xl-fxi">fx</span><span>=SUM(F2:F18)</span></div>
      <div class="xl-grid"><table>
        <thead><tr><th></th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r, i) => `<tr class="${i === 0 ? 'xh' : r[0] === '합계' ? 'xs' : ''}"><th>${i + 1}</th>${r.map((v, j) => `<td class="${j >= 2 && j <= 8 ? 'r' : ''} ${v === '확인필요' ? 'warn' : ''}">${v}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>
      <div class="xl-tabs"><span class="on">요약</span><span>월별</span><span>지역별</span><span>원본데이터</span><span>+</span></div>
      <div class="xl-status"><span>준비</span><span>평균: ${Math.round(sum / regions.length).toLocaleString()} &nbsp; 개수: ${regions.length} &nbsp; 합계: ${sum.toLocaleString()} &nbsp;&nbsp; 100%</span></div>`;
  }
  function toggleBoss(force) {
    bossOn = typeof force === 'boolean' ? force : !bossOn;
    $('#boss').classList.toggle('hidden', !bossOn);
    document.title = bossOn ? BOSS_TITLE : APP_TITLE;
  }

  /* ---------------- 라우팅 ---------------- */
  function route() {
    viewSeq++;
    stopGame();
    if (modalOn) closeModal();
    const h = location.hash.replace(/^#\/?/, '');
    const [view, arg] = h.split('/');
    document.body.classList.remove('nav-open');
    if (view === 'game' && byId[arg]) {
      setActiveNav('game/' + arg);
      renderGame(byId[arg]);
    } else if (view === 'ranking') {
      setActiveNav('ranking');
      renderRanking();
    } else if (view === 'groups') {
      setActiveNav('groups');
      renderGroups();
    } else {
      setActiveNav('');
      renderDashboard();
    }
    window.scrollTo(0, 0);
  }

  /* ---------------- 초기화 ---------------- */
  renderNav();
  renderUser();
  $('#dbMode').innerHTML = DB.mode === 'remote' ? '<span class="dot-on"></span>공유 서버 연결됨' : '<span class="dot-off"></span>로컬 저장 모드';
  buildBoss();
  tickClock();
  setInterval(tickClock, 10000);
  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      toggleBoss();
    }
  });
  $('#bossBtn').addEventListener('click', () => toggleBoss(true));
  $('#boss').addEventListener('dblclick', () => toggleBoss(false));
  $('#userChip').addEventListener('click', openNameModal);
  $('#menuBtn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('#scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
  route();
  // 방문 통계: 브라우저 탭(세션)당 한 번
  try {
    if (!sessionStorage.getItem('wp_visit')) {
      sessionStorage.setItem('wp_visit', '1');
      DB.track('visit');
    }
  } catch (e) { /* 저장소 사용 불가 환경은 통계 생략 */ }
})();
