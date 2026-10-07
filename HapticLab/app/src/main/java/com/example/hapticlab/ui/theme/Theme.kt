package com.example.hapticlab.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val Teal = Color(0xFF14B8A6)
private val TealDark = Color(0xFF0D9488)

private val LightColors = lightColorScheme(
    primary = TealDark,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCCFBF1),
    onPrimaryContainer = Color(0xFF042F2E),
    secondary = Color(0xFF475569),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFE2E8F0),
    onSecondaryContainer = Color(0xFF0F172A),
    tertiary = Color(0xFFD97706),
    background = Color(0xFFF7F9FB),
    onBackground = Color(0xFF0F172A),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF0F172A),
    surfaceVariant = Color(0xFFEEF2F6),
    onSurfaceVariant = Color(0xFF475569),
    surfaceContainer = Color(0xFFF1F5F9),
    surfaceContainerHigh = Color(0xFFE9EEF3),
    outline = Color(0xFFCBD5E1),
    outlineVariant = Color(0xFFE2E8F0),
    error = Color(0xFFDC2626),
    errorContainer = Color(0xFFFEE2E2),
    onErrorContainer = Color(0xFF7F1D1D),
)

private val DarkColors = darkColorScheme(
    primary = Teal,
    onPrimary = Color(0xFF042F2E),
    primaryContainer = Color(0xFF134E4A),
    onPrimaryContainer = Color(0xFFCCFBF1),
    secondary = Color(0xFF94A3B8),
    onSecondary = Color(0xFF0F172A),
    secondaryContainer = Color(0xFF1E293B),
    onSecondaryContainer = Color(0xFFE2E8F0),
    tertiary = Color(0xFFF59E0B),
    background = Color(0xFF0E1116),
    onBackground = Color(0xFFE5E7EB),
    surface = Color(0xFF151A21),
    onSurface = Color(0xFFE5E7EB),
    surfaceVariant = Color(0xFF1C232C),
    onSurfaceVariant = Color(0xFF9CA3AF),
    surfaceContainer = Color(0xFF181E26),
    surfaceContainerHigh = Color(0xFF1F2630),
    outline = Color(0xFF334155),
    outlineVariant = Color(0xFF243040),
    error = Color(0xFFF87171),
    errorContainer = Color(0xFF450A0A),
    onErrorContainer = Color(0xFFFECACA),
)

/** Status colors for Supported / Unsupported badges. */
@Immutable
data class StatusColors(
    val supported: Color,
    val supportedContainer: Color,
    val unsupported: Color,
    val unsupportedContainer: Color,
)

private val LightStatus = StatusColors(
    supported = Color(0xFF047857),
    supportedContainer = Color(0xFFD1FAE5),
    unsupported = Color(0xFFB91C1C),
    unsupportedContainer = Color(0xFFFEE2E2),
)

private val DarkStatus = StatusColors(
    supported = Color(0xFF6EE7B7),
    supportedContainer = Color(0xFF064E3B),
    unsupported = Color(0xFFFCA5A5),
    unsupportedContainer = Color(0xFF4C0519),
)

val LocalStatusColors = staticCompositionLocalOf { LightStatus }

val MonoStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 13.sp)

private val AppTypography = Typography().let { base ->
    base.copy(
        headlineMedium = base.headlineMedium.copy(fontWeight = FontWeight.Bold),
        titleLarge = base.titleLarge.copy(fontWeight = FontWeight.SemiBold),
        titleMedium = base.titleMedium.copy(fontWeight = FontWeight.SemiBold),
    )
}

@Composable
fun HapticLabTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    androidx.compose.runtime.CompositionLocalProvider(
        LocalStatusColors provides if (darkTheme) DarkStatus else LightStatus,
    ) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkColors else LightColors,
            typography = AppTypography,
            content = content,
        )
    }
}
