package com.example.hapticlab

import com.example.hapticlab.data.HapticCategory
import com.example.hapticlab.data.HapticLibrary
import com.example.hapticlab.data.HapticPatternType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HapticLibraryTest {

    private val patterns = HapticLibrary.patterns

    @Test
    fun hasFiftyNumberedPatternsWithUniqueIds() {
        assertEquals(50, patterns.size)
        assertEquals((1..50).toList(), patterns.map { it.number })
        assertEquals(50, patterns.map { it.id }.toSet().size)
        assertEquals(50, patterns.map { it.name }.toSet().size)
    }

    @Test
    fun categoriesMatchTheSpecification() {
        val expected = mapOf(
            HapticCategory.BASIC to 10,
            HapticCategory.IMPACT to 10,
            HapticCategory.BOUNCE to 6,
            HapticCategory.MOTION to 8,
            HapticCategory.NATURAL to 6,
            HapticCategory.MACHINE to 6,
            HapticCategory.GAME to 4,
        )
        assertEquals(expected, patterns.groupingBy { it.category }.eachCount())
    }

    @Test
    fun everyPrimaryImplementationIsPresent() {
        patterns.forEach { p ->
            when (p.patternType) {
                HapticPatternType.ENVELOPE -> assertNotNull(p.id, p.envelope)
                HapticPatternType.COMPOSITION -> assertNotNull(p.id, p.composition)
                HapticPatternType.WAVEFORM -> Unit
            }
        }
    }

    @Test
    fun noTwoPatternsShareTheSameData() {
        val compositions = patterns.mapNotNull { p -> p.composition?.let { p.id to it } }
        assertEquals(compositions.size, compositions.map { it.second }.toSet().size)
        val envelopes = patterns.mapNotNull { p -> p.envelope?.let { p.id to it } }
        assertEquals(envelopes.size, envelopes.map { it.second }.toSet().size)
        assertEquals(50, patterns.map { it.waveform }.toSet().size)
    }

    @Test
    fun durationsStayWithinSafeLimits() {
        patterns.forEach { p ->
            assertTrue("${p.id} waveform too long", p.waveform.durationMs <= 3_500)
            p.envelope?.let { assertTrue("${p.id} envelope too long", it.durationMs <= 3_500) }
            assertTrue("${p.id} estimate too long", p.estimatedDurationMs <= 3_500)
        }
    }

    @Test
    fun envelopesEndAtZeroIntensity() {
        patterns.mapNotNull { it.envelope }.forEach { assertEquals(0f, it.points.last().intensity) }
    }

    @Test
    fun waveformOnSegmentsAreLongEnoughToFeel() {
        patterns.forEach { p ->
            p.waveform.timings.zip(p.waveform.amplitudes).forEach { (t, a) ->
                if (a > 0) assertTrue("${p.id}: $t ms pulse is too short", t >= 6)
            }
        }
    }

    @Test
    fun searchMatchesNameDescriptionAndCategory() {
        assertTrue(HapticLibrary.find("heartbeat")!!.matches("심장"))
        assertTrue(HapticLibrary.find("engine_rev")!!.matches("기계"))
        assertTrue(HapticLibrary.find("ball_bounce")!!.matches("통"))
        assertTrue(patterns.none { it.matches("없는검색어") })
    }
}
