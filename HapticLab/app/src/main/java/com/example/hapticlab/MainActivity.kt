package com.example.hapticlab

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.example.hapticlab.ads.InterstitialAdController
import com.example.hapticlab.navigation.HapticLabApp
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val container: AppContainer
        get() = (application as HapticLabApplication).container

    private lateinit var ads: InterstitialAdController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // No system haptics from the window itself (e.g. long-press on views).
        window.decorView.isHapticFeedbackEnabled = false
        setContent { HapticLabApp(container) }

        ads = InterstitialAdController(this)
        ads.start(this)
        showAdsAtNaturalBreaks()
    }

    /**
     * Shows the interstitial once [com.example.hapticlab.ads.AdGate] says one is due, but only
     * after the vibration has finished and the user has paused for [AD_IDLE_DELAY_MS] — never in
     * the middle of a vibration or right under a finger that is still tapping tiles.
     */
    private fun showAdsAtNaturalBreaks() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.RESUMED) {
                combine(container.adGate.adDue, container.hapticEngine.playbackState) { due, playback ->
                    due && !playback.isPlaying
                }.distinctUntilChanged().collectLatest { ready ->
                    if (!ready) return@collectLatest
                    delay(AD_IDLE_DELAY_MS)
                    ads.show(this@MainActivity) {
                        container.hapticEngine.stop()
                        container.adGate.onAdShown()
                    }
                }
            }
        }
    }

    override fun onStop() {
        super.onStop()
        // Leaving the app (home, recents, screen off, an ad) must never leave a vibration running.
        // Configuration changes are excluded so rotating the phone doesn't cut a test short.
        if (!isChangingConfigurations) container.hapticEngine.stop()
    }

    override fun onDestroy() {
        if (isFinishing) container.hapticEngine.stop()
        super.onDestroy()
    }

    private companion object {
        const val AD_IDLE_DELAY_MS = 1_500L
    }
}
