package com.tg7.editor.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object TG7Colors {
    val Black = Color(0xFF000000)
    val GlassSurface = Color(0xCC0C1018)
    val GlassCard = Color(0xB8111622)
    val GlassHighlight = Color(0x28FFFFFF)
    val BorderSubtle = Color(0xFF202636)
    val NeonCyan = Color(0xFF00F0FF)
    val BloodRed = Color(0xFFFF1030)
    val TextPrimary = Color(0xFFF6F8FC)
    val TextMuted = Color(0xFF8C95A8)
}

private val TG7DarkScheme = darkColorScheme(
    primary = TG7Colors.NeonCyan,
    onPrimary = TG7Colors.Black,
    secondary = TG7Colors.BloodRed,
    onSecondary = Color.White,
    background = TG7Colors.Black,
    onBackground = TG7Colors.TextPrimary,
    surface = TG7Colors.GlassSurface,
    onSurface = TG7Colors.TextPrimary,
    surfaceVariant = TG7Colors.GlassCard,
    onSurfaceVariant = TG7Colors.TextMuted,
    outline = TG7Colors.BorderSubtle
)

@Composable
fun TG7Theme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = TG7DarkScheme,
        content = content
    )
}
