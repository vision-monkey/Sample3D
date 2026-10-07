# 진동 도감 (Haptic Lab)

> Google Play release checklist, listing text and privacy policy: see [`store/PLAY_STORE.md`](store/PLAY_STORE.md).

A developer tool for feeling — and comparing — 50 distinct haptic patterns on a real Android phone
(tuned on Galaxy-class LRA actuators). Button clicks, water drops, bouncing balls, heartbeats, springs,
engines, dials and more, rendered through the best haptic API your device supports.

## Purpose

The goal is not "50 vibration patterns" but **50 tactile experiences that are clearly distinguishable
on one phone**. Every pattern is built from a different mix of primitive, intensity, sharpness, rhythm,
attack, decay, acceleration and repetition, and every pattern carries its own hand-tuned fallback so it
still makes sense on older hardware.

## Supported Android Versions

| | Value | Why |
|---|---|---|
| `minSdk` | **26** (Android 8.0) | `VibrationEffect` + amplitude waveforms |
| `compileSdk` / `targetSdk` | **37** | Latest stable SDK |
| Composition primitives | API 30 (`CLICK`, `TICK`, `QUICK_RISE`, `SLOW_RISE`, `QUICK_FALL`) / API 31 (`THUD`, `SPIN`, `LOW_TICK`) | Checked per primitive at runtime |
| Envelope effects | API 36 (Android 16) | `VibrationEffect.BasicEnvelopeBuilder` |

Every newer API call sits behind an `SDK_INT` check inside a `@RequiresApi` helper object.

## Architecture

MVVM with a framework-only haptic layer that the UI never bypasses.

```
com.example.hapticlab
├── HapticLabApplication / AppContainer   manual DI (engine + preferences)
├── MainActivity                          stops vibration in onStop / onDestroy
├── data/
│   ├── HapticCategory.kt                 7 categories
│   ├── HapticPattern.kt                  pattern model: PrimitiveStep, EnvelopeSpec, WaveformSpec
│   ├── HapticLibrary.kt                  the 50 patterns (data only, no UI)
│   └── UserPreferencesRepository.kt      favorites + global intensity (SharedPreferences)
├── haptic/
│   ├── HapticPrimitive.kt                the 8 composition primitives
│   ├── HapticCapability.kt               capability model + API path enum
│   ├── HapticCapabilityDetector.kt       reads the Vibrator, API-level guarded
│   ├── HapticEffectFactory.kt            pattern -> VibrationEffect with the fallback chain
│   ├── HapticAdapters.kt                 pure JVM: intensity scaling, envelope fitting, on/off conversion
│   └── HapticEngine.kt                   play / stop / repeat / continuous, single owner of Vibrator
├── viewmodel/                            Home, Detail, Playground, DeviceInfo + factories
├── navigation/                           3 tabs + detail, tiny saveable back stack
├── ui/                                   home, detail, playground, deviceinfo, components, theme
└── util/DeviceNames.kt                   "SM-S921N" -> "Galaxy S24"
```

`HapticEngine` API:

```kotlin
fun play(pattern: HapticPattern, intensity: Float = 1f, repeat: RepeatMode = RepeatMode.OFF): Boolean
fun stop()
fun isPatternSupported(pattern: HapticPattern): Boolean
fun getCapabilities(): HapticCapability
// plus: resolvePath(), isPrimaryImplementationSupported(), playSequence(), playOneShot(), playbackState
```

## Haptic APIs

All names below were checked against the public Android 16 API surface (`core/api/current.txt`) and
the code compiles against the API 37 framework.

| Tier | API | Used for |
|---|---|---|
| 1 | `VibrationEffect.BasicEnvelopeBuilder` (`setInitialSharpness`, `addControlPoint(intensity, sharpness, ms)`), gated by `Vibrator.areEnvelopeEffectsSupported()` and fitted to `Vibrator.getEnvelopeEffectInfo()` | 13 patterns with continuous shape: Explosion, Spring, Water Drop, Breathing, motors, engines, Charging, Power Release, Magic Pulse |
| 2 | `VibrationEffect.startComposition().addPrimitive(id, scale, delay).compose()`, gated by `Vibrator.arePrimitivesSupported()` | 37 primary patterns + composition fallback for 9 envelope patterns |
| 3 | `VibrationEffect.createWaveform(timings, amplitudes, -1)` | every pattern has a hand-tuned waveform |
| 4 | `VibrationEffect.createWaveform(timings, -1)` | devices without `hasAmplitudeControl()` |

Notes:

* The Android SDK has **no `VibrationEffect.Builder` class**. The Android 16 "builder" APIs are
  `VibrationEffect.BasicEnvelopeBuilder` (intensity + sharpness, device independent) and
  `VibrationEffect.WaveformEnvelopeBuilder` (amplitude + absolute frequency in Hz). Haptic Lab uses the
  basic builder because its sharpness axis is normalized across devices.
* Envelopes must end at intensity 0 (enforced by the framework). Control points shorter than the
  device minimum are stretched, longer than the maximum are split; if the result still exceeds the
  point-count or duration limits the engine falls back to tier 2.
* Patterns play with `VibrationAttributes.USAGE_MEDIA` (API 33+), so they are not dropped when "touch
  feedback" is off and they follow the media vibration intensity.
* Capability detection also reads `getPrimitiveDurations()`, `getResonantFrequency()`, `getQFactor()`
  and (API 36) `getFrequencyProfile()`.

### Fallback strategy

```
pattern ─► envelope defined && areEnvelopeEffectsSupported && fits limits ─► BasicEnvelopeBuilder
       └► composition defined && every primitive supported ────────────────► Composition
       └► hasAmplitudeControl ─────────────────────────────────────────────► amplitude waveform
       └► otherwise ───────────────────────────────────────────────────────► on/off waveform
```

If building a tier throws, the next tier is tried. On on/off motors amplitude is approximated by duty
cycle: a weaker segment becomes a shorter pulse followed by silence, so rhythm and decay survive.

### Global intensity

The detail screen's intensity slider multiplies every step and keeps their ratios. Ball Bounce
(`1.0, 0.55, 0.3`) at 50 % plays `0.5, 0.275, 0.15`. Waveform amplitudes are scaled the same way and
never round a non-zero segment down to silence.

### Repeat & safety

* Repeat: OFF / 2x / 3x / 5x / Continuous. Repeats are scheduled on a coroutine using the real effect
  duration (device primitive durations when known) plus a per-pattern gap.
* Continuous always shows a STOP button and auto-stops after 60 s.
* Playback stops when a detail/playground screen leaves composition, when a ViewModel is cleared, and in
  `MainActivity.onStop()` (except for rotation).
* No library pattern lasts longer than ~3 s; Playground pulses are capped at 1 s, 40 hits, 16 steps.
* The UI never adds its own haptics: `android:hapticFeedbackEnabled="false"` on the theme and activity,
  `View.isHapticFeedbackEnabled = false`, and a no-op `LocalHapticFeedback` for Compose.

## Device Compatibility

**Motors and manufacturer haptic tuning differ from model to model, so the same pattern can feel
different on another phone** — even between two Galaxy generations. Primitive durations, the strength
curve of `scale`, envelope limits and resonant frequency are all device-specific. The Device tab shows
exactly what your phone reports and which API each pattern uses.

| Device class | Expected path |
|---|---|
| Android 16+ with envelope-capable HAL | Envelope + Composition |
| Galaxy S2x / Pixel 6+ on Android 12–15 | Composition (most primitives) |
| Android 8–10, or HAL without primitives | Amplitude waveform |
| Basic ERM motors | On/off waveform |

## Haptic Lab UI

* **Library** — header with device name and engine path, a collapsible *Device Haptic Capability*
  card, search (name / description / category), category filter, ★ favorites filter, and a compact
  grid of all 50 patterns (icon, number, name). Tap a tile to play it, long-press to open its detail.
* **Detail** — category, description, duration, designed implementation vs. the path used on this
  device, the full primitive/envelope sequence (live-scaled by the intensity slider), fallback data,
  repeat options and a large TEST HAPTIC / STOP button.
* **Playground** — Pulse Designer (primitive or raw one-shot, intensity, duration, delay, repeat) and a
  Sequencer (add / delete / reorder steps; primitive, intensity and delay per step). Unsupported
  primitives are disabled and labelled "Not supported on this device".
* **Device** — manufacturer, model, Android version, API level, vibrator, amplitude control, envelope
  limits, frequency profile, per-primitive support and duration, haptic engine path and how many
  library patterns use each path.

## How to Build

Requirements: Android Studio (latest stable), JDK 17+, Android SDK Platform 37.

```bash
cd HapticLab
./gradlew assembleDebug
```

Versions (aligned with Google's official compose-samples): AGP 9.3.1, Gradle 9.5.0, Kotlin 2.4.20,
Compose BOM 2026.09.00. Dependencies are AndroidX only (Compose, Material 3, Activity, Lifecycle) plus
kotlinx-coroutines; no third-party libraries.

Unit tests (pattern data and fallback math, pure JVM):

```bash
./gradlew testDebugUnitTest
```

## How to Install

1. Enable *Developer options* and *USB debugging* on the phone.
2. Connect it and run `./gradlew installDebug`, or
   `adb install -r app/build/outputs/apk/debug/app-debug.apk`.

## How to Test

1. Open **Device** first and note the haptic engine path and unsupported primitives.
2. In **Library**, play patterns in the same category back to back (e.g. Ball Bounce → Basketball →
   Ping Pong → Rubber Ball) and compare rhythm and decay.
3. In **Detail**, lower the intensity to 50 % and 25 % and confirm the pattern keeps its shape.
4. Try Repeat 3x and Continuous on Heartbeat, Engine Idle and Rain; check STOP and that leaving the
   screen or pressing Home stops the vibration.
5. In **Playground**, compare primitives at the same intensity, then build a sequence like
   `THUD 1.0 → 80 ms → THUD 0.5 → 60 ms → TICK 0.3`.
6. Check that the system vibration intensity (Settings › Sounds and vibration › Vibration intensity ›
   Media) is not at zero.

## Known Limitations

* Haptic feel depends on the actuator and OEM tuning; values are tuned for strong LRA motors and may
  feel weaker or blurrier on other phones.
* Envelope patterns require an Android 16 HAL that reports `areEnvelopeEffectsSupported()`; many
  devices still fall back to compositions. Engine Rev has 25 control points and falls back when the
  device allows fewer.
* Primitive scale is perceptually non-linear and some devices clamp low scales; steps below ~0.2 may be
  imperceptible.
* Repeats are scheduled in software, so there can be a few ms of jitter between cycles.
* "Media" vibration intensity and battery-saver/Do-Not-Disturb settings can scale down or block
  vibration.
* Marketing names are mapped only for common Galaxy models; others show `Build.MODEL`.

## 50 Haptic Patterns

13 patterns use an envelope as primary implementation (with composition and/or waveform fallbacks);
37 use primitive compositions (with waveform fallbacks). Delays in compositions are pauses *before* a
primitive. Envelope points ramp from the previous point to `(intensity, sharpness)` over the given time.
Durations are estimates using nominal primitive lengths; real durations come from the device.

### 기본

| # | Pattern | Description | Primary | Duration | Peak | Envelope (intensity, sharpness, ms) | Composition (scale, *delay*) |
|---|---|---|---|---|---|---|---|
| 1 | · **살짝 톡** | 아주 살짝, 거의 안 느껴질 만큼 톡. | 기본 진동 조합 | ~8 ms | 0.35 | — | TICK 0.35 |
| 2 | • **톡** | 목록을 넘길 때 같은 평범한 톡. | 기본 진동 조합 | ~8 ms | 0.7 | — | TICK 0.7 |
| 3 | ⬤ **묵직한 톡** | 짧지만 무게감 있는 톡. | 기본 진동 조합 | ~12 ms | 1.0 | — | LOW_TICK 1.0 |
| 4 | 🔘 **부드러운 딸깍** | 푹신한 버튼을 누르는 느낌. | 기본 진동 조합 | ~12 ms | 0.45 | — | CLICK 0.45 |
| 5 | ⌨️ **기계식 딸깍** | 키보드 스위치처럼 딸깍 눌리고 톡 올라와요. | 기본 진동 조합 | ~50 ms | 1.0 | — | CLICK 1.0 → *30ms* TICK 0.55 |
| 6 | 🔲 **묵직한 딸깍** | 크고 무거운 버튼을 꾹 누르는 느낌. | 기본 진동 조합 | ~72 ms | 1.0 | — | CLICK 1.0 → THUD 0.5 |
| 7 | ⏸ **딸깍딸깍** | 똑같은 딸깍 두 번. | 기본 진동 조합 | ~114 ms | 0.9 | — | CLICK 0.9 → *90ms* CLICK 0.9 |
| 8 | ⁂ **딸깍 세 번** | 빠르게 딸깍딸깍딸깍. | 기본 진동 조합 | ~176 ms | 0.9 | — | CLICK 0.9 → *70ms* CLICK 0.9 → *70ms* CLICK 0.9 |
| 9 | 🟢 **스위치 켜기** | 스르륵 올라가다 딸깍! 켜졌어요. | 기본 진동 조합 | ~174 ms | 1.0 | — | LOW_TICK 0.4 → QUICK_RISE 0.5 → CLICK 1.0 |
| 10 | ⚪ **스위치 끄기** | 딸깍 풀리고 스르륵 내려가요. | 기본 진동 조합 | ~154 ms | 0.7 | — | CLICK 0.7 → QUICK_FALL 0.5 → *30ms* LOW_TICK 0.4 |

### 충격

| # | Pattern | Description | Primary | Duration | Peak | Envelope (intensity, sharpness, ms) | Composition (scale, *delay*) |
|---|---|---|---|---|---|---|---|
| 11 | 👆 **손가락 톡톡** | 손끝으로 화면을 가볍게 두드려요. | 기본 진동 조합 | ~60 ms | 0.3 | — | THUD 0.3 |
| 12 | 🚪 **노크** | 나무 문을 똑 한 번 두드려요. | 기본 진동 조합 | ~88 ms | 0.8 | — | THUD 0.8 → *20ms* TICK 0.3 |
| 13 | ✊ **똑똑** | 문을 똑똑 두 번 두드려요. | 기본 진동 조합 | ~326 ms | 0.85 | — | THUD 0.85 → *15ms* TICK 0.3 → *160ms* THUD 0.85 → *15ms* TICK 0.3 |
| 14 | 🪨 **쿵** | 무거운 물건이 바닥에 쿵. | 기본 진동 조합 | ~60 ms | 1.0 | — | THUD 1.0 |
| 15 | 👊 **펀치** | 짧고 세게 퍽! | 기본 진동 조합 | ~172 ms | 1.0 | — | CLICK 1.0 → THUD 1.0 → QUICK_FALL 0.6 |
| 16 | 🔨 **망치** | 망치를 들었다가 쾅! 쇠가 울려요. | 기본 진동 조합 | ~366 ms | 1.0 | — | LOW_TICK 0.3 → *150ms* THUD 1.0 → *30ms* TICK 0.5 → *40ms* TICK 0.32 → *50ms* TICK 0.2 |
| 17 | 🚗 **충돌** | 두 물체가 다가와 쾅 부딪혀요. | 기본 진동 조합 | ~299 ms | 1.0 | — | QUICK_RISE 0.5 → THUD 1.0 → *25ms* CLICK 0.6 → *40ms* LOW_TICK 0.35 |
| 18 | 📦 **툭 떨어지기** | 작은 물건이 툭 떨어져 한 번 통. | 기본 진동 조합 | ~142 ms | 0.6 | — | THUD 0.6 → *70ms* LOW_TICK 0.35 |
| 19 | 🏋️ **쿵 떨어지기** | 무거운 상자가 쿵 떨어지고 흔들려요. | 기본 진동 조합 | ~272 ms | 1.0 | — | THUD 1.0 → *50ms* THUD 0.45 → *90ms* LOW_TICK 0.3 |
| 20 | 💣 **폭발** | 펑! 하고 우르르 잦아들어요. | 진동 곡선 (세기 + 선명도) | ~785 ms | 1.0 | s0=0.85; (1.0, 0.85, 15ms) → (1.0, 0.5, 40ms) → (0.7, 0.3, 80ms) → (0.4, 0.15, 150ms) → (0.15, 0.05, 250ms) → (0.0, 0.0, 250ms) | THUD 1.0 → QUICK_FALL 1.0 → *40ms* LOW_TICK 0.5 → *20ms* QUICK_FALL 0.4 → *80ms* LOW_TICK 0.3 → *120ms* LOW_TICK 0.2 |

### 튕김

| # | Pattern | Description | Primary | Duration | Peak | Envelope (intensity, sharpness, ms) | Composition (scale, *delay*) |
|---|---|---|---|---|---|---|---|
| 21 | ⚽ **공 튀기기** | 공이 통, 통, 통 점점 약하게 튀다가 멈춰요. | 기본 진동 조합 | ~472 ms | 1.0 | — | THUD 1.0 → *130ms* THUD 0.55 → *90ms* THUD 0.3 → *60ms* LOW_TICK 0.2 |
| 22 | 🏀 **농구공** | 크고 무거운 공이 천천히 쿵쿵 튀어요. | 기본 진동 조합 | ~790 ms | 1.0 | — | THUD 1.0 → *240ms* THUD 0.75 → *180ms* THUD 0.5 → *130ms* THUD 0.3 |
| 23 | 🏓 **탁구공** | 가벼운 공이 따닥따닥 점점 빨라져요. | 기본 진동 조합 | ~509 ms | 0.9 | — | CLICK 0.9 → *130ms* CLICK 0.75 → *95ms* CLICK 0.6 → *70ms* TICK 0.7 → *52ms* TICK 0.55 → *38ms* TICK 0.42 → *28ms* TICK 0.3 → *20ms* TICK 0.2 |
| 24 | 🔴 **탱탱볼** | 탱탱볼이 여러 번 통통통 튀어요. | 기본 진동 조합 | ~752 ms | 1.0 | — | THUD 1.0 → *150ms* THUD 0.78 → *110ms* THUD 0.6 → *80ms* LOW_TICK 0.65 → *58ms* LOW_TICK 0.5 → *42ms* LOW_TICK 0.38 → *30ms* LOW_TICK 0.28 → *22ms* TICK 0.25 → *16ms* TICK 0.2 |
| 25 | 🌀 **스프링** | 꾹 눌렀다 놓으면 띠용~ 흔들려요. | 진동 곡선 (세기 + 선명도) | ~585 ms | 1.0 | s0=0.15; (0.45, 0.2, 300ms) → (0.05, 0.3, 20ms) → (1.0, 0.9, 15ms) → (0.15, 0.6, 35ms) → (0.7, 0.7, 35ms) → (0.12, 0.6, 35ms) → (0.45, 0.65, 35ms) → (0.08, 0.6, 35ms) → (0.25, 0.6, 35ms) → (0.0, 0.5, 40ms) | SLOW_RISE 0.5 → *30ms* CLICK 1.0 → SPIN 0.45 → *45ms* LOW_TICK 0.4 → *45ms* LOW_TICK 0.25 |
| 26 | 🪢 **고무줄** | 쭉 당겼다가 탁! 놓아요. | 기본 진동 조합 | ~497 ms | 1.0 | — | LOW_TICK 0.2 → *70ms* LOW_TICK 0.3 → *55ms* LOW_TICK 0.4 → *45ms* LOW_TICK 0.5 → *35ms* LOW_TICK 0.6 → *120ms* CLICK 1.0 → QUICK_FALL 0.5 |

### 움직임

| # | Pattern | Description | Primary | Duration | Peak | Envelope (intensity, sharpness, ms) | Composition (scale, *delay*) |
|---|---|---|---|---|---|---|---|
| 27 | 🔄 **빙글** | 한 번 빙글 돌아요. | 기본 진동 조합 | ~140 ms | 0.8 | — | SPIN 0.8 |
| 28 | 💫 **빙글빙글** | 팽이가 점점 빨리 돌아요. | 기본 진동 조합 | ~420 ms | 1.0 | — | SPIN 0.7 → SPIN 0.85 → SPIN 1.0 |
| 29 | 🎡 **느린 회전** | 큰 바퀴가 천천히 돌다 멈춰 가요. | 기본 진동 조합 | ~760 ms | 0.55 | — | SPIN 0.55 → *140ms* SPIN 0.45 → *200ms* SPIN 0.35 |
| 30 | 🎱 **데굴데굴** | 구슬이 책상 위를 굴러가요. | 기본 진동 조합 | ~590 ms | 0.4 | — | LOW_TICK 0.35 → *45ms* LOW_TICK 0.28 → *52ms* LOW_TICK 0.4 → *40ms* LOW_TICK 0.3 → *58ms* LOW_TICK 0.38 → *47ms* LOW_TICK 0.26 → *55ms* LOW_TICK 0.36 → *43ms* LOW_TICK 0.3 → *60ms* LOW_TICK 0.25 → *70ms* LOW_TICK 0.2 |
| 31 | ⚙️ **톱니바퀴** | 톱니가 하나씩 딱딱 맞물려 돌아요. | 기본 진동 조합 | ~396 ms | 0.65 | — | CLICK 0.65 → *15ms* LOW_TICK 0.5 → *80ms* CLICK 0.65 → *15ms* LOW_TICK 0.5 → *80ms* CLICK 0.65 → *15ms* LOW_TICK 0.5 → *80ms* CLICK 0.65 → *15ms* LOW_TICK 0.5 |
| 32 | 🔧 **라쳇** | 드르륵 올라가다 딱! 걸려요. | 기본 진동 조합 | ~496 ms | 1.0 | — | LOW_TICK 0.25 → *30ms* TICK 0.4 → *30ms* CLICK 1.0 → *110ms* LOW_TICK 0.25 → *30ms* TICK 0.4 → *30ms* CLICK 1.0 → *110ms* LOW_TICK 0.25 → *30ms* TICK 0.4 → *30ms* CLICK 1.0 |
| 33 | 🎛️ **다이얼** | 다이얼을 한 칸씩 딸깍딸깍 돌려요. | 기본 진동 조합 | ~560 ms | 0.85 | — | TICK 0.85 → *130ms* TICK 0.85 → *130ms* TICK 0.85 → *130ms* TICK 0.85 → *130ms* TICK 0.85 |
| 34 | ⏩ **다이얼 휙** | 휙 돌린 다이얼이 빨라졌다가 멈춰요. | 기본 진동 조합 | ~602 ms | 0.75 | — | TICK 0.75 → *80ms* TICK 0.75 → *62ms* TICK 0.75 → *50ms* TICK 0.75 → *40ms* TICK 0.75 → *34ms* TICK 0.75 → *30ms* TICK 0.75 → *30ms* TICK 0.75 → *32ms* TICK 0.75 → *38ms* TICK 0.75 → *48ms* TICK 0.75 → *62ms* TICK 0.75 |

### 자연

| # | Pattern | Description | Primary | Duration | Peak | Envelope (intensity, sharpness, ms) | Composition (scale, *delay*) |
|---|---|---|---|---|---|---|---|
| 35 | 💧 **물방울** | 똑! 떨어져서 퐁 퍼져요. | 진동 곡선 (세기 + 선명도) | ~187 ms | 0.85 | s0=1.0; (0.85, 1.0, 12ms) → (0.05, 0.9, 20ms) → (0.4, 0.25, 35ms) → (0.25, 0.2, 40ms) → (0.0, 0.15, 80ms) | TICK 1.0 → *35ms* LOW_TICK 0.45 → QUICK_FALL 0.3 |
| 36 | 💦 **물방울들** | 수도꼭지에서 물방울이 똑, 똑 떨어져요. | 기본 진동 조합 | ~860 ms | 1.0 | — | TICK 0.9 → *30ms* LOW_TICK 0.35 → *220ms* TICK 0.6 → *30ms* LOW_TICK 0.25 → *140ms* TICK 1.0 → *30ms* LOW_TICK 0.4 → *300ms* TICK 0.5 → *30ms* LOW_TICK 0.2 |
| 37 | 🌧️ **빗방울** | 창문에 작은 빗방울이 톡톡. | 기본 진동 조합 | ~975 ms | 0.55 | — | TICK 0.4 → *35ms* TICK 0.25 → *80ms* TICK 0.5 → *22ms* TICK 0.2 → *60ms* TICK 0.35 → *110ms* TICK 0.55 → *30ms* TICK 0.25 → *45ms* TICK 0.3 → *95ms* TICK 0.45 → *20ms* TICK 0.2 → *70ms* TICK 0.4 → *40ms* TICK 0.28 → *100ms* TICK 0.5 → *25ms* TICK 0.22 → *65ms* TICK 0.33 → *50ms* TICK 0.38 |
| 38 | ❤️ **심장 박동** | 쿵-쿵, 쉬고, 쿵-쿵. | 기본 진동 조합 | ~1150 ms | 1.0 | — | THUD 1.0 → *130ms* THUD 0.55 → *650ms* THUD 1.0 → *130ms* THUD 0.55 |
| 39 | 💓 **두근두근** | 긴장해서 심장이 빨리 뛰어요. | 기본 진동 조합 | ~1160 ms | 1.0 | — | THUD 1.0 → *80ms* THUD 0.6 → *280ms* THUD 1.0 → *80ms* THUD 0.6 → *280ms* THUD 1.0 → *80ms* THUD 0.6 |
| 40 | 🫁 **숨쉬기** | 천천히 들이쉬고, 길게 내쉬어요. | 진동 곡선 (세기 + 선명도) | ~3050 ms | 0.6 | s0=0.05; (0.15, 0.05, 300ms) → (0.4, 0.1, 400ms) → (0.6, 0.12, 500ms) → (0.6, 0.12, 250ms) → (0.35, 0.08, 600ms) → (0.12, 0.05, 600ms) → (0.0, 0.0, 400ms) | SLOW_RISE 0.35 → SLOW_RISE 0.6 → *200ms* QUICK_FALL 0.45 → QUICK_FALL 0.25 |

### 기계

| # | Pattern | Description | Primary | Duration | Peak | Envelope (intensity, sharpness, ms) | Composition (scale, *delay*) |
|---|---|---|---|---|---|---|---|
| 41 | 🪫 **작은 모터** | 작은 장난감 모터가 위잉~ | 진동 곡선 (세기 + 선명도) | ~720 ms | 0.36 | s0=0.9; (0.35, 0.9, 60ms) → (0.35, 0.95, 200ms) → (0.32, 0.9, 200ms) → (0.36, 0.95, 200ms) → (0.0, 0.9, 60ms) | — |
| 42 | 🔌 **전기 모터** | 윙~ 돌기 시작해서 돌다가 멈춰요. | 진동 곡선 (세기 + 선명도) | ~1100 ms | 0.65 | s0=0.4; (0.55, 0.6, 150ms) → (0.65, 0.7, 250ms) → (0.6, 0.7, 250ms) → (0.65, 0.7, 200ms) → (0.0, 0.4, 250ms) | — |
| 43 | 🚙 **자동차 시동** | 부르릉 부르릉 엔진이 가만히 돌아요. | 진동 곡선 (세기 + 선명도) | ~600 ms | 0.62 | s0=0.1; (0.6, 0.1, 30ms) → (0.2, 0.08, 55ms) → (0.55, 0.1, 30ms) → (0.18, 0.08, 60ms) → (0.62, 0.12, 30ms) → (0.22, 0.08, 50ms) → (0.5, 0.1, 30ms) → (0.18, 0.08, 62ms) → (0.6, 0.1, 30ms) → (0.2, 0.08, 55ms) → (0.56, 0.11, 30ms) → (0.2, 0.08, 58ms) → (0.6, 0.1, 30ms) → (0.0, 0.05, 50ms) | THUD 0.5 → *45ms* THUD 0.35 → *45ms* THUD 0.55 → *50ms* THUD 0.3 → *45ms* THUD 0.5 → *45ms* THUD 0.35 → *50ms* THUD 0.55 → *45ms* THUD 0.35 |
| 44 | 🏎️ **엔진 부웅** | 부르르릉! 점점 빨라지고 세져요. | 진동 곡선 (세기 + 선명도) | ~1020 ms | 1.0 | s0=0.1; (0.35, 0.1, 48ms) → (0.11, 0.1, 72ms) → (0.41, 0.16, 45ms) → (0.12, 0.16, 67ms) → (0.47, 0.22, 42ms) → (0.14, 0.22, 62ms) → (0.53, 0.28, 38ms) → (0.16, 0.28, 57ms) → (0.59, 0.34, 35ms) → (0.18, 0.34, 52ms) → (0.65, 0.4, 32ms) → (0.19, 0.4, 47ms) → (0.7, 0.45, 28ms) → (0.21, 0.45, 43ms) → (0.76, 0.51, 25ms) → (0.23, 0.51, 38ms) → (0.82, 0.57, 22ms) → (0.25, 0.57, 33ms) → (0.88, 0.63, 18ms) → (0.26, 0.63, 28ms) → (0.94, 0.69, 15ms) → (0.28, 0.69, 23ms) → (1.0, 0.75, 12ms) → (0.3, 0.75, 18ms) → (0.0, 0.6, 120ms) | THUD 0.3 → *120ms* THUD 0.35 → *105ms* THUD 0.41 → *90ms* THUD 0.46 → *78ms* THUD 0.52 → *66ms* LOW_TICK 0.57 → *56ms* LOW_TICK 0.62 → *48ms* LOW_TICK 0.68 → *41ms* LOW_TICK 0.73 → *35ms* LOW_TICK 0.78 → *30ms* CLICK 0.84 → *26ms* CLICK 0.89 → *23ms* CLICK 0.95 → *20ms* CLICK 1.0 |
| 45 | 🪚 **전동 드릴** | 드릴이 드르르륵 나무를 뚫어요. | 진동 곡선 (세기 + 선명도) | ~840 ms | 1.0 | s0=0.6; (0.85, 0.75, 60ms) → (0.95, 0.8, 80ms) → (0.75, 0.7, 80ms) → (1.0, 0.85, 80ms) → (0.8, 0.75, 80ms) → (0.95, 0.8, 80ms) → (0.7, 0.7, 80ms) → (1.0, 0.85, 80ms) → (0.3, 0.5, 120ms) → (0.0, 0.3, 100ms) | — |
| 46 | 🪥 **전동 칫솔** | 아주 잘게 떨리는 진동이 세 번. | 진동 곡선 (세기 + 선명도) | ~930 ms | 0.42 | s0=1.0; (0.4, 1.0, 20ms) → (0.42, 1.0, 230ms) → (0.0, 1.0, 20ms) → (0.0, 1.0, 60ms) → (0.4, 1.0, 20ms) → (0.42, 1.0, 230ms) → (0.0, 1.0, 20ms) → (0.0, 1.0, 60ms) → (0.4, 1.0, 20ms) → (0.42, 1.0, 230ms) → (0.0, 1.0, 20ms) | — |

### 게임

| # | Pattern | Description | Primary | Duration | Peak | Envelope (intensity, sharpness, ms) | Composition (scale, *delay*) |
|---|---|---|---|---|---|---|---|
| 47 | 🔫 **총 반동** | 탕! 손이 뒤로 밀리고 살짝 흔들려요. | 기본 진동 조합 | ~291 ms | 1.0 | — | CLICK 1.0 → THUD 1.0 → QUICK_FALL 0.7 → *45ms* LOW_TICK 0.3 → *50ms* LOW_TICK 0.2 |
| 48 | 🔋 **충전** | 에너지가 점점 차오르며 세져요. | 진동 곡선 (세기 + 선명도) | ~1530 ms | 0.95 | s0=0.1; (0.1, 0.1, 150ms) → (0.2, 0.25, 250ms) → (0.35, 0.4, 300ms) → (0.55, 0.6, 300ms) → (0.8, 0.8, 300ms) → (0.95, 0.95, 200ms) → (0.0, 1.0, 30ms) | SLOW_RISE 0.3 → SLOW_RISE 0.55 → SLOW_RISE 0.8 → QUICK_RISE 1.0 → TICK 0.6 |
| 49 | ⚡ **에너지 발사** | 모으고, 잠깐 멈췄다가, 한 번에 펑! | 진동 곡선 (세기 + 선명도) | ~1230 ms | 1.0 | s0=0.2; (0.3, 0.3, 200ms) → (0.55, 0.55, 250ms) → (0.75, 0.8, 200ms) → (0.0, 0.8, 15ms) → (0.0, 0.5, 70ms) → (1.0, 0.35, 15ms) → (0.8, 0.25, 60ms) → (0.4, 0.15, 120ms) → (0.15, 0.1, 150ms) → (0.0, 0.05, 150ms) | SLOW_RISE 0.6 → QUICK_RISE 0.85 → *80ms* THUD 1.0 → QUICK_FALL 0.9 → *60ms* LOW_TICK 0.35 → *80ms* LOW_TICK 0.2 |
| 50 | ✨ **마법 진동** | 반짝반짝, 강약이 번갈아 와요. | 진동 곡선 (세기 + 선명도) | ~750 ms | 0.85 | s0=0.9; (0.8, 0.95, 70ms) → (0.2, 0.35, 70ms) → (0.85, 0.95, 70ms) → (0.2, 0.35, 70ms) → (0.75, 0.9, 70ms) → (0.18, 0.3, 70ms) → (0.6, 0.85, 70ms) → (0.15, 0.3, 70ms) → (0.4, 0.8, 70ms) → (0.0, 0.5, 120ms) | QUICK_RISE 0.5 → QUICK_FALL 0.9 → *30ms* QUICK_RISE 0.4 → QUICK_FALL 0.7 → *30ms* SPIN 0.5 → QUICK_FALL 0.4 |

### Waveform fallbacks

Used when the primary API is unavailable. `timings` in ms, `amplitudes` 0–255 (0 = off).

| # | Pattern | Total | timings | amplitudes |
|---|---|---|---|---|
| 1 | 살짝 톡 | 8 ms | `[8]` | `[90]` |
| 2 | 톡 | 10 ms | `[10]` | `[170]` |
| 3 | 묵직한 톡 | 14 ms | `[14]` | `[240]` |
| 4 | 부드러운 딸깍 | 26 ms | `[6, 12, 8]` | `[60, 130, 50]` |
| 5 | 기계식 딸깍 | 50 ms | `[12, 30, 8]` | `[255, 0, 150]` |
| 6 | 묵직한 딸깍 | 50 ms | `[14, 22, 14]` | `[255, 200, 90]` |
| 7 | 딸깍딸깍 | 114 ms | `[12, 90, 12]` | `[230, 0, 230]` |
| 8 | 딸깍 세 번 | 176 ms | `[12, 70, 12, 70, 12]` | `[230, 0, 230, 0, 230]` |
| 9 | 스위치 켜기 | 77 ms | `[10, 15, 15, 15, 8, 14]` | `[70, 90, 130, 170, 0, 255]` |
| 10 | 스위치 끄기 | 107 ms | `[14, 8, 15, 15, 15, 30, 10]` | `[200, 0, 150, 100, 60, 0, 90]` |
| 11 | 손가락 톡톡 | 28 ms | `[16, 12]` | `[100, 40]` |
| 12 | 노크 | 58 ms | `[22, 8, 20, 8]` | `[230, 90, 0, 80]` |
| 13 | 똑똑 | 220 ms | `[22, 8, 160, 22, 8]` | `[230, 90, 0, 230, 90]` |
| 14 | 쿵 | 70 ms | `[30, 20, 20]` | `[255, 160, 70]` |
| 15 | 펀치 | 55 ms | `[10, 30, 15]` | `[255, 255, 120]` |
| 16 | 망치 | 337 ms | `[8, 150, 35, 30, 8, 40, 8, 50, 8]` | `[70, 0, 255, 0, 130, 0, 80, 0, 50]` |
| 17 | 충돌 | 160 ms | `[15, 15, 15, 30, 25, 10, 40, 10]` | `[60, 100, 140, 255, 0, 150, 0, 80]` |
| 18 | 툭 떨어지기 | 105 ms | `[25, 70, 10]` | `[170, 0, 90]` |
| 19 | 쿵 떨어지기 | 240 ms | `[45, 20, 50, 25, 90, 10]` | `[255, 140, 0, 120, 0, 70]` |
| 20 | 폭발 | 520 ms | `[40, 40, 60, 80, 120, 180]` | `[255, 230, 180, 130, 80, 40]` |
| 21 | 공 튀기기 | 366 ms | `[35, 130, 25, 90, 18, 60, 8]` | `[255, 0, 150, 0, 85, 0, 45]` |
| 22 | 농구공 | 692 ms | `[45, 240, 40, 180, 32, 130, 25]` | `[255, 0, 200, 0, 140, 0, 85]` |
| 23 | 탁구공 | 511 ms | `[12, 130, 12, 95, 11, 70, 10, 52, 9, 38, 8, 28, 8, 20, 8]` | `[230, 0, 190, 0, 150, 0, 140, 0, 110, 0, 85, 0, 60, 0, 40]` |
| 24 | 탱탱볼 | 649 ms | `[32, 150, 26, 110, 22, 80, 14, 58, 12, 42, 10, 30, 9, 22, 8, 16, 8]` | `[255, 0, 200, 0, 160, 0, 150, 0, 120, 0, 95, 0, 72, 0, 55, 0, 40]` |
| 25 | 스프링 | 545 ms | `[50, 50, 50, 50, 50, 50, 20, 15, 30, 30, 30, 30, 30, 30, 30]` | `[45, 60, 75, 90, 105, 120, 0, 255, 30, 180, 25, 120, 20, 70, 0]` |
| 26 | 고무줄 | 419 ms | `[10, 70, 10, 55, 10, 45, 10, 35, 10, 120, 14, 15, 15]` | `[50, 0, 75, 0, 100, 0, 125, 0, 150, 0, 255, 140, 70]` |
| 27 | 빙글 | 119 ms | `[20, 18, 18, 18, 20, 25]` | `[110, 200, 120, 210, 120, 60]` |
| 28 | 빙글빙글 | 188 ms | `[12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 20]` | `[140, 74, 156, 82, 172, 90, 188, 98, 204, 106, 220, 114, 236, 122, 90]` |
| 29 | 느린 회전 | 610 ms | `[25, 25, 25, 140, 30, 30, 30, 200, 35, 35, 35]` | `[80, 140, 80, 0, 65, 115, 65, 0, 55, 90, 50]` |
| 30 | 데굴데굴 | 570 ms | `[10, 45, 10, 52, 10, 40, 10, 58, 10, 47, 10, 55, 10, 43, 10, 60, 10, 70, 10]` | `[95, 0, 75, 0, 105, 0, 80, 0, 100, 0, 70, 0, 95, 0, 80, 0, 65, 0, 50]` |
| 31 | 톱니바퀴 | 388 ms | `[10, 15, 12, 80, 10, 15, 12, 80, 10, 15, 12, 80, 10, 15, 12]` | `[170, 0, 120, 0, 170, 0, 120, 0, 170, 0, 120, 0, 170, 0, 120]` |
| 32 | 라쳇 | 484 ms | `[8, 30, 8, 30, 12, 110, 8, 30, 8, 30, 12, 110, 8, 30, 8, 30, 12]` | `[60, 0, 110, 0, 255, 0, 60, 0, 110, 0, 255, 0, 60, 0, 110, 0, 255]` |
| 33 | 다이얼 | 565 ms | `[9, 130, 9, 130, 9, 130, 9, 130, 9]` | `[210, 0, 210, 0, 210, 0, 210, 0, 210]` |
| 34 | 다이얼 휙 | 602 ms | `[8, 80, 8, 62, 8, 50, 8, 40, 8, 34, 8, 30, 8, 30, 8, 32, 8, 38, 8, 48, 8, 62, 8]` | `[190, 0, 190, 0, 190, 0, 190, 0, 190, 0, 190, 0, 190, 0, 190, 0, 190, 0, 190, 0, 190, 0, 190]` |
| 35 | 물방울 | 103 ms | `[8, 30, 15, 20, 30]` | `[200, 0, 110, 70, 30]` |
| 36 | 물방울들 | 860 ms | `[8, 30, 12, 220, 8, 30, 12, 140, 8, 30, 12, 300, 8, 30, 12]` | `[190, 0, 80, 0, 130, 0, 60, 0, 220, 0, 90, 0, 110, 0, 45]` |
| 37 | 빗방울 | 959 ms | `[7, 35, 7, 80, 7, 22, 7, 60, 7, 110, 7, 30, 7, 45, 7, 95, 7, 20, 7, 70, 7, 40, 7, 100, 7, 25, 7, 65, 7, 50, 7]` | `[100, 0, 65, 0, 125, 0, 55, 0, 90, 0, 135, 0, 65, 0, 75, 0, 115, 0, 55, 0, 100, 0, 72, 0, 125, 0, 58, 0, 85, 0, 95]` |
| 38 | 심장 박동 | 1050 ms | `[40, 130, 30, 650, 40, 130, 30]` | `[255, 0, 150, 0, 255, 0, 150]` |
| 39 | 두근두근 | 980 ms | `[35, 80, 25, 280, 35, 80, 25, 280, 35, 80, 25]` | `[255, 0, 160, 0, 255, 0, 160, 0, 255, 0, 160]` |
| 40 | 숨쉬기 | 3050 ms | `[50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 250, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50]` | `[16, 22, 28, 33, 39, 45, 51, 57, 63, 68, 74, 80, 86, 92, 98, 103, 109, 115, 121, 127, 133, 138, 144, 150, 150, 146, 141, 137, 132, 128, 123, 119, 115, 110, 106, 101, 97, 92, 88, 83, 79, 75, 70, 66, 61, 57, 52, 48, 44, 39, 35, 30, 26, 21, 17, 12, 8]` |
| 41 | 작은 모터 | 710 ms | `[30, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 30]` | `[60, 95, 80, 95, 80, 95, 80, 95, 80, 95, 80, 95, 80, 95, 80, 95, 80, 95, 80, 95, 80, 95, 80, 95, 80, 95, 80, 40]` |
| 42 | 전기 모터 | 1090 ms | `[25, 25, 25, 25, 25, 25, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 30, 30, 30, 30, 30, 30, 30, 30]` | `[62, 83, 105, 127, 148, 170, 175, 160, 175, 160, 175, 160, 175, 160, 175, 160, 175, 160, 175, 160, 143, 125, 108, 90, 73, 55, 38, 20]` |
| 43 | 자동차 시동 | 600 ms | `[30, 55, 30, 60, 30, 50, 30, 62, 30, 55, 30, 58, 30, 50]` | `[170, 45, 160, 40, 180, 50, 150, 40, 170, 45, 165, 45, 170, 20]` |
| 44 | 엔진 부웅 | 1117 ms | `[25, 120, 24, 105, 23, 90, 22, 78, 21, 66, 20, 56, 19, 48, 18, 41, 17, 35, 16, 30, 15, 26, 14, 23, 13, 20, 12, 60, 60]` | `[80, 30, 93, 30, 107, 30, 120, 30, 134, 30, 147, 30, 161, 30, 174, 30, 188, 30, 201, 30, 215, 30, 228, 30, 242, 30, 255, 120, 40]` |
| 45 | 전동 드릴 | 820 ms | `[30, 30, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 40, 40, 40, 40, 40]` | `[200, 255, 255, 200, 170, 200, 255, 170, 255, 200, 170, 200, 255, 170, 255, 200, 170, 200, 255, 170, 255, 200, 170, 200, 255, 170, 255, 200, 170, 200, 148, 116, 84, 52, 20]` |
| 46 | 전동 칫솔 | 540 ms | `[10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 20, 60, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 20, 60, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 20]` | `[110, 70, 110, 70, 110, 70, 110, 70, 110, 70, 110, 70, 40, 0, 110, 70, 110, 70, 110, 70, 110, 70, 110, 70, 110, 70, 40, 0, 110, 70, 110, 70, 110, 70, 110, 70, 110, 70, 110, 70, 40]` |
| 47 | 총 반동 | 183 ms | `[10, 25, 20, 15, 45, 10, 50, 8]` | `[255, 255, 160, 80, 0, 70, 0, 40]` |
| 48 | 충전 | 1230 ms | `[30, 85, 30, 80, 30, 75, 30, 70, 30, 65, 30, 60, 30, 55, 30, 50, 30, 45, 30, 40, 30, 35, 30, 30, 30, 25, 30, 20, 30, 15, 30]` | `[40, 0, 54, 0, 68, 0, 82, 0, 96, 0, 110, 0, 124, 0, 138, 0, 152, 0, 166, 0, 180, 0, 194, 0, 208, 0, 222, 0, 236, 0, 250]` |
| 49 | 에너지 발사 | 1140 ms | `[50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 80, 40, 50, 80, 120, 120]` | `[41, 52, 62, 73, 84, 95, 105, 116, 127, 138, 148, 159, 170, 0, 255, 210, 140, 70, 30]` |
| 50 | 마법 진동 | 620 ms | `[60, 60, 60, 60, 60, 60, 60, 60, 60, 80]` | `[220, 60, 230, 55, 200, 50, 160, 40, 110, 20]` |
