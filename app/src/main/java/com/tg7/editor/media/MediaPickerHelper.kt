package com.tg7.editor.media

import android.content.Context
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.OpenableColumns
import com.tg7.editor.model.AudioClip
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.TimelineClip
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Locale

object MediaPickerHelper {

    fun persistReadPermission(context: Context, uri: Uri) {
        try {
            context.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
        } catch (_: SecurityException) {
            // Picker session URIs work for current session even if not persistable
        } catch (_: Throwable) {
            // Safe ignore
        }
    }

    suspend fun probeUriToClip(context: Context, uri: Uri): TimelineClip? =
        withContext(Dispatchers.IO) {
            persistReadPermission(context, uri)
            val resolver = context.contentResolver
            val mime = resolver.getType(uri).orEmpty().lowercase(Locale.US)
            val displayName = resolveDisplayName(context, uri)
            val isImage = mime.startsWith("image/") ||
                displayName.endsWith(".jpg", true) ||
                displayName.endsWith(".jpeg", true) ||
                displayName.endsWith(".png", true) ||
                displayName.endsWith(".webp", true)

            if (isImage) {
                return@withContext TimelineClip(
                    uriString = uri.toString(),
                    displayName = displayName,
                    kind = MediaKind.IMAGE,
                    sourceDurationMs = 3500L,
                    trimStartMs = 0L,
                    trimEndMs = 3500L
                )
            }

            var durationMs = 5000L
            val retriever = MediaMetadataRetriever()
            try {
                retriever.setDataSource(context, uri)
                val raw = retriever
                    .extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                    ?.toLongOrNull()
                if (raw != null && raw >= 300L) {
                    durationMs = raw
                }
            } catch (_: Throwable) {
                return@withContext null
            } finally {
                runCatching { retriever.release() }
            }

            TimelineClip(
                uriString = uri.toString(),
                displayName = displayName,
                kind = MediaKind.VIDEO,
                sourceDurationMs = durationMs,
                trimStartMs = 0L,
                trimEndMs = durationMs
            )
        }

    suspend fun probeAudioUri(context: Context, uri: Uri, startTimeMs: Long): AudioClip? =
        withContext(Dispatchers.IO) {
            persistReadPermission(context, uri)
            val displayName = resolveDisplayName(context, uri)
            var durationMs = 15_000L
            val retriever = MediaMetadataRetriever()
            try {
                retriever.setDataSource(context, uri)
                val raw = retriever
                    .extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                    ?.toLongOrNull()
                if (raw != null && raw >= 300L) {
                    durationMs = raw
                }
            } catch (_: Throwable) {
                return@withContext null
            } finally {
                runCatching { retriever.release() }
            }

            AudioClip(
                uriString = uri.toString(),
                displayName = displayName,
                startTimeMs = startTimeMs.coerceAtLeast(0L),
                sourceDurationMs = durationMs,
                trimStartMs = 0L,
                trimEndMs = durationMs,
                volume = 1.0f
            )
        }

    private fun resolveDisplayName(context: Context, uri: Uri): String {
        runCatching {
            context.contentResolver.query(
                uri,
                arrayOf(OpenableColumns.DISPLAY_NAME),
                null,
                null,
                null
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (idx >= 0) {
                        val name = cursor.getString(idx)
                        if (!name.isNullOrBlank()) return name
                    }
                }
            }
        }
        return uri.lastPathSegment?.substringAfterLast('/') ?: "Media Clip"
    }

    fun formatDuration(ms: Long): String {
        val safeMs = ms.coerceAtLeast(0L)
        val totalSec = safeMs / 1000L
        val mins = totalSec / 60L
        val secs = totalSec % 60L
        val tenths = (safeMs % 1000L) / 100L
        return String.format(Locale.US, "%02d:%02d.%d", mins, secs, tenths)
    }
}
