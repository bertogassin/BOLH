package com.guardian.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val GuardianBlue = Color(0xFF0055FF)
private val LightBackground = Color(0xFFF8F9FC)
private val LightSurface = Color.White
private val LightText = Color(0xFF1A1E2B)
private val LightTextSecondary = Color(0xFF6C707B)
private val DarkBackground = Color(0xFF0A0C10)
private val DarkSurface = Color(0xFF1C1E24)
private val DarkText = Color.White
private val DarkTextSecondary = Color(0xFF9A9DA5)
private val Success = Color(0xFF00C48C)
private val Error = Color(0xFFFF3B30)
private val Warning = Color(0xFFFF9500)

private val LightColors = lightColorScheme(
    primary = GuardianBlue,
    secondary = Color(0xFF6C707B),
    tertiary = Success,
    background = LightBackground,
    surface = LightSurface,
    error = Error,
    onPrimary = Color.White,
    onSecondary = LightText,
    onBackground = LightText,
    onSurface = LightText
)

private val DarkColors = darkColorScheme(
    primary = GuardianBlue,
    secondary = DarkTextSecondary,
    tertiary = Success,
    background = DarkBackground,
    surface = DarkSurface,
    error = Error,
    onPrimary = Color.White,
    onSecondary = DarkText,
    onBackground = DarkText,
    onSurface = DarkText
)

@Composable
fun GuardianTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = Typography,
        content = content
    )
}
