package com.tg7.editor.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ZoomIn
import androidx.compose.material.icons.rounded.ZoomOut
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tg7.editor.media.MediaPickerHelper
import com.tg7.editor.model.EditorProject
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.TimelineSelection
import com.tg7.editor.model.TrackType
import com.tg7.editor.ui.theme.TG7Colors
import java.util.Locale
import kotlin.math.abs
import kotlin.math.ceil

private data class TrackBlock(
    val trackType: TrackType,
    val itemId: String,
    val index: Int,
    val label: String,
    val startMs: Long,
    val durationMs: Long,
    val trimStartMs: Long,
    val trimEndMs: Long,
    val maxSourceMs: Long,
    val baseColor: Color,
    val accentColor: Color
)

private data class CutJunction(
    val cutIndex: Int,
    val timeMs: Long,
    val hasTransition: Boolean
)

private enum class MultiDragMode {
    SCRUB,
    MOVE_LAYER,
    REORDER_VIDEO,
    TRIM_LEFT,
    TRIM_RIGHT
}

@Composable
fun MultiTrackTimeline(
    project: EditorProject,
    selection: TimelineSelection?,
    multiSelectedIds: Set<String>,
    isMultiSelectMode: Boolean,
    globalPositionMs: Long,
    zoomScale: Float,
    onZoomChange: (Float) -> Unit,
    onSeek: (Long) -> Unit,
    onSelectItem: (TrackType, String) -> Unit,
    onMoveVideoClip: (fromIdx: Int, toIdx: Int) -> Unit,
    onMoveLayerStart: (TrackType, String, Long) -> Unit,
    onTrimItem: (TrackType, String, Long, Long) -> Unit,
    onOpenTransitionPicker: (cutIndex: Int) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val density = LocalDensity.current
    val haptic = LocalHapticFeedback.current
    val pxPerSec = with(density) { (72.dp * zoomScale).toPx() }
    val handleHitPx = with(density) { 22.dp.toPx() }
    val rulerHeightPx = with(density) { 22.dp.toPx() }
    val laneHeightPx = with(density) { 38.dp.toPx() }
    val laneGapPx = with(density) { 6.dp.toPx() }

    val textMeasurer = rememberTextMeasurer()
    var activeSnapLineMs by remember { mutableStateOf<Long?>(null) }

    val blocks = remember(project) {
        buildList {
            var videoAccMs = 0L
            project.clips.forEachIndexed { idx, clip ->
                add(
                    TrackBlock(
                        trackType = TrackType.VIDEO,
                        itemId = clip.id,
                        index = idx,
                        label = "${clip.displayName.take(10)} · ${MediaPickerHelper.formatDuration(clip.activeDurationMs)}",
                        startMs = videoAccMs,
                        durationMs = clip.activeDurationMs,
                        trimStartMs = clip.trimStartMs,
                        trimEndMs = clip.trimEndMs,
                        maxSourceMs = if (clip.kind == MediaKind.IMAGE) 30_000L else clip.sourceDurationMs,
                        baseColor = if (clip.kind == MediaKind.VIDEO) Color(0xFF0E2230) else Color(0xFF261220),
                        accentColor = TG7Colors.NeonCyan
                    )
                )
                videoAccMs += clip.activeDurationMs
            }

            project.audioClips.forEachIndexed { idx, audio ->
                add(
                    TrackBlock(
                        trackType = TrackType.AUDIO,
                        itemId = audio.id,
                        index = idx,
                        label = "♫ ${audio.displayName.take(12)}",
                        startMs = audio.startTimeMs,
                        durationMs = audio.activeDurationMs,
                        trimStartMs = audio.trimStartMs,
                        trimEndMs = audio.trimEndMs,
                        maxSourceMs = audio.sourceDurationMs,
                        baseColor = Color(0xFF14261E),
                        accentColor = Color(0xFF22C55E)
                    )
                )
            }

            project.textLayers.forEachIndexed { idx, text ->
                add(
                    TrackBlock(
                        trackType = TrackType.TEXT,
                        itemId = text.id,
                        index = idx,
                        label = "T: ${text.text.take(12)}",
                        startMs = text.startTimeMs,
                        durationMs = text.durationMs,
                        trimStartMs = text.startTimeMs,
                        trimEndMs = text.durationMs,
                        maxSourceMs = 60_000L,
                        baseColor = Color(0xFF241736),
                        accentColor = Color(0xFFC084FC)
                    )
                )
            }

            project.stickerLayers.forEachIndexed { idx, sticker ->
                add(
                    TrackBlock(
                        trackType = TrackType.STICKER,
                        itemId = sticker.id,
                        index = idx,
                        label = "${sticker.preset.glyph} ${sticker.preset.label}",
                        startMs = sticker.startTimeMs,
                        durationMs = sticker.durationMs,
                        trimStartMs = sticker.startTimeMs,
                        trimEndMs = sticker.durationMs,
                        maxSourceMs = 60_000L,
                        baseColor = Color(0xFF2B1218),
                        accentColor = TG7Colors.BloodRed
                    )
                )
            }
        }
    }

    val snapTargetsMs = remember(project, globalPositionMs) {
        buildList {
            add(0L)
            add(globalPositionMs)
            var acc = 0L
            project.clips.forEach {
                acc += it.activeDurationMs
                add(acc)
            }
        }.distinct()
    }

    val cutJunctions = remember(project.clips) {
        buildList {
            var acc = 0L
            for (i in 0 until project.clips.lastIndex) {
                val c = project.clips[i]
                acc += c.activeDurationMs
                add(
                    CutJunction(
                        cutIndex = i,
                        timeMs = acc,
                        hasTransition = !c.outTransitionId.isNullOrBlank()
                    )
                )
            }
        }
    }

    val junctionHitPx = with(density) { 20.dp.toPx() }
    val currentBlocks by rememberUpdatedState(blocks)
    val currentJunctions by rememberUpdatedState(cutJunctions)
    val currentSelection by rememberUpdatedState(selection)
    val currentGlobalPos by rememberUpdatedState(globalPositionMs)
    val currentTotalDur by rememberUpdatedState(project.totalDurationMs)
    val currentPxPerSec by rememberUpdatedState(pxPerSec)
    val currentSnapTargets by rememberUpdatedState(snapTargetsMs)
    val currentZoom by rememberUpdatedState(zoomScale)

    fun laneForY(y: Float): TrackType? {
        if (y < rulerHeightPx) return null
        val rel = y - rulerHeightPx
        val stride = laneHeightPx + laneGapPx
        val laneIdx = (rel / stride).toInt()
        return TrackType.entries.getOrNull(laneIdx)
    }

    fun yRangeForTrack(trackType: TrackType): Pair<Float, Float> {
        val top = rulerHeightPx + trackType.ordinal * (laneHeightPx + laneGapPx)
        return top to (top + laneHeightPx)
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(TG7Colors.GlassSurface, RoundedCornerShape(14.dp))
            .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(14.dp))
            .padding(vertical = 6.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (isMultiSelectMode) "MULTI-SELECT (${multiSelectedIds.size})" else "MULTI-TRACK · 4 LAYERS",
                color = if (isMultiSelectMode) TG7Colors.BloodRed else TG7Colors.TextMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Row(
                    modifier = Modifier
                        .defaultMinSize(minHeight = 48.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .clickable {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            onZoomChange((currentZoom / 1.25f).coerceIn(0.4f, 2.8f))
                        }
                        .padding(horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    Icon(Icons.Rounded.ZoomOut, contentDescription = "Zoom out", tint = TG7Colors.NeonCyan, modifier = Modifier.size(16.dp))
                    Text("Out", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                }

                Text(
                    text = "${(zoomScale * 100).toInt()}%",
                    color = TG7Colors.NeonCyan,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )

                Row(
                    modifier = Modifier
                        .defaultMinSize(minHeight = 48.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .clickable {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            onZoomChange((currentZoom * 1.25f).coerceIn(0.4f, 2.8f))
                        }
                        .padding(horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    Icon(Icons.Rounded.ZoomIn, contentDescription = "Zoom in", tint = TG7Colors.NeonCyan, modifier = Modifier.size(16.dp))
                    Text("In", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        val totalCanvasHeightDp = with(density) {
            (rulerHeightPx + TrackType.entries.size * (laneHeightPx + laneGapPx) + 6f).toDp()
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(totalCanvasHeightDp)
                .pointerInput(Unit) {
                    detectTransformGestures { _, _, zoom, _ ->
                        if (abs(zoom - 1f) > 0.02f) {
                            onZoomChange((currentZoom * zoom).coerceIn(0.4f, 2.8f))
                        }
                    }
                }
                .pointerInput(Unit) {
                    detectTapGestures { offset ->
                        val pps = currentPxPerSec
                        val centerX = size.width / 2f
                        val playheadPx = (currentGlobalPos / 1000f) * pps
                        val worldMs = (((offset.x - centerX + playheadPx) / pps) * 1000f).toLong()
                        val lane = laneForY(offset.y)

                        if (lane == TrackType.VIDEO) {
                            val shiftX = centerX - playheadPx
                            val hitCut = currentJunctions.firstOrNull { j ->
                                val jx = (j.timeMs / 1000f) * pps + shiftX
                                abs(offset.x - jx) <= junctionHitPx
                            }
                            if (hitCut != null) {
                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                onOpenTransitionPicker(hitCut.cutIndex)
                                return@detectTapGestures
                            }
                        }

                        val hit = if (lane != null) {
                            currentBlocks.firstOrNull { b ->
                                b.trackType == lane && worldMs in b.startMs..(b.startMs + b.durationMs)
                            }
                        } else null

                        if (hit != null) {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            onSelectItem(hit.trackType, hit.itemId)
                        }
                        onSeek(worldMs.coerceIn(0L, currentTotalDur))
                    }
                }
                .pointerInput(Unit) {
                    var dragMode = MultiDragMode.SCRUB
                    var targetBlock: TrackBlock? = null
                    var startOriginMs = 0L
                    var origTrimStart = 0L
                    var origTrimEnd = 0L
                    var scrubStartMs = 0L
                    var cumulativePx = 0f
                    var lastSnappedMs: Long? = null

                    detectHorizontalDragGestures(
                        onDragStart = { startOffset ->
                            val pps = currentPxPerSec
                            val centerX = size.width / 2f
                            val playheadPx = (currentGlobalPos / 1000f) * pps
                            val worldX = startOffset.x - centerX + playheadPx
                            val worldMs = ((worldX / pps) * 1000f).toLong()
                            cumulativePx = 0f
                            scrubStartMs = currentGlobalPos
                            lastSnappedMs = null
                            activeSnapLineMs = null

                            val lane = laneForY(startOffset.y)
                            val sel = currentSelection
                            val selBlock = if (sel != null && lane == sel.trackType) {
                                currentBlocks.firstOrNull { it.trackType == sel.trackType && it.itemId == sel.itemId }
                            } else null

                            if (selBlock != null) {
                                val startPx = (selBlock.startMs / 1000f) * pps
                                val endPx = ((selBlock.startMs + selBlock.durationMs) / 1000f) * pps
                                when {
                                    abs(worldX - startPx) <= handleHitPx -> {
                                        dragMode = MultiDragMode.TRIM_LEFT
                                        targetBlock = selBlock
                                        origTrimStart = selBlock.trimStartMs
                                        origTrimEnd = selBlock.trimEndMs
                                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    }
                                    abs(worldX - endPx) <= handleHitPx -> {
                                        dragMode = MultiDragMode.TRIM_RIGHT
                                        targetBlock = selBlock
                                        origTrimStart = selBlock.trimStartMs
                                        origTrimEnd = selBlock.trimEndMs
                                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    }
                                    selBlock.trackType != TrackType.VIDEO &&
                                        worldMs in selBlock.startMs..(selBlock.startMs + selBlock.durationMs) -> {
                                        dragMode = MultiDragMode.MOVE_LAYER
                                        targetBlock = selBlock
                                        startOriginMs = selBlock.startMs
                                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    }
                                    selBlock.trackType == TrackType.VIDEO &&
                                        worldMs in selBlock.startMs..(selBlock.startMs + selBlock.durationMs) -> {
                                        dragMode = MultiDragMode.REORDER_VIDEO
                                        targetBlock = selBlock
                                    }
                                    else -> {
                                        dragMode = MultiDragMode.SCRUB
                                        targetBlock = null
                                    }
                                }
                            } else {
                                dragMode = MultiDragMode.SCRUB
                                targetBlock = null
                            }
                        },
                        onDragEnd = {
                            activeSnapLineMs = null
                        },
                        onDragCancel = {
                            activeSnapLineMs = null
                        },
                        onHorizontalDrag = { _, dragAmount ->
                            cumulativePx += dragAmount
                            val pps = currentPxPerSec
                            when (dragMode) {
                                MultiDragMode.SCRUB -> {
                                    val deltaMs = ((-cumulativePx / pps) * 1000f).toLong()
                                    onSeek((scrubStartMs + deltaMs).coerceIn(0L, currentTotalDur))
                                }
                                MultiDragMode.REORDER_VIDEO -> {
                                    val block = targetBlock ?: return@detectHorizontalDragGestures
                                    val thresholdPx = 65f
                                    if (cumulativePx > thresholdPx) {
                                        onMoveVideoClip(block.index, block.index + 1)
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        cumulativePx = 0f
                                        targetBlock = currentBlocks.firstOrNull { it.itemId == block.itemId }
                                    } else if (cumulativePx < -thresholdPx) {
                                        onMoveVideoClip(block.index, block.index - 1)
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        cumulativePx = 0f
                                        targetBlock = currentBlocks.firstOrNull { it.itemId == block.itemId }
                                    }
                                }
                                MultiDragMode.MOVE_LAYER -> {
                                    val block = targetBlock ?: return@detectHorizontalDragGestures
                                    val rawStart = (startOriginMs + ((cumulativePx / pps) * 1000f).toLong()).coerceAtLeast(0L)
                                    val snapMatch = currentSnapTargets.firstOrNull { abs(rawStart - it) <= 130L }
                                    val snapped = snapMatch ?: rawStart
                                    activeSnapLineMs = snapMatch
                                    if (snapMatch != null && snapMatch != lastSnappedMs) {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        lastSnappedMs = snapMatch
                                    } else if (snapMatch == null) {
                                        lastSnappedMs = null
                                    }
                                    onMoveLayerStart(block.trackType, block.itemId, snapped)
                                }
                                MultiDragMode.TRIM_LEFT -> {
                                    val block = targetBlock ?: return@detectHorizontalDragGestures
                                    val deltaMs = ((cumulativePx / pps) * 1000f).toLong()
                                    if (block.trackType == TrackType.VIDEO || block.trackType == TrackType.AUDIO) {
                                        val nextStart = (origTrimStart + deltaMs).coerceIn(0L, origTrimEnd - 300L)
                                        onTrimItem(block.trackType, block.itemId, nextStart, origTrimEnd)
                                    } else {
                                        val maxStart = block.startMs + block.durationMs - 400L
                                        val nextStart = (origTrimStart + deltaMs).coerceIn(0L, maxStart)
                                        val nextDur = (origTrimStart + origTrimEnd - nextStart).coerceAtLeast(400L)
                                        onTrimItem(block.trackType, block.itemId, nextStart, nextDur)
                                    }
                                }
                                MultiDragMode.TRIM_RIGHT -> {
                                    val block = targetBlock ?: return@detectHorizontalDragGestures
                                    val deltaMs = ((cumulativePx / pps) * 1000f).toLong()
                                    if (block.trackType == TrackType.VIDEO || block.trackType == TrackType.AUDIO) {
                                        val nextEnd = (origTrimEnd + deltaMs).coerceIn(origTrimStart + 300L, block.maxSourceMs)
                                        onTrimItem(block.trackType, block.itemId, origTrimStart, nextEnd)
                                    } else {
                                        val nextDur = (origTrimEnd + deltaMs).coerceIn(400L, 60_000L)
                                        onTrimItem(block.trackType, block.itemId, origTrimStart, nextDur)
                                    }
                                }
                            }
                        }
                    )
                }
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val centerX = size.width / 2f
                val playheadPx = (globalPositionMs / 1000f) * pxPerSec
                val shiftX = centerX - playheadPx

                // Time Ruler
                val visibleStartSec = ((playheadPx - centerX) / pxPerSec).toInt().coerceAtLeast(0)
                val visibleEndSec = ceil(((playheadPx + centerX) / pxPerSec).toDouble()).toInt()
                    .coerceAtLeast(visibleStartSec + 1)

                for (sec in visibleStartSec..visibleEndSec) {
                    val x = sec * pxPerSec + shiftX
                    drawLine(
                        color = Color(0xFF2C3446),
                        start = Offset(x, 12f),
                        end = Offset(x, rulerHeightPx - 2f),
                        strokeWidth = 2f
                    )
                    val label = String.format(Locale.US, "%02d:%02d", sec / 60, sec % 60)
                    drawText(
                        textMeasurer = textMeasurer,
                        text = label,
                        topLeft = Offset(x + 4f, 1f),
                        style = TextStyle(
                            color = Color(0xFF7D879B),
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    )
                }

                // Track lane backgrounds + subtle labels
                TrackType.entries.forEach { track ->
                    val (topY, _) = yRangeForTrack(track)
                    drawRoundRect(
                        color = Color(0xFF07090F),
                        topLeft = Offset(0f, topY),
                        size = Size(size.width, laneHeightPx),
                        cornerRadius = CornerRadius(8f, 8f)
                    )
                }

                // Blocks across all 4 tracks
                blocks.forEach { block ->
                    val drawLeft = (block.startMs / 1000f) * pxPerSec + shiftX
                    val widthPx = ((block.durationMs / 1000f) * pxPerSec).coerceAtLeast(28f)
                    if (drawLeft + widthPx < -40f || drawLeft > size.width + 40f) return@forEach

                    val (topY, _) = yRangeForTrack(block.trackType)
                    val isSelected = selection?.itemId == block.itemId || block.itemId in multiSelectedIds

                    drawRoundRect(
                        color = block.baseColor,
                        topLeft = Offset(drawLeft, topY),
                        size = Size(widthPx, laneHeightPx),
                        cornerRadius = CornerRadius(10f, 10f)
                    )

                    if (block.trackType == TrackType.AUDIO && widthPx > 32f) {
                        var wx = drawLeft + 10f
                        var barIdx = 0
                        while (wx < drawLeft + widthPx - 10f) {
                            val barH = if (barIdx % 3 == 0) laneHeightPx * 0.52f else laneHeightPx * 0.3f
                            val barTop = topY + (laneHeightPx - barH) / 2f
                            drawLine(
                                color = block.accentColor.copy(alpha = 0.35f),
                                start = Offset(wx, barTop),
                                end = Offset(wx, barTop + barH),
                                strokeWidth = 3f
                            )
                            wx += 10f
                            barIdx++
                        }
                    }

                    drawRoundRect(
                        color = if (isSelected) block.accentColor else Color(0xFF283044),
                        topLeft = Offset(drawLeft, topY),
                        size = Size(widthPx, laneHeightPx),
                        cornerRadius = CornerRadius(10f, 10f),
                        style = Stroke(width = if (isSelected) 3.5f else 1.5f)
                    )

                    if (widthPx > 60f) {
                        val minX = drawLeft + 8f
                        val maxX = (drawLeft + widthPx - 58f).coerceAtLeast(minX)
                        val textX = 8f.coerceIn(minX, maxX)
                        drawText(
                            textMeasurer = textMeasurer,
                            text = block.label,
                            topLeft = Offset(textX, topY + (laneHeightPx - 28f) / 2f),
                            style = TextStyle(
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        )
                    }

                    if (selection?.itemId == block.itemId && !isMultiSelectMode) {
                        val handleW = 11f
                        drawRoundRect(
                            color = TG7Colors.NeonCyan,
                            topLeft = Offset(drawLeft - 1f, topY),
                            size = Size(handleW, laneHeightPx),
                            cornerRadius = CornerRadius(5f, 5f)
                        )
                        drawRoundRect(
                            color = TG7Colors.BloodRed,
                            topLeft = Offset(drawLeft + widthPx - handleW + 1f, topY),
                            size = Size(handleW, laneHeightPx),
                            cornerRadius = CornerRadius(5f, 5f)
                        )
                    }
                }

                // Transition Cut Junction Badges on Video Track
                val (videoTopY, _) = yRangeForTrack(TrackType.VIDEO)
                val badgeCy = videoTopY + laneHeightPx / 2f
                val badgeHalf = 11f
                cutJunctions.forEach { j ->
                    val jx = (j.timeMs / 1000f) * pxPerSec + shiftX
                    if (jx < -20f || jx > size.width + 20f) return@forEach
                    val bgColor = if (j.hasTransition) TG7Colors.NeonCyan else Color(0xFF101726)
                    val strokeColor = if (j.hasTransition) Color.White else TG7Colors.NeonCyan
                    drawRoundRect(
                        color = bgColor,
                        topLeft = Offset(jx - badgeHalf, badgeCy - badgeHalf),
                        size = Size(badgeHalf * 2f, badgeHalf * 2f),
                        cornerRadius = CornerRadius(6f, 6f)
                    )
                    drawRoundRect(
                        color = strokeColor,
                        topLeft = Offset(jx - badgeHalf, badgeCy - badgeHalf),
                        size = Size(badgeHalf * 2f, badgeHalf * 2f),
                        cornerRadius = CornerRadius(6f, 6f),
                        style = Stroke(width = 2f)
                    )
                    val glyphColor = if (j.hasTransition) Color.Black else Color.White
                    if (j.hasTransition) {
                        drawLine(
                            color = glyphColor,
                            start = Offset(jx - 4f, badgeCy + 4f),
                            end = Offset(jx + 4f, badgeCy - 4f),
                            strokeWidth = 2.5f
                        )
                    } else {
                        drawLine(
                            color = glyphColor,
                            start = Offset(jx - 4.5f, badgeCy),
                            end = Offset(jx + 4.5f, badgeCy),
                            strokeWidth = 2.2f
                        )
                        drawLine(
                            color = glyphColor,
                            start = Offset(jx, badgeCy - 4.5f),
                            end = Offset(jx, badgeCy + 4.5f),
                            strokeWidth = 2.2f
                        )
                    }
                }

                // Active Snap Guide Line
                activeSnapLineMs?.let { snapMs ->
                    val sx = (snapMs / 1000f) * pxPerSec + shiftX
                    drawLine(
                        color = TG7Colors.NeonCyan.copy(alpha = 0.85f),
                        start = Offset(sx, rulerHeightPx),
                        end = Offset(sx, size.height),
                        strokeWidth = 2.5f
                    )
                }

                // Center Playhead
                drawLine(
                    color = Color.White,
                    start = Offset(centerX, 0f),
                    end = Offset(centerX, size.height),
                    strokeWidth = 3f
                )
                drawCircle(
                    color = TG7Colors.NeonCyan,
                    radius = 4.5f,
                    center = Offset(centerX, 5f)
                )
            }
        }
    }
}
