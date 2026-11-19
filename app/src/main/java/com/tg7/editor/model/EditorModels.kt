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

data class TimelineClip(
    val id: String = UUID.randomUUID().toString(),
    val uriString: String,
    val displayName: String,
    val kind: MediaKind,
    val sourceDurationMs: Long,
    val trimStartMs: Long = 0L,
    val trimEndMs: Long = sourceDurationMs
) {
    val activeDurationMs: Long
        get() = (trimEndMs - trimStartMs).coerceAtLeast(300L)
}

data class AudioClip(
    val id: String = UUID.randomUUID().toString(),
    val uriString: String,
    val displayName: String,
    val startTimeMs: Long = 0L,
    val sourceDurationMs: Long = 10_000L,
    val trimStartMs: Long = 0L,
    val trimEndMs: Long = sourceDurationMs,
    val volume: Float = 1.0f
) {
    val activeDurationMs: Long
        get() = (trimEndMs - trimStartMs).coerceAtLeast(300L)
}

data class TextLayer(
    val id: String = UUID.randomUUID().toString(),
    val text: String,
    val startTimeMs: Long = 0L,
    val durationMs: Long = 3000L,
    val posXFraction: Float = 0.5f,
    val posYFraction: Float = 0.5f,
    val colorHex: Long = 0xFFFFFFFF,
    val fontSizeSp: Float = 26f
)

data class StickerLayer(
    val id: String = UUID.randomUUID().toString(),
    val preset: StickerPreset = StickerPreset.STAR,
    val startTimeMs: Long = 0L,
    val durationMs: Long = 3000L,
    val posXFraction: Float = 0.5f,
    val posYFraction: Float = 0.35f,
    val sizeDp: Float = 56f,
    val tintHex: Long = preset.defaultTintHex
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
