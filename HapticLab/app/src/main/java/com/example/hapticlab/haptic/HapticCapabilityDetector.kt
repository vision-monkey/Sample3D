package com.example.hapticlab.haptic

import android.content.Context
import android.os.Build
import android.os.Vibrator
import android.os.VibratorManager
import androidx.annotation.RequiresApi
import com.example.hapticlab.util.DeviceNames

/** Reads the device's haptic capabilities using only API-level-guarded framework calls. */
object HapticCapabilityDetector {

    fun obtainVibrator(context: Context): Vibrator? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Api31.defaultVibrator(context)
        } else {
            context.getSystemService(Vibrator::class.java)
        }

    fun detect(vibrator: Vibrator?): HapticCapability {
        val sdk = Build.VERSION.SDK_INT
        val hasVibrator = vibrator?.hasVibrator() == true
        val base = HapticCapability.Unknown.copy(
            manufacturer = Build.MANUFACTURER.orEmpty(),
            model = Build.MODEL.orEmpty(),
            displayName = DeviceNames.displayName(Build.MANUFACTURER.orEmpty(), Build.MODEL.orEmpty()),
            androidVersion = Build.VERSION.RELEASE.orEmpty(),
            apiLevel = sdk,
            hasVibrator = hasVibrator,
        )
        if (vibrator == null || !hasVibrator) return base

        val primitiveSupport = if (sdk >= Build.VERSION_CODES.R) {
            Api30.primitiveSupport(vibrator)
        } else {
            HapticPrimitive.entries.associateWith { false }
        }
        val durations = if (sdk >= Build.VERSION_CODES.S) Api31.primitiveDurations(vibrator) else emptyMap()
        val resonant = if (sdk >= Build.VERSION_CODES.S) vibrator.resonantFrequency.takeUnless { it.isNaN() } else null
        val qFactor = if (sdk >= Build.VERSION_CODES.S) vibrator.qFactor.takeUnless { it.isNaN() } else null

        var envelopeSupported = false
        var envelopeLimits: EnvelopeLimits? = null
        var frequencyProfile: FrequencyProfileInfo? = null
        if (sdk >= Build.VERSION_CODES.BAKLAVA) {
            // Flagged APIs: guard against OEM builds where the flag is off.
            runCatching {
                envelopeSupported = Api36.envelopeSupported(vibrator)
                if (envelopeSupported) envelopeLimits = Api36.envelopeLimits(vibrator)
                frequencyProfile = Api36.frequencyProfile(vibrator)
            }.onFailure { envelopeSupported = false }
        }

        return base.copy(
            hasAmplitudeControl = vibrator.hasAmplitudeControl(),
            compositionApiAvailable = sdk >= Build.VERSION_CODES.R,
            primitiveSupport = primitiveSupport,
            primitiveDurationsMs = durations,
            envelopeSupported = envelopeSupported && envelopeLimits != null,
            envelopeLimits = envelopeLimits,
            frequencyProfile = frequencyProfile,
            resonantFrequencyHz = resonant,
            qFactor = qFactor,
        )
    }

    @RequiresApi(Build.VERSION_CODES.R)
    private object Api30 {
        fun primitiveSupport(vibrator: Vibrator): Map<HapticPrimitive, Boolean> =
            HapticPrimitive.entries.associateWith { primitive ->
                // THUD / SPIN / LOW_TICK are only defined from API 31: never query them earlier.
                if (Build.VERSION.SDK_INT < primitive.minApi) {
                    false
                } else {
                    runCatching {
                        vibrator.arePrimitivesSupported(HapticEffectFactory.frameworkId(primitive)).single()
                    }.getOrDefault(false)
                }
            }
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private object Api31 {
        fun defaultVibrator(context: Context): Vibrator? =
            context.getSystemService(VibratorManager::class.java)?.defaultVibrator

        fun primitiveDurations(vibrator: Vibrator): Map<HapticPrimitive, Int> {
            val primitives = HapticPrimitive.entries
            val ids = primitives.map { HapticEffectFactory.frameworkId(it) }.toIntArray()
            val durations = runCatching { vibrator.getPrimitiveDurations(*ids) }.getOrNull()
                ?: return emptyMap()
            return primitives.zip(durations.toList()).toMap()
        }
    }

    @RequiresApi(Build.VERSION_CODES.BAKLAVA)
    private object Api36 {
        fun envelopeSupported(vibrator: Vibrator): Boolean = vibrator.areEnvelopeEffectsSupported()

        fun envelopeLimits(vibrator: Vibrator): EnvelopeLimits {
            val info = vibrator.envelopeEffectInfo
            return EnvelopeLimits(
                maxControlPoints = info.maxSize,
                minControlPointDurationMs = info.minControlPointDurationMillis,
                maxControlPointDurationMs = info.maxControlPointDurationMillis,
                maxDurationMs = info.maxDurationMillis,
            )
        }

        fun frequencyProfile(vibrator: Vibrator): FrequencyProfileInfo? {
            val profile = vibrator.frequencyProfile ?: return null
            return FrequencyProfileInfo(
                minFrequencyHz = profile.minFrequencyHz,
                maxFrequencyHz = profile.maxFrequencyHz,
                maxOutputAccelerationGs = profile.maxOutputAccelerationGs,
            )
        }
    }
}
