package com.example.hapticlab.navigation

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.hapticlab.AppContainer
import com.example.hapticlab.ui.components.NoHapticFeedback
import com.example.hapticlab.ui.detail.DetailScreen
import com.example.hapticlab.ui.deviceinfo.DeviceInfoScreen
import com.example.hapticlab.ui.home.HomeScreen
import com.example.hapticlab.ui.playground.PlaygroundScreen
import com.example.hapticlab.ui.theme.HapticLabTheme
import com.example.hapticlab.viewmodel.DetailViewModel
import com.example.hapticlab.viewmodel.DeviceInfoViewModel
import com.example.hapticlab.viewmodel.HomeViewModel
import com.example.hapticlab.viewmodel.PlaygroundViewModel
import com.example.hapticlab.viewmodel.ViewModelFactories

@Composable
fun HapticLabApp(container: AppContainer) {
    // The UI itself must stay silent: disable View haptics and Compose's haptic feedback so
    // pressing PLAY never adds a system click on top of the pattern under test.
    val view = LocalView.current
    SideEffect { view.isHapticFeedbackEnabled = false }

    CompositionLocalProvider(LocalHapticFeedback provides NoHapticFeedback) {
        HapticLabTheme {
            val navigator = rememberSaveable(saver = AppNavigator.Saver) { AppNavigator() }
            BackHandler(enabled = navigator.canGoBack) { navigator.back() }

            when (val destination = navigator.current) {
                is Destination.Detail -> {
                    val vm: DetailViewModel = viewModel(
                        key = "detail-${destination.patternId}",
                        factory = ViewModelFactories.detail(container, destination.patternId),
                    )
                    DetailScreen(viewModel = vm, onBack = { navigator.back() })
                }

                else -> TabScaffold(container, navigator, destination)
            }
        }
    }
}

@Composable
private fun TabScaffold(container: AppContainer, navigator: AppNavigator, destination: Destination) {
    Scaffold(
        bottomBar = {
            NavigationBar {
                TopLevelTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = navigator.currentTab == tab,
                        onClick = { navigator.selectTab(tab) },
                        icon = { Text(tab.glyph, fontSize = 20.sp) },
                        label = { Text(tab.label, style = MaterialTheme.typography.labelMedium) },
                    )
                }
            }
        },
    ) { padding ->
        val modifier = Modifier.padding(padding)
        when (destination) {
            Destination.Playground -> {
                val vm: PlaygroundViewModel = viewModel(factory = ViewModelFactories.playground(container))
                PlaygroundScreen(vm, modifier)
            }

            Destination.DeviceInfo -> {
                val vm: DeviceInfoViewModel = viewModel(factory = ViewModelFactories.deviceInfo(container))
                DeviceInfoScreen(vm, modifier)
            }

            else -> {
                val vm: HomeViewModel = viewModel(factory = ViewModelFactories.home(container))
                HomeScreen(
                    viewModel = vm,
                    onOpenPattern = { navigator.navigate(Destination.Detail(it.id)) },
                    modifier = modifier,
                )
            }
        }
    }
}
