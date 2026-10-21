// 공유 순위 서버 설정 (README.md의 "공유 순위 설정" 참고)
// 두 값을 비워 두면 기록은 각자의 브라우저에만 저장됩니다.
// publishable/anon 키는 브라우저에 공개되는 용도의 키라 여기에 넣어도 됩니다.
window.WP_CONFIG = {
  supabaseUrl: '', // 예: 'https://abcdefghijklm.supabase.co'
  supabaseAnonKey: '', // publishable 키(sb_publishable_...) 또는 anon 키(eyJ...)
};
