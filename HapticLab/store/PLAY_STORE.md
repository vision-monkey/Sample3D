# 진동 도감 — Google Play 등록 가이드

앱 설정은 Play 등록 기준으로 이미 맞춰져 있습니다.

| 항목 | 값 |
|---|---|
| 앱 이름 | 진동 도감 |
| 패키지 이름 (applicationId) | `io.github.visionmonkey.vibrationdex` — **첫 업로드 후 변경 불가** |
| targetSdk / minSdk | 37 / 26 |
| 업로드 형식 | Android App Bundle (`.aab`), R8 최소화 + 리소스 축소 |
| versionCode | GitHub Actions 실행 번호 (매 빌드 자동 증가) |
| 권한 | `VIBRATE` 하나 (인터넷 권한 없음) |
| 스토어 문구 | `store/listing-ko.md` |
| 개인정보처리방침 | `store/privacy-policy.md` |
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

## 3. Play Console 등록

1. [Play Console](https://play.google.com/console) 개발자 계정 생성 (1회 등록비 US$25, 본인 인증 필요).
2. **앱 만들기** → 이름 `진동 도감`, 기본 언어 한국어, 앱/무료 선택.
3. **앱 콘텐츠** 작성 — `store/listing-ko.md` 하단 답변 참고
   - 개인정보처리방침 URL
   - 광고: 없음 / 앱 액세스: 모든 기능 제한 없음
   - 콘텐츠 등급 설문 → 전체이용가 예상
   - 타겟층 / 데이터 보안: 데이터 수집 없음
4. **기본 스토어 등록정보** — 이름, 간단한 설명, 자세한 설명, 아이콘(512×512), 그래픽 이미지(1024×500), **휴대폰 스크린샷 2장 이상**(폰에서 직접 캡처).
5. **테스트 및 출시** → 트랙에 `.aab` 업로드 → 출시 노트 작성 → 검토 제출.

## 꼭 알아둘 점

- **신규 개인 개발자 계정**은 프로덕션 출시 전에 **비공개 테스트(테스터 12명 이상, 14일 연속 참여)** 를 거쳐야 프로덕션 출시 신청이 가능합니다. 처음에는 비공개 테스트 트랙에 업로드하세요.
- **아동 대상 설정 주의**: 타겟층에 13세 미만을 포함하면 *가족 정책*과 교사 승인 등 추가 심사가 적용됩니다. 데이터 수집이 없어 정책상 문제는 적지만, 첫 출시는 13세 이상으로 설정하고 이후 확장하는 것이 빠릅니다.
- 앱 화면의 버튼/설명은 현재 영어입니다. 한국어 이용자 대상이면 UI 한글화를 권장합니다 (필수 아님).
- 업로드한 versionCode는 다시 쓸 수 없으므로 항상 새 빌드의 `.aab`를 사용하세요.
