package com.example.hapticlab.haptic

import com.example.hapticlab.data.EnvelopePoint
import com.example.hapticlab.data.EnvelopeSpec
import com.example.hapticlab.data.PrimitiveStep
import com.example.hapticlab.data.WaveformSpec
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/*
 * Pure (Android-free) transformations used by HapticEffectFactory. Kept separate so they can be
 * unit-tested on the JVM.
 */

/** Scales every primitive by [intensity], preserving the relative relationship between steps. */
fun List<PrimitiveStep>.scaled(intensity: Float): List<PrimitiveStep> =
    map { it.copy(scale = (it.scale * intensity).coerceIn(0f, 1f)) }

object EnvelopeAdapter {
    /**
     * Fits [spec] to the device [limits] and applies the global [intensity].
     *
     * - Control points shorter than the device minimum are stretched to the minimum.
     * - Control points longer than the device maximum are split into linearly interpolated parts.
     * - Returns null when the result still exceeds the point-count or total-duration limits,
     *   so the caller can fall back to another API.
     */
    fun adapt(spec: EnvelopeSpec, limits: EnvelopeLimits, intensity: Float): EnvelopeSpec? {
        val minMs = max(1L, limits.minControlPointDurationMs)
        val maxMs = limits.maxControlPointDurationMs.takeIf { it > 0 } ?: Long.MAX_VALUE
        val out = mutableListOf<EnvelopePoint>()
        var prevIntensity = 0f
        var prevSharpness = spec.initialSharpness
        for (point in spec.points) {
            val targetIntensity = (point.intensity * intensity).coerceIn(0f, 1f)
            val duration = point.durationMs.coerceAtLeast(minMs)
            val parts = if (duration > maxMs) ceil(duration / maxMs.toDouble()).toInt() else 1
            val partDuration = max(minMs, (duration / parts.toDouble()).roundToLong())
            for (k in 1..parts) {
                val f = k / parts.toFloat()
                out += EnvelopePoint(
                    intensity = (prevIntensity + (targetIntensity - prevIntensity) * f).coerceIn(0f, 1f),
                    sharpness = (prevSharpness + (point.sharpness - prevSharpness) * f).coerceIn(0f, 1f),
                    durationMs = partDuration.coerceAtMost(maxMs),
                )
            }
            prevIntensity = targetIntensity
            prevSharpness = point.sharpness
        }
        if (limits.maxControlPoints > 0 && out.size > limits.maxControlPoints) return null
        if (limits.maxDurationMs > 0 && out.sumOf { it.durationMs } > limits.maxDurationMs) return null
        if (out.last().intensity != 0f) out[out.lastIndex] = out.last().copy(intensity = 0f)
        return EnvelopeSpec(spec.initialSharpness, out)
    }
}

object WaveformAdapter {
    /** Shortest pulse that reliably spins up an actuator. */
    const val MIN_ON_MS = 8L

    /** Applies [intensity] to amplitudes. Non-zero amplitudes never round down to silence. */
    fun scale(spec: WaveformSpec, intensity: Float): WaveformSpec = WaveformSpec(
        timings = spec.timings,
        amplitudes = spec.amplitudes.map { a ->
            if (a == 0) 0 else (a * intensity).roundToInt().coerceIn(1, 255)
        },
    )

    /**
     * Converts an amplitude waveform into the alternating OFF/ON timing array expected by
     * `createWaveform(long[] timings, int repeat)` for devices without amplitude control.
     *
     * Amplitude is approximated by duty cycle: a weaker segment is played as a shorter pulse
     * followed by silence, so relative strength and rhythm survive on on/off motors.
     */
    fun toOnOffTimings(spec: WaveformSpec, intensity: Float): LongArray {
        val pieces = mutableListOf<Pair<Long, Boolean>>() // (duration, isOn)
        spec.timings.forEachIndexed { i, t ->
            val a = spec.amplitudes[i] * intensity.coerceIn(0f, 1f)
            if (t <= 0L) return@forEachIndexed
            if (a <= 0f) {
                pieces += t to false
            } else {
                val duty = 0.35f + 0.65f * (a / 255f)
                val on = (t * duty).roundToLong().coerceIn(minOf(MIN_ON_MS, t), t)
                pieces += on to true
                if (t - on > 0) pieces += (t - on) to false
            }
        }
        // Merge neighbours with the same state, then make sure the array starts with OFF.
        val merged = mutableListOf<Pair<Long, Boolean>>()
        for (piece in pieces) {
            val last = merged.lastOrNull()
            if (last != null && last.second == piece.second) {
                merged[merged.lastIndex] = (last.first + piece.first) to last.second
            } else {
                merged += piece
            }
        }
        val result = mutableListOf<Long>()
        if (merged.firstOrNull()?.second == true) result += 0L
        merged.forEach { result += it.first }
        return result.toLongArray()
    }
}

/** Builds waveform approximations of primitive compositions (used for custom sequences). */
object WaveformSynth {
    private fun shape(primitive: HapticPrimitive): List<Pair<Int, Float>> = when (primitive) {
        HapticPrimitive.CLICK -> listOf(12 to 1.0f)
        HapticPrimitive.TICK -> listOf(8 to 0.75f)
        HapticPrimitive.LOW_TICK -> listOf(12 to 0.6f)
        HapticPrimitive.THUD -> listOf(20 to 1.0f, 20 to 0.65f, 20 to 0.3f)
        HapticPrimitive.SPIN -> listOf(20 to 0.4f, 20 to 0.8f, 20 to 0.5f, 20 to 0.9f, 20 to 0.5f, 20 to 0.25f)
        HapticPrimitive.QUICK_RISE -> (1..6).map { 25 to 0.15f + 0.85f * it / 6f }
        HapticPrimitive.SLOW_RISE -> (1..10).map { 40 to 0.08f + 0.92f * it / 10f }
        HapticPrimitive.QUICK_FALL -> (0 until 5).map { 20 to 1.0f - 0.85f * it / 4f }
    }

    fun fromSteps(steps: List<PrimitiveStep>): WaveformSpec {
        require(steps.isNotEmpty())
        val timings = mutableListOf<Long>()
        val amplitudes = mutableListOf<Int>()
        for (step in steps) {
            if (step.delayMs > 0) {
                timings += step.delayMs.toLong()
                amplitudes += 0
            }
            for ((ms, rel) in shape(step.primitive)) {
                timings += ms.toLong()
                amplitudes += (rel * step.scale * 255f).roundToInt().coerceIn(1, 255)
            }
        }
        return WaveformSpec(timings, amplitudes)
    }
}
