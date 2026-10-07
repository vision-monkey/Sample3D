package com.example.hapticlab.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * Favorites and the global intensity, persisted with framework SharedPreferences
 * (no extra dependency needed for two small values).
 */
class UserPreferencesRepository(context: Context) {

    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _favorites = MutableStateFlow(prefs.getStringSet(KEY_FAVORITES, emptySet()).orEmpty().toSet())
    val favorites: StateFlow<Set<String>> = _favorites.asStateFlow()

    private val _globalIntensity = MutableStateFlow(prefs.getFloat(KEY_INTENSITY, 1f).coerceIn(0f, 1f))

    /** Global intensity multiplier (0..1) applied on top of every pattern. */
    val globalIntensity: StateFlow<Float> = _globalIntensity.asStateFlow()

    fun toggleFavorite(id: String) {
        _favorites.update { current -> if (id in current) current - id else current + id }
        prefs.edit().putStringSet(KEY_FAVORITES, _favorites.value).apply()
    }

    fun setGlobalIntensity(value: Float) {
        val clamped = value.coerceIn(0f, 1f)
        _globalIntensity.value = clamped
        prefs.edit().putFloat(KEY_INTENSITY, clamped).apply()
    }

    private companion object {
        const val PREFS_NAME = "haptic_lab"
        const val KEY_FAVORITES = "favorites"
        const val KEY_INTENSITY = "global_intensity"
    }
}
