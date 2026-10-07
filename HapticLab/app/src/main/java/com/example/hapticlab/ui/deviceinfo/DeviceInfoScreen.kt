package com.example.hapticlab.ui.deviceinfo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.hapticlab.haptic.HapticApiPath
import com.example.hapticlab.ui.components.InfoRow
import com.example.hapticlab.ui.components.PrimitiveSupportList
import com.example.hapticlab.ui.components.SectionCard
import com.example.hapticlab.ui.components.SupportRow
import com.example.hapticlab.ui.theme.MonoStyle
import com.example.hapticlab.viewmodel.DeviceInfoViewModel
import java.util.Locale

@Composable
fun DeviceInfoScreen(viewModel: DeviceInfoViewModel, modifier: Modifier = Modifier) {
    val c = viewModel.capability
    Column(
        modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.padding(top = 8.dp, bottom = 4.dp)) {
            Text("Device Info", style = MaterialTheme.typography.headlineMedium)
            Text(
                "What the haptic hardware reports, and which API the app uses.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        SectionCard("Haptic Engine") {
            Text(c.bestPath.label, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
            Text(c.bestPath.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(10.dp))
            Text("Library rendering on this device", style = MaterialTheme.typography.labelLarge)
            HapticApiPath.entries.forEach { path ->
                val count = viewModel.pathUsage[path] ?: 0
                if (count > 0) InfoRow(path.label, "$count patterns")
            }
            Spacer(Modifier.height(4.dp))
            Text(
                "Fallback order: Envelope (API 36) → Composition (API 30/31) → Amplitude waveform → On/Off waveform.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        SectionCard("Device") {
            InfoRow("Manufacturer", c.manufacturer)
            InfoRow("Model", c.model)
            InfoRow("Name", c.displayName)
            InfoRow("Android Version", c.androidVersion)
            InfoRow("API Level", c.apiLevel.toString())
        }

        SectionCard("Vibrator") {
            SupportRow("Has Vibrator", c.hasVibrator)
            SupportRow("Amplitude Control", c.hasAmplitudeControl)
            SupportRow("Composition API (API 30+)", c.compositionApiAvailable)
            SupportRow("Envelope Effects (API 36)", c.envelopeSupported)
            SupportRow("Frequency Control (API 36)", c.frequencyControlSupported)
            c.frequencyProfile?.let {
                InfoRow("Frequency range", "${fmt(it.minFrequencyHz)}–${fmt(it.maxFrequencyHz)} Hz")
                InfoRow("Max acceleration", "${fmt(it.maxOutputAccelerationGs)} g")
            }
            InfoRow("Resonant frequency", c.resonantFrequencyHz?.let { "${fmt(it)} Hz" } ?: "Unknown")
            InfoRow("Q factor", c.qFactor?.let { fmt(it) } ?: "Unknown")
            c.envelopeLimits?.let {
                InfoRow("Envelope max points", it.maxControlPoints.toString())
                InfoRow("Envelope point duration", "${it.minControlPointDurationMs}–${it.maxControlPointDurationMs} ms")
                InfoRow("Envelope max duration", "${it.maxDurationMs} ms")
            }
        }

        SectionCard("Primitives", subtitle = "Vibrator.arePrimitivesSupported() · durations from getPrimitiveDurations()") {
            PrimitiveSupportList(c, showDurations = true)
        }

        SectionCard("Notes") {
            Text(
                "Vibration motors and manufacturer haptic tuning differ between models, so the same pattern can " +
                    "feel different on another phone. Patterns are played with VibrationAttributes.USAGE_MEDIA " +
                    "(Android 13+), so they follow the system media vibration intensity setting.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(6.dp))
            Text("minSdk 26 · compileSdk 37 · targetSdk 37", style = MonoStyle)
        }
    }
}

private fun fmt(v: Float) = String.format(Locale.US, "%.1f", v)
