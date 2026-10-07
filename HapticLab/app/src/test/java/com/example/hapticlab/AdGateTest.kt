package com.example.hapticlab

import com.example.hapticlab.ads.AdGate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdGateTest {

    @Test
    fun adIsDueOnTheTenthPlay() {
        val gate = AdGate(playsPerAd = 10)
        (1L..9L).forEach { gate.onPlayCount(it) }
        assertFalse(gate.adDue.value)
        assertEquals(1, gate.playsUntilAd)
        gate.onPlayCount(10)
        assertTrue(gate.adDue.value)
    }

    @Test
    fun countRestartsAfterAnAdIsShown() {
        val gate = AdGate(playsPerAd = 10)
        gate.onPlayCount(12) // plays bunched up before the ad could show
        gate.onAdShown()
        assertFalse(gate.adDue.value)
        gate.onPlayCount(21)
        assertFalse(gate.adDue.value)
        gate.onPlayCount(22)
        assertTrue(gate.adDue.value)
    }

    @Test
    fun adStaysDueUntilShown() {
        val gate = AdGate(playsPerAd = 10)
        gate.onPlayCount(10)
        gate.onPlayCount(15)
        assertTrue(gate.adDue.value)
    }
}
