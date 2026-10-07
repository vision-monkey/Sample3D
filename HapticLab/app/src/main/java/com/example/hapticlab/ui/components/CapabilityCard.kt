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
        title = "내 휴대폰 진동 기능",
        subtitle = "${capability.displayName} · Android ${capability.androidVersion} (API ${capability.apiLevel})",
        modifier = modifier,
    ) {
        InfoRow("진동 방식") {
            Text(capability.bestPath.label, style = MonoStyle, color = MaterialTheme.colorScheme.primary)
        }
        if (!capability.hasVibrator) {
            SupportRow("진동 모터", false)
        } else {
            SupportRow("세기 조절", capability.hasAmplitudeControl)
            if (expanded) {
                SupportRow("진동 곡선 (Android 16)", capability.envelopeSupported)
                SupportRow("주파수 조절", capability.frequencyControlSupported)
                HorizontalDivider(Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outlineVariant)
                PrimitiveSupportList(capability)
            } else {
                Text(
                    "기본 진동 8개 중 ${capability.supportedPrimitives.size}개 지원",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        TextButton(onClick = { expanded = !expanded }, modifier = Modifier.align(Alignment.End)) {
            Text(if (expanded) "접기" else "자세히 보기")
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
