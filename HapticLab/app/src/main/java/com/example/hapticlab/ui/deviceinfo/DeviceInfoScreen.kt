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
            Text("내 휴대폰", style = MaterialTheme.typography.headlineMedium)
            Text(
                "진동 모터가 알려 주는 정보와 앱이 사용하는 진동 방식이에요.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        SectionCard("진동 방식") {
            Text(c.bestPath.label, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
            Text(c.bestPath.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(10.dp))
            Text("이 휴대폰에서 진동 50가지가 재생되는 방식", style = MaterialTheme.typography.labelLarge)
            HapticApiPath.entries.forEach { path ->
                val count = viewModel.pathUsage[path] ?: 0
                if (count > 0) InfoRow(path.label, "${count}개")
            }
            Spacer(Modifier.height(4.dp))
            Text(
                "사용 순서: 진동 곡선(API 36) → 기본 진동 조합(API 30/31) → 세기 파형 → 켜기/끄기 파형",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        SectionCard("기기") {
            InfoRow("제조사", c.manufacturer)
            InfoRow("모델", c.model)
            InfoRow("이름", c.displayName)
            InfoRow("Android 버전", c.androidVersion)
            InfoRow("API 레벨", c.apiLevel.toString())
        }

        SectionCard("진동 모터") {
            SupportRow("진동 모터", c.hasVibrator)
            SupportRow("세기 조절", c.hasAmplitudeControl)
            SupportRow("기본 진동 조합 (API 30+)", c.compositionApiAvailable)
            SupportRow("진동 곡선 (API 36)", c.envelopeSupported)
            SupportRow("주파수 조절 (API 36)", c.frequencyControlSupported)
            c.frequencyProfile?.let {
                InfoRow("주파수 범위", "${fmt(it.minFrequencyHz)}–${fmt(it.maxFrequencyHz)} Hz")
                InfoRow("최대 가속도", "${fmt(it.maxOutputAccelerationGs)} g")
            }
            InfoRow("공진 주파수", c.resonantFrequencyHz?.let { "${fmt(it)} Hz" } ?: "알 수 없음")
            InfoRow("Q factor", c.qFactor?.let { fmt(it) } ?: "알 수 없음")
            c.envelopeLimits?.let {
                InfoRow("곡선 최대 점 개수", it.maxControlPoints.toString())
                InfoRow("곡선 점 길이", "${it.minControlPointDurationMs}–${it.maxControlPointDurationMs} ms")
                InfoRow("곡선 최대 길이", "${it.maxDurationMs} ms")
            }
        }

        SectionCard("기본 진동 (Primitive)", subtitle = "휴대폰이 지원하는 기본 진동과 길이") {
            PrimitiveSupportList(c, showDurations = true)
        }

        SectionCard("알아두세요") {
            Text(
                "휴대폰마다 진동 모터와 제조사 설정이 달라서 같은 진동도 느낌이 조금씩 달라요. " +
                    "진동이 약하면 [설정 › 소리 및 진동 › 진동 세기 › 미디어]를 확인해 주세요.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(6.dp))
            Text("minSdk 26 · compileSdk 37 · targetSdk 37", style = MonoStyle)
        }
    }
}

private fun fmt(v: Float) = String.format(Locale.US, "%.1f", v)
