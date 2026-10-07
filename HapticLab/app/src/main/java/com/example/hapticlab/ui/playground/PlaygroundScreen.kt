package com.example.hapticlab.ui.playground

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.hapticlab.haptic.HapticCapability
import com.example.hapticlab.haptic.HapticEngine
import com.example.hapticlab.haptic.HapticPrimitive
import com.example.hapticlab.haptic.PlaybackState
import com.example.hapticlab.haptic.RepeatMode
import com.example.hapticlab.ui.components.IntensitySlider
import com.example.hapticlab.ui.components.LabeledSlider
import com.example.hapticlab.ui.components.PlayStopButton
import com.example.hapticlab.ui.components.RepeatSelector
import com.example.hapticlab.ui.components.SectionCard
import com.example.hapticlab.ui.theme.LocalStatusColors
import com.example.hapticlab.ui.theme.MonoStyle
import com.example.hapticlab.viewmodel.PlaygroundUiState
import com.example.hapticlab.viewmodel.PlaygroundViewModel
import com.example.hapticlab.viewmodel.SequencerStep
import kotlin.math.roundToInt

private const val PULSE_SOURCE = "pulse"

@Composable
fun PlaygroundScreen(viewModel: PlaygroundViewModel, modifier: Modifier = Modifier) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val playback by viewModel.playback.collectAsStateWithLifecycle()
    val capability = viewModel.capability

    DisposableEffect(viewModel) {
        onDispose { viewModel.stop() }
    }

    // Which Playground section started the current playback (both use the engine's custom id).
    var lastSource by remember { mutableStateOf(PULSE_SOURCE) }
    val customPlaying = playback.isPlaying && playback.sourceId == HapticEngine.CUSTOM_ID

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "title") {
            Column(Modifier.padding(top = 8.dp, bottom = 4.dp)) {
                Text("Playground", style = MaterialTheme.typography.headlineMedium)
                Text(
                    "Design your own haptics from the device's primitives.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        item(key = "pulse") {
            PulseDesigner(
                state = state,
                capability = capability,
                hitCount = viewModel.pulseCount(state),
                isPlaying = customPlaying && lastSource == PULSE_SOURCE,
                playback = playback,
                onSelectPrimitive = viewModel::selectPrimitive,
                onIntensity = viewModel::setIntensity,
                onDuration = viewModel::setDuration,
                onDelay = viewModel::setDelay,
                onRepeat = viewModel::setRepeat,
                onPlay = {
                    lastSource = PULSE_SOURCE
                    viewModel.playPulse()
                },
                onStop = viewModel::stop,
            )
        }
        item(key = "sequencer-header") {
            Column(Modifier.padding(top = 8.dp)) {
                Text("Sequencer", style = MaterialTheme.typography.titleLarge)
                Text(
                    "Build a timeline of primitives. Uses the Repeat setting above.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (viewModel.sequenceUsesFallback(state)) {
                    Text(
                        "Contains primitives this device doesn't support — the sequence will play through the waveform fallback.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }
        itemsIndexed(state.steps, key = { _, step -> step.key }) { index, step ->
            Column {
                if (index > 0) {
                    Text(
                        "   ↓ ${step.delayMs} ms",
                        style = MonoStyle,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                }
                StepCard(
                    index = index,
                    step = step,
                    isFirst = index == 0,
                    isLast = index == state.steps.lastIndex,
                    capability = capability,
                    onPrimitive = { viewModel.setStepPrimitive(step.key, it) },
                    onIntensity = { viewModel.setStepIntensity(step.key, it) },
                    onDelay = { viewModel.setStepDelay(step.key, it) },
                    onMoveUp = { viewModel.moveStep(step.key, -1) },
                    onMoveDown = { viewModel.moveStep(step.key, 1) },
                    onRemove = { viewModel.removeStep(step.key) },
                )
            }
        }
        item(key = "sequencer-actions") {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(
                    onClick = viewModel::addStep,
                    enabled = state.steps.size < PlaygroundViewModel.MAX_STEPS,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("+ Add Step")
                }
                PlayStopButton(
                    isPlaying = customPlaying && lastSource != PULSE_SOURCE,
                    playLabel = "PLAY SEQUENCE",
                    onPlay = {
                        lastSource = "sequence"
                        viewModel.playSequence()
                    },
                    onStop = viewModel::stop,
                    enabled = state.steps.isNotEmpty() && capability.hasVibrator,
                )
            }
        }
    }
}

@Composable
private fun PulseDesigner(
    state: PlaygroundUiState,
    capability: HapticCapability,
    hitCount: Int,
    isPlaying: Boolean,
    playback: PlaybackState,
    onSelectPrimitive: (HapticPrimitive?) -> Unit,
    onIntensity: (Float) -> Unit,
    onDuration: (Int) -> Unit,
    onDelay: (Int) -> Unit,
    onRepeat: (RepeatMode) -> Unit,
    onPlay: () -> Unit,
    onStop: () -> Unit,
) {
    SectionCard("Pulse Designer", subtitle = "Pick a primitive and shape it with intensity, duration and delay.") {
        Text("Primitive", style = MaterialTheme.typography.labelLarge)
        Spacer(Modifier.height(6.dp))
        PrimitiveGrid(selected = state.primitive, capability = capability, onSelect = onSelectPrimitive)
        Spacer(Modifier.height(4.dp))
        FilterChip(
            selected = state.primitive == null,
            onClick = { onSelectPrimitive(null) },
            label = { Text("RAW ONE-SHOT (any device)") },
        )
        Text(
            state.primitive?.feel ?: "Plain motor pulse via createOneShot-style waveform. Duration = pulse length.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(12.dp))
        IntensitySlider(value = state.intensity, onValueChange = onIntensity)
        LabeledSlider(
            label = "Duration",
            value = state.durationMs.toFloat(),
            onValueChange = { onDuration(it.roundToInt()) },
            valueText = "${state.durationMs} ms",
            valueRange = PlaygroundViewModel.MIN_DURATION_MS.toFloat()..PlaygroundViewModel.MAX_DURATION_MS.toFloat(),
            startLabel = "${PlaygroundViewModel.MIN_DURATION_MS} ms",
            endLabel = "${PlaygroundViewModel.MAX_DURATION_MS} ms",
        )
        LabeledSlider(
            label = "Delay",
            value = state.delayMs.toFloat(),
            onValueChange = { onDelay(it.roundToInt()) },
            valueText = "${state.delayMs} ms",
            valueRange = 0f..PlaygroundViewModel.MAX_DELAY_MS.toFloat(),
            startLabel = "0 ms",
            endLabel = "${PlaygroundViewModel.MAX_DELAY_MS} ms",
        )
        Text(
            if (state.primitive == null) {
                "One ${state.durationMs} ms pulse; delay is the gap between repeats."
            } else {
                "$hitCount × ${state.primitive.label} spaced ${state.delayMs} ms to fill ${state.durationMs} ms."
            },
            style = MonoStyle,
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.height(12.dp))
        RepeatSelector(selected = state.repeat, onSelect = onRepeat)
        Spacer(Modifier.height(16.dp))
        PlayStopButton(
            isPlaying = isPlaying,
            playLabel = "PLAY",
            onPlay = onPlay,
            onStop = onStop,
            enabled = state.intensity > 0f && capability.hasVibrator,
        )
        if (isPlaying) {
            Text(
                "Iteration ${playback.iteration}/${playback.totalIterations ?: "∞"} · ${playback.path?.label.orEmpty()}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

@Composable
private fun PrimitiveGrid(
    selected: HapticPrimitive?,
    capability: HapticCapability,
    onSelect: (HapticPrimitive) -> Unit,
) {
    val order = listOf(
        HapticPrimitive.CLICK,
        HapticPrimitive.TICK,
        HapticPrimitive.LOW_TICK,
        HapticPrimitive.THUD,
        HapticPrimitive.SPIN,
        HapticPrimitive.QUICK_RISE,
        HapticPrimitive.SLOW_RISE,
        HapticPrimitive.QUICK_FALL,
    )
    Column {
        order.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { primitive ->
                    val supported = capability.isPrimitiveSupported(primitive)
                    Column(Modifier.weight(1f)) {
                        FilterChip(
                            selected = selected == primitive,
                            onClick = { onSelect(primitive) },
                            enabled = supported,
                            label = { Text(primitive.label, style = MonoStyle) },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        if (!supported) {
                            Text(
                                "Not supported on this device",
                                style = MaterialTheme.typography.labelSmall,
                                color = LocalStatusColors.current.unsupported,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StepCard(
    index: Int,
    step: SequencerStep,
    isFirst: Boolean,
    isLast: Boolean,
    capability: HapticCapability,
    onPrimitive: (HapticPrimitive) -> Unit,
    onIntensity: (Float) -> Unit,
    onDelay: (Int) -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onRemove: () -> Unit,
) {
    val supported = capability.isPrimitiveSupported(step.primitive)
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(start = 14.dp, end = 6.dp, top = 8.dp, bottom = 10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${index + 1}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Box(Modifier.padding(start = 10.dp).weight(1f)) {
                    PrimitiveDropdown(step.primitive, capability, onPrimitive)
                }
                TextButton(onClick = onMoveUp, enabled = !isFirst) { Text("↑") }
                TextButton(onClick = onMoveDown, enabled = !isLast) { Text("↓") }
                TextButton(onClick = onRemove) { Text("✕", color = MaterialTheme.colorScheme.error) }
            }
            if (!supported) {
                Text(
                    "Not supported on this device",
                    style = MaterialTheme.typography.labelSmall,
                    color = LocalStatusColors.current.unsupported,
                )
            }
            Column(Modifier.padding(end = 8.dp)) {
                IntensitySlider(value = step.intensity, onValueChange = onIntensity)
                if (!isFirst) {
                    LabeledSlider(
                        label = "Delay before",
                        value = step.delayMs.toFloat(),
                        onValueChange = { onDelay(it.roundToInt()) },
                        valueText = "${step.delayMs} ms",
                        valueRange = 0f..PlaygroundViewModel.MAX_DELAY_MS.toFloat(),
                    )
                }
            }
        }
    }
}

@Composable
private fun PrimitiveDropdown(
    selected: HapticPrimitive,
    capability: HapticCapability,
    onSelect: (HapticPrimitive) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick = { open = true }) {
            Text("${selected.label}  ▾", style = MonoStyle)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            HapticPrimitive.entries.forEach { primitive ->
                val supported = capability.isPrimitiveSupported(primitive)
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(primitive.label, style = MonoStyle)
                            if (!supported) {
                                Text(
                                    "Not supported on this device",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = LocalStatusColors.current.unsupported,
                                )
                            }
                        }
                    },
                    onClick = {
                        onSelect(primitive)
                        open = false
                    },
                    enabled = supported,
                )
            }
        }
    }
}
