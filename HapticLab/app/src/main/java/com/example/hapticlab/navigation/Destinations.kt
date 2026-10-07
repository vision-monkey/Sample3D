package com.example.hapticlab.navigation

/** App destinations. Top-level tabs plus the pattern detail screen. */
sealed interface Destination {
    data object Library : Destination
    data object Playground : Destination
    data object DeviceInfo : Destination
    data class Detail(val patternId: String) : Destination
}

enum class TopLevelTab(val label: String, val glyph: String, val destination: Destination) {
    LIBRARY("Library", "≋", Destination.Library),
    PLAYGROUND("Playground", "🧪", Destination.Playground),
    DEVICE("Device", "ⓘ", Destination.DeviceInfo),
}
