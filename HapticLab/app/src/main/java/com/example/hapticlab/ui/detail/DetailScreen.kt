package com.example.hapticlab.ui.detail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.hapticlab.data.EnvelopeSpec
import com.example.hapticlab.data.HapticPattern
import com.example.hapticlab.data.HapticPatternType
import com.example.hapticlab.data.PrimitiveStep
import com.example.hapticlab.data.WaveformSpec
import com.example.hapticlab.haptic.HapticApiPath
import com.example.hapticlab.haptic.RepeatMode
import com.example.hapticlab.haptic.WaveformAdapter
import com.example.hapticlab.ui.components.InfoRow
import com.example.hapticlab.ui.components.IntensitySlider
import com.example.hapticlab.ui.components.PlayStopButton
import com.example.hapticlab.ui.components.RepeatSelector
import com.example.hapticlab.ui.components.SectionCard
import com.example.hapticlab.ui.components.SupportBadge
import com.example.hapticlab.ui.theme.MonoStyle
import com.example.hapticlab.viewmodel.DetailViewModel
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetailScreen(viewModel: DetailViewModel, onBack: () -> Unit) {
    val pattern = viewModel.pattern
    val intensity by viewModel.intensity.collectAsStateWithLifecycle()
    val repeat by viewModel.repeat.collectAsStateWithLifecycle()
    val playback by viewModel.playback.collectAsStateWithLifecycle()
    val isFavorite by viewModel.isFavorite.collectAsStateWithLifecycle()

    // Never leave a vibration running after the screen goes away.
    DisposableEffect(viewModel) {
        onDispose { viewModel.stop() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(pattern?.name ?: "Unknown pattern") },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("←  Back") }
                },
                actions = {
                    if (pattern != null) {
                        IconButton(onClick = viewModel::toggleFavorite) {
                            Text(
                                if (isFavorite) "★" else "☆",
                                fontSize = 22.sp,
                                color = if (isFavorite) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                },
            )
        },
        bottomBar = {
            if (pattern != null) {
                Surface(tonalElevation = 3.dp, shadowElevation = 8.dp) {
                    PlayStopButton(
                        isPlaying = playback.isPlaying && playback.sourceId == pattern.id,
                        playLabel = "TEST HAPTIC",
                        onPlay = viewModel::play,
                        onStop = viewModel::stop,
                        enabled = intensity > 0f && viewModel.capability.hasVibrator,
                        modifier = Modifier
                            .navigationBarsPadding()
                            .padding(16.dp),
                    )
                }
            }
        },
    ) { padding ->
        if (pattern == null) {
            Text("Pattern not found", Modifier.padding(padding).padding(24.dp))
        } else {
            DetailBody(
                pattern = pattern,
                viewModel = viewModel,
                intensity = intensity,
                repeat = repeat,
                status = if (playback.isPlaying && playback.sourceId == pattern.id) {
                    val total = playback.totalIterations?.toString() ?: "∞"
                    "Playing ${playback.iteration}/$total via ${playback.path?.label.orEmpty()}"
                } else {
                    null
                },
                modifier = Modifier.padding(padding),
            )
        }
    }
}

@Composable
private fun DetailBody(
    pattern: HapticPattern,
    viewModel: DetailViewModel,
    intensity: Float,
    repeat: RepeatMode,
    status: String?,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Hero(pattern)
        Overview(viewModel, pattern)
        Playback(
            intensity = intensity,
            onIntensityChange = viewModel::setIntensity,
            repeat = repeat,
            onRepeatChange = viewModel::setRepeat,
            status = status,
        )
        SequenceSection(pattern, intensity, viewModel.path)
        FallbackSection(pattern)
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun Hero(pattern: HapticPattern) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(pattern.emoji, fontSize = 44.sp)
        Spacer(Modifier.width(14.dp))
        Column {
            Text(pattern.name, style = MaterialTheme.typography.headlineMedium)
            Text(
                "#${pattern.number} · ${pattern.category.label}",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

@Composable
private fun Overview(viewModel: DetailViewModel, pattern: HapticPattern) {
    SectionCard("Overview") {
        Text(pattern.description, style = MaterialTheme.typography.bodyLarge)
        HorizontalDivider(Modifier.padding(vertical = 10.dp), color = MaterialTheme.colorScheme.outlineVariant)
        InfoRow("Category", pattern.category.label)
        val duration = when (viewModel.path) {
            HapticApiPath.COMPOSITION -> viewModel.compositionDurationMs ?: pattern.estimatedDurationMs
            HapticApiPath.ENVELOPE -> pattern.envelope?.durationMs ?: pattern.estimatedDurationMs
            HapticApiPath.WAVEFORM_AMPLITUDE, HapticApiPath.WAVEFORM_ON_OFF -> pattern.waveform.durationMs
            else -> pattern.estimatedDurationMs
        }
        InfoRow("Duration", "~$duration ms")
        InfoRow("Peak intensity", String.format(Locale.US, "%.2f", pattern.intensity))
        InfoRow("Implementation", pattern.patternType.label)
        InfoRow("On this device") {
            Column(horizontalAlignment = Alignment.End) {
                Text(viewModel.path?.label.orEmpty(), style = MonoStyle, color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(4.dp))
                SupportBadge(
                    supported = viewModel.primaryImplementationSupported,
                    text = if (viewModel.primaryImplementationSupported) "Primary" else "Fallback",
                )
            }
        }
    }
}

@Composable
private fun Playback(
    intensity: Float,
    onIntensityChange: (Float) -> Unit,
    repeat: RepeatMode,
    onRepeatChange: (RepeatMode) -> Unit,
    status: String?,
) {
    SectionCard(
        title = "Playback",
        subtitle = "Global intensity scales every step while keeping their relative strength.",
    ) {
        IntensitySlider(value = intensity, onValueChange = onIntensityChange)
        Spacer(Modifier.height(12.dp))
        RepeatSelector(selected = repeat, onSelect = onRepeatChange)
        if (status != null) {
            Spacer(Modifier.height(10.dp))
            Text(status, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun SequenceSection(pattern: HapticPattern, intensity: Float, path: HapticApiPath?) {
    when (pattern.patternType) {
        HapticPatternType.COMPOSITION ->
            SectionCard("Sequence", subtitle = "Primitive composition · values at ${pct(intensity)} global intensity") {
                CompositionSteps(pattern.composition.orEmpty(), intensity)
            }

        HapticPatternType.ENVELOPE ->
            SectionCard("Envelope", subtitle = "Intensity / sharpness control points · ${pct(intensity)} global intensity") {
                EnvelopePoints(pattern.envelope!!, intensity)
            }

        HapticPatternType.WAVEFORM ->
            SectionCard("Waveform") { WaveformArrays(pattern.waveform, intensity) }
    }
    if (path != null && path != HapticApiPath.NONE) {
        Text(
            "This device renders the pattern with ${path.label}.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 4.dp),
        )
    }
}

@Composable
private fun FallbackSection(pattern: HapticPattern) {
    var expanded by rememberSaveable(pattern.id) { mutableStateOf(false) }
    SectionCard("Fallback implementations", subtitle = "Used automatically when the primary API is unavailable") {
        if (!expanded) {
            TextButton(onClick = { expanded = true }) { Text("Show fallback data") }
        } else {
            FallbackData(pattern, onHide = { expanded = false })
        }
    }
}

@Composable
private fun FallbackData(pattern: HapticPattern, onHide: () -> Unit) {
    if (pattern.patternType == HapticPatternType.ENVELOPE && pattern.composition != null) {
        Text("Composition fallback", style = MaterialTheme.typography.labelLarge)
        Spacer(Modifier.height(6.dp))
        CompositionSteps(pattern.composition, 1f)
        Spacer(Modifier.height(12.dp))
    }
    Text("Waveform fallback", style = MaterialTheme.typography.labelLarge)
    Spacer(Modifier.height(6.dp))
    WaveformArrays(pattern.waveform, 1f)
    Spacer(Modifier.height(6.dp))
    Text(
        "Devices without amplitude control convert this to an on/off waveform; weaker segments become shorter pulses.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    TextButton(onClick = onHide) { Text("Hide") }
}

@Composable
private fun CompositionSteps(steps: List<PrimitiveStep>, intensity: Float) {
    steps.forEachIndexed { index, step ->
        if (index > 0) {
            Text(
                if (step.delayMs > 0) "   ↓ ${step.delayMs} ms delay" else "   ↓ immediately",
                style = MonoStyle,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 2.dp),
            )
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(step.primitive.label, style = MonoStyle, fontWeight = FontWeight.Bold)
            Text(
                if (intensity < 1f) "Intensity ${f2(step.scale)} → ${f3(step.scale * intensity)}" else "Intensity ${f2(step.scale)}",
                style = MonoStyle,
            )
        }
    }
}

@Composable
private fun EnvelopePoints(envelope: EnvelopeSpec, intensity: Float) {
    Text("Initial sharpness ${f2(envelope.initialSharpness)}", style = MonoStyle, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Spacer(Modifier.height(4.dp))
    envelope.points.forEach { point ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("→ ${point.durationMs} ms", style = MonoStyle, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("I ${f2(point.intensity * intensity)}  S ${f2(point.sharpness)}", style = MonoStyle)
        }
    }
}

@Composable
private fun WaveformArrays(waveform: WaveformSpec, intensity: Float) {
    Text("timings (ms)", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Text(waveform.timings.joinToString(prefix = "[", postfix = "]"), style = MonoStyle)
    Spacer(Modifier.height(6.dp))
    Text("amplitudes (0–255)", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Text(
        WaveformAdapter.scale(waveform, intensity.coerceAtLeast(0.01f))
            .amplitudes.joinToString(prefix = "[", postfix = "]"),
        style = MonoStyle,
    )
}

private fun f2(v: Float) = String.format(Locale.US, "%.2f", v)
private fun f3(v: Float) = String.format(Locale.US, "%.3f", v)
private fun pct(v: Float) = "${(v * 100).toInt()}%"
