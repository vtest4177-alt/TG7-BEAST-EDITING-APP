package com.tg7.editor.ui.editor

import android.content.res.Configuration
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Redo
import androidx.compose.material.icons.automirrored.rounded.Undo
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AspectRatio
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.AutoFixHigh
import androidx.compose.material.icons.rounded.CheckBox
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.ContentCut
import androidx.compose.material.icons.rounded.CropRotate
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.DeleteSweep
import androidx.compose.material.icons.rounded.Diamond
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.EmojiEmotions
import androidx.compose.material.icons.rounded.FilterCenterFocus
import androidx.compose.material.icons.rounded.Fullscreen
import androidx.compose.material.icons.rounded.FullscreenExit
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.TextFields
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.airbnb.lottie.compose.LottieAnimation
import com.airbnb.lottie.compose.LottieCompositionSpec
import com.airbnb.lottie.compose.rememberLottieComposition
import com.tg7.editor.engine.anim.OverlayAnimator
import com.tg7.editor.engine.player.StudioPlayerController
import com.tg7.editor.media.MediaPickerHelper
import com.tg7.editor.model.EditorProject
import com.tg7.editor.model.ExportResolution
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.TimelineClip
import com.tg7.editor.model.TimelineSelection
import com.tg7.editor.model.TrackType
import com.tg7.editor.ui.components.MultiTrackTimeline
import com.tg7.editor.ui.components.TG7DockToolButton
import com.tg7.editor.ui.components.resolveComposeFontFamily
import com.tg7.editor.ui.theme.TG7Colors
import kotlin.math.roundToInt

@Composable
fun EditorScreen(
    project: EditorProject,
    playerController: StudioPlayerController,
    isPlaying: Boolean,
    globalPositionMs: Long,
    selection: TimelineSelection?,
    multiSelectedIds: Set<String>,
    isMultiSelectMode: Boolean,
    timelineZoom: Float,
    canUndo: Boolean,
    canRedo: Boolean,
    exportResolution: ExportResolution,
    showTrimPanel: Boolean,
    isFullscreenPreview: Boolean,
    playerError: String?,
    bannerMessage: String?,
    onBack: () -> Unit,
    onUndo: () -> Unit,
    onRedo: () -> Unit,
    onExportClick: () -> Unit,
    onTogglePlay: () -> Unit,
    onSeek: (Long) -> Unit,
    onSelectItem: (TrackType, String) -> Unit,
    onMoveVideoClip: (Int, Int) -> Unit,
    onMoveLayerStart: (TrackType, String, Long) -> Unit,
    onTrimItem: (TrackType, String, Long, Long) -> Unit,
    onMoveOverlayPosition: (TrackType, String, Float, Float) -> Unit,
    onZoomChange: (Float) -> Unit,
    onSplitAtPlayhead: () -> Unit,
    onDuplicateSelected: () -> Unit,
    onToggleMultiSelect: () -> Unit,
    onDeleteSelected: (ripple: Boolean) -> Unit,
    onToggleTrimPanel: () -> Unit,
    onCycleAspectRatio: () -> Unit,
    onAddMediaClick: () -> Unit,
    onAddAudioClick: () -> Unit,
    onAddTextClick: () -> Unit,
    onAddStickerClick: () -> Unit,
    onOpenTransitionPicker: (cutIndex: Int) -> Unit,
    onOpenTransitionsDock: () -> Unit,
    onOpenEffectsDock: () -> Unit,
    onOpenChromaDock: () -> Unit,
    onOpenSpeedDock: () -> Unit,
    onOpenTransformDock: () -> Unit,
    onOpenKeyframesDock: () -> Unit,
    onOpenAudioStudioDock: () -> Unit,
    onOpenVoiceoverDock: () -> Unit,
    onToggleFullscreen: () -> Unit,
    onDismissError: () -> Unit
) {
    val haptic = LocalHapticFeedback.current
    val isLandscape = LocalConfiguration.current.orientation == Configuration.ORIENTATION_LANDSCAPE
    var showFullscreenHud by remember(isFullscreenPreview) { mutableStateOf(true) }
    val selectedVideoClip = project.clips.firstOrNull { it.id == selection?.itemId } ?: project.clips.firstOrNull()

    if (isFullscreenPreview) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
                .clickable { showFullscreenHud = !showFullscreenHud }
        ) {
            AspectPreviewStage(
                project = project,
                globalPositionMs = globalPositionMs,
                selection = selection,
                playerController = playerController,
                onSelectItem = onSelectItem,
                onMoveOverlayPosition = onMoveOverlayPosition,
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
        // Safe-Area Top Bar: Home, Undo, Redo, Export (all >= 48dp touch targets)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .background(Color(0xFF06080D))
                .padding(horizontal = 6.dp, vertical = 4.dp),
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
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                    contentDescription = "Home",
                    tint = Color.White,
                    modifier = Modifier.size(18.dp)
                )
                Text("Home", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                TopHistoryButton(
                    icon = Icons.AutoMirrored.Rounded.Undo,
                    label = "Undo",
                    enabled = canUndo,
                    onClick = onUndo
                )
                TopHistoryButton(
                    icon = Icons.AutoMirrored.Rounded.Redo,
                    label = "Redo",
                    enabled = canRedo,
                    onClick = onRedo
                )
            }

            Button(
                onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    onExportClick()
                },
                modifier = Modifier.heightIn(min = 48.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = TG7Colors.NeonCyan,
                    contentColor = Color.Black
                )
            ) {
                Icon(Icons.Rounded.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.size(4.dp))
                Text("Export ${exportResolution.label}", fontWeight = FontWeight.Black, fontSize = 11.sp)
            }
        }

        val activeAlert = playerError ?: bannerMessage
        if (activeAlert != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0x2EFF1030))
                    .padding(horizontal = 12.dp, vertical = 4.dp),
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
                        .weight(1f)
                        .fillMaxHeight()
                        .background(Color.Black)
                        .padding(6.dp)
                ) {
                    AspectPreviewStage(
                        project = project,
                        globalPositionMs = globalPositionMs,
                        selection = selection,
                        playerController = playerController,
                        onSelectItem = onSelectItem,
                        onMoveOverlayPosition = onMoveOverlayPosition,
                        modifier = Modifier.fillMaxSize()
                    )
                    FloatingAddMediaButton(
                        onClick = onAddMediaClick,
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(6.dp)
                    )
                }

                Column(
                    modifier = Modifier
                        .weight(1.1f)
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
                    if (showTrimPanel && selectedVideoClip != null) {
                        TrimFineControls(
                            clip = selectedVideoClip,
                            onTrimClip = { id, s, e -> onTrimItem(TrackType.VIDEO, id, s, e) }
                        )
                    }
                    MultiTrackTimeline(
                        project = project,
                        selection = selection,
                        multiSelectedIds = multiSelectedIds,
                        isMultiSelectMode = isMultiSelectMode,
                        globalPositionMs = globalPositionMs,
                        zoomScale = timelineZoom,
                        onZoomChange = onZoomChange,
                        onSeek = onSeek,
                        onSelectItem = onSelectItem,
                        onMoveVideoClip = onMoveVideoClip,
                        onMoveLayerStart = onMoveLayerStart,
                        onTrimItem = onTrimItem,
                        onOpenTransitionPicker = onOpenTransitionPicker
                    )
                    ScrollablePhase2ToolDock(
                        aspectLabel = project.aspectRatio.label,
                        trimActive = showTrimPanel,
                        multiSelectActive = isMultiSelectMode,
                        onAddMedia = onAddMediaClick,
                        onAddAudio = onAddAudioClick,
                        onAddText = onAddTextClick,
                        onAddSticker = onAddStickerClick,
                        onTransitions = onOpenTransitionsDock,
                        onEffects = onOpenEffectsDock,
                        onChroma = onOpenChromaDock,
                        onSpeed = onOpenSpeedDock,
                        onTransform = onOpenTransformDock,
                        onKeyframes = onOpenKeyframesDock,
                        onAudioStudio = onOpenAudioStudioDock,
                        onVoiceover = onOpenVoiceoverDock,
                        onTrimToggle = onToggleTrimPanel,
                        onSplit = onSplitAtPlayhead,
                        onDuplicate = onDuplicateSelected,
                        onToggleMultiSelect = onToggleMultiSelect,
                        onRippleDelete = { onDeleteSelected(true) },
                        onDelete = { onDeleteSelected(false) },
                        onCycleRatio = onCycleAspectRatio,
                        onFullscreen = onToggleFullscreen
                    )
                }
            }
        } else {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .background(Color.Black)
                    .padding(horizontal = 10.dp, vertical = 4.dp)
            ) {
                AspectPreviewStage(
                    project = project,
                    globalPositionMs = globalPositionMs,
                    selection = selection,
                    playerController = playerController,
                    onSelectItem = onSelectItem,
                    onMoveOverlayPosition = onMoveOverlayPosition,
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

            if (showTrimPanel && selectedVideoClip != null) {
                TrimFineControls(
                    clip = selectedVideoClip,
                    onTrimClip = { id, s, e -> onTrimItem(TrackType.VIDEO, id, s, e) }
                )
            }

            Box(modifier = Modifier.padding(horizontal = 8.dp)) {
                MultiTrackTimeline(
                    project = project,
                    selection = selection,
                    multiSelectedIds = multiSelectedIds,
                    isMultiSelectMode = isMultiSelectMode,
                    globalPositionMs = globalPositionMs,
                    zoomScale = timelineZoom,
                    onZoomChange = onZoomChange,
                    onSeek = onSeek,
                    onSelectItem = onSelectItem,
                    onMoveVideoClip = onMoveVideoClip,
                    onMoveLayerStart = onMoveLayerStart,
                    onTrimItem = onTrimItem,
                    onOpenTransitionPicker = onOpenTransitionPicker
                )
            }

            Spacer(Modifier.height(4.dp))

            ScrollablePhase2ToolDock(
                aspectLabel = project.aspectRatio.label,
                trimActive = showTrimPanel,
                multiSelectActive = isMultiSelectMode,
                onAddMedia = onAddMediaClick,
                onAddAudio = onAddAudioClick,
                onAddText = onAddTextClick,
                onAddSticker = onAddStickerClick,
                onTransitions = onOpenTransitionsDock,
                onEffects = onOpenEffectsDock,
                onChroma = onOpenChromaDock,
                onSpeed = onOpenSpeedDock,
                onTransform = onOpenTransformDock,
                onKeyframes = onOpenKeyframesDock,
                onAudioStudio = onOpenAudioStudioDock,
                onVoiceover = onOpenVoiceoverDock,
                onTrimToggle = onToggleTrimPanel,
                onSplit = onSplitAtPlayhead,
                onDuplicate = onDuplicateSelected,
                onToggleMultiSelect = onToggleMultiSelect,
                onRippleDelete = { onDeleteSelected(true) },
                onDelete = { onDeleteSelected(false) },
                onCycleRatio = onCycleAspectRatio,
                onFullscreen = onToggleFullscreen
            )
        }
    }
}

@Composable
private fun TopHistoryButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    enabled: Boolean,
    onClick: () -> Unit
) {
    val haptic = LocalHapticFeedback.current
    Row(
        modifier = Modifier
            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
            .clip(RoundedCornerShape(10.dp))
            .clickable(enabled = enabled) {
                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                onClick()
            }
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = if (enabled) TG7Colors.NeonCyan else Color(0xFF3E4554),
            modifier = Modifier.size(18.dp)
        )
        Text(
            text = label,
            color = if (enabled) Color.White else Color(0xFF4B5364),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun AspectPreviewStage(
    project: EditorProject,
    globalPositionMs: Long,
    selection: TimelineSelection?,
    playerController: StudioPlayerController,
    onSelectItem: (TrackType, String) -> Unit,
    onMoveOverlayPosition: (TrackType, String, Float, Float) -> Unit,
    modifier: Modifier = Modifier
) {
    val density = LocalDensity.current
    BoxWithConstraints(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        val boxRatio = if (maxHeight > 0.dp) maxWidth / maxHeight else 1f
        val stageModifier = if (boxRatio > project.aspectRatio.ratio) {
            Modifier
                .fillMaxHeight()
                .aspectRatio(project.aspectRatio.ratio)
        } else {
            Modifier
                .fillMaxWidth()
                .aspectRatio(project.aspectRatio.ratio)
        }

        BoxWithConstraints(
            modifier = stageModifier
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFF040508))
                .border(1.dp, Color(0xFF1A202E), RoundedCornerShape(12.dp))
        ) {
            val stageWidthPx = with(density) { maxWidth.toPx() }.coerceAtLeast(1f)
            val stageHeightPx = with(density) { maxHeight.toPx() }.coerceAtLeast(1f)

            NativeVideoSurface(
                playerController = playerController,
                modifier = Modifier.fillMaxSize()
            )

            val stageContext = LocalContext.current

            // Live Text Overlays (draggable + Phase 4 typography & 60 animations)
            project.textLayers.filter {
                globalPositionMs in it.startTimeMs..(it.startTimeMs + it.durationMs)
            }.forEach { layer ->
                val isSelected = selection?.itemId == layer.id
                val animFrame = OverlayAnimator.evaluateText(
                    context = stageContext,
                    layer = layer,
                    localTimeMs = (globalPositionMs - layer.startTimeMs).coerceAtLeast(0L)
                )
                Box(
                    modifier = Modifier
                        .offset {
                            IntOffset(
                                x = ((animFrame.posXFraction - 0.5f) * stageWidthPx).roundToInt(),
                                y = ((animFrame.posYFraction - 0.5f) * stageHeightPx).roundToInt()
                            )
                        }
                        .align(Alignment.Center)
                        .graphicsLayer {
                            alpha = animFrame.alpha
                            scaleX = animFrame.scaleX
                            scaleY = animFrame.scaleY
                            translationX = animFrame.offsetXDp.dp.toPx()
                            translationY = animFrame.offsetYDp.dp.toPx()
                            rotationZ = animFrame.rotationDeg
                        }
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (layer.bgColorHex != 0L) Color(layer.bgColorHex) else Color.Transparent)
                        .border(
                            width = if (isSelected) 1.5.dp else 0.dp,
                            color = if (isSelected) TG7Colors.NeonCyan else Color.Transparent,
                            shape = RoundedCornerShape(10.dp)
                        )
                        .pointerInput(layer.id, stageWidthPx, stageHeightPx) {
                            var curX = layer.posXFraction
                            var curY = layer.posYFraction
                            detectDragGestures(
                                onDragStart = {
                                    curX = layer.posXFraction
                                    curY = layer.posYFraction
                                    onSelectItem(TrackType.TEXT, layer.id)
                                },
                                onDrag = { _, dragAmount ->
                                    curX = (curX + dragAmount.x / stageWidthPx).coerceIn(0.08f, 0.92f)
                                    curY = (curY + dragAmount.y / stageHeightPx).coerceIn(0.08f, 0.92f)
                                    onMoveOverlayPosition(TrackType.TEXT, layer.id, curX, curY)
                                }
                            )
                        }
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = animFrame.visibleText,
                        style = TextStyle(
                            color = Color(animFrame.overrideColorHex ?: layer.colorHex),
                            fontSize = layer.fontSizeSp.sp,
                            fontFamily = resolveComposeFontFamily(layer.fontFamily),
                            fontWeight = FontWeight.Black,
                            letterSpacing = layer.letterSpacingEm.em,
                            shadow = if (layer.hasOutline) {
                                Shadow(color = Color.Black, offset = Offset(0f, 2f), blurRadius = 6f)
                            } else null
                        )
                    )
                }
            }

            // Live Sticker Overlays (Lottie animated vector + Keyframe Motion Engine)
            project.stickerLayers.filter {
                globalPositionMs in it.startTimeMs..(it.startTimeMs + it.durationMs)
            }.forEach { sticker ->
                val isSelected = selection?.itemId == sticker.id
                val lottiePath = sticker.lottieAssetPath
                val localStickerMs = (globalPositionMs - sticker.startTimeMs).coerceAtLeast(0L)
                val stickerKf = OverlayAnimator.evaluateSticker(sticker, localStickerMs)
                Box(
                    modifier = Modifier
                        .offset {
                            IntOffset(
                                x = ((stickerKf.posX - 0.5f) * stageWidthPx).roundToInt(),
                                y = ((stickerKf.posY - 0.5f) * stageHeightPx).roundToInt()
                            )
                        }
                        .align(Alignment.Center)
                        .graphicsLayer {
                            alpha = stickerKf.opacity
                            scaleX = stickerKf.scale
                            scaleY = stickerKf.scale
                            rotationZ = stickerKf.rotationDeg
                        }
                        .size(sticker.sizeDp.dp)
                        .clip(CircleShape)
                        .background(if (lottiePath != null) Color.Transparent else Color(0x990A0E17))
                        .border(
                            width = if (isSelected) 2.dp else if (lottiePath == null) 1.5.dp else 0.dp,
                            color = if (isSelected) TG7Colors.NeonCyan else if (lottiePath == null) Color(sticker.tintHex) else Color.Transparent,
                            shape = CircleShape
                        )
                        .pointerInput(sticker.id, stageWidthPx, stageHeightPx) {
                            var curX = sticker.posXFraction
                            var curY = sticker.posYFraction
                            detectDragGestures(
                                onDragStart = {
                                    curX = sticker.posXFraction
                                    curY = sticker.posYFraction
                                    onSelectItem(TrackType.STICKER, sticker.id)
                                },
                                onDrag = { _, dragAmount ->
                                    curX = (curX + dragAmount.x / stageWidthPx).coerceIn(0.08f, 0.92f)
                                    curY = (curY + dragAmount.y / stageHeightPx).coerceIn(0.08f, 0.92f)
                                    onMoveOverlayPosition(TrackType.STICKER, sticker.id, curX, curY)
                                }
                            )
                        },
                    contentAlignment = Alignment.Center
                ) {
                    if (lottiePath != null) {
                        val comp by rememberLottieComposition(LottieCompositionSpec.Asset(lottiePath))
                        val localMs = (globalPositionMs - sticker.startTimeMs).coerceAtLeast(0L)
                        val progress = ((localMs % 1500L) / 1500f)
                        LottieAnimation(
                            composition = comp,
                            progress = { progress },
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Icon(
                            imageVector = sticker.preset.icon,
                            contentDescription = sticker.preset.label,
                            tint = Color(sticker.tintHex),
                            modifier = Modifier.size((sticker.sizeDp * 0.58f).dp)
                        )
                    }
                }
            }
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

@OptIn(UnstableApi::class)
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
            .padding(horizontal = 12.dp, vertical = 2.dp),
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
private fun ScrollablePhase2ToolDock(
    aspectLabel: String,
    trimActive: Boolean,
    multiSelectActive: Boolean,
    onAddMedia: () -> Unit,
    onAddAudio: () -> Unit,
    onAddText: () -> Unit,
    onAddSticker: () -> Unit,
    onTransitions: () -> Unit,
    onEffects: () -> Unit,
    onChroma: () -> Unit,
    onSpeed: () -> Unit,
    onTransform: () -> Unit,
    onKeyframes: () -> Unit,
    onAudioStudio: () -> Unit,
    onVoiceover: () -> Unit,
    onTrimToggle: () -> Unit,
    onSplit: () -> Unit,
    onDuplicate: () -> Unit,
    onToggleMultiSelect: () -> Unit,
    onRippleDelete: () -> Unit,
    onDelete: () -> Unit,
    onCycleRatio: () -> Unit,
    onFullscreen: () -> Unit
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
        TG7DockToolButton(icon = Icons.Rounded.Add, label = "Add Clip", tint = TG7Colors.NeonCyan, active = false, onClick = onAddMedia)
        TG7DockToolButton(icon = Icons.Rounded.Speed, label = "Speed", tint = TG7Colors.NeonCyan, active = false, onClick = onSpeed)
        TG7DockToolButton(icon = Icons.Rounded.CropRotate, label = "Transform", tint = TG7Colors.NeonCyan, active = false, onClick = onTransform)
        TG7DockToolButton(icon = Icons.Rounded.Diamond, label = "Keyframes", tint = Color(0xFFFACC15), active = false, onClick = onKeyframes)
        TG7DockToolButton(icon = Icons.Rounded.AutoAwesome, label = "Effects", tint = TG7Colors.NeonCyan, active = false, onClick = onEffects)
        TG7DockToolButton(icon = Icons.Rounded.AutoFixHigh, label = "Transitions", tint = TG7Colors.NeonCyan, active = false, onClick = onTransitions)
        TG7DockToolButton(icon = Icons.Rounded.FilterCenterFocus, label = "Chroma", tint = Color(0xFF22C55E), active = false, onClick = onChroma)
        TG7DockToolButton(icon = Icons.Rounded.GraphicEq, label = "Audio Mix", tint = Color(0xFF22C55E), active = false, onClick = onAudioStudio)
        TG7DockToolButton(icon = Icons.Rounded.Mic, label = "Voiceover", tint = TG7Colors.BloodRed, active = false, onClick = onVoiceover)
        TG7DockToolButton(icon = Icons.Rounded.MusicNote, label = "Import Audio", tint = Color(0xFF22C55E), active = false, onClick = onAddAudio)
        TG7DockToolButton(icon = Icons.Rounded.TextFields, label = "Text", tint = Color(0xFFC084FC), active = false, onClick = onAddText)
        TG7DockToolButton(icon = Icons.Rounded.EmojiEmotions, label = "Sticker", tint = TG7Colors.BloodRed, active = false, onClick = onAddSticker)
        TG7DockToolButton(icon = Icons.Rounded.Tune, label = "Trim", tint = if (trimActive) TG7Colors.NeonCyan else Color.White, active = trimActive, onClick = onTrimToggle)
        TG7DockToolButton(icon = Icons.Rounded.ContentCut, label = "Split", tint = Color.White, active = false, onClick = onSplit)
        TG7DockToolButton(icon = Icons.Rounded.ContentCopy, label = "Duplicate", tint = Color.White, active = false, onClick = onDuplicate)
        TG7DockToolButton(icon = Icons.Rounded.CheckBox, label = "Multi", tint = if (multiSelectActive) TG7Colors.NeonCyan else Color.White, active = multiSelectActive, onClick = onToggleMultiSelect)
        TG7DockToolButton(icon = Icons.Rounded.DeleteSweep, label = "Ripple Del", tint = TG7Colors.BloodRed, active = false, onClick = onRippleDelete)
        TG7DockToolButton(icon = Icons.Rounded.Delete, label = "Delete", tint = TG7Colors.BloodRed, active = false, onClick = onDelete)
        TG7DockToolButton(icon = Icons.Rounded.AspectRatio, label = "Ratio $aspectLabel", tint = TG7Colors.NeonCyan, active = false, onClick = onCycleRatio)
        TG7DockToolButton(icon = Icons.Rounded.Fullscreen, label = "Fullscreen", tint = Color.White, active = false, onClick = onFullscreen)
    }
}
