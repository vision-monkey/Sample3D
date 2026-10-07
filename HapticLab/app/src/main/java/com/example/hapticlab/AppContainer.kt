package com.example.hapticlab

import android.content.Context
import com.example.hapticlab.data.UserPreferencesRepository
import com.example.hapticlab.haptic.HapticEngine

/** Manual dependency container; one instance per process. */
class AppContainer(context: Context) {
    val hapticEngine: HapticEngine by lazy { HapticEngine(context) }
    val preferences: UserPreferencesRepository by lazy { UserPreferencesRepository(context) }
}
