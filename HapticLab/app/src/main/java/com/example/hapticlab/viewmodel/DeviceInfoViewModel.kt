package com.example.hapticlab.viewmodel

import androidx.lifecycle.ViewModel
import com.example.hapticlab.data.HapticLibrary
import com.example.hapticlab.haptic.HapticApiPath
import com.example.hapticlab.haptic.HapticCapability
import com.example.hapticlab.haptic.HapticEngine

class DeviceInfoViewModel(engine: HapticEngine) : ViewModel() {
    val capability: HapticCapability = engine.getCapabilities()

    /** How many library patterns will render through each API path on this device. */
    val pathUsage: Map<HapticApiPath, Int> = HapticLibrary.patterns
        .groupingBy { engine.resolvePath(it) }
        .eachCount()
}
