package com.example.hapticlab.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.hapticlab.data.HapticCategory
import com.example.hapticlab.data.HapticLibrary
import com.example.hapticlab.data.HapticPattern
import com.example.hapticlab.data.UserPreferencesRepository
import com.example.hapticlab.haptic.HapticCapability
import com.example.hapticlab.haptic.HapticEngine
import com.example.hapticlab.haptic.PlaybackState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn

data class HomeUiState(
    val patterns: List<HapticPattern> = emptyList(),
    val totalCount: Int = 0,
    val query: String = "",
    val category: HapticCategory? = null,
    val favoritesOnly: Boolean = false,
    val favorites: Set<String> = emptySet(),
)

class HomeViewModel(
    private val engine: HapticEngine,
    private val preferences: UserPreferencesRepository,
) : ViewModel() {

    private val query = MutableStateFlow("")
    private val category = MutableStateFlow<HapticCategory?>(null)
    private val favoritesOnly = MutableStateFlow(false)

    val capability: HapticCapability = engine.getCapabilities()
    val playback: StateFlow<PlaybackState> = engine.playbackState

    val uiState: StateFlow<HomeUiState> = combine(
        query,
        category,
        favoritesOnly,
        preferences.favorites,
    ) { q, cat, favOnly, favs ->
        HomeUiState(
            patterns = HapticLibrary.patterns.filter { pattern ->
                (cat == null || pattern.category == cat) &&
                    (!favOnly || pattern.id in favs) &&
                    pattern.matches(q)
            },
            totalCount = HapticLibrary.patterns.size,
            query = q,
            category = cat,
            favoritesOnly = favOnly,
            favorites = favs,
        )
    }.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        HomeUiState(patterns = HapticLibrary.patterns, totalCount = HapticLibrary.patterns.size),
    )

    fun onQueryChange(value: String) {
        query.value = value
    }

    fun onCategorySelected(value: HapticCategory?) {
        category.value = value
    }

    fun onFavoritesOnlyChange(value: Boolean) {
        favoritesOnly.value = value
    }

    fun toggleFavorite(id: String) = preferences.toggleFavorite(id)

    fun play(pattern: HapticPattern) {
        engine.play(pattern, preferences.globalIntensity.value)
    }

    fun stop() = engine.stop()

    override fun onCleared() {
        engine.stop()
    }
}
