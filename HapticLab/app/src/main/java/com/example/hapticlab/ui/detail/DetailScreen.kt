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
                title = { Text(pattern?.name ?: "알 수 없는 진동") },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("←  뒤로") }
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
                        playLabel = "진동 느껴보기",
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
            Text("진동을 찾을 수 없어요", Modifier.padding(padding).padding(24.dp))
        } else {
            DetailBody(
                pattern = pattern,
                viewModel = viewModel,
                intensity = intensity,
                repeat = repeat,
                status = if (playback.isPlaying && playback.sourceId == pattern.id) {
                    val total = playback.totalIterations?.toString() ?: "∞"
                    "재생 중 ${playback.iteration}/$total · ${playback.path?.label.orEmpty()}"
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
    SectionCard("소개") {
        Text(pattern.description, style = MaterialTheme.typography.bodyLarge)
        HorizontalDivider(Modifier.padding(vertical = 10.dp), color = MaterialTheme.colorScheme.outlineVariant)
        InfoRow("종류", pattern.category.label)
        val duration = when (viewModel.path) {
            HapticApiPath.COMPOSITION -> viewModel.compositionDurationMs ?: pattern.estimatedDurationMs
            HapticApiPath.ENVELOPE -> pattern.envelope?.durationMs ?: pattern.estimatedDurationMs
            HapticApiPath.WAVEFORM_AMPLITUDE, HapticApiPath.WAVEFORM_ON_OFF -> pattern.waveform.durationMs
            else -> pattern.estimatedDurationMs
        }
        InfoRow("길이", "약 ${duration}ms")
        InfoRow("최대 세기", String.format(Locale.US, "%.2f", pattern.intensity))
        InfoRow("만든 방식", pattern.patternType.label)
        InfoRow("내 휴대폰에서") {
            Column(horizontalAlignment = Alignment.End) {
                Text(viewModel.path?.label.orEmpty(), style = MonoStyle, color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(4.dp))
                SupportBadge(
                    supported = viewModel.primaryImplementationSupported,
                    text = if (viewModel.primaryImplementationSupported) "기본 방식" else "대체 방식",
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
        title = "재생 설정",
        subtitle = "전체 세기를 바꿔도 강약의 차이는 그대로 유지돼요.",
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
            SectionCard("진동 순서", subtitle = "기본 진동 조합 · 세기 ${pct(intensity)} 적용") {
                CompositionSteps(pattern.composition.orEmpty(), intensity)
            }

        HapticPatternType.ENVELOPE ->
            SectionCard("진동 곡선", subtitle = "세기(I)·선명도(S) 변화 · 세기 ${pct(intensity)} 적용") {
                EnvelopePoints(pattern.envelope!!, intensity)
            }

        HapticPatternType.WAVEFORM ->
            SectionCard("파형") { WaveformArrays(pattern.waveform, intensity) }
    }
    if (path != null && path != HapticApiPath.NONE) {
        Text(
            "이 휴대폰에서는 ${path.label} 방식으로 재생돼요.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 4.dp),
        )
    }
}

@Composable
private fun FallbackSection(pattern: HapticPattern) {
    var expanded by rememberSaveable(pattern.id) { mutableStateOf(false) }
    SectionCard("대체 방식", subtitle = "기본 방식을 지원하지 않는 휴대폰에서 자동으로 사용돼요") {
        if (!expanded) {
            TextButton(onClick = { expanded = true }) { Text("대체 방식 보기") }
        } else {
            FallbackData(pattern, onHide = { expanded = false })
        }
    }
}

@Composable
private fun FallbackData(pattern: HapticPattern, onHide: () -> Unit) {
    if (pattern.patternType == HapticPatternType.ENVELOPE && pattern.composition != null) {
        Text("기본 진동 조합", style = MaterialTheme.typography.labelLarge)
        Spacer(Modifier.height(6.dp))
        CompositionSteps(pattern.composition, 1f)
        Spacer(Modifier.height(12.dp))
    }
    Text("파형", style = MaterialTheme.typography.labelLarge)
    Spacer(Modifier.height(6.dp))
    WaveformArrays(pattern.waveform, 1f)
    Spacer(Modifier.height(6.dp))
    Text(
        "세기 조절이 안 되는 휴대폰에서는 켜기/끄기 진동으로 바꾸고, 약한 부분은 더 짧게 울려요.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    TextButton(onClick = onHide) { Text("접기") }
}

@Composable
private fun CompositionSteps(steps: List<PrimitiveStep>, intensity: Float) {
    steps.forEachIndexed { index, step ->
        if (index > 0) {
            Text(
                if (step.delayMs > 0) "   ↓ ${step.delayMs}ms 쉬고" else "   ↓ 바로 이어서",
                style = MonoStyle,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 2.dp),
            )
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(step.primitive.label, style = MonoStyle, fontWeight = FontWeight.Bold)
            Text(
                if (intensity < 1f) "세기 ${f2(step.scale)} → ${f3(step.scale * intensity)}" else "세기 ${f2(step.scale)}",
                style = MonoStyle,
            )
        }
    }
}

@Composable
private fun EnvelopePoints(envelope: EnvelopeSpec, intensity: Float) {
    Text("시작 선명도 ${f2(envelope.initialSharpness)}", style = MonoStyle, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
    Text("시간 (ms)", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Text(waveform.timings.joinToString(prefix = "[", postfix = "]"), style = MonoStyle)
    Spacer(Modifier.height(6.dp))
    Text("세기 (0–255)", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Text(
        WaveformAdapter.scale(waveform, intensity.coerceAtLeast(0.01f))
            .amplitudes.joinToString(prefix = "[", postfix = "]"),
        style = MonoStyle,
    )
}

private fun f2(v: Float) = String.format(Locale.US, "%.2f", v)
private fun f3(v: Float) = String.format(Locale.US, "%.3f", v)
private fun pct(v: Float) = "${(v * 100).toInt()}%"
