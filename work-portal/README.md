# 업무포털 (월급루팡 미니게임)

업무 화면처럼 보이는 미니게임 10종 모음입니다. `index.html`을 브라우저로 열면 바로 실행됩니다.

- **ESC**: 스프레드시트 보고서 화면으로 즉시 전환 / 복귀
- 기록 등록 시 이름은 선택이며, 비워 두면 `달리는 만두` 같은 랜덤 아이디가 지정됩니다.
- 사용자 설정(우측 상단)에서 그룹명을 정할 수 있습니다. 비워 두면 `무소속`입니다.
- 순위표의 `내 그룹` 토글, 실적 현황의 그룹 필터, **그룹 대항전** 메뉴(업무별 그룹 최고 기록 순위로 10·7·5·3·2·1점 합산, 무소속 제외)를 제공합니다.

## 공유 순위 설정 (Supabase, 무료)

`config.js`가 비어 있으면 기록은 각자 브라우저에만 저장됩니다(사이드바 하단 "로컬 저장 모드").
아래 설정을 하면 모든 사람이 같은 순위를 봅니다("공유 서버 연결됨").

1. <https://supabase.com> 에서 가입 후 **New project** 생성 (Free 플랜)
2. 왼쪽 메뉴 **SQL Editor** → `supabase.sql` 내용을 붙여넣고 **Run**
3. **Project Settings → API Keys** (또는 상단 **Connect**) 에서 두 값을 복사
   - Project URL: `https://xxxx.supabase.co`
   - Publishable key(`sb_publishable_...`) 또는 legacy anon key(`eyJ...`)
4. `config.js`에 붙여넣기

   ```js
   window.WP_CONFIG = {
     supabaseUrl: 'https://xxxx.supabase.co',
     supabaseAnonKey: 'sb_publishable_xxxxxxxx',
   };
   ```

publishable/anon 키는 브라우저 공개용 키라 커밋해도 됩니다. **service_role / secret 키는 절대 넣지 마세요.**
테이블은 조회·등록만 허용되고 수정·삭제는 막혀 있습니다(Row Level Security).

> 참고: 브라우저 게임 특성상 개발자 도구로 가짜 점수를 직접 등록하는 것까지는 막을 수 없습니다.
> 이상한 기록은 Supabase 대시보드 **Table Editor → records** 에서 지우면 됩니다.

### 그룹명 기능 업데이트 (기존 DB)

이미 `supabase.sql`을 실행한 DB라면 SQL Editor에서 `supabase-group.sql`을 한 번 실행하세요.
기존 기록은 그대로 남고 그룹은 `무소속`으로 채워집니다. 실행 전에도 사이트는 동작하지만 그룹명이 저장되지 않습니다.

### 점수 조작 방지 업데이트 (기존 DB)

SQL Editor에서 `supabase-secure.sql`을 한 번 실행하세요. 기존 기록은 그대로 유지됩니다.

- 기록은 서버 함수(`start_session` → `submit_record`)로만 등록되고, 테이블에 직접 넣는 길은 막힙니다.
- 서버가 게임 시작~등록 사이 경과 시간과 게임별 점수 범위를 검사해 불가능한 기록을 거부합니다.
- 같은 IP에서 1분에 게임 시작 30회 / 기록 등록 10회까지만 허용합니다.
- 욕설이 들어간 이름·그룹명은 사이트와 서버 양쪽에서 거부합니다.
- 이상한 기록은 Supabase **Table Editor → records** 에서 삭제하면 됩니다.

브라우저 게임 특성상 조작을 100% 막을 수는 없습니다. 범위 안의 그럴듯한 가짜 점수는 여전히 가능합니다.

### 방문 통계 (기존 DB)

SQL Editor에서 `supabase-stats.sql`을 한 번 실행하면 방문·플레이·등록 수가 집계됩니다. 외부 통계 서비스 가입은 필요 없습니다.

```sql
select * from public.stats_daily;  -- 날짜별 방문수 · 방문자수 · 플레이 · 등록
select * from public.stats_games;  -- 최근 30일 게임별 플레이 · 등록 · 플레이어 수
```

IP·이름은 저장하지 않고 브라우저별 임의 ID만 쓰며, 13개월 뒤 자동 삭제됩니다. 통계는 사이트에서 읽을 수 없고 대시보드에서만 볼 수 있습니다.
개인정보처리방침은 `privacy.html`에 있습니다 (사이드바 하단 링크).

### 고급 지뢰찾기 [전사 리스크 정밀 감사] (기존 DB)

WK-111(30×16, 리스크 99개) 기록을 받으려면 SQL Editor에서 `supabase-hard.sql`을 한 번 실행하세요. 기존 기록은 그대로입니다.

### 업무 폭탄 회피 (기존 DB)

WK-112(똥 피하기) 기록을 받으려면 SQL Editor에서 `supabase-dodge.sql`을 한 번 실행하세요. 이 파일에는 `supabase-hard.sql` 내용도 포함되어 있습니다.

## 동료와 같이 쓰기 (GitHub Pages)

저장소 **Settings → Pages** → Source: `Deploy from a branch`, 브랜치 선택, 폴더 `/ (root)` → Save.
몇 분 뒤 `https://<계정>.github.io/<저장소>/work-portal/` 주소로 접속할 수 있습니다.
(GitHub Pages는 공개 사이트가 됩니다. 비공개 저장소의 Pages는 유료 플랜이 필요합니다.)

## 파일 구성

| 파일 | 내용 |
|---|---|
| `index.html`, `style.css` | 포털 화면 |
| `app.js` | 화면 전환, 대시보드, 순위, 결과 등록, ESC 보스 화면 |
| `games.js` | 게임 10종 |
| `db.js` | 기록 저장소 (Supabase 또는 localStorage) |
| `config.js` | Supabase 연결 설정 |
| `supabase.sql` | 공유 순위 테이블 생성 SQL |
| `supabase-group.sql` | 기존 DB에 그룹명 컬럼 추가 SQL |
| `supabase-secure.sql` | 점수 검증·등록 제한·금칙어 SQL |
| `supabase-stats.sql` | 방문 통계 SQL |
| `supabase-hard.sql` | 고급 지뢰찾기(risk_hard) 기록 허용 SQL |
| `supabase-dodge.sql` | 업무 폭탄 회피(dodge) + 고급 지뢰찾기 기록 허용 SQL |
| `privacy.html` | 개인정보처리방침 |
