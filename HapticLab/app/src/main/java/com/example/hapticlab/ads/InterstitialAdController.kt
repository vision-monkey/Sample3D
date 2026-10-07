package com.example.hapticlab.ads

import android.app.Activity
import android.content.Context
import android.util.Log
import com.example.hapticlab.R
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Google AdMob interstitials with Google's consent flow (UMP).
 *
 * Ad unit IDs come from string resources: Google's official *test* IDs in `src/main` (used by
 * debug builds) and the real IDs in `src/release/res/values/ads.xml`.
 */
class InterstitialAdController(context: Context) {

    private val appContext = context.applicationContext
    private val consentInformation: ConsentInformation = UserMessagingPlatform.getConsentInformation(appContext)
    private val initialized = AtomicBoolean(false)
    private var interstitial: InterstitialAd? = null
    private var loading = false

    val isReady: Boolean get() = interstitial != null

    /** Gathers consent where required (EEA/UK), then initializes the SDK and preloads an ad. */
    fun start(activity: Activity) {
        val params = ConsentRequestParameters.Builder().build()
        consentInformation.requestConsentInfoUpdate(
            activity,
            params,
            {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { formError ->
                    if (formError != null) Log.w(TAG, "Consent form: ${formError.message}")
                    initializeIfAllowed()
                }
            },
            { error ->
                Log.w(TAG, "Consent info update failed: ${error.message}")
                initializeIfAllowed()
            },
        )
        // Consent from a previous session may already allow requests.
        initializeIfAllowed()
    }

    private fun initializeIfAllowed() {
        if (!consentInformation.canRequestAds() || !initialized.compareAndSet(false, true)) return
        MobileAds.setRequestConfiguration(
            RequestConfiguration.Builder()
                // Family-friendly app: only general-audience ads.
                .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G)
                .build(),
        )
        CoroutineScope(Dispatchers.IO).launch {
            MobileAds.initialize(appContext) {}
            launch(Dispatchers.Main) { load() }
        }
    }

    fun load() {
        if (!initialized.get() || loading || interstitial != null) return
        loading = true
        InterstitialAd.load(
            appContext,
            appContext.getString(R.string.admob_interstitial_id),
            AdRequest.Builder().build(),
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    loading = false
                    interstitial = ad
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    loading = false
                    interstitial = null
                    Log.w(TAG, "Interstitial failed to load: ${error.message}")
                }
            },
        )
    }

    /** Shows the preloaded ad. [onShown] runs once the ad is on screen; returns false if none ready. */
    fun show(activity: Activity, onShown: () -> Unit): Boolean {
        val ad = interstitial ?: run {
            load()
            return false
        }
        interstitial = null
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdShowedFullScreenContent() = onShown()

            override fun onAdDismissedFullScreenContent() = load()

            override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                Log.w(TAG, "Interstitial failed to show: ${adError.message}")
                load()
            }
        }
        ad.show(activity)
        return true
    }

    private companion object {
        const val TAG = "HapticLabAds"
    }
}
