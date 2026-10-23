// 업무(처럼 보이는) 게임 모음.
// 각 게임은 mount(root, ctx)로 시작하고 { destroy() }를 반환한다.
// ctx.finish(score): 정상 완료 → 실적 등록 / ctx.fail(msg): 실패 / ctx.paused(): 보스 화면·모달 표시 중 여부
window.WP_GAMES = [];

(function () {
  'use strict';
  const G = window.WP_GAMES;
  const rand = (n) => Math.floor(Math.random() * n);
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const now = () => performance.now();
  const sec1 = (s) => s.toFixed(1) + '초';
  const sec2 = (s) => s.toFixed(2) + '초';

  function onKey(handler) {
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }

  // 타이머/타임아웃을 한 번에 정리하기 위한 도우미
  function timers() {
    const ids = [];
    return {
      timeout(fn, ms) { const id = setTimeout(fn, ms); ids.push(['t', id]); return id; },
      interval(fn, ms) { const id = setInterval(fn, ms); ids.push(['i', id]); return id; },
      clear() { ids.forEach(([k, id]) => (k === 't' ? clearTimeout(id) : clearInterval(id))); ids.length = 0; },
    };
  }

  function bump(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  /* ------------------------------------------------------------------
   * WK-101 주간 보고서 작성 (타자 연습)
   * ------------------------------------------------------------------ */
  const SENTENCES = [
    '금주 주요 업무는 3분기 실적 분석 및 차주 회의 자료 준비입니다.',
    '해당 건은 관련 부서와 협의 후 차주 중으로 회신드리겠습니다.',
    '첨부한 파일을 확인하시고 검토 의견 부탁드립니다.',
    '고객사 요구사항을 반영하여 일정을 일부 조정하였습니다.',
    '예산 집행 현황은 별첨 자료를 참고해 주시기 바랍니다.',
    '회의 결과에 따라 담당자별 후속 조치를 진행할 예정입니다.',
    '시스템 점검으로 인해 금일 오후 서비스가 일시 중단됩니다.',
    '말씀하신 내용은 확인 후 다시 공유드리도록 하겠습니다.',
    '프로젝트 진행 상황을 주간 단위로 정리하여 보고드립니다.',
    '업무 효율화를 위해 결재 프로세스를 간소화할 예정입니다.',
    '다음 주 월요일 오전 열 시에 전체 회의가 있습니다.',
    '협조해 주셔서 감사합니다. 좋은 하루 보내세요.',
    '요청하신 자료는 공유 폴더에 업로드해 두었습니다.',
    '일정 지연에 대한 원인 분석과 대응 방안을 정리했습니다.',
  ];
  const JUNG2 = [9, 10, 11, 14, 15, 16, 19];
  const JONG2 = [3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18];
  // 한글 타수: 자모 단위 키 입력 수로 환산
  function strokes(str) {
    let n = 0;
    for (const ch of str) {
      const c = ch.charCodeAt(0);
      if (c >= 0xac00 && c <= 0xd7a3) {
        const i = c - 0xac00;
        const jung = Math.floor((i % 588) / 28);
        const jong = i % 28;
        n += 1 + (JUNG2.includes(jung) ? 2 : 1) + (jong === 0 ? 0 : JONG2.includes(jong) ? 2 : 1);
      } else {
        n += 1;
      }
    }
    return n;
  }

  G.push({
    id: 'report',
    code: 'WK-101',
    title: '주간 보고서 작성',
    short: '보고서 문장 입력 속도 측정',
    desc: '주간 업무 보고 문장 5개를 정확하게 입력합니다. 완료 시 처리 속도(타/분)가 집계됩니다.',
    howto: ['화면의 문장을 똑같이 입력하고 Enter', '오타가 있으면 제출되지 않습니다 (붙여넣기 불가)', '첫 글자를 입력하는 순간부터 시간이 측정됩니다'],
    higher: true,
    fmt: (s) => s.toLocaleString() + '타/분',
    mount(root, ctx) {
      const T = timers();
      const list = shuffle(SENTENCES).slice(0, 5);
      let idx = 0, t0 = 0, total = 0, errs = 0, composing = false, pending = false;
      root.innerHTML = `
        <div class="g-stats">
          <span>진행 <b data-k="prog">1 / 5</b></span>
          <span>경과 <b data-k="time">0.0초</b></span>
          <span>오타 <b data-k="err">0</b></span>
          <span>현재 속도 <b data-k="cpm">-</b></span>
        </div>
        <div class="doc-paper">
          <div class="doc-title">2026년 4분기 주간 업무 보고서</div>
          <div class="doc-meta">작성자: 본인 · 문서번호 RPT-${1000 + rand(9000)}</div>
          <ol class="doc-lines"></ol>
          <div class="t-target"></div>
        </div>
        <input class="inp t-input" type="text" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="여기에 입력 후 Enter" />`;
      const q = (k) => root.querySelector(`[data-k="${k}"]`);
      const target = root.querySelector('.t-target');
      const inp = root.querySelector('.t-input');
      const lines = root.querySelector('.doc-lines');

      function paint() {
        const s = list[idx], v = inp.value;
        let html = '';
        for (let i = 0; i < s.length; i++) {
          let cls = '';
          if (i < v.length) cls = v[i] === s[i] ? 'ok' : i === v.length - 1 ? 'cur' : 'ng';
          html += `<span class="${cls}">${s[i]}</span>`;
        }
        target.innerHTML = html;
      }
      function tick() {
        if (!t0) return;
        const el = (now() - t0) / 1000;
        q('time').textContent = el.toFixed(1) + '초';
        if (total) q('cpm').textContent = Math.round(total / (el / 60)) + '타/분';
      }
      function submit() {
        const s = list[idx];
        if (inp.value.trim() === s) {
          total += strokes(s);
          const li = document.createElement('li');
          li.textContent = s;
          lines.appendChild(li);
          idx++;
          inp.value = '';
          if (idx >= list.length) {
            ctx.finish(Math.round(total / ((now() - t0) / 60000)));
            return;
          }
          q('prog').textContent = idx + 1 + ' / ' + list.length;
          paint();
        } else if (inp.value.trim()) {
          errs++;
          q('err').textContent = errs;
          bump(inp, 'shake');
        }
      }
      inp.addEventListener('input', () => {
        if (!t0 && inp.value) t0 = now();
        paint();
      });
      inp.addEventListener('paste', (e) => e.preventDefault());
      inp.addEventListener('compositionstart', () => (composing = true));
      inp.addEventListener('compositionend', () => {
        composing = false;
        if (pending) {
          pending = false;
          T.timeout(submit, 0);
        }
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (e.isComposing || composing) { pending = true; return; }
        submit();
      });
      T.interval(tick, 100);
      paint();
      T.timeout(() => inp.focus(), 0);
      return { destroy: T.clear };
    },
  });

  // 지뢰찾기 공용 보드. 엑셀처럼 열 이름(A, B, … Z, AA …)과 행 번호를 붙인다.
  const colName = (x) => (x >= 26 ? String.fromCharCode(64 + Math.floor(x / 26)) : '') + String.fromCharCode(65 + (x % 26));
  function mountMines(root, ctx, { W, H, M, hard = false, loseMsg }) {
    const T = timers();
    const cells = Array.from({ length: W * H }, () => ({ mine: false, n: 0, open: false, flag: false }));
    let started = false, ended = false, t0 = 0, revealed = 0, flags = 0, flagMode = false;
    const cols = Array.from({ length: W }, (_, x) => colName(x));
    root.innerHTML = `
      <div class="g-stats">
        <span>잔여 리스크 <b data-k="left">${M}</b></span>
        <span>경과 <b data-k="time">0.0초</b></span>
        <button class="btn sm" data-k="mode">표시 모드: OFF</button>
      </div>
      <div class="sheet-wrap"><table class="sheet ms${hard ? ' hard' : ''}">
        <thead><tr><th></th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${Array.from({ length: H }, (_, y) => `<tr><th>${y + 1}</th>${cols.map((_, x) => `<td data-i="${y * W + x}"></td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    const q = (k) => root.querySelector(`[data-k="${k}"]`);
    const tds = Array.from(root.querySelectorAll('td[data-i]'));
    const table = root.querySelector('table');

    function nb(i) {
      const x = i % W, y = Math.floor(i / W), r = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < W && ny >= 0 && ny < H) r.push(ny * W + nx);
        }
      return r;
    }
    function place(safe) {
      const banned = new Set([safe, ...nb(safe)]);
      let c = 0;
      while (c < M) {
        const i = rand(W * H);
        if (banned.has(i) || cells[i].mine) continue;
        cells[i].mine = true;
        c++;
      }
      cells.forEach((cell, i) => (cell.n = nb(i).filter((j) => cells[j].mine).length));
    }
    function draw(i) {
      const c = cells[i], td = tds[i];
      td.className = c.open ? 'open n' + c.n : c.flag ? 'flag' : '';
      td.textContent = c.open ? (c.mine ? '✱' : c.n || '') : c.flag ? '⚑' : '';
    }
    function open(i) {
      const c = cells[i];
      if (c.open || c.flag) return;
      if (!started) {
        started = true;
        place(i);
        t0 = now();
        T.interval(() => (q('time').textContent = ((now() - t0) / 1000).toFixed(1) + '초'), 100);
      }
      if (c.mine) return lose(i);
      const st = [i];
      while (st.length) {
        const k = st.pop(), d = cells[k];
        if (d.open || d.flag) continue;
        d.open = true;
        revealed++;
        draw(k);
        if (d.n === 0) nb(k).forEach((j) => !cells[j].open && st.push(j));
      }
      if (revealed === W * H - M) win();
    }
    function chord(i) {
      const c = cells[i];
      const around = nb(i);
      if (around.filter((j) => cells[j].flag).length !== c.n) return;
      for (const j of around) {
        if (ended) return;
        open(j);
      }
    }
    function toggleFlag(i) {
      const c = cells[i];
      if (c.open) return;
      c.flag = !c.flag;
      flags += c.flag ? 1 : -1;
      q('left').textContent = M - flags;
      draw(i);
    }
    function lose(i) {
      ended = true;
      T.clear();
      cells.forEach((c, k) => {
        if (c.mine) { c.open = true; draw(k); tds[k].classList.add('mine'); }
      });
      tds[i].classList.add('boom');
      T.timeout(() => ctx.fail(loseMsg), 700);
    }
    function win() {
      ended = true;
      ctx.finish(Math.round((now() - t0) / 100) / 10);
    }
    table.addEventListener('click', (e) => {
      const td = e.target.closest('td[data-i]');
      if (!td || ended || ctx.paused()) return;
      const i = +td.dataset.i;
      if (cells[i].open) return chord(i);
      flagMode ? toggleFlag(i) : open(i);
    });
    table.addEventListener('contextmenu', (e) => {
      const td = e.target.closest('td[data-i]');
      if (!td) return;
      e.preventDefault();
      if (!ended && !ctx.paused()) toggleFlag(+td.dataset.i);
    });
    q('mode').addEventListener('click', () => {
      flagMode = !flagMode;
      q('mode').textContent = '표시 모드: ' + (flagMode ? 'ON' : 'OFF');
      q('mode').classList.toggle('primary', flagMode);
    });
    return { destroy: T.clear };
  }

  /* ------------------------------------------------------------------
   * WK-102 리스크 점검 (지뢰찾기)
   * ------------------------------------------------------------------ */
  G.push({
    id: 'risk',
    code: 'WK-102',
    title: '리스크 점검',
    short: '점검표에 숨은 리스크 회피',
    desc: '9×9 점검표에 숨겨진 리스크 10건을 피해서 모든 안전 항목을 확인합니다.',
    howto: ['셀 클릭: 항목 확인 · 우클릭: 리스크 표시', '숫자는 주변 8칸에 있는 리스크 개수입니다', '확인된 숫자 클릭 시 주변 일괄 확인 · 모바일은 [표시 모드] 사용'],
    higher: false,
    fmt: sec1,
    mount(root, ctx) {
      return mountMines(root, ctx, { W: 9, H: 9, M: 10, loseMsg: '리스크가 발생했습니다. 점검표를 다시 작성해 주세요.' });
    },
  });

  /* ------------------------------------------------------------------
   * WK-103 예산 통합 (2048)
   * ------------------------------------------------------------------ */
  const TILE_BG = ['#eef2f7', '#dfe9f8', '#c9dbf5', '#a9c6ef', '#86ade6', '#5f90dc', '#3f76cf', '#2d5fb4', '#234c93', '#1b3b74', '#142c57', '#0d1f3f'];
  G.push({
    id: 'budget',
    code: 'WK-103',
    title: '예산 통합',
    short: '같은 금액 예산 항목 병합',
    desc: '같은 금액의 예산 항목을 합쳐 통합 예산을 키웁니다. 더 이상 합칠 수 없으면 결산이 마감됩니다.',
    howto: ['방향키 / WASD (모바일은 스와이프)로 항목 이동', '같은 금액끼리 부딪히면 합쳐지고 실적이 오릅니다', '[결산 제출]로 언제든 중간 제출할 수 있습니다'],
    higher: true,
    fmt: (s) => s.toLocaleString() + '백만원',
    mount(root, ctx) {
      const T = timers();
      const N = 4;
      const b = Array(N * N).fill(0);
      let score = 0, over = false;
      root.innerHTML = `
        <div class="g-stats">
          <span>통합 실적 <b data-k="score">0</b> 백만원</span>
          <span>최대 항목 <b data-k="max">2</b></span>
          <button class="btn sm" data-k="submit">결산 제출</button>
        </div>
        <div class="g2048"></div>
        <p class="hint">단위: 백만원 · 방향키로 같은 금액 항목을 합치세요.</p>`;
      const q = (k) => root.querySelector(`[data-k="${k}"]`);
      const grid = root.querySelector('.g2048');

      function add() {
        const empty = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
        if (!empty.length) return -1;
        const i = empty[rand(empty.length)];
        b[i] = Math.random() < 0.9 ? 2 : 4;
        return i;
      }
      function indexLines(dir) {
        const L = [];
        for (let r = 0; r < N; r++) {
          const row = [];
          for (let c = 0; c < N; c++) {
            row.push(
              dir === 'left' ? r * N + c :
              dir === 'right' ? r * N + (N - 1 - c) :
              dir === 'up' ? c * N + r : (N - 1 - c) * N + r
            );
          }
          L.push(row);
        }
        return L;
      }
      function slide(idx) {
        const vals = idx.map((i) => b[i]).filter((v) => v);
        const out = [];
        let gained = 0;
        for (let k = 0; k < vals.length; k++) {
          if (vals[k] === vals[k + 1]) { out.push(vals[k] * 2); gained += vals[k] * 2; k++; }
          else out.push(vals[k]);
        }
        while (out.length < N) out.push(0);
        let moved = false;
        idx.forEach((i, k) => { if (b[i] !== out[k]) { moved = true; b[i] = out[k]; } });
        return { moved, gained };
      }
      function canMove() {
        for (let i = 0; i < N * N; i++) {
          if (!b[i]) return true;
          if (i % N < N - 1 && b[i] === b[i + 1]) return true;
          if (i + N < N * N && b[i] === b[i + N]) return true;
        }
        return false;
      }
      function render(ni) {
        grid.innerHTML = b
          .map((v, i) => {
            if (!v) return '<div class="tile"></div>';
            const lv = Math.min(Math.log2(v) - 1, TILE_BG.length - 1);
            const fg = lv >= 4 ? '#fff' : '#1f2a3c';
            const fs = v >= 1024 ? 'small' : '';
            return `<div class="tile ${i === ni ? 'new' : ''} ${fs}" style="background:${TILE_BG[lv]};color:${fg}">${v.toLocaleString()}</div>`;
          })
          .join('');
        q('score').textContent = score.toLocaleString();
        q('max').textContent = Math.max(...b).toLocaleString();
      }
      function move(dir) {
        if (over || ctx.paused()) return;
        let moved = false;
        indexLines(dir).forEach((l) => {
          const r = slide(l);
          moved = moved || r.moved;
          score += r.gained;
        });
        if (!moved) return;
        render(add());
        if (!canMove()) {
          over = true;
          T.timeout(() => ctx.finish(score), 500);
        }
      }
      const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
      const offKey = onKey((e) => {
        if (e.target.tagName === 'INPUT') return;
        const dir = KEYS[e.key];
        if (!dir) return;
        e.preventDefault();
        move(dir);
      });
      let sx = 0, sy = 0;
      grid.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      grid.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
      grid.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
        move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      });
      q('submit').addEventListener('click', () => {
        if (over) return;
        over = true;
        score > 0 ? ctx.finish(score) : ctx.fail('통합된 예산이 없어 결산을 제출할 수 없습니다.');
      });
      add();
      add();
      render();
      return { destroy() { T.clear(); offKey(); } };
    },
  });

  /* ------------------------------------------------------------------
   * WK-104 결재 순서 처리 (1 to 25)
   * ------------------------------------------------------------------ */
  G.push({
    id: 'approve',
    code: 'WK-104',
    title: '결재 순서 처리',
    short: '문서 1~25번 순서대로 결재',
    desc: '흩어진 결재 문서 25건을 번호 순서대로 빠르게 처리합니다.',
    howto: ['문서 #01부터 #25까지 순서대로 클릭', '순서가 틀리면 1초 패널티가 부과됩니다', '시작 버튼을 누르는 즉시 시간이 측정됩니다'],
    higher: false,
    fmt: sec2,
    mount(root, ctx) {
      const T = timers();
      let next = 1, pen = 0;
      const t0 = now();
      const elapsed = () => (now() - t0) / 1000 + pen;
      root.innerHTML = `
        <div class="g-stats">
          <span>다음 결재 <b data-k="next">문서 #01</b></span>
          <span>경과 <b data-k="time">0.00초</b></span>
          <span>오처리 <b data-k="pen">0</b>건 (+1초)</span>
        </div>
        <div class="g-grid25">${shuffle(Array.from({ length: 25 }, (_, i) => i + 1))
          .map((n) => `<button class="doc-btn" data-n="${n}"><small>결재요청</small>#${String(n).padStart(2, '0')}</button>`)
          .join('')}</div>`;
      const q = (k) => root.querySelector(`[data-k="${k}"]`);
      T.interval(() => (q('time').textContent = elapsed().toFixed(2) + '초'), 50);
      root.querySelector('.g-grid25').addEventListener('click', (e) => {
        const btn = e.target.closest('.doc-btn');
        if (!btn || btn.disabled || ctx.paused()) return;
        if (+btn.dataset.n === next) {
          btn.classList.add('done');
          btn.disabled = true;
          btn.innerHTML = '<small>처리완료</small>✔';
          next++;
          if (next > 25) return ctx.finish(Math.round(elapsed() * 100) / 100);
          q('next').textContent = '문서 #' + String(next).padStart(2, '0');
        } else {
          pen++;
          q('pen').textContent = pen;
          bump(btn, 'ng');
        }
      });
      return { destroy: T.clear };
    },
  });

  /* ------------------------------------------------------------------
   * WK-105 받은편지함 정리 (메일 분류)
   * ------------------------------------------------------------------ */
  const WORK_MAILS = [
    ['김부장', '[회신요망] 3분기 실적 보고서 검토 요청'],
    ['인사팀', '2026년 연말정산 서류 제출 안내'],
    ['재무팀 이과장', '법인카드 사용내역 확인 부탁드립니다'],
    ['IT지원센터', '[공지] 사내 VPN 정기 점검 일정 안내'],
    ['고객사 박팀장', '견적서 수정본 송부드립니다'],
    ['총무팀', '회의실 예약 변경 확인 부탁드립니다'],
    ['최대리', '오늘 회의 자료 공유드립니다'],
    ['기획팀', '신규 프로젝트 킥오프 미팅 일정'],
    ['법무팀', '계약서 검토 의견 회신'],
    ['대표이사', '전 직원 타운홀 미팅 안내'],
    ['보안팀', '[필수] 4분기 정보보안 교육 이수 안내'],
    ['영업팀 정과장', '거래처 미팅 결과 공유'],
    ['교육팀', '리더십 교육 신청 안내'],
    ['개발팀', '배포 일정 변경 안내 (v2.3)'],
    ['구매팀', '사무용품 신청 마감 안내'],
    ['한차장', 'RE: 내일 오전 보고 일정 확인'],
  ];
  const SPAM_MAILS = [
    ['(광고)쇼핑몰', '[광고] 오늘 단 하루! 전 품목 90% 할인'],
    ['당첨안내센터', '축하합니다! 최신 스마트폰에 당첨되셨습니다'],
    ['대출상담', '[광고] 신용등급 무관 즉시 대출 승인'],
    ['Account Team', '비밀번호가 만료되었습니다. 지금 바로 클릭하세요'],
    ['해외배송', '고객님의 택배가 보류 중입니다 (주소 확인 필요)'],
    ['투자클럽', '[광고] 이번 주 급등 종목 무료 공개'],
    ['Prince Abdul', 'URGENT: Business Proposal $5,000,000'],
    ['쿠폰발송', '[광고] 미사용 쿠폰이 곧 소멸됩니다'],
    ['보안경고', '귀하의 PC가 바이러스에 감염되었습니다!!!'],
    ['오늘의운세', '[광고] 2027년 당신의 재물운은?'],
    ['다이어트연구소', '[광고] 한 달 만에 10kg 감량 비법'],
    ['lucky@win.biz', 'You are our 1,000,000th visitor!'],
    ['인사팀(외부)', '[긴급] 급여 계좌 재등록 요청 - 링크 클릭'],
  ];
  G.push({
    id: 'inbox',
    code: 'WK-105',
    title: '받은편지함 정리',
    short: '업무 메일 / 스팸 분류',
    desc: '40초 동안 쏟아지는 메일을 업무 메일과 스팸으로 분류합니다. 정확도가 실적입니다.',
    howto: ['← 키 또는 [스팸] 버튼: 스팸 처리', '→ 키 또는 [업무함] 버튼: 업무 메일 보관', '정답 +1건, 오분류 -1건'],
    higher: true,
    fmt: (s) => s + '건',
    mount(root, ctx) {
      const T = timers();
      const LIMIT = 40;
      let ok = 0, ng = 0, cur = null, done = false;
      const t0 = now();
      root.innerHTML = `
        <div class="g-stats">
          <span>남은 시간 <b data-k="time">${LIMIT}.0초</b></span>
          <span>정상 분류 <b data-k="ok">0</b></span>
          <span>오분류 <b data-k="ng">0</b></span>
        </div>
        <div class="timebar"><i data-k="bar"></i></div>
        <div class="mail-card" data-k="card"></div>
        <div class="mail-actions">
          <button class="btn danger lg" data-k="spam">🗑 스팸 (←)</button>
          <button class="btn primary lg" data-k="work">📁 업무함 (→)</button>
        </div>
        <table class="tbl mail-log"><thead><tr><th>보낸사람</th><th>제목</th><th>처리</th></tr></thead><tbody data-k="log"></tbody></table>`;
      const q = (k) => root.querySelector(`[data-k="${k}"]`);
      function nextMail() {
        const spam = Math.random() < 0.45;
        const src = spam ? SPAM_MAILS : WORK_MAILS;
        let m;
        do m = src[rand(src.length)]; while (cur && m[1] === cur.subject);
        const h = 9 + rand(9), mi = rand(60);
        cur = { spam, from: m[0], subject: m[1], time: `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` };
        const card = q('card');
        card.innerHTML = `<div class="mail-from"><span class="avatar sm">${cur.from[0]}</span><b></b><span class="muted">${cur.time}</span></div><div class="mail-subj"></div><div class="mail-prev muted">본문 미리보기를 불러오는 중입니다…</div>`;
        card.querySelector('b').textContent = cur.from;
        card.querySelector('.mail-subj').textContent = cur.subject;
        bump(card, 'slide-in');
      }
      function judge(isSpam) {
        if (done || ctx.paused()) return;
        const right = isSpam === cur.spam;
        right ? ok++ : ng++;
        q('ok').textContent = ok;
        q('ng').textContent = ng;
        const tr = document.createElement('tr');
        tr.className = right ? '' : 'row-ng';
        tr.innerHTML = '<td></td><td></td><td></td>';
        tr.children[0].textContent = cur.from;
        tr.children[1].textContent = cur.subject;
        tr.children[2].textContent = (isSpam ? '스팸' : '업무함') + (right ? ' ✔' : ' ✖');
        const log = q('log');
        log.prepend(tr);
        while (log.children.length > 5) log.lastChild.remove();
        nextMail();
      }
      T.interval(() => {
        const left = Math.max(0, LIMIT - (now() - t0) / 1000);
        q('time').textContent = left.toFixed(1) + '초';
        q('bar').style.width = (left / LIMIT) * 100 + '%';
        if (left <= 0 && !done) {
          done = true;
          ctx.finish(Math.max(0, ok - ng));
        }
      }, 100);
      q('spam').addEventListener('click', () => judge(true));
      q('work').addEventListener('click', () => judge(false));
      const offKey = onKey((e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); judge(true); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); judge(false); }
      });
      nextMail();
      return { destroy() { T.clear(); offKey(); } };
    },
  });

  /* ------------------------------------------------------------------
   * WK-106 경비 정산 검증 (암산)
   * ------------------------------------------------------------------ */
  const EXPENSES = ['사무용품', '택시비', '식대', '회의 다과', 'SW 구독료', '출장 숙박', '택배비', '도서 구입', '교육비', '복사 용지', '주차비', '접대비'];
  G.push({
    id: 'settle',
    code: 'WK-106',
    title: '경비 정산 검증',
    short: '정산서 합계 금액 검산',
    desc: '60초 동안 경비 정산서의 합계 금액을 계산해 입력합니다. 정확히 검산한 건수가 실적입니다.',
    howto: ['정산서 항목의 합계(원)를 입력하고 Enter', '할인 항목은 차감해야 합니다', '쉼표는 입력하지 않아도 됩니다'],
    higher: true,
    fmt: (s) => s + '건',
    mount(root, ctx) {
      const T = timers();
      const LIMIT = 60;
      let solved = 0, wrong = 0, answer = 0, done = false;
      const t0 = now();
      root.innerHTML = `
        <div class="g-stats">
          <span>남은 시간 <b data-k="time">${LIMIT}.0초</b></span>
          <span>검산 완료 <b data-k="ok">0</b>건</span>
          <span>오류 <b data-k="ng">0</b>건</span>
        </div>
        <div class="timebar"><i data-k="bar"></i></div>
        <div class="doc-paper settle">
          <div class="doc-title">경비 정산서 <span class="muted" data-k="no"></span></div>
          <table class="tbl"><thead><tr><th>No</th><th>항목</th><th class="r">금액(원)</th></tr></thead><tbody data-k="rows"></tbody>
          <tfoot><tr><th colspan="2">합계</th><th class="r"><input class="inp num" data-k="inp" inputmode="numeric" autocomplete="off" placeholder="금액 입력" /></th></tr></tfoot></table>
          <div class="feedback" data-k="fb">&nbsp;</div>
        </div>`;
      const q = (k) => root.querySelector(`[data-k="${k}"]`);
      const inp = q('inp');
      function newProblem() {
        const k = solved < 3 ? 2 : solved < 8 ? 3 : 4;
        const names = shuffle(EXPENSES).slice(0, k);
        const items = names.map((n) => [n, (rand(90) + 10) * 100]);
        if (k >= 3 && Math.random() < 0.35) items.push(['할인', -(rand(9) + 1) * 100]);
        answer = items.reduce((s, it) => s + it[1], 0);
        q('no').textContent = 'EXP-' + (2600 + rand(400));
        q('rows').innerHTML = items
          .map((it, i) => `<tr${it[1] < 0 ? ' class="minus"' : ''}><td>${i + 1}</td><td>${it[0]}</td><td class="r">${it[1].toLocaleString()}</td></tr>`)
          .join('');
        inp.value = '';
        inp.focus();
      }
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || done || ctx.paused()) return;
        e.preventDefault();
        const v = parseInt(inp.value.replace(/[^\d-]/g, ''), 10);
        if (Number.isNaN(v)) return;
        const fb = q('fb');
        if (v === answer) {
          solved++;
          q('ok').textContent = solved;
          fb.className = 'feedback ok';
          fb.textContent = '✔ 검산 완료';
        } else {
          wrong++;
          q('ng').textContent = wrong;
          fb.className = 'feedback ng';
          fb.textContent = `✖ 금액 불일치 (정답 ${answer.toLocaleString()}원)`;
        }
        newProblem();
      });
      T.interval(() => {
        const left = Math.max(0, LIMIT - (now() - t0) / 1000);
        q('time').textContent = left.toFixed(1) + '초';
        q('bar').style.width = (left / LIMIT) * 100 + '%';
        if (left <= 0 && !done) {
          done = true;
          solved > 0 ? ctx.finish(solved) : ctx.fail('검산 완료된 정산서가 없습니다.');
        }
      }, 100);
      newProblem();
      return { destroy: T.clear };
    },
  });

  /* ------------------------------------------------------------------
   * WK-107 긴급 결재 대응 (반응속도)
   * ------------------------------------------------------------------ */
  G.push({
    id: 'urgent',
    code: 'WK-107',
    title: '긴급 결재 대응',
    short: '긴급 결재 요청 반응 속도',
    desc: '긴급 결재 요청 알림이 뜨는 순간 최대한 빨리 승인합니다. 5회 평균 응답 시간이 실적입니다.',
    howto: ['대기 화면에서 기다리다가 알림이 뜨면 즉시 클릭 (Space 키 가능)', '알림 전에 클릭하면 해당 회차를 다시 진행합니다', '총 5회 진행'],
    higher: false,
    fmt: (s) => s + 'ms',
    mount(root, ctx) {
      const T = timers();
      const ROUNDS = 5;
      let round = 0, state = 'wait', tGo = 0, goId = 0;
      const res = [];
      root.innerHTML = `
        <div class="g-stats">
          <span>회차 <b data-k="round">1 / ${ROUNDS}</b></span>
          <span>최근 <b data-k="last">-</b></span>
          <span>평균 <b data-k="avg">-</b></span>
        </div>
        <div class="react-pad" data-k="pad"></div>`;
      const q = (k) => root.querySelector(`[data-k="${k}"]`);
      const pad = q('pad');
      function show(cls, html) { pad.className = 'react-pad ' + cls; pad.innerHTML = html; }
      function ready() {
        state = 'ready';
        q('round').textContent = round + 1 + ' / ' + ROUNDS;
        show('waiting', '<div class="big-ico">📥</div><div>결재 대기 중…</div><div class="muted">긴급 요청이 오면 즉시 클릭하세요</div>');
        goId = T.timeout(go, 1500 + rand(2500));
      }
      function go() {
        if (ctx.paused()) { goId = T.timeout(go, 500); return; }
        state = 'go';
        tGo = now();
        show('alert', '<div class="big-ico">🔔</div><div class="alert-title">긴급 결재 요청</div><div>지금 클릭하여 승인!</div>');
      }
      function hit() {
        if (state === 'ready') {
          clearTimeout(goId);
          state = 'wait';
          show('early', '<div class="big-ico">⚠️</div><div>요청 전에 승인했습니다.</div><div class="muted">잠시 후 다시 대기합니다</div>');
          T.timeout(ready, 1200);
        } else if (state === 'go') {
          const ms = Math.round(now() - tGo);
          res.push(ms);
          round++;
          state = 'wait';
          const avg = Math.round(res.reduce((a, b) => a + b, 0) / res.length);
          q('last').textContent = ms + 'ms';
          q('avg').textContent = avg + 'ms';
          show('approved', `<div class="big-ico">✅</div><div>승인 완료 · <b>${ms}ms</b></div>`);
          if (round >= ROUNDS) T.timeout(() => ctx.finish(avg), 800);
          else T.timeout(ready, 1000);
        }
      }
      pad.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(); });
      const offKey = onKey((e) => {
        if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) hit(); }
      });
      ready();
      return { destroy() { T.clear(); offKey(); } };
    },
  });

  /* ------------------------------------------------------------------
   * WK-108 증빙 서류 대조 (카드 짝맞추기)
   * ------------------------------------------------------------------ */
  const DOCS = [['📄', '계약서'], ['🧾', '영수증'], ['📊', '보고서'], ['📅', '일정표'], ['💼', '제안서'], ['📋', '회의록'], ['🗂️', '인사기록'], ['📑', '견적서']];
  G.push({
    id: 'match',
    code: 'WK-108',
    title: '증빙 서류 대조',
    short: '같은 증빙 서류 짝 맞추기',
    desc: '뒤집힌 대외비 서류 16장 중 같은 종류의 서류 8쌍을 찾아 대조합니다.',
    howto: ['서류를 두 장씩 열람합니다', '같은 종류면 대조 완료, 다르면 다시 덮입니다', '첫 열람부터 시간이 측정됩니다'],
    higher: false,
    fmt: sec1,
    mount(root, ctx) {
      const T = timers();
      const deck = shuffle([...DOCS.keys(), ...DOCS.keys()]);
      const matched = new Set();
      let open = [], lock = false, t0 = 0, moves = 0;
      root.innerHTML = `
        <div class="g-stats">
          <span>대조 완료 <b data-k="pairs">0 / 8</b></span>
          <span>열람 횟수 <b data-k="moves">0</b></span>
          <span>경과 <b data-k="time">0.0초</b></span>
        </div>
        <div class="g-cards">${deck
          .map((_, i) => `<button class="card" data-i="${i}"><span class="back">대외비<small>DOC-${String(i + 1).padStart(2, '0')}</small></span><span class="front"></span></button>`)
          .join('')}</div>`;
      const q = (k) => root.querySelector(`[data-k="${k}"]`);
      const cards = Array.from(root.querySelectorAll('.card'));
      function flip(i, up) {
        const c = cards[i];
        c.classList.toggle('up', up);
        c.querySelector('.front').innerHTML = up ? `<span class="ico">${DOCS[deck[i]][0]}</span>${DOCS[deck[i]][1]}` : '';
      }
      root.querySelector('.g-cards').addEventListener('click', (e) => {
        const c = e.target.closest('.card');
        if (!c || lock || ctx.paused()) return;
        const i = +c.dataset.i;
        if (matched.has(i) || open.includes(i)) return;
        if (!t0) {
          t0 = now();
          T.interval(() => (q('time').textContent = ((now() - t0) / 1000).toFixed(1) + '초'), 100);
        }
        flip(i, true);
        open.push(i);
        if (open.length < 2) return;
        moves++;
        q('moves').textContent = moves;
        const [a, b] = open;
        open = [];
        if (deck[a] === deck[b]) {
          matched.add(a).add(b);
          cards[a].classList.add('matched');
          cards[b].classList.add('matched');
          q('pairs').textContent = matched.size / 2 + ' / 8';
          if (matched.size === 16) ctx.finish(Math.round((now() - t0) / 100) / 10);
        } else {
          lock = true;
          T.timeout(() => { flip(a, false); flip(b, false); lock = false; }, 700);
        }
      });
      return { destroy: T.clear };
    },
  });

  /* ------------------------------------------------------------------
   * WK-109 데이터 파이프라인 구축 (스네이크)
   * ------------------------------------------------------------------ */
  G.push({
    id: 'pipeline',
    code: 'WK-109',
    title: '데이터 파이프라인 구축',
    short: '데이터를 수집하며 파이프라인 확장',
    desc: '파이프라인을 조종해 데이터 블록을 수집합니다. 벽이나 자기 자신에 부딪히면 장애가 발생합니다.',
    howto: ['방향키 / WASD (모바일은 하단 버튼)로 이동', '첫 방향키 입력 시 가동 시작', '수집할수록 처리 속도가 빨라집니다'],
    higher: true,
    fmt: (s) => s + '건',
    mount(root, ctx) {
      const T = timers();
      const COLS = 24, ROWS = 15;
      root.innerHTML = `
        <div class="g-stats">
          <span>수집 데이터 <b data-k="score">0</b>건</span>
          <span>처리 속도 <b data-k="speed">1.0x</b></span>
          <span class="muted" data-k="msg">방향키를 누르면 가동됩니다</span>
        </div>
        <div class="canvas-wrap"><canvas></canvas></div>
        <div class="dpad">
          <button class="btn" data-d="up">▲</button>
          <div><button class="btn" data-d="left">◀</button><button class="btn" data-d="down">▼</button><button class="btn" data-d="right">▶</button></div>
        </div>`;
      const q = (k) => root.querySelector(`[data-k="${k}"]`);
      const canvas = root.querySelector('canvas');
      const cs = Math.max(12, Math.floor(Math.min(root.clientWidth || 600, 720) / COLS));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = COLS * cs * dpr;
      canvas.height = ROWS * cs * dpr;
      canvas.style.width = COLS * cs + 'px';
      canvas.style.height = ROWS * cs + 'px';
      const g = canvas.getContext('2d');
      g.scale(dpr, dpr);

      let snake = [{ x: 6, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 7 }];
      let dir = { x: 1, y: 0 };
      const queue = [];
      let food = null, score = 0, running = false, over = false, delay = 140;

      function placeFood() {
        do food = { x: rand(COLS), y: rand(ROWS) };
        while (snake.some((s) => s.x === food.x && s.y === food.y));
      }
      function draw() {
        g.fillStyle = '#fff';
        g.fillRect(0, 0, COLS * cs, ROWS * cs);
        g.strokeStyle = '#e4e8ef';
        g.lineWidth = 1;
        for (let x = 0; x <= COLS; x++) { g.beginPath(); g.moveTo(x * cs + 0.5, 0); g.lineTo(x * cs + 0.5, ROWS * cs); g.stroke(); }
        for (let y = 0; y <= ROWS; y++) { g.beginPath(); g.moveTo(0, y * cs + 0.5); g.lineTo(COLS * cs, y * cs + 0.5); g.stroke(); }
        g.fillStyle = '#e6f4ea';
        g.fillRect(food.x * cs + 1, food.y * cs + 1, cs - 1, cs - 1);
        g.fillStyle = '#1e8e3e';
        g.font = `bold ${Math.floor(cs * 0.6)}px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('DB', food.x * cs + cs / 2 + 0.5, food.y * cs + cs / 2 + 1);
        snake.forEach((s, i) => {
          g.fillStyle = i === 0 ? '#1d4fa8' : '#3b78e7';
          g.fillRect(s.x * cs + 2, s.y * cs + 2, cs - 3, cs - 3);
        });
      }
      function step() {
        if (over) return;
        if (!ctx.paused()) {
          if (queue.length) dir = queue.shift();
          const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
          const ate = head.x === food.x && head.y === food.y;
          const body = ate ? snake : snake.slice(0, -1);
          if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS || body.some((s) => s.x === head.x && s.y === head.y)) {
            over = true;
            q('msg').textContent = '⚠ 파이프라인 장애 발생';
            T.timeout(() => (score > 0 ? ctx.finish(score) : ctx.fail('수집한 데이터 없이 파이프라인 장애가 발생했습니다.')), 600);
            return;
          }
          snake.unshift(head);
          if (ate) {
            score++;
            delay = Math.max(60, 140 - score * 4);
            q('score').textContent = score;
            q('speed').textContent = (140 / delay).toFixed(1) + 'x';
            placeFood();
          } else snake.pop();
          draw();
        }
        T.timeout(step, delay);
      }
      const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
      function turn(name) {
        if (over || ctx.paused()) return;
        const d = DIRS[name];
        const last = queue.length ? queue[queue.length - 1] : dir;
        if (d.x === -last.x && d.y === -last.y) return;
        if (d.x === last.x && d.y === last.y) { if (!running) start(); return; }
        if (queue.length < 2) queue.push(d);
        if (!running) start();
      }
      function start() {
        running = true;
        q('msg').textContent = '가동 중';
        T.timeout(step, delay);
      }
      const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
      const offKey = onKey((e) => {
        if (e.target.tagName === 'INPUT') return;
        const k = KEYS[e.key];
        if (!k) return;
        e.preventDefault();
        turn(k);
      });
      root.querySelector('.dpad').addEventListener('click', (e) => {
        const b = e.target.closest('[data-d]');
        if (b) turn(b.dataset.d);
      });
      placeFood();
      draw();
      return { destroy() { T.clear(); offKey(); } };
    },
  });

  /* ------------------------------------------------------------------
   * WK-110 업무 지시 기억 (시퀀스 기억)
   * ------------------------------------------------------------------ */
  const DEPTS = ['기획', '영업', '인사', '재무', '개발', '디자인', '법무', '총무', '마케팅'];
  G.push({
    id: 'order',
    code: 'WK-110',
    title: '업무 지시 전달',
    short: '지시받은 부서 순서 기억',
    desc: '상사가 지시한 부서 전달 순서를 기억했다가 그대로 전달합니다. 단계마다 지시가 하나씩 늘어납니다.',
    howto: ['부서 버튼이 순서대로 깜빡입니다', '깜빡임이 끝나면 같은 순서로 클릭', '틀리면 종료되며 완료한 단계가 실적입니다'],
    higher: true,
    fmt: (s) => s + '단계',
    mount(root, ctx) {
      const T = timers();
      const seq = [];
      let pos = 0, accepting = false;
      root.innerHTML = `
        <div class="g-stats">
          <span>현재 단계 <b data-k="lv">1</b></span>
          <span data-k="msg" class="muted">업무 지시 수신 대기</span>
        </div>
        <div class="g-depts">${DEPTS.map((d, i) => `<button class="dept" data-i="${i}"><small>DEPT-0${i + 1}</small>${d}팀</button>`).join('')}</div>`;
      const q = (k) => root.querySelector(`[data-k="${k}"]`);
      const btns = Array.from(root.querySelectorAll('.dept'));
      function light(i, cls = 'lit', ms = 350) {
        btns[i].classList.add(cls);
        T.timeout(() => btns[i].classList.remove(cls), ms);
      }
      function nextLevel() {
        seq.push(rand(DEPTS.length));
        q('lv').textContent = seq.length;
        q('msg').textContent = '📢 업무 지시 수신 중… 잘 보세요';
        accepting = false;
        root.classList.add('playing');
        const gap = Math.max(320, 650 - seq.length * 25);
        seq.forEach((d, k) => T.timeout(() => light(d, 'lit', gap * 0.65), 600 + k * gap));
        T.timeout(() => {
          accepting = true;
          pos = 0;
          root.classList.remove('playing');
          q('msg').textContent = '✍ 지시받은 순서대로 부서를 클릭하세요';
        }, 600 + seq.length * gap);
      }
      root.querySelector('.g-depts').addEventListener('click', (e) => {
        const b = e.target.closest('.dept');
        if (!b || !accepting || ctx.paused()) return;
        const i = +b.dataset.i;
        if (i === seq[pos]) {
          light(i, 'hit', 200);
          pos++;
          if (pos === seq.length) {
            accepting = false;
            q('msg').textContent = '✔ 전달 완료! 다음 지시를 준비합니다';
            T.timeout(nextLevel, 800);
          }
        } else {
          accepting = false;
          light(i, 'miss', 900);
          light(seq[pos], 'lit', 900);
          const done = seq.length - 1;
          q('msg').textContent = '✖ 잘못된 부서로 전달했습니다';
          T.timeout(() => (done > 0 ? ctx.finish(done) : ctx.fail('첫 번째 지시부터 잘못 전달했습니다.')), 900);
        }
      });
      nextLevel();
      return { destroy: T.clear };
    },
  });

  /* ------------------------------------------------------------------
   * WK-111 전사 리스크 정밀 감사 (지뢰찾기 고급: 30×16, 99개)
   * ------------------------------------------------------------------ */
  G.push({
    id: 'risk_hard',
    code: 'WK-111',
    title: '전사 리스크 정밀 감사',
    short: '고위험 리스크 99건 정밀 감사 (고급)',
    desc: '30×16 전사 감사표에 숨겨진 고위험 리스크 99건을 피해서 모든 항목을 감사합니다. 리스크 점검의 고급 과정입니다.',
    howto: ['셀 클릭: 항목 감사 · 우클릭: 리스크 표시', '숫자는 주변 8칸에 있는 리스크 개수입니다', '확인된 숫자 클릭 시 주변 일괄 감사 · 좁은 화면에서는 감사표가 세로(16×30)로 바뀝니다'],
    higher: false,
    fmt: sec1,
    wide: true, // 감사표가 넓어서 순위표를 아래로 내린 한 줄 레이아웃 사용
    mount(root, ctx) {
      // 가로 30칸이 들어가지 않는 화면이면 같은 난이도로 세로 배치
      const wide = root.clientWidth >= 30 * 25 + 60;
      return mountMines(root, ctx, {
        W: wide ? 30 : 16,
        H: wide ? 16 : 30,
        M: 99,
        hard: true,
        loseMsg: '고위험 리스크가 터졌습니다. 정밀 감사를 처음부터 다시 진행해 주세요.',
      });
    },
  });

  /* ------------------------------------------------------------------
   * WK-112 업무 폭탄 회피 (똥 피하기)
   * ------------------------------------------------------------------ */
  const BOMBS = ['긴급', '추가 요청', '주말 출근', '보고서 수정', '회의 소집', '재검토', 'ASAP', '야근', '자료 취합', '오늘까지', '전수 조사', '자료 정리', '양식 변경'];
  const SENDERS = ['부장님', '본부장님', '팀장님', '상무님', '고객사'];
  const URGENT = ['긴급', 'ASAP', '오늘까지'];
  G.push({
    id: 'dodge',
    code: 'WK-112',
    title: '업무 폭탄 회피',
    short: '쏟아지는 업무 폭탄 피하며 버티기',
    desc: '윗선에서 쏟아지는 업무 폭탄을 피하며 최대한 오래 버팁니다. 처음부터 빠르고, 시간이 갈수록 업무가 더 많이, 더 빨리, 더 변칙적으로 떨어집니다.',
    howto: ['← → 키 (A / D) 또는 하단 버튼으로 이동, 첫 이동부터 시간 측정', '업무 폭탄에 맞으면 종료되며 버틴 시간이 실적입니다', '☕ 커피를 받으면 2초간 업무 면역 (커피는 드물게 내려옵니다)', '빨간 테두리가 굵은 긴급 업무는 더 빨리 떨어지고, 시간이 지나면 옆으로 흔들리며 떨어지는 업무도 나옵니다'],
    higher: true,
    fmt: sec1,
    mount(root, ctx) {
      const W = Math.max(300, Math.min(root.clientWidth || 600, 720));
      const H = W < 500 ? 380 : 440;
      const TOP = 34; // 결재라인 표시 영역
      root.innerHTML = `
        <div class="g-stats">
          <span>버틴 시간 <b data-k="time">0.0초</b></span>
          <span>회피한 업무 <b data-k="dodged">0</b>건</span>
          <span class="muted" data-k="msg">← → 키를 누르면 시작합니다</span>
        </div>
        <div class="canvas-wrap"><canvas></canvas></div>
        <div class="dpad dodge-pad">
          <div><button class="btn" data-d="-1">◀ 왼쪽</button><button class="btn" data-d="1">오른쪽 ▶</button></div>
        </div>`;
      const q = (k) => root.querySelector(`[data-k="${k}"]`);
      const canvas = root.querySelector('canvas');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      const g = canvas.getContext('2d');
      g.scale(dpr, dpr);

      const me = { x: W / 2, y: H - 26, w: 46, h: 24, speed: 300 };
      let items = [], pops = [];
      let started = false, over = false, t = 0, dodged = 0, shield = 0, spawnIn = 0.4, coffeeIn = 14;
      let raf = 0, last = 0, dir = 0;
      const held = { left: false, right: false, pad: 0 };

      g.font = 'bold 12px sans-serif';
      function spawn(coffee) {
        const label = coffee ? '☕ 커피' : BOMBS[rand(BOMBS.length)];
        const w = Math.max(48, g.measureText(label).width + 18);
        items.push({
          coffee,
          label,
          from: SENDERS[rand(SENDERS.length)],
          w,
          h: 22,
          x: w / 2 + Math.random() * (W - w),
          y: TOP - 10,
          urgent: !coffee && URGENT.includes(label),
          vy: coffee ? 150 : (150 + t * 9) * (0.8 + Math.random() * 0.5) * (URGENT.includes(label) ? 1.4 : 1),
          // 12초가 지나면 일부 업무는 옆으로 흔들리며 떨어진다
          vx: !coffee && t > 12 && Math.random() < 0.35 ? (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 60) : 0,
        });
      }
      function roundRect(x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
      }
      function draw() {
        g.fillStyle = '#fff';
        g.fillRect(0, 0, W, H);
        g.strokeStyle = '#eef1f5';
        g.lineWidth = 1;
        for (let x = 0; x <= W; x += 40) { g.beginPath(); g.moveTo(x + 0.5, TOP); g.lineTo(x + 0.5, H); g.stroke(); }
        for (let y = TOP; y <= H; y += 24) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
        // 결재라인
        g.fillStyle = '#f1f3f6';
        g.fillRect(0, 0, W, TOP);
        g.fillStyle = '#7a8599';
        g.font = '11px sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.fillText('결재라인 ▼  ' + SENDERS.slice(0, W < 500 ? 3 : 5).join(' · '), 10, TOP / 2);
        // 업무 폭탄
        g.font = 'bold 12px sans-serif';
        g.textAlign = 'center';
        for (const it of items) {
          roundRect(it.x - it.w / 2, it.y - it.h / 2, it.w, it.h, 4);
          g.fillStyle = it.coffee ? '#e6f4ea' : '#fdecea';
          g.fill();
          g.strokeStyle = it.coffee ? '#1e8e3e' : '#d93025';
          g.lineWidth = it.urgent ? 2.5 : 1;
          g.stroke();
          g.lineWidth = 1;
          g.fillStyle = it.coffee ? '#1e8e3e' : '#c5221f';
          g.fillText(it.label, it.x, it.y + 1);
        }
        // 나
        if (shield > 0) {
          g.beginPath();
          g.arc(me.x, me.y, 30, 0, Math.PI * 2);
          g.fillStyle = 'rgba(30,142,62,0.12)';
          g.fill();
          g.strokeStyle = '#1e8e3e';
          g.stroke();
        }
        roundRect(me.x - me.w / 2, me.y - me.h / 2, me.w, me.h, 5);
        g.fillStyle = over ? '#d93025' : '#2f6fde';
        g.fill();
        g.fillStyle = '#fff';
        g.font = 'bold 13px sans-serif';
        g.fillText('나', me.x, me.y + 1);
        // 떠오르는 문구
        g.font = 'bold 12px sans-serif';
        for (const p of pops) {
          g.globalAlpha = Math.max(0, p.life);
          g.fillStyle = p.color;
          g.fillText(p.text, p.x, p.y);
        }
        g.globalAlpha = 1;
        if (!started) {
          g.fillStyle = 'rgba(31,42,60,0.75)';
          g.font = '13px sans-serif';
          g.fillText('← → 키 또는 아래 버튼으로 이동하면 시작', W / 2, H / 2);
        }
      }
      function hit(a) {
        // 판정은 조금 너그럽게
        return Math.abs(a.x - me.x) < (a.w + me.w) / 2 - 3 && Math.abs(a.y - me.y) < (a.h + me.h) / 2 - 3;
      }
      function step(dt) {
        t += dt;
        dir = (held.right ? 1 : 0) - (held.left ? 1 : 0) || held.pad;
        me.x = Math.max(me.w / 2, Math.min(W - me.w / 2, me.x + dir * me.speed * dt));
        shield = Math.max(0, shield - dt);
        spawnIn -= dt;
        if (spawnIn <= 0) {
          spawn(false);
          if (t > 6 && Math.random() < 0.35) spawn(false);
          if (t > 25 && Math.random() < 0.3) spawn(false);
          spawnIn = Math.max(0.1, 0.5 - t * 0.012) * (0.6 + Math.random() * 0.6);
        }
        coffeeIn -= dt;
        if (coffeeIn <= 0) {
          spawn(true);
          coffeeIn = 16 + Math.random() * 8;
        }
        for (const it of items) {
          it.y += it.vy * dt;
          if (it.vx) {
            it.x += it.vx * dt;
            if (it.x < it.w / 2 || it.x > W - it.w / 2) it.vx = -it.vx;
          }
          if (it.dead || !hit(it)) continue;
          it.dead = true;
          if (it.coffee) {
            shield = 2;
            pops.push({ text: '업무 면역 2초!', x: me.x, y: me.y - 26, life: 1.2, color: '#1e8e3e' });
          } else if (shield > 0) {
            pops.push({ text: '반려!', x: it.x, y: it.y, life: 0.8, color: '#1e8e3e' });
          } else {
            pops.push({ text: `${it.from}: ${it.label}`, x: Math.min(Math.max(me.x, 70), W - 70), y: me.y - 28, life: 2, color: '#d93025' });
            return end();
          }
        }
        items = items.filter((it) => {
          if (it.dead) return false;
          if (it.y - it.h / 2 > H) {
            if (!it.coffee) dodged++;
            return false;
          }
          return true;
        });
        pops = pops.filter((p) => ((p.life -= dt), (p.y -= 30 * dt), p.life > 0));
        q('time').textContent = t.toFixed(1) + '초';
        q('dodged').textContent = dodged;
      }
      function loop(ts) {
        const dt = Math.min(0.05, (ts - last) / 1000 || 0);
        last = ts;
        if (!over && started && !ctx.paused()) step(dt);
        draw();
        if (!over) raf = requestAnimationFrame(loop);
      }
      function begin() {
        if (started || over) return;
        started = true;
        q('msg').textContent = '업무 폭탄 낙하 중…';
      }
      let endTimer = 0;
      function end() {
        over = true;
        draw();
        q('msg').textContent = '💥 업무 폭탄에 맞았습니다';
        const score = Math.round(t * 10) / 10;
        endTimer = setTimeout(() => (score >= 1 ? ctx.finish(score) : ctx.fail('시작하자마자 업무 폭탄에 맞았습니다.')), 900);
      }
      const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', a: 'left', d: 'right' };
      const onDown = (e) => {
        if (e.target.tagName === 'INPUT') return;
        const k = KEYS[e.key];
        if (!k) return;
        e.preventDefault();
        if (ctx.paused()) return;
        held[k] = true;
        begin();
      };
      const onUp = (e) => {
        const k = KEYS[e.key];
        if (k) held[k] = false;
      };
      document.addEventListener('keydown', onDown);
      document.addEventListener('keyup', onUp);
      // 모바일: 버튼을 누르고 있는 동안 이동, 캔버스 좌우 절반 터치도 지원
      const press = (d) => {
        held.pad = d;
        if (d) begin();
      };
      const pad = root.querySelector('.dodge-pad');
      pad.addEventListener('pointerdown', (e) => {
        const b = e.target.closest('[data-d]');
        if (b) { e.preventDefault(); press(+b.dataset.d); }
      });
      canvas.addEventListener('pointerdown', (e) => {
        const r = canvas.getBoundingClientRect();
        press(e.clientX - r.left < r.width / 2 ? -1 : 1);
      });
      const release = () => press(0);
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
      canvas.style.touchAction = 'none';
      raf = requestAnimationFrame(loop);
      return {
        destroy() {
          over = true;
          cancelAnimationFrame(raf);
          clearTimeout(endTimer);
          document.removeEventListener('keydown', onDown);
          document.removeEventListener('keyup', onUp);
          window.removeEventListener('pointerup', release);
          window.removeEventListener('pointercancel', release);
        },
      };
    },
  });

  /* ------------------------------------------------------------------
   * WK-113 데이터 정합성 검증 (엑셀 틀린그림 찾기)
   * ------------------------------------------------------------------ */
  const DIFF_VENDORS = ['한빛상사', '대성물산', '세진유통', '미래테크', '동아산업', '우리식품', '태평양무역', '서울전자', '신화기계', '하나물류', '금강상회', '삼원정밀'];
  const DIFF_ITEMS = ['A4 용지', '토너 카트리지', '모니터암', '무선 키보드', '사무용 의자', '높이조절 책상', '복합기', 'USB 허브', '노트북 거치대', '라벨 프린터', '파쇄기', '화이트보드'];
  // 눈으로 헷갈리기 쉬운 글자 바꿈
  const LOOKALIKE = {
    상: '삼', 삼: '상', 사: '샤', 물: '뭍', 산: '신', 신: '산', 유: '우', 우: '유', 테: '태', 태: '테', 업: '엄', 식: '싁',
    무: '뮤', 역: '억', 서: '셔', 울: '을', 전: '정', 정: '전', 화: '하', 하: '화', 기: '긱', 계: '게', 류: '루', 금: '굼',
    강: '갈', 원: '윈', 용: '욤', 지: '자', 토: '투', 너: '나', 모: '무', 니: '나', 터: '타', 암: '얌', 키: '카',
    보: '부', 드: '두', 자: '지', 책: '첵', 복: '봅', 합: '함', 허: '하', 브: '부', 북: '복', 거: '가', 치: '지',
    대: '데', 라: '러', 벨: '빌', 린: '런', 파: '퍄', 쇄: '쉐', 판: '팬',
  };
  const DIFF_COLS = [
    { key: 'vendor', label: '거래처', type: 'text' },
    { key: 'item', label: '품목', type: 'text' },
    { key: 'qty', label: '수량', type: 'num' },
    { key: 'price', label: '단가', type: 'num' },
    { key: 'amount', label: '금액', type: 'num' },
  ];
  const DIFF_ROUNDS = [5, 6, 7]; // 시트별 불일치 개수
  const DIFF_ROWS = 8;
  const DIFF_PENALTY = 3; // 오검출 1회당 +3초

  function mutateText(v) {
    const chars = [...v];
    const idx = shuffle(chars.map((_, i) => i)).filter((i) => LOOKALIKE[chars[i]] && LOOKALIKE[chars[i]] !== chars[i]);
    if (idx.length) {
      chars[idx[0]] = LOOKALIKE[chars[idx[0]]];
      return chars.join('');
    }
    // 바꿀 글자가 없으면 인접한 두 글자 순서 바꾸기
    for (let i = 0; i < chars.length - 1; i++) {
      if (chars[i] !== chars[i + 1] && chars[i] !== ' ' && chars[i + 1] !== ' ') {
        [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
        return chars.join('');
      }
    }
    return v + '.';
  }
  function mutateNum(n) {
    const d = String(n).split('');
    // 인접 자릿수 뒤바뀜 (1250 → 1520) 우선, 안 되면 한 자리 ±1
    const swaps = shuffle(d.map((_, i) => i).slice(0, -1)).filter((i) => d[i] !== d[i + 1] && !(i === 0 && d[i + 1] === '0'));
    if (swaps.length && Math.random() < 0.6) {
      const i = swaps[0];
      [d[i], d[i + 1]] = [d[i + 1], d[i]];
    } else {
      const i = rand(d.length);
      const cur = +d[i];
      let nv = cur + (Math.random() < 0.5 ? 1 : -1);
      if (nv < 0 || nv > 9 || (i === 0 && nv === 0)) nv = cur === 9 ? 8 : cur + 1;
      d[i] = String(nv);
    }
    return +d.join('');
  }
  const fmtCell = (col, v) => (col.type === 'num' ? Number(v).toLocaleString() : v);

  G.push({
    id: 'diff',
    code: 'WK-113',
    title: '데이터 정합성 검증',
    short: '원본·사본 시트의 불일치 데이터 찾기',
    desc: '원본 시트와 사본 시트를 대조해 값이 다른 셀을 찾아냅니다. 3개 시트, 총 18건의 불일치를 찾는 시간이 실적입니다.',
    howto: ['오른쪽(사본) 시트에서 원본과 다른 셀을 클릭', '숫자 자리 바뀜, 비슷한 글자 오타 등 미세한 차이를 찾으세요', `잘못 클릭하면 ${DIFF_PENALTY}초 패널티 · 3개 시트를 모두 검증하면 완료`],
    higher: false,
    fmt: sec1,
    wide: true,
    mount(root, ctx) {
      const T = timers();
      let round = 0, found = 0, wrong = 0, diffs = null, done = false;
      const t0 = now();
      const elapsed = () => (now() - t0) / 1000 + wrong * DIFF_PENALTY;
      root.innerHTML = `
        <div class="g-stats">
          <span>검증 시트 <b data-k="round">1 / ${DIFF_ROUNDS.length}</b></span>
          <span>남은 불일치 <b data-k="left">-</b>건</span>
          <span>경과 <b data-k="time">0.0초</b></span>
          <span>오검출 <b data-k="wrong">0</b>건 (+${DIFF_PENALTY}초)</span>
        </div>
        <div class="diff-wrap">
          <div class="diff-pane"><div class="diff-cap"><span class="badge gray">원본</span> ERP_매입내역_원본.xlsx</div><div data-k="src"></div></div>
          <div class="diff-pane"><div class="diff-cap"><span class="badge">사본</span> 매입내역_취합본_최종.xlsx <span class="muted sm">← 여기서 클릭</span></div><div data-k="dst"></div></div>
        </div>`;
      const q = (k) => root.querySelector(`[data-k="${k}"]`);

      function makeRows() {
        const vendors = shuffle(DIFF_VENDORS), items = shuffle(DIFF_ITEMS);
        return Array.from({ length: DIFF_ROWS }, (_, i) => {
          const qty = 1 + rand(240);
          const price = (10 + rand(9890)) * 100;
          return { vendor: vendors[i], item: items[i], qty, price, amount: qty * price };
        });
      }
      function table(rows, side) {
        const cells = rows
          .map(
            (r, y) =>
              `<tr><th>${y + 2}</th>${DIFF_COLS.map((c, x) => `<td class="${c.type === 'num' ? 'r' : ''}" data-c="${y}-${x}">${fmtCell(c, r[c.key])}</td>`).join('')}</tr>`
          )
          .join('');
        return `<table class="diff-sheet ${side}">
          <thead><tr><th></th>${DIFF_COLS.map((_, x) => `<th>${String.fromCharCode(65 + x)}</th>`).join('')}</tr>
          <tr class="hdr"><th>1</th>${DIFF_COLS.map((c) => `<td>${c.label}</td>`).join('')}</tr></thead>
          <tbody>${cells}</tbody></table>`;
      }
      function startRound() {
        const src = makeRows();
        const dst = src.map((r) => ({ ...r }));
        const n = DIFF_ROUNDS[round];
        // 행과 열이 고르게 섞이도록 서로 다른 셀 n개 선택
        const picks = shuffle(Array.from({ length: DIFF_ROWS * DIFF_COLS.length }, (_, i) => i)).slice(0, n);
        diffs = new Set();
        for (const p of picks) {
          const y = Math.floor(p / DIFF_COLS.length), x = p % DIFF_COLS.length, c = DIFF_COLS[x];
          dst[y][c.key] = c.type === 'num' ? mutateNum(src[y][c.key]) : mutateText(src[y][c.key]);
          if (fmtCell(c, dst[y][c.key]) !== fmtCell(c, src[y][c.key])) diffs.add(`${y}-${x}`);
        }
        found = 0;
        q('src').innerHTML = table(src, 'src');
        q('dst').innerHTML = table(dst, 'dst');
        q('round').textContent = `${round + 1} / ${DIFF_ROUNDS.length}`;
        q('left').textContent = diffs.size;
      }
      q('dst').addEventListener('click', (e) => {
        const td = e.target.closest('td[data-c]');
        if (!td || done || ctx.paused() || td.classList.contains('found')) return;
        const key = td.dataset.c;
        if (diffs.has(key)) {
          td.classList.add('found');
          q('src').querySelector(`td[data-c="${key}"]`).classList.add('found');
          found++;
          q('left').textContent = diffs.size - found;
          if (found === diffs.size) {
            round++;
            if (round >= DIFF_ROUNDS.length) {
              done = true;
              T.timeout(() => ctx.finish(Math.round(elapsed() * 10) / 10), 500);
            } else {
              T.timeout(startRound, 700);
            }
          }
        } else {
          wrong++;
          q('wrong').textContent = wrong;
          bump(td, 'miss');
        }
      });
      T.interval(() => (q('time').textContent = elapsed().toFixed(1) + '초'), 100);
      startRound();
      return { destroy: T.clear };
    },
  });
})();
