package com.tg7.editor.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.material.icons.automirrored.rounded.RotateRight
import androidx.compose.material.icons.rounded.AutoGraph
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.CropRotate
import androidx.compose.material.icons.rounded.Flip
import androidx.compose.material.icons.rounded.PauseCircle
import androidx.compose.material.icons.rounded.RestartAlt
import androidx.compose.material.icons.rounded.Speed
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
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
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
import com.tg7.editor.media.MediaPickerHelper
import com.tg7.editor.model.BlendModePreset
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.SpeedRampPreset
import com.tg7.editor.model.TimelineClip
import com.tg7.editor.ui.theme.TG7Colors
import java.util.Locale

private val QUICK_SPEEDS = listOf(0.25f, 0.5f, 1.0f, 1.5f, 2.0f, 4.0f, 8.0f)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SpeedAndTransformSheet(
    clip: TimelineClip,
    initialTab: Int = 0,
    onUpdateSpeed: (clipId: String, speed: Float, ramp: SpeedRampPreset) -> Unit,
    onFreezeFrame: (clipId: String) -> Unit,
    onUpdateTransform: (
        clipId: String,
        scale: Float,
        panX: Float,
        panY: Float,
        rotationDeg: Float,
        flipH: Boolean,
        flipV: Boolean,
        opacity: Float,
        blendMode: BlendModePreset
    ) -> Unit,
    onResetTransform: (clipId: String) -> Unit,
    onDismiss: () -> Unit
) {
    val haptic = LocalHapticFeedback.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var activeTab by remember(initialTab) { mutableIntStateOf(initialTab.coerceIn(0, 1)) }

    var speed by remember(clip.id, clip.speed) { mutableFloatStateOf(clip.speed.coerceIn(0.1f, 10f)) }
    var ramp by remember(clip.id, clip.speedRamp) { mutableStateOf(clip.speedRamp) }

    var scale by remember(clip.id, clip.scale) { mutableFloatStateOf(clip.scale.coerceIn(0.4f, 3.0f)) }
    var panX by remember(clip.id, clip.panX) { mutableFloatStateOf(clip.panX.coerceIn(-0.65f, 0.65f)) }
    var panY by remember(clip.id, clip.panY) { mutableFloatStateOf(clip.panY.coerceIn(-0.65f, 0.65f)) }
    var rotation by remember(clip.id, clip.rotationDeg) { mutableFloatStateOf(clip.rotationDeg.coerceIn(-180f, 180f)) }
    var flipH by remember(clip.id, clip.flipHorizontal) { mutableStateOf(clip.flipHorizontal) }
    var flipV by remember(clip.id, clip.flipVertical) { mutableStateOf(clip.flipVertical) }
    var opacity by remember(clip.id, clip.opacity) { mutableFloatStateOf(clip.opacity.coerceIn(0f, 1f)) }
    var blendMode by remember(clip.id, clip.blendMode) { mutableStateOf(clip.blendMode) }

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
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = if (activeTab == 0) "Speed, Ramping & Freeze" else "Transform, Crop & Blend",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = "${clip.displayName} · ${MediaPickerHelper.formatDuration(clip.activeDurationMs)}",
                        color = TG7Colors.TextMuted,
                        fontSize = 11.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                IconButton(
                    onClick = {
                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onDismiss()
                    },
                    modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                ) {
                    Icon(Icons.Rounded.Close, contentDescription = "Close", tint = Color.White)
                }
            }

            Spacer(Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ProSheetTabChip(
                    label = "Speed & Ramp",
                    icon = Icons.Rounded.Speed,
                    selected = activeTab == 0,
                    onClick = { activeTab = 0 },
                    modifier = Modifier.weight(1f)
                )
                ProSheetTabChip(
                    label = "Transform & Blend",
                    icon = Icons.Rounded.CropRotate,
                    selected = activeTab == 1,
                    onClick = { activeTab = 1 },
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(Modifier.height(12.dp))

            if (activeTab == 0) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 420.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Freeze Frame Card
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF0E1422))
                            .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(12.dp))
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Freeze Frame at Playhead",
                                color = Color.White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Captures a crisp PNG still and inserts it onto the timeline.",
                                color = TG7Colors.TextMuted,
                                fontSize = 11.sp
                            )
                        }
                        Spacer(Modifier.width(8.dp))
                        Button(
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                onFreezeFrame(clip.id)
                            },
                            modifier = Modifier.heightIn(min = 48.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = TG7Colors.NeonCyan,
                                contentColor = Color.Black
                            )
                        ) {
                            Icon(Icons.Rounded.PauseCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(5.dp))
                            Text("Freeze", fontWeight = FontWeight.Black, fontSize = 12.sp)
                        }
                    }

                    if (clip.kind == MediaKind.IMAGE) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF151924))
                                .padding(14.dp)
                        ) {
                            Text(
                                text = "Photo clips hold a constant still frame. Use Trim to set duration, or switch to Transform & Blend for Ken Burns keyframes & zoom.",
                                color = TG7Colors.TextMuted,
                                fontSize = 12.sp
                            )
                        }
                    } else {
                        // Normal / Base Speed Slider (0.1x .. 10x)
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF0C101B))
                                .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(12.dp))
                                .padding(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Speed Multiplier", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                Text(
                                    text = String.format(Locale.US, "%.2fx", speed),
                                    color = TG7Colors.NeonCyan,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Black
                                )
                            }
                            Slider(
                                value = speed,
                                onValueChange = { next ->
                                    val snapped = (next * 20f).toInt() / 20f
                                    speed = snapped.coerceIn(0.1f, 10f)
                                    onUpdateSpeed(clip.id, speed, ramp)
                                },
                                valueRange = 0.1f..10.0f,
                                colors = SliderDefaults.colors(
                                    thumbColor = TG7Colors.NeonCyan,
                                    activeTrackColor = TG7Colors.NeonCyan,
                                    inactiveTrackColor = TG7Colors.BorderSubtle
                                )
                            )

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                QUICK_SPEEDS.forEach { preset ->
                                    val isCurrent = kotlin.math.abs(speed - preset) < 0.04f
                                    Box(
                                        modifier = Modifier
                                            .defaultMinSize(minWidth = 52.dp, minHeight = 48.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(if (isCurrent) TG7Colors.NeonCyan else Color(0xFF141A29))
                                            .border(1.dp, if (isCurrent) TG7Colors.NeonCyan else TG7Colors.BorderSubtle, RoundedCornerShape(10.dp))
                                            .clickable {
                                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                                speed = preset
                                                onUpdateSpeed(clip.id, speed, ramp)
                                            }
                                            .padding(horizontal = 12.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "${preset}x",
                                            color = if (isCurrent) Color.Black else Color.White,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }
                            }
                        }

                        // Speed Ramp Presets with Velocity Curves
                        Text(
                            text = "Speed Ramping Curves",
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            SpeedRampPreset.entries.forEach { preset ->
                                val selected = ramp == preset
                                Column(
                                    modifier = Modifier
                                        .width(108.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(if (selected) Color(0xFF0E2530) else Color(0xFF0D121D))
                                        .border(
                                            width = if (selected) 1.5.dp else 1.dp,
                                            color = if (selected) TG7Colors.NeonCyan else TG7Colors.BorderSubtle,
                                            shape = RoundedCornerShape(12.dp)
                                        )
                                        .clickable {
                                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                            ramp = preset
                                            onUpdateSpeed(clip.id, speed, ramp)
                                        }
                                        .padding(10.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Canvas(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(40.dp)
                                    ) {
                                        val w = size.width
                                        val h = size.height
                                        val maxP = 3.2f
                                        fun yFor(v: Float): Float = h - (v.coerceIn(0.1f, maxP) / maxP) * (h - 6f) - 3f

                                        val pts = preset.points
                                        val p0 = Offset(4f, yFor(pts[0]))
                                        val p1 = Offset(w * 0.5f, yFor(pts[1]))
                                        val p2 = Offset(w - 4f, yFor(pts[2]))

                                        val path = Path().apply {
                                            moveTo(p0.x, p0.y)
                                            quadraticBezierTo(w * 0.25f, p0.y, p1.x, p1.y)
                                            quadraticBezierTo(w * 0.75f, p2.y, p2.x, p2.y)
                                        }
                                        drawPath(
                                            path = path,
                                            color = if (selected) TG7Colors.NeonCyan else Color(0xFF6B7A99),
                                            style = Stroke(width = 4f, cap = StrokeCap.Round)
                                        )
                                        drawCircle(TG7Colors.BloodRed, radius = 4f, center = p1)
                                    }
                                    Spacer(Modifier.height(6.dp))
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Rounded.AutoGraph,
                                            contentDescription = null,
                                            tint = if (selected) TG7Colors.NeonCyan else TG7Colors.TextMuted,
                                            modifier = Modifier.size(13.dp)
                                        )
                                        Text(
                                            text = preset.label,
                                            color = if (selected) TG7Colors.NeonCyan else Color.White,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                // Tab 1: Transform, Crop/Zoom, Rotate, Flip H/V, Opacity, Blend Mode
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 420.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    TransformSliderRow(
                        label = "Zoom / Crop",
                        valueText = String.format(Locale.US, "%.2fx", scale),
                        value = scale,
                        range = 0.4f..3.0f,
                        onChange = { next ->
                            scale = next
                            onUpdateTransform(clip.id, scale, panX, panY, rotation, flipH, flipV, opacity, blendMode)
                        }
                    )
                    TransformSliderRow(
                        label = "Pan Horizontal",
                        valueText = String.format(Locale.US, "%+.0f%%", panX * 100f),
                        value = panX,
                        range = -0.65f..0.65f,
                        onChange = { next ->
                            panX = next
                            onUpdateTransform(clip.id, scale, panX, panY, rotation, flipH, flipV, opacity, blendMode)
                        }
                    )
                    TransformSliderRow(
                        label = "Pan Vertical",
                        valueText = String.format(Locale.US, "%+.0f%%", panY * 100f),
                        value = panY,
                        range = -0.65f..0.65f,
                        onChange = { next ->
                            panY = next
                            onUpdateTransform(clip.id, scale, panX, panY, rotation, flipH, flipV, opacity, blendMode)
                        }
                    )
                    TransformSliderRow(
                        label = "Rotation",
                        valueText = "${rotation.toInt()}°",
                        value = rotation,
                        range = -180f..180f,
                        onChange = { next ->
                            rotation = next
                            onUpdateTransform(clip.id, scale, panX, panY, rotation, flipH, flipV, opacity, blendMode)
                        }
                    )
                    TransformSliderRow(
                        label = "Opacity",
                        valueText = "${(opacity * 100).toInt()}%",
                        value = opacity,
                        range = 0f..1f,
                        onChange = { next ->
                            opacity = next
                            onUpdateTransform(clip.id, scale, panX, panY, rotation, flipH, flipV, opacity, blendMode)
                        }
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        ToggleTransformButton(
                            icon = Icons.AutoMirrored.Rounded.RotateRight,
                            label = "+90°",
                            active = false,
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                val nextRot = ((rotation + 90f + 180f) % 360f) - 180f
                                rotation = nextRot
                                onUpdateTransform(clip.id, scale, panX, panY, rotation, flipH, flipV, opacity, blendMode)
                            },
                            modifier = Modifier.weight(1f)
                        )
                        ToggleTransformButton(
                            icon = Icons.Rounded.Flip,
                            label = "Flip H",
                            active = flipH,
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                flipH = !flipH
                                onUpdateTransform(clip.id, scale, panX, panY, rotation, flipH, flipV, opacity, blendMode)
                            },
                            modifier = Modifier.weight(1f)
                        )
                        ToggleTransformButton(
                            icon = Icons.Rounded.Flip,
                            label = "Flip V",
                            active = flipV,
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                flipV = !flipV
                                onUpdateTransform(clip.id, scale, panX, panY, rotation, flipH, flipV, opacity, blendMode)
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Text("GPU Blend Mode", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        BlendModePreset.entries.forEach { preset ->
                            val selected = blendMode == preset
                            Box(
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 48.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (selected) TG7Colors.NeonCyan else Color(0xFF121725))
                                    .border(1.dp, if (selected) TG7Colors.NeonCyan else TG7Colors.BorderSubtle, RoundedCornerShape(10.dp))
                                    .clickable {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        blendMode = preset
                                        onUpdateTransform(clip.id, scale, panX, panY, rotation, flipH, flipV, opacity, blendMode)
                                    }
                                    .padding(horizontal = 14.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = preset.label,
                                    color = if (selected) Color.Black else Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    OutlinedButton(
                        onClick = {
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            scale = 1f
                            panX = 0f
                            panY = 0f
                            rotation = 0f
                            flipH = false
                            flipV = false
                            opacity = 1f
                            blendMode = BlendModePreset.NORMAL
                            onResetTransform(clip.id)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Rounded.RestartAlt, contentDescription = null, tint = TG7Colors.BloodRed)
                        Spacer(Modifier.width(6.dp))
                        Text("Reset Transform & Blend", color = TG7Colors.BloodRed, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(Modifier.height(10.dp))

            Button(
                onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onDismiss()
                },
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
private fun ProSheetTabChip(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .defaultMinSize(minHeight = 48.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) Color(0xFF0E2530) else Color(0xFF10141F))
            .border(1.dp, if (selected) TG7Colors.NeonCyan else TG7Colors.BorderSubtle, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Icon(icon, contentDescription = null, tint = if (selected) TG7Colors.NeonCyan else TG7Colors.TextMuted, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(6.dp))
        Text(
            text = label,
            color = if (selected) TG7Colors.NeonCyan else Color.White,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun TransformSliderRow(
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
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Text(
                text = valueText,
                color = TG7Colors.NeonCyan,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
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

@Composable
private fun ToggleTransformButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    active: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .defaultMinSize(minHeight = 48.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (active) Color(0xFF0E2530) else Color(0xFF121725))
            .border(1.dp, if (active) TG7Colors.NeonCyan else TG7Colors.BorderSubtle, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = if (active) TG7Colors.NeonCyan else Color.White,
            modifier = Modifier.size(16.dp)
        )
        Spacer(Modifier.width(5.dp))
        Text(
            text = label,
            color = if (active) TG7Colors.NeonCyan else Color.White,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold
        )
    }
}
