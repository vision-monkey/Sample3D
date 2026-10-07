package com.example.hapticlab.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.hapticlab.data.HapticLibrary
import com.example.hapticlab.data.HapticPattern
import com.example.hapticlab.data.UserPreferencesRepository
import com.example.hapticlab.haptic.HapticApiPath
import com.example.hapticlab.haptic.HapticCapability
import com.example.hapticlab.haptic.HapticEngine
import com.example.hapticlab.haptic.PlaybackState
import com.example.hapticlab.haptic.RepeatMode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

class DetailViewModel(
    patternId: String,
    private val engine: HapticEngine,
    private val preferences: UserPreferencesRepository,
) : ViewModel() {

    val pattern: HapticPattern? = HapticLibrary.find(patternId)
    val capability: HapticCapability = engine.getCapabilities()
    val path: HapticApiPath? = pattern?.let { engine.resolvePath(it) }
    val primaryImplementationSupported: Boolean = pattern?.let { engine.isPrimaryImplementationSupported(it) } ?: false

    /** Device-adjusted duration of the composition (uses real primitive durations when known). */
    val compositionDurationMs: Long? = pattern?.composition?.let { engine.compositionDurationMs(it) }

    val intensity: StateFlow<Float> = preferences.globalIntensity

    private val _repeat = MutableStateFlow(RepeatMode.OFF)
    val repeat: StateFlow<RepeatMode> = _repeat.asStateFlow()

    val playback: StateFlow<PlaybackState> = engine.playbackState

    val isFavorite: StateFlow<Boolean> = preferences.favorites
        .map { patternId in it }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), patternId in preferences.favorites.value)

    fun setIntensity(value: Float) = preferences.setGlobalIntensity(value)

    fun setRepeat(mode: RepeatMode) {
        _repeat.value = mode
    }

    fun toggleFavorite() {
        pattern?.let { preferences.toggleFavorite(it.id) }
    }

    fun play() {
        pattern?.let { engine.play(it, intensity.value, repeat.value) }
    }

    fun stop() = engine.stop()

    override fun onCleared() {
        engine.stop()
    }
}
