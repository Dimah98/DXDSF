package ua.diperon.slbotremote.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Glassmorphism Typography System
// Uses system default font with carefully tuned weights and spacing
// For production, replace FontFamily.Default with a bundled Inter font
val GlassFontFamily = FontFamily.Default

val Typography =
  Typography(
    // Display styles — large titles
    displayLarge = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.ExtraBold,
      fontSize = 36.sp,
      lineHeight = 44.sp,
      letterSpacing = (-1.0).sp,
    ),
    displayMedium = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.Bold,
      fontSize = 28.sp,
      lineHeight = 36.sp,
      letterSpacing = (-0.5).sp,
    ),
    displaySmall = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.Bold,
      fontSize = 24.sp,
      lineHeight = 32.sp,
      letterSpacing = (-0.25).sp,
    ),
    // Headline styles
    headlineLarge = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.Bold,
      fontSize = 22.sp,
      lineHeight = 28.sp,
      letterSpacing = (-0.25).sp,
    ),
    headlineMedium = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.SemiBold,
      fontSize = 20.sp,
      lineHeight = 26.sp,
      letterSpacing = 0.sp,
    ),
    headlineSmall = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.SemiBold,
      fontSize = 18.sp,
      lineHeight = 24.sp,
      letterSpacing = 0.sp,
    ),
    // Title styles
    titleLarge = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.SemiBold,
      fontSize = 20.sp,
      lineHeight = 26.sp,
      letterSpacing = (-0.15).sp,
    ),
    titleMedium = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.SemiBold,
      fontSize = 16.sp,
      lineHeight = 22.sp,
      letterSpacing = 0.sp,
    ),
    titleSmall = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.Medium,
      fontSize = 14.sp,
      lineHeight = 20.sp,
      letterSpacing = 0.1.sp,
    ),
    // Body styles
    bodyLarge = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.Normal,
      fontSize = 16.sp,
      lineHeight = 24.sp,
      letterSpacing = 0.15.sp,
    ),
    bodyMedium = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.Normal,
      fontSize = 14.sp,
      lineHeight = 20.sp,
      letterSpacing = 0.25.sp,
    ),
    bodySmall = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.Normal,
      fontSize = 12.sp,
      lineHeight = 16.sp,
      letterSpacing = 0.4.sp,
    ),
    // Label styles
    labelLarge = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.SemiBold,
      fontSize = 14.sp,
      lineHeight = 20.sp,
      letterSpacing = 0.1.sp,
    ),
    labelMedium = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.Medium,
      fontSize = 12.sp,
      lineHeight = 16.sp,
      letterSpacing = 0.5.sp,
    ),
    labelSmall = TextStyle(
      fontFamily = GlassFontFamily,
      fontWeight = FontWeight.Medium,
      fontSize = 10.sp,
      lineHeight = 14.sp,
      letterSpacing = 0.5.sp,
    ),
  )
