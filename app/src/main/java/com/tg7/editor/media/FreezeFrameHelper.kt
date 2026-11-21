package com.tg7.editor.media

import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

object FreezeFrameHelper {

    suspend fun captureFrameFile(
        context: Context,
        uriString: String,
        sourceTimeMs: Long
    ): File? = withContext(Dispatchers.IO) {
        val retriever = MediaMetadataRetriever()
        var bitmap: Bitmap? = null
        try {
            retriever.setDataSource(context, Uri.parse(uriString))
            val timeUs = sourceTimeMs.coerceAtLeast(0L) * 1000L
            bitmap = retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                ?: retriever.getFrameAtTime(timeUs)
            if (bitmap == null) return@withContext null

            val dir = File(context.filesDir, "freeze_frames").apply { mkdirs() }
            val outFile = File(dir, "tg7_freeze_${System.currentTimeMillis()}.png")
            FileOutputStream(outFile).use { fos ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 95, fos)
            }
            outFile
        } catch (_: Throwable) {
            null
        } finally {
            runCatching { bitmap?.recycle() }
            runCatching { retriever.release() }
        }
    }
}
