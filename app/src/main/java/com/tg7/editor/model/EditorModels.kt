package com.tg7.editor.model

import java.util.UUID

enum class MediaKind {
    VIDEO,
    IMAGE
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

data class EditorProject(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val aspectRatio: CanvasAspectRatio = CanvasAspectRatio.PORTRAIT_9_16,
    val updatedAtMs: Long = System.currentTimeMillis(),
    val clips: List<TimelineClip> = emptyList()
) {
    val totalDurationMs: Long
        get() = clips.sumOf { it.activeDurationMs }

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
