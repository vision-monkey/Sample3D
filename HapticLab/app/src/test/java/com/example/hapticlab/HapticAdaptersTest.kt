package com.example.hapticlab

import com.example.hapticlab.data.EnvelopePoint
import com.example.hapticlab.data.EnvelopeSpec
import com.example.hapticlab.data.HapticLibrary
import com.example.hapticlab.data.PrimitiveStep
import com.example.hapticlab.data.WaveformSpec
import com.example.hapticlab.haptic.EnvelopeAdapter
import com.example.hapticlab.haptic.EnvelopeLimits
import com.example.hapticlab.haptic.HapticPrimitive
import com.example.hapticlab.haptic.WaveformAdapter
import com.example.hapticlab.haptic.WaveformSynth
import com.example.hapticlab.haptic.scaled
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HapticAdaptersTest {

    @Test
    fun globalIntensityKeepsRelativeStrength() {
        val steps = listOf(
            PrimitiveStep(HapticPrimitive.THUD, 1.0f),
            PrimitiveStep(HapticPrimitive.THUD, 0.55f, 80),
            PrimitiveStep(HapticPrimitive.THUD, 0.25f, 65),
        )
        val half = steps.scaled(0.5f)
        assertEquals(listOf(0.5f, 0.275f, 0.125f), half.map { it.scale })
        assertEquals(steps.map { it.delayMs }, half.map { it.delayMs })
    }

    @Test
    fun waveformScalingNeverSilencesNonZeroSegments() {
        val spec = WaveformSpec(listOf(10L, 20L, 10L), listOf(255, 0, 2))
        val scaled = WaveformAdapter.scale(spec, 0.1f)
        assertEquals(listOf(26, 0, 1), scaled.amplitudes)
    }

    @Test
    fun onOffConversionStartsWithOffAndKeepsTotalDuration() {
        val spec = WaveformSpec(listOf(35L, 80L, 25L, 65L, 18L), listOf(255, 0, 140, 0, 70))
        val timings = WaveformAdapter.toOnOffTimings(spec, 1f)
        assertEquals(0L, timings.first())
        assertEquals(spec.durationMs, timings.sum())
        // Full-strength pulse stays full length; weaker ones get shorter.
        assertEquals(35L, timings[1])
        assertTrue(timings[3] < 25L)
    }

    @Test
    fun onOffConversionMergesAdjacentOffSegments() {
        val spec = WaveformSpec(listOf(10L, 30L, 20L), listOf(0, 0, 255))
        assertArrayEquals(longArrayOf(40L, 20L), WaveformAdapter.toOnOffTimings(spec, 1f))
    }

    @Test
    fun envelopeAdapterStretchesSplitsAndRejects() {
        val spec = EnvelopeSpec(0.5f, listOf(EnvelopePoint(1f, 0.5f, 5), EnvelopePoint(0f, 0.2f, 1_000)))
        val limits = EnvelopeLimits(
            maxControlPoints = 16,
            minControlPointDurationMs = 10,
            maxControlPointDurationMs = 300,
            maxDurationMs = 5_000,
        )
        val adapted = EnvelopeAdapter.adapt(spec, limits, 0.5f)!!
        assertEquals(10L, adapted.points.first().durationMs)
        assertEquals(0.5f, adapted.points.first().intensity)
        assertEquals(5, adapted.points.size) // 1 + 1000 ms split into 4 x 250 ms
        assertTrue(adapted.points.all { it.durationMs in 10..300 })
        assertEquals(0f, adapted.points.last().intensity)

        assertNull(EnvelopeAdapter.adapt(spec, limits.copy(maxControlPoints = 3), 1f))
        assertNull(EnvelopeAdapter.adapt(spec, limits.copy(maxDurationMs = 500), 1f))
    }

    @Test
    fun allLibraryEnvelopesFitTypicalLimits() {
        val limits = EnvelopeLimits(
            maxControlPoints = 32,
            minControlPointDurationMs = 10,
            maxControlPointDurationMs = 1_000,
            maxDurationMs = 10_000,
        )
        HapticLibrary.patterns.mapNotNull { p -> p.envelope?.let { p.id to it } }.forEach { (id, env) ->
            assertTrue("$id does not fit", EnvelopeAdapter.adapt(env, limits, 1f) != null)
        }
    }

    @Test
    fun synthesizedWaveformFollowsSteps() {
        val spec = WaveformSynth.fromSteps(
            listOf(PrimitiveStep(HapticPrimitive.CLICK, 1f), PrimitiveStep(HapticPrimitive.TICK, 0.5f, 40)),
        )
        assertEquals(listOf(12L, 40L, 8L), spec.timings)
        assertEquals(255, spec.amplitudes[0])
        assertEquals(0, spec.amplitudes[1])
        assertTrue(spec.amplitudes[2] in 90..100)
    }
}
