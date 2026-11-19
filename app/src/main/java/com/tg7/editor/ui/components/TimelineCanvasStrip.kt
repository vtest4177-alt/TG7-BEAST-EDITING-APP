package com.tg7.editor.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.TimelineClip
import com.tg7.editor.ui.theme.TG7Colors
import java.util.Locale
import kotlin.math.ceil

private enum class TimelineDragTarget {
    SCRUB,
    TRIM_LEFT,
    TRIM_RIGHT
}

@Composable
fun TimelineCanvasStrip(
    clips: List<TimelineClip>,
    selectedClipId: String?,
    globalPositionMs: Long,
    totalDurationMs: Long,
    onSeek: (Long) -> Unit,
    onSelectClip: (String) -> Unit,
    onTrimClip: (clipId: String, trimStartMs: Long, trimEndMs: Long) -> Unit,
    modifier: Modifier = Modifier
) {
    val density = LocalDensity.current
    val haptic = LocalHapticFeedback.current
    val pxPerSec = with(density) { 78.dp.toPx() }
    val handleHitPx = with(density) { 26.dp.toPx() }
    val trackTopPx = with(density) { 26.dp.toPx() }
    val trackHeightPx = with(density) { 64.dp.toPx() }

    val textMeasurer = rememberTextMeasurer()

    val currentSelectedId by rememberUpdatedState(selectedClipId)
    val currentGlobalPos by rememberUpdatedState(globalPositionMs)
    val currentTotalDur by rememberUpdatedState(totalDurationMs)

    val clipLayouts = remember(clips, pxPerSec) {
        var accMs = 0L
        clips.map { clip ->
            val startPx = (accMs / 1000f) * pxPerSec
            val widthPx = ((clip.activeDurationMs / 1000f) * pxPerSec).coerceAtLeast(30f)
            val entry = Triple(clip, startPx, widthPx)
            accMs += clip.activeDurationMs
            entry
        }
    }
    val currentClipLayouts by rememberUpdatedState(clipLayouts)

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
                .padding(horizontal = 12.dp, vertical = 2.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "VIDEO TRACK · ${clips.size} CLIP${if (clips.size == 1) "" else "S"}",
                color = TG7Colors.TextMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
            Text(
                text = "Drag handles to trim · Swipe to scrub",
                color = Color(0xFF6B7280),
                fontSize = 10.sp
            )
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(102.dp)
                .pointerInput(pxPerSec) {
                    detectTapGestures { offset ->
                        val layouts = currentClipLayouts
                        val centerX = size.width / 2f
                        val playheadPx = (currentGlobalPos / 1000f) * pxPerSec
                        val worldX = offset.x - centerX + playheadPx
                        val tapped = layouts.firstOrNull { (_, startPx, widthPx) ->
                            worldX >= startPx && worldX <= startPx + widthPx
                        }
                        if (tapped != null) {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            onSelectClip(tapped.first.id)
                        }
                        val tappedMs = ((worldX / pxPerSec) * 1000f).toLong()
                            .coerceIn(0L, currentTotalDur)
                        onSeek(tappedMs)
                    }
                }
                .pointerInput(pxPerSec) {
                    var dragTarget = TimelineDragTarget.SCRUB
                    var dragClip: TimelineClip? = null
                    var origTrimStart = 0L
                    var origTrimEnd = 0L
                    var scrubStartMs = 0L
                    var cumulativeDragPx = 0f

                    detectHorizontalDragGestures(
                        onDragStart = { startOffset ->
                            val layouts = currentClipLayouts
                            val centerX = size.width / 2f
                            val playheadPx = (currentGlobalPos / 1000f) * pxPerSec
                            val worldX = startOffset.x - centerX + playheadPx
                            cumulativeDragPx = 0f
                            scrubStartMs = currentGlobalPos

                            val selEntry = layouts.firstOrNull { it.first.id == currentSelectedId }
                            if (selEntry != null && startOffset.y >= trackTopPx) {
                                val (clip, startPx, widthPx) = selEntry
                                val endPx = startPx + widthPx
                                when {
                                    kotlin.math.abs(worldX - startPx) <= handleHitPx -> {
                                        dragTarget = TimelineDragTarget.TRIM_LEFT
                                        dragClip = clip
                                        origTrimStart = clip.trimStartMs
                                        origTrimEnd = clip.trimEndMs
                                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    }
                                    kotlin.math.abs(worldX - endPx) <= handleHitPx -> {
                                        dragTarget = TimelineDragTarget.TRIM_RIGHT
                                        dragClip = clip
                                        origTrimStart = clip.trimStartMs
                                        origTrimEnd = clip.trimEndMs
                                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    }
                                    else -> {
                                        dragTarget = TimelineDragTarget.SCRUB
                                        dragClip = null
                                    }
                                }
                            } else {
                                dragTarget = TimelineDragTarget.SCRUB
                                dragClip = null
                            }
                        },
                        onHorizontalDrag = { _, dragAmount ->
                            cumulativeDragPx += dragAmount
                            when (dragTarget) {
                                TimelineDragTarget.SCRUB -> {
                                    val deltaMs = ((-cumulativeDragPx / pxPerSec) * 1000f).toLong()
                                    val nextMs = (scrubStartMs + deltaMs)
                                        .coerceIn(0L, currentTotalDur)
                                    onSeek(nextMs)
                                }
                                TimelineDragTarget.TRIM_LEFT -> {
                                    val c = dragClip ?: return@detectHorizontalDragGestures
                                    val deltaMs = ((cumulativeDragPx / pxPerSec) * 1000f).toLong()
                                    val minStart = 0L
                                    val maxStart = origTrimEnd - 300L
                                    val nextStart = (origTrimStart + deltaMs).coerceIn(minStart, maxStart)
                                    onTrimClip(c.id, nextStart, origTrimEnd)
                                }
                                TimelineDragTarget.TRIM_RIGHT -> {
                                    val c = dragClip ?: return@detectHorizontalDragGestures
                                    val deltaMs = ((cumulativeDragPx / pxPerSec) * 1000f).toLong()
                                    val maxEnd = if (c.kind == MediaKind.IMAGE) 30_000L else c.sourceDurationMs
                                    val minEnd = origTrimStart + 300L
                                    val nextEnd = (origTrimEnd + deltaMs).coerceIn(minEnd, maxEnd)
                                    onTrimClip(c.id, origTrimStart, nextEnd)
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

                val visibleStartSec = ((playheadPx - centerX) / pxPerSec).toInt().coerceAtLeast(0)
                val visibleEndSec = ceil(((playheadPx + centerX) / pxPerSec).toDouble()).toInt()
                    .coerceAtLeast(visibleStartSec + 1)

                for (sec in visibleStartSec..visibleEndSec) {
                    val x = sec * pxPerSec + shiftX
                    drawLine(
                        color = Color(0xFF2B3242),
                        start = Offset(x, 12f),
                        end = Offset(x, 22f),
                        strokeWidth = 2f
                    )
                    val label = String.format(Locale.US, "%02d:%02d", sec / 60, sec % 60)
                    drawText(
                        textMeasurer = textMeasurer,
                        text = label,
                        topLeft = Offset(x + 4f, 0f),
                        style = TextStyle(
                            color = Color(0xFF818A9E),
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    )
                }

                clipLayouts.forEach { (clip, startPx, widthPx) ->
                    val drawLeft = startPx + shiftX
                    if (drawLeft + widthPx < -40f || drawLeft > size.width + 40f) return@forEach

                    val isSelected = clip.id == selectedClipId
                    val blockColor = if (clip.kind == MediaKind.VIDEO) {
                        Color(0xFF10202C)
                    } else {
                        Color(0xFF24111E)
                    }

                    drawRoundRect(
                        color = blockColor,
                        topLeft = Offset(drawLeft, trackTopPx),
                        size = Size(widthPx, trackHeightPx),
                        cornerRadius = CornerRadius(12f, 12f)
                    )

                    val tileStep = 44f
                    var tx = drawLeft + tileStep
                    while (tx < drawLeft + widthPx - 8f) {
                        drawLine(
                            color = Color.White.copy(alpha = 0.08f),
                            start = Offset(tx, trackTopPx + 5f),
                            end = Offset(tx, trackTopPx + trackHeightPx - 5f),
                            strokeWidth = 1.5f
                        )
                        tx += tileStep
                    }

                    drawRoundRect(
                        color = if (isSelected) TG7Colors.NeonCyan else Color(0xFF2B3448),
                        topLeft = Offset(drawLeft, trackTopPx),
                        size = Size(widthPx, trackHeightPx),
                        cornerRadius = CornerRadius(12f, 12f),
                        style = Stroke(width = if (isSelected) 4f else 2f)
                    )

                    if (widthPx > 68f) {
                        val minX = drawLeft + 10f
                        val maxX = (drawLeft + widthPx - 72f).coerceAtLeast(minX)
                        val textX = 8f.coerceIn(minX, maxX)
                        drawText(
                            textMeasurer = textMeasurer,
                            text = clip.displayName.take(14),
                            topLeft = Offset(textX, trackTopPx + 9f),
                            style = TextStyle(
                                color = Color.White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        )
                        drawText(
                            textMeasurer = textMeasurer,
                            text = MediaPickerHelper.formatDuration(clip.activeDurationMs),
                            topLeft = Offset(textX, trackTopPx + 27f),
                            style = TextStyle(
                                color = TG7Colors.NeonCyan,
                                fontSize = 10.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        )
                    }

                    if (isSelected) {
                        val handleW = 14f
                        drawRoundRect(
                            color = TG7Colors.NeonCyan,
                            topLeft = Offset(drawLeft - 2f, trackTopPx),
                            size = Size(handleW, trackHeightPx),
                            cornerRadius = CornerRadius(6f, 6f)
                        )
                        drawRoundRect(
                            color = TG7Colors.BloodRed,
                            topLeft = Offset(drawLeft + widthPx - handleW + 2f, trackTopPx),
                            size = Size(handleW, trackHeightPx),
                            cornerRadius = CornerRadius(6f, 6f)
                        )
                    }
                }

                drawLine(
                    color = Color.White,
                    start = Offset(centerX, 0f),
                    end = Offset(centerX, size.height),
                    strokeWidth = 3.5f
                )
                drawCircle(
                    color = TG7Colors.NeonCyan,
                    radius = 5f,
                    center = Offset(centerX, 6f)
                )
            }
        }
    }
}
