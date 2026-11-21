package com.tg7.editor.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Diamond
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tg7.editor.engine.anim.KeyframeEngine
import com.tg7.editor.media.MediaPickerHelper
import com.tg7.editor.model.EasingCurve
import com.tg7.editor.model.EditorProject
import com.tg7.editor.model.KeyframeNode
import com.tg7.editor.model.TimelineSelection
import com.tg7.editor.model.TrackType
import com.tg7.editor.ui.theme.TG7Colors
import java.util.Locale
import kotlin.math.abs

private data class KeyframeTargetInfo(
    val trackType: TrackType,
    val itemId: String,
    val title: String,
    val startGlobalMs: Long,
    val durationMs: Long,
    val basePosX: Float,
    val basePosY: Float,
    val baseScale: Float,
    val baseRotationDeg: Float,
    val baseOpacity: Float,
    val keyframes: List<KeyframeNode>
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KeyframeInspectorSheet(
    project: EditorProject,
    selection: TimelineSelection?,
    globalPositionMs: Long,
    onSeekGlobal: (Long) -> Unit,
    onAddOrUpdateKeyframe: (TrackType, String, KeyframeNode) -> Unit,
    onDeleteKeyframe: (TrackType, String, String) -> Unit,
    onDismiss: () -> Unit
) {
    val haptic = LocalHapticFeedback.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val target = remember(project, selection) { resolveTarget(project, selection) }
    var localTimeMs by remember(target?.itemId) {
        val initial = if (target != null) {
            (globalPositionMs - target.startGlobalMs).coerceIn(0L, target.durationMs)
        } else 0L
        mutableLongStateOf(initial)
    }

    val existingNear = remember(target?.keyframes, localTimeMs) {
        target?.keyframes?.minByOrNull { abs(it.timeOffsetMs - localTimeMs) }?.takeIf {
            abs(it.timeOffsetMs - localTimeMs) <= 130L
        }
    }

    val evaluated = remember(target, localTimeMs) {
        if (target == null) null else KeyframeEngine.evaluate(
            keyframes = target.keyframes,
            basePosX = target.basePosX,
            basePosY = target.basePosY,
            baseScale = target.baseScale,
            baseRotationDeg = target.baseRotationDeg,
            baseOpacity = target.baseOpacity,
            localTimeMs = localTimeMs
        )
    }

    var selectedEasing by remember(existingNear?.id) {
        mutableStateOf(existingNear?.easing ?: EasingCurve.EASE_IN_OUT)
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF070A10),
        contentColor = Color.White,
        dragHandle = null
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Rounded.Diamond, contentDescription = null, tint = Color(0xFFFACC15))
                    Column {
                        Text(
                            text = "Keyframe Animation Engine",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            text = target?.let { "${it.title} · ${it.keyframes.size} keyframe(s)" }
                                ?: "Select a Video, Text, or Sticker layer first",
                            color = TG7Colors.TextMuted,
                            fontSize = 11.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                ) {
                    Icon(Icons.Rounded.Close, contentDescription = "Close", tint = Color.White)
                }
            }

            if (target == null || evaluated == null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Tap any Video clip, Text layer, or Sticker on the timeline to animate keyframes.",
                        color = TG7Colors.TextMuted,
                        fontSize = 13.sp
                    )
                }
            } else {
                Spacer(Modifier.height(10.dp))

                // Keyframe Diamond Track + Scrub Slider
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF0D121D))
                        .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(12.dp))
                        .padding(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Local Keyframe Scrub", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text(
                            text = "${MediaPickerHelper.formatDuration(localTimeMs)} / ${MediaPickerHelper.formatDuration(target.durationMs)}",
                            color = TG7Colors.NeonCyan,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp
                        )
                    }

                    Spacer(Modifier.height(6.dp))

                    Canvas(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(22.dp)
                    ) {
                        val yMid = size.height / 2f
                        drawLine(
                            color = Color(0xFF283044),
                            start = Offset(8f, yMid),
                            end = Offset(size.width - 8f, yMid),
                            strokeWidth = 4f,
                            cap = StrokeCap.Round
                        )
                        val durF = target.durationMs.coerceAtLeast(1L).toFloat()
                        target.keyframes.forEach { kf ->
                            val frac = (kf.timeOffsetMs / durF).coerceIn(0f, 1f)
                            val cx = 8f + frac * (size.width - 16f)
                            val isActive = existingNear?.id == kf.id
                            val r = if (isActive) 8f else 6f
                            val diamond = Path().apply {
                                moveTo(cx, yMid - r)
                                lineTo(cx + r, yMid)
                                lineTo(cx, yMid + r)
                                lineTo(cx - r, yMid)
                                close()
                            }
                            drawPath(
                                path = diamond,
                                color = if (isActive) TG7Colors.NeonCyan else Color(0xFFFACC15)
                            )
                        }
                        val headFrac = (localTimeMs / durF).coerceIn(0f, 1f)
                        val hx = 8f + headFrac * (size.width - 16f)
                        drawLine(
                            color = Color.White,
                            start = Offset(hx, 2f),
                            end = Offset(hx, size.height - 2f),
                            strokeWidth = 3f
                        )
                    }

                    Slider(
                        value = localTimeMs.toFloat(),
                        onValueChange = { raw ->
                            val next = raw.toLong().coerceIn(0L, target.durationMs)
                            localTimeMs = next
                            onSeekGlobal(target.startGlobalMs + next)
                        },
                        valueRange = 0f..target.durationMs.coerceAtLeast(300L).toFloat(),
                        colors = SliderDefaults.colors(
                            thumbColor = Color(0xFFFACC15),
                            activeTrackColor = Color(0xFFFACC15),
                            inactiveTrackColor = TG7Colors.BorderSubtle
                        )
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                val node = KeyframeNode(
                                    id = existingNear?.id ?: java.util.UUID.randomUUID().toString(),
                                    timeOffsetMs = existingNear?.timeOffsetMs ?: localTimeMs,
                                    posX = evaluated.posX,
                                    posY = evaluated.posY,
                                    scale = evaluated.scale,
                                    rotationDeg = evaluated.rotationDeg,
                                    opacity = evaluated.opacity,
                                    easing = selectedEasing
                                )
                                onAddOrUpdateKeyframe(target.trackType, target.itemId, node)
                            },
                            modifier = Modifier
                                .weight(1f)
                                .heightIn(min = 48.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFFACC15),
                                contentColor = Color.Black
                            )
                        ) {
                            Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(
                                text = if (existingNear != null) "Update Point" else "Add Keyframe",
                                fontWeight = FontWeight.Black,
                                fontSize = 12.sp
                            )
                        }

                        OutlinedButton(
                            onClick = {
                                val del = existingNear ?: return@OutlinedButton
                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                onDeleteKeyframe(target.trackType, target.itemId, del.id)
                            },
                            enabled = existingNear != null,
                            modifier = Modifier.heightIn(min = 48.dp),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Delete,
                                contentDescription = "Delete",
                                tint = if (existingNear != null) TG7Colors.BloodRed else TG7Colors.TextMuted,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                text = "Remove",
                                color = if (existingNear != null) TG7Colors.BloodRed else TG7Colors.TextMuted,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(Modifier.height(10.dp))

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 310.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Easing Curve", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        EasingCurve.entries.forEach { curve ->
                            val selected = selectedEasing == curve
                            Row(
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 48.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (selected) Color(0xFF0E2530) else Color(0xFF101521))
                                    .border(
                                        width = 1.dp,
                                        color = if (selected) TG7Colors.NeonCyan else TG7Colors.BorderSubtle,
                                        shape = RoundedCornerShape(10.dp)
                                    )
                                    .clickable {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        selectedEasing = curve
                                        if (existingNear != null) {
                                            onAddOrUpdateKeyframe(
                                                target.trackType,
                                                target.itemId,
                                                existingNear.copy(easing = curve)
                                            )
                                        }
                                    }
                                    .padding(horizontal = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Canvas(modifier = Modifier.size(22.dp)) {
                                    val path = Path()
                                    val steps = 12
                                    for (s in 0..steps) {
                                        val tx = s / steps.toFloat()
                                        val ty = curve.evaluate(tx).coerceIn(-0.15f, 1.2f)
                                        val px = tx * size.width
                                        val py = size.height - ty * (size.height * 0.78f) - 2f
                                        if (s == 0) path.moveTo(px, py) else path.lineTo(px, py)
                                    }
                                    drawPath(
                                        path = path,
                                        color = if (selected) TG7Colors.NeonCyan else Color.White,
                                        style = Stroke(width = 3f, cap = StrokeCap.Round)
                                    )
                                }
                                Text(
                                    text = curve.label,
                                    color = if (selected) TG7Colors.NeonCyan else Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    fun commitSliderChange(
                        posX: Float = evaluated.posX,
                        posY: Float = evaluated.posY,
                        scale: Float = evaluated.scale,
                        rot: Float = evaluated.rotationDeg,
                        opacity: Float = evaluated.opacity
                    ) {
                        val node = KeyframeNode(
                            id = existingNear?.id ?: java.util.UUID.randomUUID().toString(),
                            timeOffsetMs = existingNear?.timeOffsetMs ?: localTimeMs,
                            posX = posX,
                            posY = posY,
                            scale = scale,
                            rotationDeg = rot,
                            opacity = opacity,
                            easing = selectedEasing
                        )
                        onAddOrUpdateKeyframe(target.trackType, target.itemId, node)
                    }

                    KeyframePropertySlider(
                        label = "Position X",
                        valueText = String.format(Locale.US, "%+.0f%%", (evaluated.posX - 0.5f) * 200f),
                        value = evaluated.posX,
                        range = 0.05f..0.95f,
                        onChange = { next -> commitSliderChange(posX = next) }
                    )
                    KeyframePropertySlider(
                        label = "Position Y",
                        valueText = String.format(Locale.US, "%+.0f%%", (evaluated.posY - 0.5f) * 200f),
                        value = evaluated.posY,
                        range = 0.05f..0.95f,
                        onChange = { next -> commitSliderChange(posY = next) }
                    )
                    KeyframePropertySlider(
                        label = "Scale",
                        valueText = String.format(Locale.US, "%.2fx", evaluated.scale),
                        value = evaluated.scale,
                        range = 0.25f..3.0f,
                        onChange = { next -> commitSliderChange(scale = next) }
                    )
                    KeyframePropertySlider(
                        label = "Rotation",
                        valueText = "${evaluated.rotationDeg.toInt()}°",
                        value = evaluated.rotationDeg,
                        range = -180f..180f,
                        onChange = { next -> commitSliderChange(rot = next) }
                    )
                    KeyframePropertySlider(
                        label = "Opacity",
                        valueText = "${(evaluated.opacity * 100).toInt()}%",
                        value = evaluated.opacity,
                        range = 0f..1f,
                        onChange = { next -> commitSliderChange(opacity = next) }
                    )
                }
            }

            Spacer(Modifier.height(10.dp))

            Button(
                onClick = onDismiss,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = TG7Colors.NeonCyan,
                    contentColor = Color.Black
                )
            ) {
                Icon(Icons.Rounded.Check, contentDescription = null)
                Spacer(Modifier.width(6.dp))
                Text("Done", fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun KeyframePropertySlider(
    label: String,
    valueText: String,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    onChange: (Float) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xFF0D111C))
            .padding(horizontal = 12.dp, vertical = 4.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Text(
                text = valueText,
                color = TG7Colors.NeonCyan,
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
        }
        Slider(
            value = value.coerceIn(range.start, range.endInclusive),
            onValueChange = onChange,
            valueRange = range,
            colors = SliderDefaults.colors(
                thumbColor = TG7Colors.NeonCyan,
                activeTrackColor = TG7Colors.NeonCyan,
                inactiveTrackColor = TG7Colors.BorderSubtle
            )
        )
    }
}

private fun resolveTarget(project: EditorProject, selection: TimelineSelection?): KeyframeTargetInfo? {
    when (selection?.trackType) {
        TrackType.TEXT -> {
            val layer = project.textLayers.firstOrNull { it.id == selection.itemId } ?: return null
            return KeyframeTargetInfo(
                trackType = TrackType.TEXT,
                itemId = layer.id,
                title = "Text · ${layer.text.take(18)}",
                startGlobalMs = layer.startTimeMs,
                durationMs = layer.durationMs,
                basePosX = layer.posXFraction,
                basePosY = layer.posYFraction,
                baseScale = layer.scale,
                baseRotationDeg = layer.rotationDeg,
                baseOpacity = layer.opacity,
                keyframes = layer.keyframes
            )
        }
        TrackType.STICKER -> {
            val sticker = project.stickerLayers.firstOrNull { it.id == selection.itemId } ?: return null
            return KeyframeTargetInfo(
                trackType = TrackType.STICKER,
                itemId = sticker.id,
                title = "Sticker · ${sticker.label}",
                startGlobalMs = sticker.startTimeMs,
                durationMs = sticker.durationMs,
                basePosX = sticker.posXFraction,
                basePosY = sticker.posYFraction,
                baseScale = sticker.scale,
                baseRotationDeg = sticker.rotationDeg,
                baseOpacity = sticker.opacity,
                keyframes = sticker.keyframes
            )
        }
        else -> {
            val clipId = if (selection?.trackType == TrackType.VIDEO) selection.itemId else project.clips.firstOrNull()?.id
            var acc = 0L
            project.clips.forEach { clip ->
                if (clip.id == clipId) {
                    return KeyframeTargetInfo(
                        trackType = TrackType.VIDEO,
                        itemId = clip.id,
                        title = "Clip · ${clip.displayName.take(18)}",
                        startGlobalMs = acc,
                        durationMs = clip.activeDurationMs,
                        basePosX = 0.5f + clip.panX,
                        basePosY = 0.5f + clip.panY,
                        baseScale = clip.scale,
                        baseRotationDeg = clip.rotationDeg,
                        baseOpacity = clip.opacity,
                        keyframes = clip.keyframes
                    )
                }
                acc += clip.activeDurationMs
            }
            return null
        }
    }
}
