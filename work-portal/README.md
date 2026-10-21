# WorkSpace 업무 포털

업무 화면처럼 보이는 미니게임 10종 모음입니다. `index.html`을 브라우저로 열면 바로 실행됩니다.

- **ESC**: 엑셀 보고서 화면으로 즉시 전환 / 복귀
- 기록 등록 시 이름은 선택이며, 비워 두면 `달리는 만두` 같은 랜덤 아이디가 지정됩니다.
- 사용자 설정(우측 상단)에서 그룹명을 정할 수 있습니다. 비워 두면 `무소속`입니다.

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
