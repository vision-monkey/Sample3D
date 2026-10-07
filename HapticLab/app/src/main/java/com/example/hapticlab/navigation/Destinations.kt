package com.example.hapticlab.navigation

/** App destinations. Top-level tabs plus the pattern detail screen. */
sealed interface Destination {
    data object Library : Destination
    data object Playground : Destination
    data object DeviceInfo : Destination
    data class Detail(val patternId: String) : Destination
}

enum class TopLevelTab(val label: String, val glyph: String, val destination: Destination) {
    LIBRARY("도감", "≋", Destination.Library),
    PLAYGROUND("놀이터", "🧪", Destination.Playground),
    DEVICE("내 폰", "ⓘ", Destination.DeviceInfo),
}
