package com.example.hapticlab

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.example.hapticlab.navigation.HapticLabApp

class MainActivity : ComponentActivity() {

    private val container: AppContainer
        get() = (application as HapticLabApplication).container

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // No system haptics from the window itself (e.g. long-press on views).
        window.decorView.isHapticFeedbackEnabled = false
        setContent { HapticLabApp(container) }
    }

    override fun onStop() {
        super.onStop()
        // Leaving the app (home, recents, screen off) must never leave a vibration running.
        // Configuration changes are excluded so rotating the phone doesn't cut a test short.
        if (!isChangingConfigurations) container.hapticEngine.stop()
    }

    override fun onDestroy() {
        if (isFinishing) container.hapticEngine.stop()
        super.onDestroy()
    }
}
