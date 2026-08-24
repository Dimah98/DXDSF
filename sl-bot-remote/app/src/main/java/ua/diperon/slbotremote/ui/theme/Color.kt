package ua.diperon.slbotremote.ui.theme

import androidx.compose.ui.graphics.Color

// ══════════════════════════════════════════════════════════
// Glassmorphism Dark Palette
// ══════════════════════════════════════════════════════════

// ── Backgrounds ──
val GlassBg = Color(0xFF0A0E1A)            // Deep indigo-black
val GlassBgGradientEnd = Color(0xFF111827)  // Slightly lighter for gradient
val GlassNavBg = Color.Transparent          // Transparent nav for blur effect

// ── Glass Surfaces ──
val GlassCard = Color(0x0FFFFFFF)           // White 6% — glass card fill
val GlassCardHover = Color(0x14FFFFFF)      // White 8% — hovered glass
val GlassCardActive = Color(0x1AFFFFFF)     // White 10% — pressed/active glass
val GlassBorder = Color(0x1FFFFFFF)         // White 12% — glass card border
val GlassBorderSubtle = Color(0x0DFFFFFF)   // White 5% — very subtle border
val GlassTerminal = Color(0xFF050510)       // Nearly black for console/terminal

// ── Accent Colors ──
val GlassPrimary = Color(0xFF10B981)        // Emerald Green
val GlassPrimaryLight = Color(0xFF34D399)   // Light Emerald
val GlassSecondary = Color(0xFF34D399)      // Neon Green
val GlassAccent = Color(0xFF059669)         // Darker Green
val GlassAccentLight = Color(0xFF10B981)    // Emerald Green

// ── Semantic Colors ──
val GlassSuccess = Color(0xFF10B981)        // Emerald Green (kept)
val GlassSuccessLight = Color(0xFF34D399)   // Light Emerald
val GlassWarning = Color(0xFFF59E0B)        // Amber (kept)
val GlassWarningLight = Color(0xFFFBBF24)   // Light Amber
val GlassError = Color(0xFFF87171)          // Soft Red
val GlassErrorDark = Color(0xFFEF4444)      // Deeper Red for destructive

// ── Text Colors ──
val GlassOnSurface = Color(0xFFF1F5F9)      // Warm white text
val GlassOnSurfaceVariant = Color(0xFFA0AEC0) // Silver-lavender muted text
val GlassOnSurfaceDim = Color(0xFF64748B)   // Dimmed text / placeholders

// ── Season Colors (preserved for game mechanics) ──
val SeasonSpring = Color(0xFF10B981)
val SeasonSummer = Color(0xFFF59E0B)
val SeasonAutumn = Color(0xFFF97316)
val SeasonWinter = Color(0xFF38BDF8)

// ── Special ──
val GlassIndigo = Color(0xFF6366F1)         // Indigo for selection highlights
val GlassIndigoLight = Color(0xFF818CF8)    // Light indigo
val GlassGem = Color(0xFF38BDF8)            // Gem/crystal blue
val GlassBalance = Color(0xFFC084FC)        // Purple for balance
