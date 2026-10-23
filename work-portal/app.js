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
  const DB = window.WP_DB;
  let orgInfo = null; // 내 단체 정보 (org_info 결과). 단체 범위일 때 이름·그룹은 여기서 가져온다
  const inOrg = () => DB.scope === 'org' && !!orgInfo;
  const getName = () => (inOrg() ? orgInfo.me.name : store.get('wp_name', ''));
  function setName(n) {
    store.set('wp_name', n);
    renderUser();
  }
  const getGroup = () => (inOrg() ? orgInfo.me.group : store.get('wp_group', '') || NO_GROUP);
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
      `<a href="#/org" data-nav="org"><span class="nav-ico">◆</span>단체</a>`,
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
    $('#userGroup').textContent = inOrg() ? `${orgInfo.org_name} · ${getGroup()}` : getGroup();
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
    const org = DB.scope === 'org'; // 단체 범위면 단체 멤버 이름·그룹으로 단체 순위에 등록
    openModal(
      `<div class="modal-h">업무 처리 완료 보고</div>
      <div class="modal-b">
        <table class="kv">
          <tr><th>업무</th><td>${g.code} ${g.title}</td></tr>
          <tr><th>처리 실적</th><td class="result">${g.fmt(score)}</td></tr>
          <tr><th>예상 순위</th><td id="mRank"><span class="muted">조회 중…</span></td></tr>
        </table>
        ${org ? orgNote() : profileFields()}
        <p class="form-err hidden" id="mErr"></p>
      </div>
      <div class="modal-f">
        <button class="btn" id="mSkip">등록 안 함</button>
        <button class="btn primary" id="mSave">실적 등록</button>
      </div>`,
      () => renderIntro(g, g.fmt(score))
    );
    const inp = $('#nmInput');
    if (!org) {
      $('#nmRand').addEventListener('click', () => {
        inp.value = randomName();
        inp.focus();
      });
    }
    $('#mSkip').addEventListener('click', closeModal);
    fill('#mRank', DB.rankOf(g, score), (pr) => `<b>${pr.rank}위</b> <span class="muted">/ ${pr.total}건</span>`, () => '<span class="muted">-</span>');
    let saving = false;
    const save = async () => {
      if (saving) return;
      const err = $('#mErr');
      const name = org ? (orgInfo ? orgInfo.me.name : '') : inp.value.trim().slice(0, 16) || randomName();
      const group = org ? (orgInfo ? orgInfo.me.group : '') : cleanGroup($('#grInput').value);
      const bad = org ? '' : profileError(name, group);
      if (bad) {
        err.textContent = bad;
        err.classList.remove('hidden');
        return;
      }
      saving = true;
      const btn = $('#mSave');
      btn.disabled = $('#mSkip').disabled = true;
      btn.textContent = '등록 중…';
      if (!org) {
        setName(name);
        setGroup(group);
        inp.value = name;
      }
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
    if (!org) {
      [inp, $('#grInput')].forEach((el) =>
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.isComposing) save();
        })
      );
    }
    setTimeout(() => $('#mSave').focus(), 0);
  }

  // 단체 범위에서 실적 등록 창에 보여줄 안내
  const orgNote = () =>
    !orgInfo
      ? '<div class="org-note">🏢 내 단체 순위에 등록됩니다. <div class="muted sm">단체 기록은 단체 멤버만 볼 수 있습니다.</div></div>'
      : `
        <div class="org-note">🏢 <b>${esc(orgInfo.org_name)}</b> 단체 순위에 <b>${esc(orgInfo.me.name)}</b> ${groupTag(orgInfo.me.group)}(으)로 등록됩니다.
          <div class="muted sm">단체 기록은 단체 멤버만 볼 수 있습니다. 이름·그룹은 [단체] 메뉴에서 바꿀 수 있습니다.</div></div>`;

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
    if (inOrg()) return openOrgProfileModal();
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

  /* ---------------- 단체 ---------------- */
  // 저장된 단체 토큰으로 단체 정보를 불러온다. 내보내진 경우 이 브라우저의 단체 정보를 지운다.
  function loadOrg() {
    if (!DB.org.joined || !DB.org.available) {
      orgInfo = null;
      renderScope();
      return Promise.resolve();
    }
    return DB.org
      .info()
      .then(
        (info) => {
          orgInfo = info;
        },
        (e) => {
          orgInfo = null;
          if (e.code === 'not_member') {
            DB.org.forget();
            toast('단체에서 나가진 상태입니다. 전체 기록 보기로 돌아갑니다.');
          } else if (DB.scope === 'org') {
            // 단체 정보를 못 불러오면 이름·범위가 어긋나지 않게 전체 보기로 돌린다
            DB.setScope('public');
            toast('단체 정보를 불러오지 못해 전체 기록으로 표시합니다.');
          }
        }
      )
      .then(() => {
        renderUser();
        renderScope();
      });
  }

  function renderScope() {
    const el = $('#scopeSeg');
    if (!orgInfo || !DB.org.joined) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = `<button data-s="public" class="${DB.scope === 'public' ? 'on' : ''}">전체</button><button data-s="org" class="${DB.scope === 'org' ? 'on' : ''}" title="${esc(orgInfo.org_name)} 단체 기록">🏢 ${esc(orgInfo.org_name)}</button>`;
  }

  function switchScope(s) {
    if (current) return toast('진행 중인 업무를 마친 뒤 전환해 주세요.');
    if (s === DB.scope) return;
    DB.setScope(s);
    renderScope();
    renderUser();
    route();
    toast(s === 'org' ? `🏢 ${esc(orgInfo.org_name)} 단체 기록 보기` : '전체 기록 보기');
  }

  const orgErr = (sel, e) => {
    const el = $(sel);
    if (!el) return toast(esc(e.message));
    el.textContent = e.friendly ? e.message : '처리하지 못했습니다. 잠시 후 다시 시도해 주세요. (' + e.message + ')';
    el.classList.remove('hidden');
  };
  const copyText = (text, input) => {
    const done = () => toast('복사했습니다');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => input && input.select());
    else if (input) input.select();
  };
  // 단체 화면 항목별 도움말 (상단 [도움말 숨기기]로 접을 수 있다)
  const ORG_HELP = {
    join: '단체 관리자에게 받은 8자리 초대 코드로 가입합니다. 가입하면 이 브라우저에 멤버 정보가 저장되어, 다음부터는 바로 단체 기록을 볼 수 있습니다.',
    ojCode: '대소문자·하이픈(-)은 상관없습니다. 코드가 맞지 않으면 관리자에게 최신 코드를 다시 받아 주세요. (관리자가 재발급하면 옛 코드는 쓸 수 없습니다)',
    ojName: '단체 순위에 표시될 이름입니다. 전체 순위용 이름과 따로 정할 수 있고, 가입한 뒤에도 바꿀 수 있습니다.',
    create: '새 단체를 만들면 만든 사람이 관리자가 되어 그룹을 만들고 멤버를 관리합니다. 만든 직후 초대 코드와 관리자 코드가 표시됩니다.',
    ocName: '멤버들이 보게 될 단체 이름입니다. (최대 30자)',
    ocMe: '이 단체 안에서 쓸 내 이름입니다.',
    scope: '단체 기록: 순위표·실적 현황·그룹 대항전·기록 등록이 모두 이 단체 멤버끼리만 공유됩니다. 전체 기록: 누구나 보는 공개 순위입니다. 화면 위쪽 [전체 | 🏢 단체명] 버튼으로도 바꿀 수 있습니다.',
    omName: '단체 순위에 표시될 이름입니다. 단체 기록을 등록하면 이 이름으로 올라갑니다.',
    omGroup: '관리자가 만든 그룹 중에서 고릅니다. 그룹 대항전과 순위표의 [내 그룹] 보기에 쓰입니다. 원하는 그룹이 없으면 관리자에게 요청하세요.',
    omAdmin: '단체를 만들 때 받은 관리자 코드를 넣으면 이 기기에서도 관리자 메뉴를 쓸 수 있습니다. 관리자 코드를 알려준 사람도 관리자가 될 수 있으니 주의하세요.',
    omLeave: '나가면 이 브라우저의 멤버 정보가 지워집니다. 이미 등록한 기록은 단체 순위에 남고, 다시 들어오려면 초대 코드가 필요합니다.',
    oaInv: '이 코드를 멤버에게 알려주면 [단체] 메뉴에서 가입할 수 있습니다. 코드를 아는 사람은 누구나 가입할 수 있으니, 원치 않는 곳에 퍼졌다면 [재발급]을 누르세요. 기존 멤버는 그대로 남습니다.',
    oaGroup: '멤버가 고를 수 있는 그룹 목록입니다 (최대 50개). 그룹을 지우면 그 그룹 멤버는 무소속이 되지만, 이미 등록된 기록의 그룹명은 그대로입니다.',
    oaMembers: '단체에 가입한 사람 목록입니다. [내보내기]를 누르면 그 사람은 더 이상 단체 기록을 볼 수 없습니다. 이미 등록한 기록은 단체 순위에 남습니다.',
  };
  const help = (k) => `<p class="help">💡 ${ORG_HELP[k]}</p>`;
  const helpOff = () => store.get('wp_org_help', 'on') === 'off';
  function applyHelpPref() {
    document.body.classList.toggle('help-off', helpOff());
    const b = $('[data-orghelp="toggle"]');
    if (b) b.textContent = helpOff() ? '💡 도움말 보기' : '💡 도움말 숨기기';
  }
  const orgHead = (sub) => `
      <div class="page-head">
        <div>
          <div class="crumb">홈 › 단체</div>
          <h1>단체</h1>
          <p class="sub">${sub}</p>
        </div>
        <div class="head-actions">
          <button class="btn sm" data-orghelp="intro">단체 모드 안내</button>
          <button class="btn sm" data-orghelp="toggle">${helpOff() ? '💡 도움말 보기' : '💡 도움말 숨기기'}</button>
        </div>
      </div>`;

  // 단체 모드 안내 (첫 방문 시 한 번 자동 표시, [단체 모드 안내] 버튼으로 다시 보기)
  function showOrgIntro() {
    store.set('wp_org_intro_seen', 1);
    const onOrgPage = location.hash === '#/org';
    openModal(
      `<div class="modal-h">🏢 단체 모드 안내</div>
      <div class="modal-b intro-modal">
        <p>단체 모드는 <b>회사·팀·모임끼리만 보는 비공개 순위</b>입니다. 단체에서 등록한 기록은 전체 순위에 나오지 않고, 같은 단체 멤버만 볼 수 있습니다.</p>
        <ol class="intro-steps">
          <li><b>단체 만들기 또는 가입</b><span>왼쪽 [◆ 단체] 메뉴에서 새 단체를 만들거나, 관리자에게 받은 초대 코드로 가입합니다.</span></li>
          <li><b>이름·그룹 정하기</b><span>단체에서 쓸 이름과, 관리자가 만든 그룹 중 내 그룹을 고릅니다.</span></li>
          <li><b>보기 전환</b><span>화면 위쪽 <span class="kbd">전체</span> <span class="kbd">🏢 단체명</span> 버튼으로 바꿉니다. 단체로 바꾸면 순위표·실적 현황·그룹 대항전·기록 등록이 단체 안에서만 동작합니다.</span></li>
          <li><b>관리자</b><span>단체를 만든 사람은 그룹 관리, 멤버 내보내기, 초대 코드 재발급을 할 수 있습니다.</span></li>
        </ol>
        <p class="muted sm">로그인 없이 이 브라우저에 멤버 정보가 저장됩니다. 다른 기기에서는 초대 코드로 다시 가입하면 됩니다.</p>
      </div>
      <div class="modal-f"><button class="btn" id="oiClose">닫기</button>${onOrgPage ? '' : '<button class="btn primary" id="oiGo">단체 메뉴로 이동</button>'}</div>`,
      null
    );
    $('#oiClose').addEventListener('click', closeModal);
    if (!onOrgPage) {
      $('#oiGo').addEventListener('click', () => {
        closeModal();
        location.hash = '#/org';
      });
    }
  }

  function renderOrg() {
    if (!DB.org.available) {
      main.innerHTML = orgHead('단체 기능은 공유 서버에 연결되어 있을 때만 쓸 수 있습니다.');
      return;
    }
    if (!DB.org.joined) return renderOrgJoin();
    main.innerHTML = orgHead('단체 멤버끼리만 보는 비공개 순위입니다. 단체 기록은 전체 순위에 나오지 않습니다.') + `<div id="orgBody">${LOADING}</div>`;
    const seq = viewSeq;
    DB.org.info().then(
      (info) => {
        if (seq !== viewSeq) return;
        orgInfo = info;
        renderUser();
        renderScope();
        drawOrg();
      },
      (e) => {
        if (seq !== viewSeq) return;
        if (e.code === 'not_member') {
          DB.org.forget();
          orgInfo = null;
          renderUser();
          renderScope();
          toast(esc(e.message));
          return renderOrgJoin();
        }
        $('#orgBody').innerHTML = errHTML(e);
      }
    );
  }

  function renderOrgJoin() {
    main.innerHTML =
      orgHead('단체를 만들거나 초대 코드로 가입하면, 단체 멤버끼리만 보는 비공개 순위를 쓸 수 있습니다.') +
      `
      <div class="org-grid">
        <section class="panel">
          <div class="panel-h"><span>초대 코드로 가입</span></div>
          <div class="panel-b">
            ${help('join')}
            <label class="lbl" for="ojCode">초대 코드</label>
            <input class="inp full code" id="ojCode" maxlength="9" autocomplete="off" placeholder="예) ABCD-EFGH" />
            ${help('ojCode')}
            <label class="lbl" for="ojName">단체에서 쓸 이름</label>
            <input class="inp full" id="ojName" maxlength="16" autocomplete="off" value="${esc(getName())}" placeholder="예) ${esc(randomName())}" />
            ${help('ojName')}
            <p class="form-err hidden" id="ojErr"></p>
            <div class="org-actions"><button class="btn primary" id="ojBtn">가입하기</button></div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-h"><span>새 단체 만들기</span></div>
          <div class="panel-b">
            ${help('create')}
            <label class="lbl" for="ocName">단체 이름</label>
            <input class="inp full" id="ocName" maxlength="30" autocomplete="off" placeholder="예) ○○주식회사, 3층 개발본부" />
            ${help('ocName')}
            <label class="lbl" for="ocMe">내 이름</label>
            <input class="inp full" id="ocMe" maxlength="16" autocomplete="off" value="${esc(getName())}" placeholder="예) ${esc(randomName())}" />
            ${help('ocMe')}
            <p class="form-err hidden" id="ocErr"></p>
            <div class="org-actions"><button class="btn" id="ocBtn">단체 만들기</button></div>
          </div>
        </section>
      </div>`;
    const busy = (btn, on, label) => {
      btn.disabled = on;
      btn.textContent = on ? '처리 중…' : label;
    };
    $('#ojBtn').addEventListener('click', () => {
      const code = $('#ojCode').value.trim().toUpperCase();
      const name = $('#ojName').value.trim().slice(0, 16) || randomName();
      if (!/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(code)) return orgErr('#ojErr', { friendly: true, message: '초대 코드 8자리를 입력해 주세요. (예: ABCD-EFGH)' });
      if (profileError(name, '')) return orgErr('#ojErr', { friendly: true, message: profileError(name, '') });
      const btn = $('#ojBtn');
      busy(btn, true);
      DB.org
        .join(code.includes('-') ? code : code.slice(0, 4) + '-' + code.slice(4), name)
        .then((r) => loadOrg().then(() => {
          toast(`🏢 ${esc(r.org_name)} 단체에 가입했습니다`);
          route();
        }))
        .catch((e) => {
          busy(btn, false, '가입하기');
          orgErr('#ojErr', e);
        });
    });
    $('#ocBtn').addEventListener('click', () => {
      const orgName = $('#ocName').value.trim().slice(0, 30);
      const me = $('#ocMe').value.trim().slice(0, 16) || randomName();
      if (!orgName) return orgErr('#ocErr', { friendly: true, message: '단체 이름을 입력해 주세요.' });
      const bad = profileError(orgName, me);
      if (bad) return orgErr('#ocErr', { friendly: true, message: bad });
      const btn = $('#ocBtn');
      busy(btn, true);
      DB.org
        .create(orgName, me)
        .then((r) => loadOrg().then(() => showOrgCodes(r)))
        .catch((e) => {
          busy(btn, false, '단체 만들기');
          orgErr('#ocErr', e);
        });
    });
  }

  // 단체를 만든 직후 초대 코드 / 관리자 코드 안내 (관리자 코드는 이때 한 번만 보여준다)
  function showOrgCodes(r) {
    openModal(
      `<div class="modal-h">단체가 만들어졌습니다</div>
      <div class="modal-b">
        <p>🏢 <b>${esc(r.org_name)}</b></p>
        <label class="lbl">초대 코드 <span class="muted">(멤버에게 공유)</span></label>
        <div class="row"><input class="inp code" id="ccInv" readonly value="${esc(r.invite_code)}" /><button class="btn" id="ccInvCopy">복사</button></div>
        <label class="lbl">관리자 코드 <span class="muted">(본인만 보관)</span></label>
        <div class="row"><input class="inp code" id="ccAdm" readonly value="${esc(r.admin_code)}" /><button class="btn" id="ccAdmCopy">복사</button></div>
        <p class="form-err">⚠ 관리자 코드는 지금 한 번만 보여드립니다. 다른 기기·브라우저에서 관리자 권한을 받을 때 필요하니 꼭 따로 저장해 두세요.</p>
      </div>
      <div class="modal-f"><button class="btn primary" id="ccOk">확인</button></div>`,
      () => route()
    );
    $('#ccInvCopy').addEventListener('click', () => copyText(r.invite_code, $('#ccInv')));
    $('#ccAdmCopy').addEventListener('click', () => copyText(r.admin_code, $('#ccAdm')));
    $('#ccOk').addEventListener('click', closeModal);
  }

  function drawOrg() {
    const info = orgInfo;
    const me = info.me;
    const groupOptions = [NO_GROUP, ...info.groups].map((gr) => `<option value="${esc(gr)}"${gr === me.group ? ' selected' : ''}>${esc(gr)}</option>`).join('');
    $('#orgBody').innerHTML = `
      <div class="org-grid">
        <section class="panel">
          <div class="panel-h"><span>🏢 ${esc(info.org_name)}</span><span class="muted sm">멤버 ${info.members}명${me.is_admin ? ' · <span class="badge">관리자</span>' : ''}</span></div>
          <div class="panel-b">
            <div class="org-scope">현재 보기: <b>${DB.scope === 'org' ? '단체 기록' : '전체 기록'}</b>
              <button class="btn sm${DB.scope === 'org' ? '' : ' primary'}" data-scope="${DB.scope === 'org' ? 'public' : 'org'}">${DB.scope === 'org' ? '전체 기록 보기' : '단체 기록 보기'}</button></div>
            ${help('scope')}
            <label class="lbl" for="omName">단체에서 쓸 이름</label>
            <input class="inp full" id="omName" maxlength="16" autocomplete="off" value="${esc(me.name)}" />
            ${help('omName')}
            <label class="lbl" for="omGroup">그룹</label>
            <select class="inp full" id="omGroup">${groupOptions}</select>
            ${help('omGroup')}
            ${info.groups.length ? '' : '<p class="muted sm">아직 그룹이 없습니다. 관리자가 그룹을 만들면 고를 수 있습니다.</p>'}
            <p class="form-err hidden" id="omErr"></p>
            <div class="org-actions"><button class="btn primary" id="omSave">저장</button></div>
            ${me.is_admin ? '' : `
            <label class="lbl" for="omAdmin">관리자 코드가 있다면</label>
            <div class="row"><input class="inp code" id="omAdmin" maxlength="14" autocomplete="off" placeholder="XXXX-XXXX-XXXX" /><button class="btn" id="omClaim">관리자 권한 받기</button></div>
            ${help('omAdmin')}
            <p class="form-err hidden" id="omAdminErr"></p>`}
            <div class="org-leave"><button class="btn danger sm" id="omLeave">단체 나가기</button>${help('omLeave')}</div>
          </div>
        </section>
        ${me.is_admin ? `
        <section class="panel">
          <div class="panel-h"><span>관리자 메뉴</span></div>
          <div class="panel-b">
            <label class="lbl">초대 코드</label>
            <div class="row"><input class="inp code" id="oaInv" readonly value="${esc(info.invite_code || '')}" /><button class="btn" id="oaCopy">복사</button><button class="btn" id="oaReset">재발급</button></div>
            ${help('oaInv')}
            <label class="lbl">그룹 관리</label>
            <div class="org-chips">${info.groups.map((gr) => `<span class="chip">${esc(gr)}<button title="삭제" data-delgroup="${esc(gr)}">×</button></span>`).join('') || '<span class="muted sm">그룹이 없습니다.</span>'}</div>
            <div class="row"><input class="inp" id="oaGroup" maxlength="20" autocomplete="off" placeholder="새 그룹명 (예: 개발1팀)" /><button class="btn" id="oaAdd">추가</button></div>
            ${help('oaGroup')}
            <p class="form-err hidden" id="oaErr"></p>
            <label class="lbl">멤버</label>
            ${help('oaMembers')}
            <div id="oaMembers">${LOADING}</div>
          </div>
        </section>` : ''}
      </div>`;

    const refresh = (r) => {
      orgInfo = r;
      renderUser();
      renderScope();
      drawOrg();
    };
    $('#omSave').addEventListener('click', () => {
      const name = $('#omName').value.trim().slice(0, 16);
      if (!name) return orgErr('#omErr', { friendly: true, message: '이름을 입력해 주세요.' });
      if (profileError(name, '')) return orgErr('#omErr', { friendly: true, message: profileError(name, '') });
      DB.org.updateMe(name, $('#omGroup').value).then((r) => {
        refresh(r);
        toast('단체 정보를 저장했습니다');
      }, (e) => orgErr('#omErr', e));
    });
    if (!me.is_admin) {
      $('#omClaim').addEventListener('click', () => {
        DB.org.claimAdmin($('#omAdmin').value).then((r) => {
          refresh(r);
          toast('관리자 권한을 받았습니다');
        }, (e) => orgErr('#omAdminErr', e));
      });
    }
    $('#omLeave').addEventListener('click', () => {
      if (!confirm(`${info.org_name} 단체에서 나갈까요?\n다시 들어오려면 초대 코드가 필요합니다.${me.is_admin ? '\n관리자 코드가 없으면 관리자 권한도 다시 받을 수 없습니다.' : ''}`)) return;
      DB.org.leave().then(() => {
        orgInfo = null;
        renderUser();
        renderScope();
        toast('단체에서 나갔습니다');
        route();
      }, (e) => orgErr('#omErr', e));
    });
    if (!me.is_admin) return;

    $('#oaCopy').addEventListener('click', () => copyText(info.invite_code, $('#oaInv')));
    $('#oaReset').addEventListener('click', () => {
      if (!confirm('초대 코드를 새로 만들까요?\n기존 코드로는 더 이상 가입할 수 없습니다.')) return;
      DB.org.resetInvite().then((r) => {
        refresh(r);
        toast('초대 코드를 재발급했습니다');
      }, (e) => orgErr('#oaErr', e));
    });
    $('#oaAdd').addEventListener('click', () => {
      const name = $('#oaGroup').value.trim().slice(0, 20);
      if (!name) return;
      if (profileError('', name)) return orgErr('#oaErr', { friendly: true, message: profileError('', name) });
      DB.org.groupAdd(name).then(refresh, (e) => orgErr('#oaErr', e));
    });
    $('#oaGroup').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) $('#oaAdd').click();
    });
    $('#orgBody').querySelectorAll('[data-delgroup]').forEach((b) =>
      b.addEventListener('click', () => {
        const name = b.dataset.delgroup;
        if (!confirm(`'${name}' 그룹을 삭제할까요?\n이 그룹 멤버는 무소속이 됩니다. 이미 등록된 기록의 그룹명은 그대로입니다.`)) return;
        DB.org.groupRemove(name).then(refresh, (e) => orgErr('#oaErr', e));
      })
    );
    const drawMembers = (list) => {
      const el = $('#oaMembers');
      if (!el) return;
      el.innerHTML = `<div class="scroll-x"><table class="tbl"><thead><tr><th>이름</th><th>그룹</th><th class="r">기록</th><th class="hide-sm">최근 접속</th><th></th></tr></thead><tbody>${list
        .map(
          (m) => `<tr><td class="wrap">${esc(m.name)}${m.is_admin ? ' <span class="badge">관리자</span>' : ''}${m.id === me.id ? ' <span class="muted sm">(나)</span>' : ''}</td><td>${groupTag(m.group)}</td><td class="r">${m.records}</td><td class="muted hide-sm">${fmtDate(Date.parse(m.last_seen))}</td><td class="r">${m.id === me.id ? '' : `<button class="btn sm danger" data-kick="${m.id}" data-name="${esc(m.name)}">내보내기</button>`}</td></tr>`
        )
        .join('')}</tbody></table></div>`;
      el.querySelectorAll('[data-kick]').forEach((b) =>
        b.addEventListener('click', () => {
          if (!confirm(`${b.dataset.name} 님을 단체에서 내보낼까요?\n이미 등록된 기록은 단체 순위에 남습니다.`)) return;
          DB.org.removeMember(+b.dataset.kick).then(drawMembers, (e) => orgErr('#oaErr', e));
        })
      );
    };
    const seq = viewSeq;
    DB.org.members().then((list) => seq === viewSeq && drawMembers(list), (e) => seq === viewSeq && ($('#oaMembers').innerHTML = errHTML(e)));
  }

  // 단체 범위에서 우측 상단 사용자 칩을 누르면: 단체 이름·그룹 변경
  function openOrgProfileModal() {
    const me = orgInfo.me;
    const groupOptions = [NO_GROUP, ...orgInfo.groups].map((gr) => `<option value="${esc(gr)}"${gr === me.group ? ' selected' : ''}>${esc(gr)}</option>`).join('');
    openModal(
      `<div class="modal-h">단체 사용자 설정</div>
      <div class="modal-b">
        <p>🏢 <b>${esc(orgInfo.org_name)}</b></p>
        <label class="lbl" for="opName">단체에서 쓸 이름</label>
        <input class="inp full" id="opName" maxlength="16" autocomplete="off" value="${esc(me.name)}" />
        <label class="lbl" for="opGroup">그룹</label>
        <select class="inp full" id="opGroup">${groupOptions}</select>
        <p class="form-err hidden" id="opErr"></p>
        <p class="muted sm">전체 순위용 이름은 상단에서 [전체]로 바꾼 뒤 설정할 수 있습니다.</p>
      </div>
      <div class="modal-f"><button class="btn" id="opCancel">취소</button><button class="btn primary" id="opSave">저장</button></div>`,
      () => {
        if (!current) route();
      }
    );
    $('#opCancel').addEventListener('click', closeModal);
    $('#opSave').addEventListener('click', () => {
      const name = $('#opName').value.trim().slice(0, 16);
      if (!name) return orgErr('#opErr', { friendly: true, message: '이름을 입력해 주세요.' });
      if (profileError(name, '')) return orgErr('#opErr', { friendly: true, message: profileError(name, '') });
      DB.org.updateMe(name, $('#opGroup').value).then((r) => {
        orgInfo = r;
        renderUser();
        renderScope();
        closeModal();
        toast('단체 정보를 저장했습니다');
      }, (e) => orgErr('#opErr', e));
    });
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
    } else if (view === 'org') {
      setActiveNav('org');
      renderOrg();
    } else {
      setActiveNav('');
      renderDashboard();
    }
    if (view !== 'org' && inOrg()) {
      main.insertAdjacentHTML(
        'afterbegin',
        `<div class="scope-banner">🏢 <b>${esc(orgInfo.org_name)}</b> 단체 기록을 보고 있습니다. 이 화면의 순위와 등록은 단체 멤버끼리만 공유됩니다. <button class="btn sm" data-scope="public">전체 기록 보기</button></div>`
      );
    }
    window.scrollTo(0, 0);
  }

  /* ---------------- 초기화 ---------------- */
  renderNav();
  renderUser();
  $('#scopeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]');
    if (b) switchScope(b.dataset.s);
  });
  main.addEventListener('click', (e) => {
    const b = e.target.closest('[data-scope]');
    if (b) switchScope(b.dataset.scope);
    const h = e.target.closest('[data-orghelp]');
    if (h && h.dataset.orghelp === 'intro') showOrgIntro();
    if (h && h.dataset.orghelp === 'toggle') {
      store.set('wp_org_help', helpOff() ? 'on' : 'off');
      applyHelpPref();
    }
  });
  applyHelpPref();
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
  const scopeAtStart = DB.scope;
  route();
  // 단체 정보를 불러온 뒤 단체 범위면(또는 범위가 바뀌었으면) 이름·그룹 표시를 위해 다시 그린다
  loadOrg()
    .then(() => {
      if ((DB.scope === 'org' || DB.scope !== scopeAtStart) && !current && !modalOn) route();
    })
    // 첫 방문이면 단체 모드 안내를 한 번 띄운다 (서버에 단체 기능이 준비된 경우에만)
    .then(() => (store.get('wp_org_intro_seen', 0) || DB.org.joined ? false : DB.org.ready()))
    .then((ready) => {
      if (ready && !modalOn && !current) showOrgIntro();
    });
  // 방문 통계: 브라우저 탭(세션)당 한 번
  try {
    if (!sessionStorage.getItem('wp_visit')) {
      sessionStorage.setItem('wp_visit', '1');
      DB.track('visit');
    }
  } catch (e) { /* 저장소 사용 불가 환경은 통계 생략 */ }
})();
