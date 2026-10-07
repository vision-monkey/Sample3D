package com.example.hapticlab.navigation

import androidx.compose.runtime.Stable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver

/**
 * Minimal back stack. The app has three tabs and one detail screen, which does not justify an
 * extra navigation dependency.
 */
@Stable
class AppNavigator(initial: List<Destination> = listOf(Destination.Library)) {

    private val stack = mutableStateListOf<Destination>().apply { addAll(initial) }

    val current: Destination get() = stack.last()

    val canGoBack: Boolean get() = stack.size > 1

    /** The tab that owns the current screen (detail screens belong to the Library). */
    val currentTab: TopLevelTab
        get() = TopLevelTab.entries.firstOrNull { it.destination == stack.first() } ?: TopLevelTab.LIBRARY

    fun navigate(destination: Destination) {
        stack.add(destination)
    }

    fun selectTab(tab: TopLevelTab) {
        stack.clear()
        stack.add(tab.destination)
    }

    fun back(): Boolean {
        if (!canGoBack) return false
        stack.removeAt(stack.lastIndex)
        return true
    }

    companion object {
        val Saver: Saver<AppNavigator, Any> = listSaver(
            save = { nav -> nav.stack.map { encode(it) } },
            restore = { saved -> AppNavigator(saved.map { decode(it) }.ifEmpty { listOf(Destination.Library) }) },
        )

        private fun encode(d: Destination): String = when (d) {
            Destination.Library -> "library"
            Destination.Playground -> "playground"
            Destination.DeviceInfo -> "device"
            is Destination.Detail -> "detail:${d.patternId}"
        }

        private fun decode(s: String): Destination = when {
            s == "playground" -> Destination.Playground
            s == "device" -> Destination.DeviceInfo
            s.startsWith("detail:") -> Destination.Detail(s.removePrefix("detail:"))
            else -> Destination.Library
        }
    }
}
