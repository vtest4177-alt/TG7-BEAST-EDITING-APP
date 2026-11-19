package com.tg7.editor.engine.export

import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import androidx.core.content.FileProvider
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import com.tg7.editor.model.CanvasAspectRatio
import com.tg7.editor.model.ExportResolution
import com.tg7.editor.model.ExportState
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.TimelineClip
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

class HardwareVideoExporter(context: Context) {
    private val appContext = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())
    private var activeTransformer: Transformer? = null
    private var progressPollRunnable: Runnable? = null

    fun startExport(
        projectName: String,
        clips: List<TimelineClip>,
        aspectRatio: CanvasAspectRatio,
        resolution: ExportResolution,
        onStateChanged: (ExportState) -> Unit
    ) {
        if (clips.isEmpty()) {
            onStateChanged(ExportState.Failed("Add at least one video or photo before exporting."))
            return
        }

        cancel()
        onStateChanged(ExportState.Exporting(progressPercent = 0, resolution = resolution))

        val exportDir = File(appContext.cacheDir, "exports").apply { mkdirs() }
        val safeTitle = projectName.replace(Regex("[^A-Za-z0-9_-]"), "_").take(24).ifBlank { "TG7_Edit" }
        val fileName = "${safeTitle}_${resolution.label}_${System.currentTimeMillis()}.mp4"
        val outFile = File(exportDir, fileName)
        if (outFile.exists()) outFile.delete()

        mainHandler.post {
            try {
                val (targetW, targetH) = aspectRatio.outputDimensions(resolution.shortEdgePx)
                val videoEffects: List<Effect> = listOf(
                    Presentation.createForWidthAndHeight(
                        targetW,
                        targetH,
                        Presentation.LAYOUT_SCALE_TO_FIT
                    )
                )
                val itemEffects = Effects(emptyList(), videoEffects)

                val editedItems = clips.map { clip ->
                    val itemBuilder = MediaItem.Builder()
                        .setUri(Uri.parse(clip.uriString))

                    if (clip.kind == MediaKind.VIDEO) {
                        itemBuilder.setClippingConfiguration(
                            MediaItem.ClippingConfiguration.Builder()
                                .setStartPositionMs(clip.trimStartMs)
                                .setEndPositionMs(clip.trimEndMs)
                                .build()
                        )
                    } else {
                        itemBuilder.setImageDurationMs(clip.activeDurationMs)
                    }

                    val editedBuilder = EditedMediaItem.Builder(itemBuilder.build())
                        .setEffects(itemEffects)

                    if (clip.kind == MediaKind.IMAGE) {
                        editedBuilder
                            .setDurationUs(clip.activeDurationMs * 1000L)
                            .setFrameRate(60)
                    }
                    editedBuilder.build()
                }

                val sequence = EditedMediaItemSequence(editedItems)
                val composition = Composition.Builder(sequence).build()

                val transformer = Transformer.Builder(appContext)
                    .setVideoMimeType(MimeTypes.VIDEO_H264)
                    .setAudioMimeType(MimeTypes.AUDIO_AAC)
                    .addListener(object : Transformer.Listener {
                        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                            stopProgressPoll()
                            activeTransformer = null
                            Thread {
                                val galleryUri = saveMp4ToGallery(outFile, fileName)
                                val shareUri = galleryUri ?: runCatching {
                                    FileProvider.getUriForFile(
                                        appContext,
                                        "${appContext.packageName}.fileprovider",
                                        outFile
                                    ).toString()
                                }.getOrNull()
                                mainHandler.post {
                                    onStateChanged(
                                        ExportState.Completed(
                                            filePath = outFile.absolutePath,
                                            galleryUriString = shareUri,
                                            fileName = fileName
                                        )
                                    )
                                }
                            }.start()
                        }

                        override fun onError(
                            composition: Composition,
                            exportResult: ExportResult,
                            exportException: ExportException
                        ) {
                            stopProgressPoll()
                            activeTransformer = null
                            onStateChanged(
                                ExportState.Failed(
                                    "Hardware export failed (${exportException.errorCodeName}): ${exportException.localizedMessage ?: "Codec error"}"
                                )
                            )
                        }
                    })
                    .build()

                activeTransformer = transformer
                transformer.start(composition, outFile.absolutePath)
                startProgressPoll(transformer, resolution, onStateChanged)
            } catch (t: Throwable) {
                stopProgressPoll()
                activeTransformer = null
                onStateChanged(ExportState.Failed(t.localizedMessage ?: "Failed to start hardware encoder"))
            }
        }
    }

    private fun startProgressPoll(
        transformer: Transformer,
        resolution: ExportResolution,
        onStateChanged: (ExportState) -> Unit
    ) {
        val holder = ProgressHolder()
        val runnable = object : Runnable {
            override fun run() {
                if (activeTransformer !== transformer) return
                val state = transformer.getProgress(holder)
                if (state == Transformer.PROGRESS_STATE_AVAILABLE) {
                    onStateChanged(
                        ExportState.Exporting(
                            progressPercent = holder.progress.coerceIn(0, 99),
                            resolution = resolution
                        )
                    )
                }
                mainHandler.postDelayed(this, 120L)
            }
        }
        progressPollRunnable = runnable
        mainHandler.postDelayed(runnable, 120L)
    }

    private fun stopProgressPoll() {
        progressPollRunnable?.let { mainHandler.removeCallbacks(it) }
        progressPollRunnable = null
    }

    private fun saveMp4ToGallery(sourceFile: File, fileName: String): String? {
        if (!sourceFile.exists()) return null
        return runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Video.Media.DISPLAY_NAME, fileName)
                    put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
                    put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/TG7 Editor")
                    put(MediaStore.Video.Media.IS_PENDING, 1)
                }
                val resolver = appContext.contentResolver
                val uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
                    ?: return null

                resolver.openOutputStream(uri)?.use { out ->
                    sourceFile.inputStream().use { input ->
                        input.copyTo(out)
                    }
                }
                val done = ContentValues().apply {
                    put(MediaStore.Video.Media.IS_PENDING, 0)
                }
                resolver.update(uri, done, null, null)
                uri.toString()
            } else {
                val moviesDir = File(
                    appContext.getExternalFilesDir(Environment.DIRECTORY_MOVIES),
                    "TG7 Editor"
                ).apply { mkdirs() }
                val dest = File(moviesDir, fileName)
                sourceFile.copyTo(dest, overwrite = true)
                MediaScannerConnection.scanFile(appContext, arrayOf(dest.absolutePath), arrayOf("video/mp4"), null)
                FileProvider.getUriForFile(
                    appContext,
                    "${appContext.packageName}.fileprovider",
                    dest
                ).toString()
            }
        }.getOrNull()
    }

    fun cancel() {
        stopProgressPoll()
        mainHandler.post {
            runCatching { activeTransformer?.cancel() }
            activeTransformer = null
        }
    }

    suspend fun clearOldExports() = withContext(Dispatchers.IO) {
        val dir = File(appContext.cacheDir, "exports")
        dir.listFiles()?.forEach { f ->
            if (System.currentTimeMillis() - f.lastModified() > 24 * 60 * 60 * 1000L) {
                runCatching { f.delete() }
            }
        }
    }
}
