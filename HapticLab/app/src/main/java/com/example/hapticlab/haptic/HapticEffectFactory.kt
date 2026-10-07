package com.example.hapticlab.haptic

import android.annotation.SuppressLint
import android.os.Build
import android.os.VibrationEffect
import androidx.annotation.RequiresApi
import com.example.hapticlab.data.EnvelopeSpec
import com.example.hapticlab.data.HapticPattern
import com.example.hapticlab.data.PrimitiveStep

/** A ready-to-play effect plus the information the UI and repeat scheduler need. */
class PreparedEffect(
    val effect: VibrationEffect,
    val path: HapticApiPath,
    val durationMs: Long,
)

/**
 * Turns [HapticPattern] data into a [VibrationEffect], choosing the best API the device supports:
 *
 * 1. Envelope (`BasicEnvelopeBuilder`, API 36) when the pattern defines one and the device
 *    reports `areEnvelopeEffectsSupported()` and the envelope fits the device limits.
 * 2. Composition (`startComposition`, API 30/31) when every primitive used is supported.
 * 3. Amplitude waveform (`createWaveform(timings, amplitudes, -1)`).
 * 4. On/off waveform (`createWaveform(timings, -1)`) for motors without amplitude control.
 *
 * If building a higher tier throws (e.g. a vendor validation quirk) the next tier is tried.
 */
class HapticEffectFactory(private val capability: HapticCapability) {

    /** The path [prepare] will use for [pattern] on this device. */
    fun resolvePath(pattern: HapticPattern): HapticApiPath = candidatePaths(pattern).first()

    fun prepare(pattern: HapticPattern, intensity: Float): PreparedEffect? {
        if (!capability.hasVibrator || intensity <= 0f) return null
        val scale = intensity.coerceIn(0f, 1f)
        for (path in candidatePaths(pattern)) {
            val prepared = runCatching { build(pattern, path, scale) }.getOrNull()
            if (prepared != null) return prepared
        }
        return null
    }

    private fun candidatePaths(pattern: HapticPattern): List<HapticApiPath> {
        if (!capability.hasVibrator) return listOf(HapticApiPath.NONE)
        val paths = mutableListOf<HapticApiPath>()
        val envelope = pattern.envelope
        val limits = capability.envelopeLimits
        if (envelope != null && capability.envelopeSupported && limits != null &&
            EnvelopeAdapter.adapt(envelope, limits, 1f) != null
        ) {
            paths += HapticApiPath.ENVELOPE
        }
        val composition = pattern.composition
        if (composition != null && composition.all { capability.isPrimitiveSupported(it.primitive) }) {
            paths += HapticApiPath.COMPOSITION
        }
        paths += capability.waveformPath
        return paths
    }

    private fun build(pattern: HapticPattern, path: HapticApiPath, scale: Float): PreparedEffect? =
        when (path) {
            HapticApiPath.ENVELOPE -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA) {
                val adapted = EnvelopeAdapter.adapt(pattern.envelope!!, capability.envelopeLimits!!, scale)
                adapted?.let { PreparedEffect(Api36.envelope(it), path, it.durationMs) }
            } else {
                null
            }

            HapticApiPath.COMPOSITION -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val steps = pattern.composition!!.scaled(scale)
                PreparedEffect(Api30.composition(steps), path, compositionDurationMs(steps))
            } else {
                null
            }

            HapticApiPath.WAVEFORM_AMPLITUDE -> {
                val spec = WaveformAdapter.scale(pattern.waveform, scale)
                PreparedEffect(
                    VibrationEffect.createWaveform(spec.timings.toLongArray(), spec.amplitudes.toIntArray(), -1),
                    path,
                    spec.durationMs,
                )
            }

            HapticApiPath.WAVEFORM_ON_OFF -> {
                val timings = WaveformAdapter.toOnOffTimings(pattern.waveform, scale)
                PreparedEffect(VibrationEffect.createWaveform(timings, -1), path, timings.sum())
            }

            HapticApiPath.NONE -> null
        }

    fun compositionDurationMs(steps: List<PrimitiveStep>): Long =
        steps.sumOf { (it.delayMs + capability.primitiveDurationMs(it.primitive)).toLong() }

    @RequiresApi(Build.VERSION_CODES.R)
    private object Api30 {
        fun composition(steps: List<PrimitiveStep>): VibrationEffect {
            val composition = VibrationEffect.startComposition()
            for (step in steps) {
                composition.addPrimitive(frameworkId(step.primitive), step.scale, step.delayMs)
            }
            return composition.compose()
        }
    }

    @RequiresApi(Build.VERSION_CODES.BAKLAVA)
    private object Api36 {
        fun envelope(spec: EnvelopeSpec): VibrationEffect {
            val builder = VibrationEffect.BasicEnvelopeBuilder()
                .setInitialSharpness(spec.initialSharpness)
            for (point in spec.points) {
                builder.addControlPoint(point.intensity, point.sharpness, point.durationMs)
            }
            return builder.build()
        }
    }

    companion object {
        /**
         * Maps [HapticPrimitive] to the real `VibrationEffect.Composition.PRIMITIVE_*` constant.
         * The constants are compile-time ints; callers only pass them to the framework on an API
         * level that defines them (see [HapticPrimitive.minApi]).
         */
        @SuppressLint("InlinedApi")
        fun frameworkId(primitive: HapticPrimitive): Int = when (primitive) {
            HapticPrimitive.CLICK -> VibrationEffect.Composition.PRIMITIVE_CLICK
            HapticPrimitive.THUD -> VibrationEffect.Composition.PRIMITIVE_THUD
            HapticPrimitive.SPIN -> VibrationEffect.Composition.PRIMITIVE_SPIN
            HapticPrimitive.QUICK_RISE -> VibrationEffect.Composition.PRIMITIVE_QUICK_RISE
            HapticPrimitive.SLOW_RISE -> VibrationEffect.Composition.PRIMITIVE_SLOW_RISE
            HapticPrimitive.QUICK_FALL -> VibrationEffect.Composition.PRIMITIVE_QUICK_FALL
            HapticPrimitive.TICK -> VibrationEffect.Composition.PRIMITIVE_TICK
            HapticPrimitive.LOW_TICK -> VibrationEffect.Composition.PRIMITIVE_LOW_TICK
        }
    }
}
