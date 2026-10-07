package com.example.hapticlab.haptic

import android.content.Context
import android.os.Build
import android.os.SystemClock
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.annotation.RequiresApi
import com.example.hapticlab.data.HapticCategory
import com.example.hapticlab.data.HapticPattern
import com.example.hapticlab.data.HapticPatternType
import com.example.hapticlab.data.PrimitiveStep
import com.example.hapticlab.data.WaveformSpec
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class RepeatMode(val label: String, val count: Int?) {
    OFF("한 번", 1),
    TWICE("2번", 2),
    THREE("3번", 3),
    FIVE("5번", 5),
    CONTINUOUS("계속", null),
}

data class PlaybackState(
    val isPlaying: Boolean = false,
    val sourceId: String? = null,
    val iteration: Int = 0,
    /** null while playing continuously. */
    val totalIterations: Int? = null,
    val path: HapticApiPath? = null,
) {
    val isContinuous: Boolean get() = isPlaying && totalIterations == null

    companion object {
        val Idle = PlaybackState()
    }
}

/**
 * Single entry point for all vibration in the app. UI code never touches [Vibrator] directly.
 *
 * Only one effect plays at a time: every [play] cancels whatever was playing before.
 * Repeats are scheduled on a background coroutine so they can be stopped at any moment, and
 * continuous playback stops automatically after [MAX_CONTINUOUS_MS] as a safety net.
 */
class HapticEngine(context: Context) {

    private val vibrator: Vibrator? = HapticCapabilityDetector.obtainVibrator(context.applicationContext)
    private val capability: HapticCapability = HapticCapabilityDetector.detect(vibrator)
    private val factory = HapticEffectFactory(capability)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val lock = Any()
    private var playJob: Job? = null

    @Volatile
    private var generation = 0L

    private val _playbackState = MutableStateFlow(PlaybackState.Idle)
    val playbackState: StateFlow<PlaybackState> = _playbackState.asStateFlow()

    private val _playCount = MutableStateFlow(0L)

    /** Number of playbacks started since launch (each PLAY press counts once, repeats included). */
    val playCount: StateFlow<Long> = _playCount.asStateFlow()

    fun getCapabilities(): HapticCapability = capability

    /** True when the device can render [pattern] at all (a waveform fallback always exists). */
    fun isPatternSupported(pattern: HapticPattern): Boolean = capability.hasVibrator

    /** True when the pattern will play with the implementation it was designed for. */
    fun isPrimaryImplementationSupported(pattern: HapticPattern): Boolean {
        val path = factory.resolvePath(pattern)
        return when (pattern.patternType) {
            HapticPatternType.ENVELOPE -> path == HapticApiPath.ENVELOPE
            HapticPatternType.COMPOSITION -> path == HapticApiPath.COMPOSITION
            HapticPatternType.WAVEFORM -> path == HapticApiPath.WAVEFORM_AMPLITUDE
        }
    }

    fun resolvePath(pattern: HapticPattern): HapticApiPath = factory.resolvePath(pattern)

    /** Duration of [steps] on this device, using reported primitive durations when available. */
    fun compositionDurationMs(steps: List<PrimitiveStep>): Long = factory.compositionDurationMs(steps)

    /**
     * Plays [pattern] scaled by the global [intensity] (0..1). Relative intensities inside the
     * pattern are preserved. Returns false when nothing could be played.
     */
    fun play(pattern: HapticPattern, intensity: Float = 1f, repeat: RepeatMode = RepeatMode.OFF): Boolean {
        val prepared = factory.prepare(pattern, intensity)
        if (prepared == null) {
            stop()
            return false
        }
        startPlayback(pattern.id, prepared, pattern.repeatGapMs, repeat)
        return true
    }

    /** Plays a user-built primitive sequence (Playground). */
    fun playSequence(
        steps: List<PrimitiveStep>,
        intensity: Float,
        repeat: RepeatMode,
        repeatGapMs: Long = 250,
    ): Boolean {
        if (steps.isEmpty()) return false
        val pattern = HapticPattern(
            id = CUSTOM_ID,
            number = 0,
            name = "Custom sequence",
            emoji = "🧪",
            description = "Playground sequence",
            category = HapticCategory.GAME,
            patternType = HapticPatternType.COMPOSITION,
            composition = steps,
            waveform = WaveformSynth.fromSteps(steps),
            repeatGapMs = repeatGapMs,
        )
        return play(pattern, intensity, repeat)
    }

    /** Raw motor pulse of [durationMs] (Playground, works on every device). */
    fun playOneShot(durationMs: Long, intensity: Float, repeat: RepeatMode, repeatGapMs: Long = 250): Boolean {
        val duration = durationMs.coerceIn(5L, MAX_ONE_SHOT_MS)
        val pattern = HapticPattern(
            id = CUSTOM_ID,
            number = 0,
            name = "One-shot",
            emoji = "🧪",
            description = "Raw one-shot pulse",
            category = HapticCategory.BASIC,
            patternType = HapticPatternType.WAVEFORM,
            waveform = WaveformSpec(listOf(duration), listOf(255)),
            repeatGapMs = repeatGapMs,
        )
        return play(pattern, intensity, repeat)
    }

    fun stop() {
        synchronized(lock) {
            generation++
            playJob?.cancel()
            playJob = null
            cancelVibrator()
        }
        _playbackState.value = PlaybackState.Idle
    }

    /** Stops playback and releases the engine's coroutine scope. */
    fun release() {
        stop()
        scope.cancel()
    }

    private fun startPlayback(sourceId: String, prepared: PreparedEffect, gapMs: Long, repeat: RepeatMode) {
        synchronized(lock) {
            playJob?.cancel()
            cancelVibrator()
            val myGeneration = ++generation
            _playCount.value += 1
            val total = repeat.count
            _playbackState.value = PlaybackState(true, sourceId, 1, total, prepared.path)
            playJob = scope.launch {
                val startedAt = SystemClock.elapsedRealtime()
                var iteration = 0
                try {
                    while (isActive) {
                        if (total != null && iteration >= total) break
                        if (total == null && SystemClock.elapsedRealtime() - startedAt > MAX_CONTINUOUS_MS) break
                        _playbackState.value = PlaybackState(true, sourceId, iteration + 1, total, prepared.path)
                        vibrate(prepared.effect)
                        val isLast = total != null && iteration == total - 1
                        // A short floor keeps the scheduler from spinning if a duration is reported as 0.
                        delay(prepared.durationMs.coerceAtLeast(MIN_CYCLE_MS) + if (isLast) 0 else gapMs)
                        iteration++
                    }
                } finally {
                    if (generation == myGeneration) {
                        if (total == null) cancelVibrator()
                        _playbackState.value = PlaybackState.Idle
                    }
                }
            }
        }
    }

    private fun vibrate(effect: VibrationEffect) {
        val v = vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Api33.vibrate(v, effect)
        } else {
            v.vibrate(effect)
        }
    }

    private fun cancelVibrator() {
        runCatching { vibrator?.cancel() }
    }

    @RequiresApi(Build.VERSION_CODES.TIRAMISU)
    private object Api33 {
        // USAGE_MEDIA: test vibrations should follow the media vibration intensity and must not be
        // dropped when the user has disabled touch feedback.
        private val attributes: VibrationAttributes =
            VibrationAttributes.createForUsage(VibrationAttributes.USAGE_MEDIA)

        fun vibrate(vibrator: Vibrator, effect: VibrationEffect) = vibrator.vibrate(effect, attributes)
    }

    companion object {
        const val CUSTOM_ID = "custom"
        const val MAX_CONTINUOUS_MS = 60_000L
        const val MAX_ONE_SHOT_MS = 1_000L
        private const val MIN_CYCLE_MS = 20L
    }
}
