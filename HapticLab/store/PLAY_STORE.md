# 진동 도감 — Google Play 등록 가이드

앱 설정은 Play 등록 기준으로 이미 맞춰져 있습니다.

| 항목 | 값 |
|---|---|
| 앱 이름 | 진동 도감 |
| 패키지 이름 (applicationId) | `io.github.visionmonkey.vibrationdex` — **첫 업로드 후 변경 불가** |
| targetSdk / minSdk | 37 / 26 |
| 업로드 형식 | Android App Bundle (`.aab`), R8 최소화 + 리소스 축소 |
| versionCode | GitHub Actions 실행 번호 (매 빌드 자동 증가) |
| 권한 | `VIBRATE` + 광고용 `INTERNET`, `ACCESS_NETWORK_STATE`, `AD_ID` (AdMob SDK가 자동 추가) |
| 광고 | Google AdMob 전면 광고, 진동 10번 재생마다 1회 (`ads/AdGate.kt`), 전체이용가(G) 광고만 |
| 스토어 문구 | `store/listing-ko.md` |
| 개인정보처리방침 | `store/privacy-policy.md` (광고·AdMob 내용 포함) |
| 앱 아이콘 512×512 / 그래픽 이미지 1024×500 | 매 빌드 GitHub 릴리스에 첨부 (`icon-512.png`, `feature-1024x500.png`, `store/make_graphics.py`로 생성) |

## 1. 업로드 키 만들기 (최초 1회)

PC에서 실행합니다 (JDK의 `keytool` 필요, Android Studio에 포함).

```bash
keytool -genkeypair -v -keystore vibrationdex-upload.jks \
  -alias upload -keyalg RSA -keysize 4096 -validity 10000
```

- 비밀번호와 `vibrationdex-upload.jks` 파일은 **안전한 곳에 백업**하세요. 저장소에 커밋하면 안 됩니다.
- Play 앱 서명(Play App Signing)을 사용하므로, 이 키를 잃어버려도 Play Console에서 업로드 키 재설정을 요청할 수 있습니다.

## 2. GitHub Secrets 등록 (최초 1회)

저장소 → Settings → Secrets and variables → Actions → **New repository secret**

| 이름 | 값 |
|---|---|
| `UPLOAD_KEYSTORE_BASE64` | `base64 -w0 vibrationdex-upload.jks` 출력 (macOS: `base64 -i vibrationdex-upload.jks`) |
| `UPLOAD_KEYSTORE_PASSWORD` | 키스토어 비밀번호 |
| `UPLOAD_KEY_ALIAS` | `upload` |
| `UPLOAD_KEY_PASSWORD` | 키 비밀번호 |

등록 후 Actions 탭에서 **Haptic Lab APK → Run workflow**를 누르면, 릴리스에 서명된 `VibrationDex-<번호>.aab`가 첨부됩니다.

> Android Studio에서 직접 만들 수도 있습니다: **Build › Generate Signed App Bundle / APK › Android App Bundle**.

## 3. AdMob 연결 (광고 수익을 받으려면 필수)

1. [AdMob](https://admob.google.com) 가입 → **앱 추가** (Android, "진동 도감").
2. **광고 단위 추가 → 전면 광고** 생성.
3. 발급된 두 ID를 `app/src/release/res/values/ads.xml`에 입력:
   - `admob_app_id` = 앱 ID (`ca-app-pub-xxxxxxxx~yyyyyyyy`)
   - `admob_interstitial_id` = 광고 단위 ID (`ca-app-pub-xxxxxxxx/zzzzzzzz`)
4. 디버그 빌드는 항상 Google **테스트 광고**를 씁니다. 실제 광고를 직접 눌러 보면 계정이 정지될 수 있으니 테스트는 디버그 APK로 하세요.
5. AdMob › 개인정보 보호 및 메시지 › **GDPR 메시지**를 만들어 게시하세요 (유럽 이용자 동의 화면, 앱에 이미 연동됨).
6. 스토어 등록정보에 개발자 웹사이트가 있으면 `app-ads.txt`를 그 도메인에 올리세요 (AdMob이 내용 제공).

> 광고 길이: AdMob 전면 광고는 이미지 광고(바로 닫기 가능) 또는 동영상 광고(보통 5초 후 건너뛰기)가 섞여 나옵니다. 앱에서 정확히 5초로 고정할 수는 없습니다.

## 4. Play Console 등록

1. [Play Console](https://play.google.com/console) 개발자 계정 생성 (1회 등록비 US$25, 본인 인증 필요).
2. **앱 만들기** → 이름 `진동 도감`, 기본 언어 한국어, 앱/무료 선택.
3. **앱 콘텐츠** 작성 — `store/listing-ko.md` 하단 답변 참고
   - 개인정보처리방침 URL
   - 광고: **예, 광고 포함** / 앱 액세스: 모든 기능 제한 없음
   - 콘텐츠 등급 설문 → 전체이용가 예상
   - 타겟층: 13세 이상 / 데이터 보안: AdMob 수집 항목 신고 (`listing-ko.md` 참고)
4. **기본 스토어 등록정보** — 이름, 간단한 설명, 자세한 설명, 아이콘(512×512), 그래픽 이미지(1024×500), **휴대폰 스크린샷 2장 이상**(폰에서 직접 캡처).
5. **테스트 및 출시** → 트랙에 `.aab` 업로드 → 출시 노트 작성 → 검토 제출.

## 꼭 알아둘 점

- **신규 개인 개발자 계정**은 프로덕션 출시 전에 **비공개 테스트(테스터 12명 이상, 14일 연속 참여)** 를 거쳐야 프로덕션 출시 신청이 가능합니다. 처음에는 비공개 테스트 트랙에 업로드하세요.
- **아동 대상 설정 주의 (광고 포함)**: 타겟층에 13세 미만을 포함하면 *가족 정책*이 적용되어, 아동 대상 인증 광고(AdMob의 아동 대상 설정 `tagForChildDirectedTreatment`, 맞춤 광고 금지)와 추가 심사가 필요합니다. 광고가 있는 상태에서는 **13세 이상**으로 출시하는 것을 권장합니다.
- **광고 정책**: 광고는 진동이 끝나고 1.5초 동안 아무 것도 누르지 않을 때만 뜨도록 만들어, 실수로 광고를 누르는 일(AdMob 정책 위반)을 줄였습니다. 광고 빈도를 더 높이면 정책 위반·평점 하락 위험이 커집니다.
- 업로드한 versionCode는 다시 쓸 수 없으므로 항상 새 빌드의 `.aab`를 사용하세요.
