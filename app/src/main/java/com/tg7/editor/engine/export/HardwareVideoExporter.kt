package com.tg7.editor.engine.export

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.RectF
import android.graphics.Typeface
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import androidx.annotation.OptIn
import androidx.core.content.FileProvider
import com.airbnb.lottie.LottieCompositionFactory
import com.airbnb.lottie.LottieDrawable
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BitmapOverlay
import androidx.media3.effect.OverlayEffect
import androidx.media3.effect.OverlaySettings
import androidx.media3.effect.Presentation
import androidx.media3.effect.TextureOverlay
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import com.google.common.collect.ImmutableList
import com.tg7.editor.engine.anim.OverlayAnimator
import com.tg7.editor.engine.gl.ClipVideoEffectsEffect
import com.tg7.editor.engine.gl.TransitionTimelineEffect
import com.tg7.editor.model.EditorProject
import com.tg7.editor.model.ExportResolution
import com.tg7.editor.model.ExportState
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.StickerLayer
import com.tg7.editor.model.TextFontFamily
import com.tg7.editor.model.TextLayer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

@OptIn(UnstableApi::class)
class HardwareVideoExporter(context: Context) {
    private val appContext = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())
    private var activeTransformer: Transformer? = null
    private var progressPollRunnable: Runnable? = null
    private val allocatedOverlayBitmaps = mutableListOf<Bitmap>()

    fun startExport(
        project: EditorProject,
        resolution: ExportResolution,
        onStateChanged: (ExportState) -> Unit
    ) {
        if (project.clips.isEmpty()) {
            onStateChanged(ExportState.Failed("Add at least one video or photo before exporting."))
            return
        }

        cancel()
        onStateChanged(ExportState.Exporting(progressPercent = 0, resolution = resolution))

        val exportDir = File(appContext.cacheDir, "exports").apply { mkdirs() }
        val safeTitle = project.name.replace(Regex("[^A-Za-z0-9_-]"), "_").take(24).ifBlank { "TG7_Edit" }
        val fileName = "${safeTitle}_${resolution.label}_${System.currentTimeMillis()}.mp4"
        val outFile = File(exportDir, fileName)
        if (outFile.exists()) outFile.delete()

        mainHandler.post {
            try {
                val (targetW, targetH) = project.aspectRatio.outputDimensions(resolution.shortEdgePx)
                val videoEffects: List<Effect> = listOf(
                    Presentation.createForWidthAndHeight(
                        targetW,
                        targetH,
                        Presentation.LAYOUT_SCALE_TO_FIT
                    )
                )
                val itemEffects = Effects(emptyList(), videoEffects)

                val editedVideoItems = project.clips.map { clip ->
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

                val sequences = mutableListOf(EditedMediaItemSequence(editedVideoItems))

                if (project.audioClips.isNotEmpty()) {
                    val editedAudioItems = project.audioClips.map { audio ->
                        val audioItem = MediaItem.Builder()
                            .setUri(Uri.parse(audio.uriString))
                            .setClippingConfiguration(
                                MediaItem.ClippingConfiguration.Builder()
                                    .setStartPositionMs(audio.trimStartMs)
                                    .setEndPositionMs(audio.trimEndMs)
                                    .build()
                            )
                            .build()
                        EditedMediaItem.Builder(audioItem)
                            .setRemoveVideo(true)
                            .build()
                    }
                    sequences.add(EditedMediaItemSequence(editedAudioItems))
                }

                val textureOverlays = buildList<TextureOverlay> {
                    project.textLayers.forEach { layer ->
                        add(createTimedTextOverlay(layer, targetH))
                    }
                    project.stickerLayers.forEach { sticker ->
                        add(createTimedStickerOverlay(sticker, targetH))
                    }
                }

                val clipEffectWindows = ClipVideoEffectsEffect.buildWindows(appContext, project.clips)
                val transitionWindows = TransitionTimelineEffect.buildWindows(appContext, project.clips)
                val compositionEffects = buildList<Effect> {
                    if (clipEffectWindows.isNotEmpty()) {
                        add(
                            ClipVideoEffectsEffect(
                                initialWindows = clipEffectWindows,
                                realtimePositionMsProvider = null
                            )
                        )
                    }
                    if (transitionWindows.isNotEmpty()) {
                        add(
                            TransitionTimelineEffect(
                                initialWindows = transitionWindows,
                                realtimePositionMsProvider = null
                            )
                        )
                    }
                    if (textureOverlays.isNotEmpty()) {
                        add(OverlayEffect(ImmutableList.copyOf(textureOverlays)))
                    }
                }

                val compositionBuilder = Composition.Builder(sequences)
                if (compositionEffects.isNotEmpty()) {
                    compositionBuilder.setEffects(
                        Effects(emptyList(), compositionEffects)
                    )
                }
                val composition = compositionBuilder.build()

                val transformer = Transformer.Builder(appContext)
                    .setVideoMimeType(MimeTypes.VIDEO_H264)
                    .setAudioMimeType(MimeTypes.AUDIO_AAC)
                    .addListener(object : Transformer.Listener {
                        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                            stopProgressPoll()
                            recycleOverlayBitmaps()
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
                            recycleOverlayBitmaps()
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
                recycleOverlayBitmaps()
                activeTransformer = null
                onStateChanged(ExportState.Failed(t.localizedMessage ?: "Failed to start hardware encoder"))
            }
        }
    }

    private fun resolveTypeface(family: TextFontFamily): Typeface {
        return when (family) {
            TextFontFamily.DISPLAY -> Typeface.create("sans-serif-black", Typeface.BOLD)
            TextFontFamily.SANS -> Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
            TextFontFamily.SERIF -> Typeface.create(Typeface.SERIF, Typeface.BOLD)
            TextFontFamily.MONO -> Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
            TextFontFamily.CONDENSED -> Typeface.create("sans-serif-condensed", Typeface.BOLD)
            TextFontFamily.ROUNDED -> Typeface.create("sans-serif", Typeface.BOLD)
        }
    }

    private fun createTimedTextOverlay(layer: TextLayer, targetHeight: Int): BitmapOverlay {
        val textPx = (layer.fontSizeSp * (targetHeight / 720f) * 2.1f).coerceIn(28f, 160f)
        val tf = resolveTypeface(layer.fontFamily)
        val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = layer.colorHex.toInt()
            textSize = textPx
            typeface = tf
            letterSpacing = layer.letterSpacingEm
            setShadowLayer(8f, 0f, 3f, Color.BLACK)
        }
        val strokePaint = Paint(fillPaint).apply {
            style = Paint.Style.STROKE
            strokeWidth = 6f
            color = Color.BLACK
        }
        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.FILL
            color = layer.bgColorHex.toInt()
        }

        val fullText = layer.text.ifBlank { "TG7" }
        val measureText = "$fullText.."
        val boxW = (fillPaint.measureText(measureText).toInt() + 72).coerceAtLeast(120)
        val fm = fillPaint.fontMetrics
        val textH = (fm.descent - fm.ascent).toInt().coerceAtLeast(36)
        val boxH = textH + 56

        val bmpA = Bitmap.createBitmap(boxW, boxH, Bitmap.Config.ARGB_8888)
        val bmpB = Bitmap.createBitmap(boxW, boxH, Bitmap.Config.ARGB_8888)
        allocatedOverlayBitmaps.add(bmpA)
        allocatedOverlayBitmaps.add(bmpB)
        val canvasA = Canvas(bmpA)
        val canvasB = Canvas(bmpB)

        fun renderTextInto(canvas: Canvas, textToDraw: String, textColorInt: Int) {
            canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)
            fillPaint.color = textColorInt
            val curW = fillPaint.measureText(textToDraw)
            val leftX = (boxW - curW) / 2f
            val baseline = (boxH - (fm.descent + fm.ascent)) / 2f
            if (((layer.bgColorHex ushr 24) and 0xFF) > 0L) {
                val rect = RectF(
                    (leftX - 24f).coerceAtLeast(4f),
                    8f,
                    (leftX + curW + 24f).coerceAtMost(boxW - 4f),
                    (boxH - 8f)
                )
                canvas.drawRoundRect(rect, 22f, 22f, bgPaint)
            }
            if (layer.hasOutline) {
                canvas.drawText(textToDraw, leftX, baseline, strokePaint)
            }
            canvas.drawText(textToDraw, leftX, baseline, fillPaint)
        }

        renderTextInto(canvasA, fullText, layer.colorHex.toInt())

        val startUs = layer.startTimeMs * 1000L
        val endUs = (layer.startTimeMs + layer.durationMs) * 1000L
        val ndcX = (layer.posXFraction * 2f - 1f).coerceIn(-0.92f, 0.92f)
        val ndcY = (1f - layer.posYFraction * 2f).coerceIn(-0.92f, 0.92f)
        val hiddenSettings = OverlaySettings.Builder().setAlphaScale(0f).build()
        val isStatic = layer.animationId == "ta_none"

        return object : BitmapOverlay() {
            private var useB = false

            override fun getBitmap(presentationTimeUs: Long): Bitmap {
                if (isStatic || presentationTimeUs !in startUs..endUs) return bmpA
                val localMs = (presentationTimeUs - startUs) / 1000L
                val frame = OverlayAnimator.evaluateText(appContext, layer, localMs)
                useB = !useB
                val targetBmp = if (useB) bmpB else bmpA
                val targetCanvas = if (useB) canvasB else canvasA
                renderTextInto(
                    targetCanvas,
                    frame.visibleText,
                    (frame.overrideColorHex ?: layer.colorHex).toInt()
                )
                return targetBmp
            }

            override fun getOverlaySettings(presentationTimeUs: Long): OverlaySettings {
                if (presentationTimeUs !in startUs..endUs) return hiddenSettings
                val localMs = (presentationTimeUs - startUs) / 1000L
                val frame = OverlayAnimator.evaluateText(appContext, layer, localMs)
                val shiftX = (frame.offsetXDp / 360f)
                val shiftY = (frame.offsetYDp / 360f)
                return OverlaySettings.Builder()
                    .setAlphaScale(frame.alpha.coerceIn(0f, 1f))
                    .setScale(frame.scaleX.coerceIn(0.1f, 3f), frame.scaleY.coerceIn(0.1f, 3f))
                    .setRotationDegrees(frame.rotationDeg)
                    .setBackgroundFrameAnchor(
                        (ndcX + shiftX).coerceIn(-0.96f, 0.96f),
                        (ndcY - shiftY).coerceIn(-0.96f, 0.96f)
                    )
                    .build()
            }
        }
    }

    private fun createTimedStickerOverlay(sticker: StickerLayer, targetHeight: Int): BitmapOverlay {
        val sizePx = (sticker.sizeDp * (targetHeight / 720f) * 2.2f).toInt().coerceIn(84, 280)
        val lottieComp = sticker.lottieAssetPath?.let { path ->
            runCatching { LottieCompositionFactory.fromAssetSync(appContext, path).value }.getOrNull()
        }

        val bmpA = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        allocatedOverlayBitmaps.add(bmpA)

        val startUs = sticker.startTimeMs * 1000L
        val endUs = (sticker.startTimeMs + sticker.durationMs) * 1000L
        val ndcX = (sticker.posXFraction * 2f - 1f).coerceIn(-0.92f, 0.92f)
        val ndcY = (1f - sticker.posYFraction * 2f).coerceIn(-0.92f, 0.92f)
        val visibleSettings = OverlaySettings.Builder()
            .setAlphaScale(1f)
            .setBackgroundFrameAnchor(ndcX, ndcY)
            .build()
        val hiddenSettings = OverlaySettings.Builder()
            .setAlphaScale(0f)
            .build()

        if (lottieComp != null) {
            val bmpB = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
            allocatedOverlayBitmaps.add(bmpB)
            val canvasA = Canvas(bmpA)
            val canvasB = Canvas(bmpB)
            val drawable = LottieDrawable().apply {
                composition = lottieComp
                setBounds(0, 0, sizePx, sizePx)
            }
            return object : BitmapOverlay() {
                private var useB = false

                override fun getBitmap(presentationTimeUs: Long): Bitmap {
                    val localMs = (presentationTimeUs - startUs).coerceAtLeast(0L)
                    drawable.progress = (localMs % 1500L) / 1500f
                    useB = !useB
                    val targetBmp = if (useB) bmpB else bmpA
                    val targetCanvas = if (useB) canvasB else canvasA
                    targetCanvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)
                    drawable.draw(targetCanvas)
                    return targetBmp
                }

                override fun getOverlaySettings(presentationTimeUs: Long): OverlaySettings {
                    return if (presentationTimeUs in startUs..endUs) visibleSettings else hiddenSettings
                }
            }
        }

        val canvas = Canvas(bmpA)
        val badgePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(170, 12, 16, 26)
        }
        val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = sizePx * 0.06f
            color = sticker.tintHex.toInt()
        }
        val glyphPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = sticker.tintHex.toInt()
            textSize = sizePx * 0.52f
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }
        val cx = sizePx / 2f
        val cy = sizePx / 2f
        val r = sizePx * 0.44f
        canvas.drawCircle(cx, cy, r, badgePaint)
        canvas.drawCircle(cx, cy, r, ringPaint)
        val textY = cy - (glyphPaint.descent() + glyphPaint.ascent()) / 2f
        canvas.drawText(sticker.preset.glyph, cx, textY, glyphPaint)

        return object : BitmapOverlay() {
            override fun getBitmap(presentationTimeUs: Long): Bitmap = bmpA
            override fun getOverlaySettings(presentationTimeUs: Long): OverlaySettings {
                return if (presentationTimeUs in startUs..endUs) visibleSettings else hiddenSettings
            }
        }
    }

    private fun recycleOverlayBitmaps() {
        allocatedOverlayBitmaps.forEach { bmp ->
            if (!bmp.isRecycled) runCatching { bmp.recycle() }
        }
        allocatedOverlayBitmaps.clear()
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
            recycleOverlayBitmaps()
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
