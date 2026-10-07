package com.example.hapticlab.data

import com.example.hapticlab.haptic.HapticPrimitive

/** The implementation a pattern was designed for (its "primary" implementation). */
enum class HapticPatternType(val label: String) {
    /** Android 16+ `VibrationEffect.BasicEnvelopeBuilder` (intensity + sharpness curve). */
    ENVELOPE("진동 곡선 (세기 + 선명도)"),

    /** Android 11+ `VibrationEffect.Composition` primitives with scale and delay. */
    COMPOSITION("기본 진동 조합"),

    /** `VibrationEffect.createWaveform` with per-segment amplitudes. */
    WAVEFORM("세기 파형"),
}

/**
 * One primitive inside a composition.
 *
 * @param delayMs pause inserted *before* this primitive, after the previous one ends
 *   (`Composition.addPrimitive(primitive, scale, delay)` semantics).
 */
data class PrimitiveStep(
    val primitive: HapticPrimitive,
    val scale: Float,
    val delayMs: Int = 0,
) {
    init {
        require(scale in 0f..1f) { "scale out of range: $scale" }
        require(delayMs >= 0) { "negative delay: $delayMs" }
    }
}

/**
 * One control point of a basic envelope: ramp from the previous point to
 * ([intensity], [sharpness]) over [durationMs].
 */
data class EnvelopePoint(
    val intensity: Float,
    val sharpness: Float,
    val durationMs: Long,
) {
    init {
        require(intensity in 0f..1f) { "intensity out of range: $intensity" }
        require(sharpness in 0f..1f) { "sharpness out of range: $sharpness" }
        require(durationMs > 0) { "control point duration must be > 0" }
    }
}

/** A basic envelope. The framework requires it to end at intensity 0. */
data class EnvelopeSpec(
    val initialSharpness: Float,
    val points: List<EnvelopePoint>,
) {
    init {
        require(points.isNotEmpty())
        require(points.last().intensity == 0f) { "envelope must end at zero intensity" }
    }

    val durationMs: Long get() = points.sumOf { it.durationMs }
    val peakIntensity: Float get() = points.maxOf { it.intensity }
}

/** Waveform fallback: on/off segments with amplitudes 0..255 (0 = motor off). */
data class WaveformSpec(
    val timings: List<Long>,
    val amplitudes: List<Int>,
) {
    init {
        require(timings.size == amplitudes.size) { "timings/amplitudes size mismatch" }
        require(timings.isNotEmpty())
        require(timings.all { it >= 0 })
        require(amplitudes.all { it in 0..255 }) { "amplitude out of range" }
        require(amplitudes.any { it > 0 }) { "waveform is silent" }
    }

    val durationMs: Long get() = timings.sum()
    val peakAmplitude: Int get() = amplitudes.max()
}

data class HapticPattern(
    val id: String,
    val number: Int,
    val name: String,
    val emoji: String,
    val description: String,
    val category: HapticCategory,
    val patternType: HapticPatternType,
    val composition: List<PrimitiveStep>? = null,
    val envelope: EnvelopeSpec? = null,
    val waveform: WaveformSpec,
    /** Rest inserted between cycles when the pattern is repeated. */
    val repeatGapMs: Long = 300,
) {
    init {
        when (patternType) {
            HapticPatternType.ENVELOPE -> requireNotNull(envelope) { "$id: envelope missing" }
            HapticPatternType.COMPOSITION -> requireNotNull(composition) { "$id: composition missing" }
            HapticPatternType.WAVEFORM -> Unit
        }
        composition?.let { require(it.isNotEmpty()) }
    }

    /** Peak designed intensity (0..1), before the global intensity scale. */
    val intensity: Float
        get() = when (patternType) {
            HapticPatternType.ENVELOPE -> envelope!!.peakIntensity
            HapticPatternType.COMPOSITION -> composition!!.maxOf { it.scale }
            HapticPatternType.WAVEFORM -> waveform.peakAmplitude / 255f
        }

    /** Short human readable shape, e.g. "THUD → THUD → THUD". */
    val sequenceSummary: String
        get() = when (patternType) {
            HapticPatternType.COMPOSITION -> summarizeSteps(composition!!)
            HapticPatternType.ENVELOPE -> "진동 곡선 · ${envelope!!.durationMs}ms"
            HapticPatternType.WAVEFORM -> "파형 · ${waveform.durationMs}ms"
        }

    /** Duration estimate of the primary implementation using nominal primitive lengths. */
    val estimatedDurationMs: Long
        get() = when (patternType) {
            HapticPatternType.ENVELOPE -> envelope!!.durationMs

            HapticPatternType.COMPOSITION -> composition!!.sumOf {
                (it.delayMs + it.primitive.nominalDurationMs).toLong()
            }

            HapticPatternType.WAVEFORM -> waveform.durationMs
        }

    val primitivesUsed: Set<HapticPrimitive>
        get() = composition?.map { it.primitive }?.toSet().orEmpty()

    fun matches(query: String): Boolean {
        if (query.isBlank()) return true
        val q = query.trim()
        return name.contains(q, ignoreCase = true) ||
            description.contains(q, ignoreCase = true) ||
            category.label.contains(q, ignoreCase = true)
    }

    companion object {
        fun summarizeSteps(steps: List<PrimitiveStep>, maxItems: Int = 5): String {
            val labels = steps.map { it.primitive.label }
            val shown = labels.take(maxItems).joinToString(" → ")
            return if (labels.size > maxItems) "$shown → … (${labels.size})" else shown
        }
    }
}
