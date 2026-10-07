package com.example.hapticlab

import android.content.Context
import com.example.hapticlab.ads.AdGate
import com.example.hapticlab.data.UserPreferencesRepository
import com.example.hapticlab.haptic.HapticEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Manual dependency container; one instance per process. */
class AppContainer(context: Context) {
    val hapticEngine: HapticEngine by lazy { HapticEngine(context) }
    val preferences: UserPreferencesRepository by lazy { UserPreferencesRepository(context) }
    val adGate = AdGate()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    init {
        // Every started playback (any screen) counts toward the next interstitial.
        scope.launch { hapticEngine.playCount.collect(adGate::onPlayCount) }
    }
}
