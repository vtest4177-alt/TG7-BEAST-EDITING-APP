package com.tg7.editor.model

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Star
import androidx.compose.ui.graphics.vector.ImageVector
import java.util.UUID

enum class MediaKind {
    VIDEO,
    IMAGE
}

enum class TrackType {
    VIDEO,
    AUDIO,
    TEXT,
    STICKER
}

enum class StickerPreset(
    val label: String,
    val defaultTintHex: Long,
    val glyph: String,
    val icon: ImageVector
) {
    STAR("Star", 0xFF00F0FF, "★", Icons.Rounded.Star),
    FIRE("Flame", 0xFFFF4500, "🔥", Icons.Rounded.LocalFireDepartment),
    HEART("Heart", 0xFFFF1030, "♥", Icons.Rounded.Favorite),
    BOLT("Bolt", 0xFFFFD600, "⚡", Icons.Rounded.Bolt),
    SPARKLE("Glow", 0xFF00F0FF, "✦", Icons.Rounded.AutoAwesome),
    MUSIC("Beat", 0xFFA855F7, "♪", Icons.Rounded.MusicNote),
    CHECK("Badge", 0xFF22C55E, "✔", Icons.Rounded.CheckCircle),
    TROPHY("Win", 0xFFFACC15, "🏆", Icons.Rounded.EmojiEvents)
}

enum class CanvasAspectRatio(
    val label: String,
    val subtitle: String,
    val ratio: Float
) {
    PORTRAIT_9_16("9:16", "Reels / Shorts", 9f / 16f),
    LANDSCAPE_16_9("16:9", "YouTube / Wide", 16f / 9f),
    SQUARE_1_1("1:1", "Square Feed", 1f);

    fun outputDimensions(shortEdgePx: Int): Pair<Int, Int> {
        val evenShort = (shortEdgePx / 2) * 2
        return when (this) {
            PORTRAIT_9_16 -> {
                val h = (((evenShort * 16f) / 9f).toInt() / 2) * 2
                evenShort to h
            }
            LANDSCAPE_16_9 -> {
                val w = (((evenShort * 16f) / 9f).toInt() / 2) * 2
                w to evenShort
            }
            SQUARE_1_1 -> evenShort to evenShort
        }
    }

    fun next(): CanvasAspectRatio {
        val list = entries
        return list[(ordinal + 1) % list.size]
    }
}

enum class ExportResolution(val label: String, val shortEdgePx: Int, val badge: String) {
    HD_720("720p", 720, "HD 720p"),
    FHD_1080("1080p", 1080, "1080p 60fps"),
    UHD_4K("4K", 2160, "4K Ultra HD")
}

enum class TransitionShaderFamily(val wireName: String, val shaderIndex: Int) {
    FADE("FADE", 0),
    WIPE("WIPE", 1),
    SLIDE("SLIDE", 2),
    ZOOM("ZOOM", 3),
    GLITCH("GLITCH", 4),
    CUBE_3D("CUBE_3D", 5),
    SWIRL_RIPPLE("SWIRL_RIPPLE", 6),
    RADIAL_PINWHEEL("RADIAL_PINWHEEL", 7),
    LIGHT_FLASH("LIGHT_FLASH", 8),
    MOSAIC_GRID("MOSAIC_GRID", 9),
    BLUR_WHIP("BLUR_WHIP", 10),
    KALEIDO_SHAPE("KALEIDO_SHAPE", 11);

    companion object {
        fun fromWire(value: String): TransitionShaderFamily {
            return entries.firstOrNull { it.wireName == value } ?: FADE
        }
    }
}

data class TransitionSpec(
    val id: String,
    val name: String,
    val category: String,
    val shaderFamily: TransitionShaderFamily,
    val mode: Int,
    val paramA: Float,
    val paramB: Float,
    val defaultDurationMs: Long = 500L
)

enum class EffectShaderFamily(val wireName: String, val shaderIndex: Int) {
    NONE("NONE", 0),
    LUT_TONE("LUT_TONE", 1),
    GLOW_BLOOM("GLOW_BLOOM", 2),
    GLITCH_CYBER("GLITCH_CYBER", 3),
    LENS_OPTICAL("LENS_OPTICAL", 4),
    MOTION_PULSE("MOTION_PULSE", 5),
    ARTISTIC_RETRO("ARTISTIC_RETRO", 6),
    DUOTONE_EDGE("DUOTONE_EDGE", 7);

    companion object {
        fun fromWire(value: String): EffectShaderFamily {
            return entries.firstOrNull { it.wireName == value } ?: NONE
        }
    }
}

data class VideoEffectSpec(
    val id: String,
    val name: String,
    val category: String,
    val shaderFamily: EffectShaderFamily,
    val mode: Int,
    val paramA: Float,
    val paramB: Float,
    val paramC: Float,
    val defaultIntensity: Float = 0.85f
)

data class ClipColorGrade(
    val brightness: Float = 0f,
    val contrast: Float = 1f,
    val saturation: Float = 1f,
    val temperature: Float = 0f,
    val vignette: Float = 0f
) {
    val isNeutral: Boolean
        get() = kotlin.math.abs(brightness) < 0.005f &&
            kotlin.math.abs(contrast - 1f) < 0.005f &&
            kotlin.math.abs(saturation - 1f) < 0.005f &&
            kotlin.math.abs(temperature) < 0.005f &&
            vignette < 0.005f
}

data class ChromaKeyConfig(
    val enabled: Boolean = false,
    val keyColorHex: Long = 0xFF00C853L,
    val similarity: Float = 0.35f,
    val smoothness: Float = 0.12f
)

enum class SpeedRampPreset(val label: String, val points: FloatArray) {
    NONE("Constant", floatArrayOf(1f, 1f, 1f)),
    HERO_DIP("Hero Dip", floatArrayOf(2.2f, 0.35f, 2.2f)),
    MONTAGE("Montage", floatArrayOf(0.55f, 2.4f, 0.65f)),
    BULLET("Bullet Time", floatArrayOf(2.8f, 0.25f, 1.5f)),
    FLASH_IN("Flash In", floatArrayOf(3.0f, 1.0f, 0.85f)),
    PULSE("Beat Pulse", floatArrayOf(1.0f, 2.8f, 1.0f));

    fun evaluateAt(progress: Float, baseMultiplier: Float = 1.0f): Float {
        if (this == NONE) return baseMultiplier.coerceIn(0.1f, 10.0f)
        val p = progress.coerceIn(0f, 1f)
        val raw = if (p <= 0.5f) {
            val t = p / 0.5f
            points[0] + (points[1] - points[0]) * t
        } else {
            val t = (p - 0.5f) / 0.5f
            points[1] + (points[2] - points[1]) * t
        }
        return (raw * baseMultiplier).coerceIn(0.1f, 10.0f)
    }

    fun averageSpeed(baseMultiplier: Float = 1.0f): Float {
        if (this == NONE) return baseMultiplier.coerceIn(0.1f, 10.0f)
        val avg = (points[0] + 2f * points[1] + points[2]) / 4f
        return (avg * baseMultiplier).coerceIn(0.1f, 10.0f)
    }
}

enum class BlendModePreset(val label: String, val shaderIndex: Int) {
    NORMAL("Normal", 0),
    SCREEN("Screen", 1),
    ADD("Linear Add", 2),
    MULTIPLY("Multiply", 3),
    OVERLAY("Overlay", 4)
}

enum class EasingCurve(val label: String) {
    LINEAR("Linear"),
    EASE_IN("Ease In"),
    EASE_OUT("Ease Out"),
    EASE_IN_OUT("Ease In-Out"),
    SPRING("Spring");

    fun evaluate(t: Float): Float {
        val x = t.coerceIn(0f, 1f)
        return when (this) {
            LINEAR -> x
            EASE_IN -> x * x * x
            EASE_OUT -> 1f - (1f - x) * (1f - x) * (1f - x)
            EASE_IN_OUT -> if (x < 0.5f) 4f * x * x * x else 1f - ((-2f * x + 2f) * (-2f * x + 2f) * (-2f * x + 2f)) / 2f
            SPRING -> {
                if (x >= 1f) 1f else {
                    1f - kotlin.math.exp(-6.5f * x) * kotlin.math.cos(x * 11f)
                }
            }
        }
    }

    companion object {
        fun fromWire(value: String): EasingCurve {
            return entries.firstOrNull { it.name == value } ?: EASE_IN_OUT
        }
    }
}

data class KeyframeNode(
    val id: String = UUID.randomUUID().toString(),
    val timeOffsetMs: Long,
    val posX: Float = 0.5f,
    val posY: Float = 0.5f,
    val scale: Float = 1.0f,
    val rotationDeg: Float = 0f,
    val opacity: Float = 1.0f,
    val easing: EasingCurve = EasingCurve.EASE_IN_OUT
)

data class TimelineClip(
    val id: String = UUID.randomUUID().toString(),
    val uriString: String,
    val displayName: String,
    val kind: MediaKind,
    val sourceDurationMs: Long,
    val trimStartMs: Long = 0L,
    val trimEndMs: Long = sourceDurationMs,
    val outTransitionId: String? = null,
    val outTransitionDurationMs: Long = 500L,
    val effectId: String? = null,
    val effectIntensity: Float = 0.85f,
    val brightness: Float = 0f,
    val contrast: Float = 1f,
    val saturation: Float = 1f,
    val temperature: Float = 0f,
    val vignette: Float = 0f,
    val chromaEnabled: Boolean = false,
    val chromaColorHex: Long = 0xFF00C853L,
    val chromaSimilarity: Float = 0.35f,
    val chromaSmoothness: Float = 0.12f,
    val speed: Float = 1.0f,
    val speedRamp: SpeedRampPreset = SpeedRampPreset.NONE,
    val scale: Float = 1.0f,
    val panX: Float = 0f,
    val panY: Float = 0f,
    val rotationDeg: Float = 0f,
    val flipHorizontal: Boolean = false,
    val flipVertical: Boolean = false,
    val opacity: Float = 1.0f,
    val blendMode: BlendModePreset = BlendModePreset.NORMAL,
    val keyframes: List<KeyframeNode> = emptyList()
) {
    val effectiveSpeed: Float
        get() = if (kind == MediaKind.IMAGE) 1.0f else speedRamp.averageSpeed(speed)

    val activeDurationMs: Long
        get() {
            val baseSpan = (trimEndMs - trimStartMs).coerceAtLeast(300L)
            return if (kind == MediaKind.IMAGE) {
                baseSpan
            } else {
                (baseSpan / effectiveSpeed).toLong().coerceAtLeast(300L)
            }
        }

    val hasCustomGrading: Boolean
        get() = !colorGrade().isNeutral

    val hasCustomTransform: Boolean
        get() = kotlin.math.abs(scale - 1.0f) > 0.005f ||
            kotlin.math.abs(panX) > 0.005f ||
            kotlin.math.abs(panY) > 0.005f ||
            kotlin.math.abs(rotationDeg) > 0.1f ||
            flipHorizontal ||
            flipVertical ||
            opacity < 0.995f ||
            blendMode != BlendModePreset.NORMAL ||
            keyframes.isNotEmpty()

    val hasActiveVisualProcessing: Boolean
        get() = !effectId.isNullOrBlank() || hasCustomGrading || chromaEnabled || hasCustomTransform

    fun colorGrade(): ClipColorGrade = ClipColorGrade(
        brightness = brightness,
        contrast = contrast,
        saturation = saturation,
        temperature = temperature,
        vignette = vignette
    )

    fun chromaKey(): ChromaKeyConfig = ChromaKeyConfig(
        enabled = chromaEnabled,
        keyColorHex = chromaColorHex,
        similarity = chromaSimilarity,
        smoothness = chromaSmoothness
    )
}

data class AudioClip(
    val id: String = UUID.randomUUID().toString(),
    val uriString: String,
    val displayName: String,
    val startTimeMs: Long = 0L,
    val sourceDurationMs: Long = 10_000L,
    val trimStartMs: Long = 0L,
    val trimEndMs: Long = sourceDurationMs,
    val volume: Float = 1.0f,
    val fadeInMs: Long = 0L,
    val fadeOutMs: Long = 0L,
    val waveformPeaks: List<Float> = emptyList(),
    val beatMarkersMs: List<Long> = emptyList()
) {
    val activeDurationMs: Long
        get() = (trimEndMs - trimStartMs).coerceAtLeast(300L)
}

enum class TextFontFamily(val wireName: String, val label: String) {
    DISPLAY("DISPLAY", "Impact"),
    SANS("SANS", "Clean Sans"),
    SERIF("SERIF", "Cinema Serif"),
    MONO("MONO", "Cyber Mono"),
    CONDENSED("CONDENSED", "Condensed"),
    ROUNDED("ROUNDED", "Rounded");

    companion object {
        fun fromWire(value: String): TextFontFamily {
            return entries.firstOrNull { it.wireName == value } ?: DISPLAY
        }
    }
}

data class TextStyleTemplate(
    val id: String,
    val name: String,
    val fontFamily: TextFontFamily,
    val colorHex: Long,
    val bgColorHex: Long,
    val hasOutline: Boolean,
    val letterSpacingEm: Float
)

data class TextAnimSpec(
    val id: String,
    val name: String,
    val category: String,
    val animKind: String,
    val speedMultiplier: Float = 1.0f
)

data class LottieStickerSpec(
    val id: String,
    val name: String,
    val category: String,
    val lottieAssetPath: String,
    val tintHex: Long
)

data class TextLayer(
    val id: String = UUID.randomUUID().toString(),
    val text: String,
    val startTimeMs: Long = 0L,
    val durationMs: Long = 3000L,
    val posXFraction: Float = 0.5f,
    val posYFraction: Float = 0.5f,
    val colorHex: Long = 0xFFFFFFFF,
    val fontSizeSp: Float = 26f,
    val templateId: String = "tpl_tg7_display",
    val animationId: String = "ta_none",
    val fontFamily: TextFontFamily = TextFontFamily.DISPLAY,
    val bgColorHex: Long = 0x00000000L,
    val hasOutline: Boolean = true,
    val letterSpacingEm: Float = 0.04f,
    val scale: Float = 1.0f,
    val rotationDeg: Float = 0f,
    val opacity: Float = 1.0f,
    val keyframes: List<KeyframeNode> = emptyList()
)

data class StickerLayer(
    val id: String = UUID.randomUUID().toString(),
    val preset: StickerPreset = StickerPreset.STAR,
    val startTimeMs: Long = 0L,
    val durationMs: Long = 3000L,
    val posXFraction: Float = 0.5f,
    val posYFraction: Float = 0.35f,
    val sizeDp: Float = 68f,
    val tintHex: Long = preset.defaultTintHex,
    val lottieAssetPath: String? = null,
    val label: String = preset.label,
    val scale: Float = 1.0f,
    val rotationDeg: Float = 0f,
    val opacity: Float = 1.0f,
    val keyframes: List<KeyframeNode> = emptyList()
)

data class TimelineSelection(
    val trackType: TrackType,
    val itemId: String
)

data class EditorProject(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val aspectRatio: CanvasAspectRatio = CanvasAspectRatio.PORTRAIT_9_16,
    val updatedAtMs: Long = System.currentTimeMillis(),
    val inActiveSession: Boolean = false,
    val clips: List<TimelineClip> = emptyList(),
    val audioClips: List<AudioClip> = emptyList(),
    val textLayers: List<TextLayer> = emptyList(),
    val stickerLayers: List<StickerLayer> = emptyList()
) {
    val videoDurationMs: Long
        get() = clips.sumOf { it.activeDurationMs }

    val totalDurationMs: Long
        get() {
            val maxVideo = videoDurationMs
            val maxAudio = audioClips.maxOfOrNull { it.startTimeMs + it.activeDurationMs } ?: 0L
            val maxText = textLayers.maxOfOrNull { it.startTimeMs + it.durationMs } ?: 0L
            val maxSticker = stickerLayers.maxOfOrNull { it.startTimeMs + it.durationMs } ?: 0L
            return maxOf(maxVideo, maxAudio, maxText, maxSticker)
        }

    val coverUriString: String?
        get() = clips.firstOrNull()?.uriString
}

data class RecentMediaItem(
    val id: Long,
    val uriString: String,
    val displayName: String,
    val kind: MediaKind,
    val durationMs: Long
)

sealed interface ExportState {
    data object Idle : ExportState
    data class Exporting(val progressPercent: Int, val resolution: ExportResolution) : ExportState
    data class Completed(
        val filePath: String,
        val galleryUriString: String?,
        val fileName: String
    ) : ExportState
    data class Failed(val message: String) : ExportState
}
