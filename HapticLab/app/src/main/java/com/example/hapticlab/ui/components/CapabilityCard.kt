package com.example.hapticlab.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.hapticlab.haptic.HapticCapability
import com.example.hapticlab.ui.theme.MonoStyle

/** "Device Haptic Capability" summary shown at the top of the library. */
@Composable
fun CapabilityCard(capability: HapticCapability, modifier: Modifier = Modifier, initiallyExpanded: Boolean = true) {
    var expanded by rememberSaveable { mutableStateOf(initiallyExpanded) }
    SectionCard(
        title = "Device Haptic Capability",
        subtitle = "${capability.displayName} · Android ${capability.androidVersion} (API ${capability.apiLevel})",
        modifier = modifier,
    ) {
        InfoRow("Haptic Engine") {
            Text(capability.bestPath.label, style = MonoStyle, color = MaterialTheme.colorScheme.primary)
        }
        if (!capability.hasVibrator) {
            SupportRow("Vibrator", false)
        } else {
            SupportRow("Amplitude Control", capability.hasAmplitudeControl)
            if (expanded) {
                SupportRow("Envelope Effects (Android 16)", capability.envelopeSupported)
                SupportRow("Frequency Control", capability.frequencyControlSupported)
                HorizontalDivider(Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outlineVariant)
                PrimitiveSupportList(capability)
            } else {
                Text(
                    "${capability.supportedPrimitives.size}/8 primitives supported",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        TextButton(onClick = { expanded = !expanded }, modifier = Modifier.align(Alignment.End)) {
            Text(if (expanded) "Hide details" else "Show details")
        }
    }
}

@Composable
fun PrimitiveSupportList(
    capability: HapticCapability,
    modifier: Modifier = Modifier,
    showDurations: Boolean = false,
) {
    Column(modifier) {
        capability.primitiveSupport.forEach { (primitive, supported) ->
            InfoRow(label = primitive.label) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val duration = capability.primitiveDurationsMs[primitive] ?: 0
                    if (showDurations && supported && duration > 0) {
                        Text(
                            "$duration ms",
                            style = MonoStyle,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(end = 10.dp),
                        )
                    }
                    SupportBadge(supported)
                }
            }
        }
    }
}
