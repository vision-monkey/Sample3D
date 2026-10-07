package com.example.hapticlab.ads

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Decides when an interstitial ad is due: after every [playsPerAd] vibration plays.
 *
 * It is fed the engine's running play total (not individual events), so plays that happen in
 * quick succession are never lost. Pure Kotlin so the rule can be unit-tested; showing the ad is
 * [InterstitialAdController]'s job.
 */
class AdGate(private val playsPerAd: Int = PLAYS_PER_AD) {

    init {
        require(playsPerAd > 0)
    }

    private var latestTotal = 0L
    private var totalAtLastAd = 0L

    private val _adDue = MutableStateFlow(false)
    val adDue: StateFlow<Boolean> = _adDue.asStateFlow()

    val playsUntilAd: Int get() = (playsPerAd - (latestTotal - totalAtLastAd)).coerceAtLeast(0L).toInt()

    @Synchronized
    fun onPlayCount(total: Long) {
        latestTotal = total
        _adDue.value = total - totalAtLastAd >= playsPerAd
    }

    /** Call when the ad was actually shown, so the next ad needs another [playsPerAd] plays. */
    @Synchronized
    fun onAdShown() {
        totalAtLastAd = latestTotal
        _adDue.value = false
    }

    companion object {
        const val PLAYS_PER_AD = 10
    }
}
