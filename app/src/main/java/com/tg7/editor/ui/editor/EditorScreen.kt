package com.tg7.editor.ui.editor

import android.content.res.Configuration
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.displayCutoutPadding
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AspectRatio
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ContentCut
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Fullscreen
import androidx.compose.material.icons.rounded.FullscreenExit
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.RangeSlider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.tg7.editor.engine.player.StudioPlayerController
import com.tg7.editor.media.MediaPickerHelper
import com.tg7.editor.model.CanvasAspectRatio
import com.tg7.editor.model.EditorProject
import com.tg7.editor.model.ExportResolution
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.TimelineClip
import com.tg7.editor.ui.components.TG7DockToolButton
import com.tg7.editor.ui.components.TimelineCanvasStrip
import com.tg7.editor.ui.theme.TG7Colors

@Composable
fun EditorScreen(
    project: EditorProject,
    playerController: StudioPlayerController,
    isPlaying: Boolean,
    globalPositionMs: Long,
    selectedClipId: String?,
    exportResolution: ExportResolution,
    showTrimPanel: Boolean,
    isFullscreenPreview: Boolean,
    playerError: String?,
    bannerMessage: String?,
    onBack: () -> Unit,
    onExportClick: () -> Unit,
    onTogglePlay: () -> Unit,
    onSeek: (Long) -> Unit,
    onSelectClip: (String) -> Unit,
    onTrimClip: (clipId: String, trimStartMs: Long, trimEndMs: Long) -> Unit,
    onSplitAtPlayhead: () -> Unit,
    onDeleteSelected: () -> Unit,
    onToggleTrimPanel: () -> Unit,
    onCycleAspectRatio: () -> Unit,
    onAddMediaClick: () -> Unit,
    onToggleFullscreen: () -> Unit,
    onDismissError: () -> Unit
) {
    val haptic = LocalHapticFeedback.current
    val isLandscape = LocalConfiguration.current.orientation == Configuration.ORIENTATION_LANDSCAPE
    var showFullscreenHud by remember(isFullscreenPreview) { mutableStateOf(true) }
    val selectedClip = project.clips.firstOrNull { it.id == selectedClipId } ?: project.clips.firstOrNull()

    if (isFullscreenPreview) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
                .clickable { showFullscreenHud = !showFullscreenHud }
        ) {
            AspectPreviewStage(
                aspectRatio = project.aspectRatio,
                playerController = playerController,
                modifier = Modifier.fillMaxSize()
            )
            if (showFullscreenHud) {
                Row(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .statusBarsPadding()
                        .displayCutoutPadding()
                        .padding(14.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                            .clip(RoundedCornerShape(24.dp))
                            .background(Color.Black.copy(alpha = 0.72f))
                            .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(24.dp))
                            .clickable {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                onToggleFullscreen()
                            }
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.FullscreenExit,
                            contentDescription = "Exit fullscreen",
                            tint = TG7Colors.NeonCyan,
                            modifier = Modifier.size(20.dp)
                        )
                        Text("Exit", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Row(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .navigationBarsPadding()
                        .padding(bottom = 22.dp)
                        .background(Color.Black.copy(alpha = 0.78f), RoundedCornerShape(28.dp))
                        .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(28.dp))
                        .padding(horizontal = 14.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .clickable {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                onTogglePlay()
                            }
                            .padding(horizontal = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                            contentDescription = if (isPlaying) "Pause" else "Play",
                            tint = TG7Colors.NeonCyan
                        )
                        Text(
                            text = if (isPlaying) "Pause" else "Play",
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Text(
                        text = "${MediaPickerHelper.formatDuration(globalPositionMs)} / ${MediaPickerHelper.formatDuration(project.totalDurationMs)}",
                        color = TG7Colors.NeonCyan,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp
                    )
                }
            }
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(TG7Colors.Black)
            .statusBarsPadding()
            .displayCutoutPadding()
            .navigationBarsPadding()
    ) {
        // Safe-Area Top Bar (all buttons >= 48dp touch height with icon + text)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .background(Color(0xFF06080D))
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier
                    .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .clickable {
                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onBack()
                    }
                    .padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                    contentDescription = "Projects",
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = "Home",
                    color = Color.White,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Text(
                text = project.name,
                color = TG7Colors.TextMuted,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp)
            )

            Button(
                onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    onExportClick()
                },
                modifier = Modifier.heightIn(min = 48.dp),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = TG7Colors.NeonCyan,
                    contentColor = Color.Black
                )
            ) {
                Icon(Icons.Rounded.Download, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(6.dp))
                Text("Export ${exportResolution.label}", fontWeight = FontWeight.Black, fontSize = 12.sp)
            }
        }

        val activeAlert = playerError ?: bannerMessage
        if (activeAlert != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0x2EFF1030))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = activeAlert,
                    color = Color(0xFFFF98A6),
                    fontSize = 12.sp,
                    modifier = Modifier.weight(1f)
                )
                Row(
                    modifier = Modifier
                        .defaultMinSize(minHeight = 48.dp)
                        .clickable {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            onDismissError()
                        }
                        .padding(horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(Icons.Rounded.Close, contentDescription = null, tint = TG7Colors.NeonCyan, modifier = Modifier.size(16.dp))
                    Text("Close", color = TG7Colors.NeonCyan, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (isLandscape) {
            Row(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                Box(
                    modifier = Modifier
                        .weight(1.1f)
                        .fillMaxHeight()
                        .background(Color.Black)
                        .padding(6.dp)
                ) {
                    AspectPreviewStage(
                        aspectRatio = project.aspectRatio,
                        playerController = playerController,
                        modifier = Modifier.fillMaxSize()
                    )
                    FloatingAddMediaButton(
                        onClick = onAddMediaClick,
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(8.dp)
                    )
                }

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .padding(horizontal = 8.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    TransportControlsRow(
                        isPlaying = isPlaying,
                        aspectLabel = project.aspectRatio.label,
                        globalPositionMs = globalPositionMs,
                        totalDurationMs = project.totalDurationMs,
                        onTogglePlay = onTogglePlay,
                        onToggleFullscreen = onToggleFullscreen
                    )
                    if (showTrimPanel && selectedClip != null) {
                        TrimFineControls(clip = selectedClip, onTrimClip = onTrimClip)
                    }
                    TimelineCanvasStrip(
                        clips = project.clips,
                        selectedClipId = selectedClipId,
                        globalPositionMs = globalPositionMs,
                        totalDurationMs = project.totalDurationMs,
                        onSeek = onSeek,
                        onSelectClip = onSelectClip,
                        onTrimClip = onTrimClip
                    )
                    ScrollableBottomToolDock(
                        aspectLabel = project.aspectRatio.label,
                        trimActive = showTrimPanel,
                        onAddMedia = onAddMediaClick,
                        onTrimToggle = onToggleTrimPanel,
                        onSplit = onSplitAtPlayhead,
                        onCycleRatio = onCycleAspectRatio,
                        onFullscreen = onToggleFullscreen,
                        onDelete = onDeleteSelected
                    )
                }
            }
        } else {
            // Portrait: Large Preview Stage + Floating "+" button
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .background(Color.Black)
                    .padding(horizontal = 10.dp, vertical = 6.dp)
            ) {
                AspectPreviewStage(
                    aspectRatio = project.aspectRatio,
                    playerController = playerController,
                    modifier = Modifier.fillMaxSize()
                )
                FloatingAddMediaButton(
                    onClick = onAddMediaClick,
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(6.dp)
                )
            }

            TransportControlsRow(
                isPlaying = isPlaying,
                aspectLabel = project.aspectRatio.label,
                globalPositionMs = globalPositionMs,
                totalDurationMs = project.totalDurationMs,
                onTogglePlay = onTogglePlay,
                onToggleFullscreen = onToggleFullscreen
            )

            if (showTrimPanel && selectedClip != null) {
                TrimFineControls(clip = selectedClip, onTrimClip = onTrimClip)
            }

            Box(modifier = Modifier.padding(horizontal = 8.dp)) {
                TimelineCanvasStrip(
                    clips = project.clips,
                    selectedClipId = selectedClipId,
                    globalPositionMs = globalPositionMs,
                    totalDurationMs = project.totalDurationMs,
                    onSeek = onSeek,
                    onSelectClip = onSelectClip,
                    onTrimClip = onTrimClip
                )
            }

            Spacer(Modifier.height(6.dp))

            ScrollableBottomToolDock(
                aspectLabel = project.aspectRatio.label,
                trimActive = showTrimPanel,
                onAddMedia = onAddMediaClick,
                onTrimToggle = onToggleTrimPanel,
                onSplit = onSplitAtPlayhead,
                onCycleRatio = onCycleAspectRatio,
                onFullscreen = onToggleFullscreen,
                onDelete = onDeleteSelected
            )
        }
    }
}

@Composable
private fun AspectPreviewStage(
    aspectRatio: CanvasAspectRatio,
    playerController: StudioPlayerController,
    modifier: Modifier = Modifier
) {
    BoxWithConstraints(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        val boxRatio = if (maxHeight > 0.dp) maxWidth / maxHeight else 1f
        val sizeModifier = if (boxRatio > aspectRatio.ratio) {
            Modifier
                .fillMaxHeight()
                .aspectRatio(aspectRatio.ratio)
        } else {
            Modifier
                .fillMaxWidth()
                .aspectRatio(aspectRatio.ratio)
        }

        Box(
            modifier = sizeModifier
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFF040508))
                .border(1.dp, Color(0xFF1A202E), RoundedCornerShape(12.dp))
        ) {
            NativeVideoSurface(
                playerController = playerController,
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

@Composable
private fun FloatingAddMediaButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val haptic = LocalHapticFeedback.current
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.90f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMedium
        ),
        label = "fabScale"
    )

    FloatingActionButton(
        onClick = {
            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
            onClick()
        },
        interactionSource = interaction,
        modifier = modifier
            .scale(scale)
            .heightIn(min = 48.dp),
        shape = RoundedCornerShape(16.dp),
        containerColor = TG7Colors.NeonCyan,
        contentColor = Color.Black,
        elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 8.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(Icons.Rounded.Add, contentDescription = "Add clip", modifier = Modifier.size(20.dp))
            Text("Add", fontSize = 12.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
private fun NativeVideoSurface(
    playerController: StudioPlayerController,
    modifier: Modifier = Modifier
) {
    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                useController = false
                setShutterBackgroundColor(android.graphics.Color.BLACK)
                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                player = playerController.player
            }
        },
        update = { view ->
            if (view.player !== playerController.player) {
                view.player = playerController.player
            }
        },
        onRelease = { view ->
            view.player = null
        },
        modifier = modifier
    )
}

@Composable
private fun TransportControlsRow(
    isPlaying: Boolean,
    aspectLabel: String,
    globalPositionMs: Long,
    totalDurationMs: Long,
    onTogglePlay: () -> Unit,
    onToggleFullscreen: () -> Unit
) {
    val haptic = LocalHapticFeedback.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF06080D))
            .padding(horizontal = 12.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = "${MediaPickerHelper.formatDuration(globalPositionMs)} / ${MediaPickerHelper.formatDuration(totalDurationMs)}",
            color = Color.White,
            fontSize = 12.sp,
            fontFamily = FontFamily.Monospace
        )

        Row(
            modifier = Modifier
                .defaultMinSize(minWidth = 84.dp, minHeight = 48.dp)
                .clip(CircleShape)
                .background(Color.White)
                .clickable {
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onTogglePlay()
                }
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(
                imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                contentDescription = if (isPlaying) "Pause" else "Play",
                tint = Color.Black,
                modifier = Modifier.size(20.dp)
            )
            Text(
                text = if (isPlaying) "Pause" else "Play",
                color = Color.Black,
                fontSize = 12.sp,
                fontWeight = FontWeight.Black
            )
        }

        Row(
            modifier = Modifier
                .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                .clip(RoundedCornerShape(10.dp))
                .clickable {
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onToggleFullscreen()
                }
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(
                imageVector = Icons.Rounded.Fullscreen,
                contentDescription = "Fullscreen",
                tint = TG7Colors.NeonCyan,
                modifier = Modifier.size(20.dp)
            )
            Text(
                text = aspectLabel,
                color = TG7Colors.NeonCyan,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun TrimFineControls(
    clip: TimelineClip,
    onTrimClip: (clipId: String, trimStartMs: Long, trimEndMs: Long) -> Unit
) {
    val maxRangeMs = if (clip.kind == MediaKind.IMAGE) 15_000f else clip.sourceDurationMs.toFloat().coerceAtLeast(300f)
    val startF = clip.trimStartMs.toFloat().coerceIn(0f, maxRangeMs - 300f)
    val endF = clip.trimEndMs.toFloat().coerceIn(startF + 300f, maxRangeMs)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 10.dp, vertical = 4.dp)
            .background(TG7Colors.GlassSurface, RoundedCornerShape(12.dp))
            .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Trim: ${clip.displayName}",
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = "${MediaPickerHelper.formatDuration(clip.trimStartMs)} – ${MediaPickerHelper.formatDuration(clip.trimEndMs)}",
                color = TG7Colors.NeonCyan,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace
            )
        }
        RangeSlider(
            value = startF..endF,
            onValueChange = { range ->
                val s = range.start.toLong()
                val e = range.endInclusive.toLong().coerceAtLeast(s + 300L)
                onTrimClip(clip.id, s, e)
            },
            valueRange = 0f..maxRangeMs,
            colors = SliderDefaults.colors(
                thumbColor = TG7Colors.NeonCyan,
                activeTrackColor = TG7Colors.NeonCyan,
                inactiveTrackColor = TG7Colors.BorderSubtle
            )
        )
    }
}

@Composable
private fun ScrollableBottomToolDock(
    aspectLabel: String,
    trimActive: Boolean,
    onAddMedia: () -> Unit,
    onTrimToggle: () -> Unit,
    onSplit: () -> Unit,
    onCycleRatio: () -> Unit,
    onFullscreen: () -> Unit,
    onDelete: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF06080D))
            .border(1.dp, Color(0xFF161A25))
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        TG7DockToolButton(
            icon = Icons.Rounded.Add,
            label = "Add Clips",
            tint = TG7Colors.NeonCyan,
            active = false,
            onClick = onAddMedia
        )
        TG7DockToolButton(
            icon = Icons.Rounded.Tune,
            label = "Trim",
            tint = if (trimActive) TG7Colors.NeonCyan else Color.White,
            active = trimActive,
            onClick = onTrimToggle
        )
        TG7DockToolButton(
            icon = Icons.Rounded.ContentCut,
            label = "Split",
            tint = Color.White,
            active = false,
            onClick = onSplit
        )
        TG7DockToolButton(
            icon = Icons.Rounded.AspectRatio,
            label = "Ratio $aspectLabel",
            tint = TG7Colors.NeonCyan,
            active = false,
            onClick = onCycleRatio
        )
        TG7DockToolButton(
            icon = Icons.Rounded.Fullscreen,
            label = "Fullscreen",
            tint = Color.White,
            active = false,
            onClick = onFullscreen
        )
        TG7DockToolButton(
            icon = Icons.Rounded.Delete,
            label = "Delete",
            tint = TG7Colors.BloodRed,
            active = false,
            onClick = onDelete
        )
    }
}
