package com.tg7.editor

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.tg7.editor.crash.CrashErrorScreen
import com.tg7.editor.crash.CrashHandler
import com.tg7.editor.model.TrackType
import com.tg7.editor.ui.components.AddStickerSheet
import com.tg7.editor.ui.components.AddTextSheet
import com.tg7.editor.ui.components.AudioStudioSheet
import com.tg7.editor.ui.components.EffectsAndColorSheet
import com.tg7.editor.ui.components.ExportSheet
import com.tg7.editor.ui.components.KeyframeInspectorSheet
import com.tg7.editor.ui.components.RecentMediaSheet
import com.tg7.editor.ui.components.SpeedAndTransformSheet
import com.tg7.editor.ui.components.TransitionPickerSheet
import com.tg7.editor.ui.editor.EditorScreen
import com.tg7.editor.ui.editor.EditorViewModel
import com.tg7.editor.ui.home.HomeScreen
import com.tg7.editor.ui.theme.TG7Theme

class MainActivity : ComponentActivity() {

    private val viewModel: EditorViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        )
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }

        val initialCrash = intent.getStringExtra(CrashHandler.EXTRA_CRASH_TRACE)
            ?: CrashHandler.consumeSavedCrash(this)

        setContent {
            TG7Theme {
                var crashTrace by remember { mutableStateOf(initialCrash) }

                if (crashTrace != null) {
                    CrashErrorScreen(
                        traceText = crashTrace ?: "",
                        onContinue = { crashTrace = null }
                    )
                    return@TG7Theme
                }

                val projects by viewModel.projects.collectAsState()
                val recoveryProject by viewModel.recoveryProject.collectAsState()
                val activeProjectId by viewModel.activeProjectId.collectAsState()
                val selection by viewModel.selection.collectAsState()
                val multiSelectedIds by viewModel.multiSelectedIds.collectAsState()
                val isMultiSelectMode by viewModel.isMultiSelectMode.collectAsState()
                val timelineZoom by viewModel.timelineZoom.collectAsState()
                val canUndo by viewModel.canUndo.collectAsState()
                val canRedo by viewModel.canRedo.collectAsState()
                val preferredAspectRatio by viewModel.preferredAspectRatio.collectAsState()
                val recentMedia by viewModel.recentMedia.collectAsState()
                val hasRecentPermission by viewModel.hasRecentPermission.collectAsState()
                val exportResolution by viewModel.exportResolution.collectAsState()
                val exportState by viewModel.exportState.collectAsState()
                val showExportSheet by viewModel.showExportSheet.collectAsState()
                val showImportSheet by viewModel.showImportSheet.collectAsState()
                val showTextSheet by viewModel.showTextSheet.collectAsState()
                val showStickerSheet by viewModel.showStickerSheet.collectAsState()
                val transitionCutIndex by viewModel.transitionCutIndex.collectAsState()
                val showEffectsSheet by viewModel.showEffectsSheet.collectAsState()
                val effectsInitialTab by viewModel.effectsInitialTab.collectAsState()
                val showSpeedTransformSheet by viewModel.showSpeedTransformSheet.collectAsState()
                val speedTransformInitialTab by viewModel.speedTransformInitialTab.collectAsState()
                val showKeyframeSheet by viewModel.showKeyframeSheet.collectAsState()
                val showAudioStudioSheet by viewModel.showAudioStudioSheet.collectAsState()
                val audioStudioInitialTab by viewModel.audioStudioInitialTab.collectAsState()
                val isRecordingVoiceover by viewModel.isRecordingVoiceover.collectAsState()
                val voiceoverAmplitude by viewModel.voiceoverAmplitude.collectAsState()
                val voiceoverElapsedMs by viewModel.voiceoverElapsedMs.collectAsState()
                val showTrimPanel by viewModel.showTrimPanel.collectAsState()
                val isFullscreenPreview by viewModel.isFullscreenPreview.collectAsState()
                val isImporting by viewModel.isImporting.collectAsState()
                val bannerMessage by viewModel.bannerMessage.collectAsState()

                val isPlaying by viewModel.playerController.isPlaying.collectAsState()
                val globalPositionMs by viewModel.playerController.globalPositionMs.collectAsState()
                val playerError by viewModel.playerController.playerError.collectAsState()

                LaunchedEffect(isFullscreenPreview) {
                    val controller = WindowCompat.getInsetsController(window, window.decorView)
                    controller.systemBarsBehavior =
                        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    if (isFullscreenPreview) {
                        controller.hide(WindowInsetsCompat.Type.systemBars())
                    } else {
                        controller.show(WindowInsetsCompat.Type.systemBars())
                    }
                }

                val newProjectPicker = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.PickMultipleVisualMedia(maxItems = 20)
                ) { uris ->
                    if (uris.isNotEmpty()) {
                        viewModel.createNewProject(uris)
                    }
                }

                val appendMediaPicker = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.PickMultipleVisualMedia(maxItems = 20)
                ) { uris ->
                    if (uris.isNotEmpty()) {
                        viewModel.appendUrisToActiveProject(uris)
                    }
                }

                val audioPicker = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.OpenDocument()
                ) { uri ->
                    if (uri != null) {
                        viewModel.onAudioPicked(uri)
                    }
                }

                val recentPermissionLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.RequestMultiplePermissions()
                ) {
                    viewModel.refreshRecentMedia()
                }

                val recordAudioPermissionLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.RequestPermission()
                ) { granted ->
                    if (granted) {
                        viewModel.openAudioStudioSheet(1)
                        viewModel.startVoiceoverRecording()
                    }
                }

                val launchVoiceoverWithPermission = {
                    val granted = ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        Manifest.permission.RECORD_AUDIO
                    ) == PackageManager.PERMISSION_GRANTED
                    if (granted) {
                        viewModel.startVoiceoverRecording()
                    } else {
                        recordAudioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    }
                }

                val requestRecentPermissions = {
                    val perms = buildList {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            add(Manifest.permission.READ_MEDIA_IMAGES)
                            add(Manifest.permission.READ_MEDIA_VIDEO)
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                                add(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED)
                            }
                        } else {
                            add(Manifest.permission.READ_EXTERNAL_STORAGE)
                        }
                    }.toTypedArray()
                    recentPermissionLauncher.launch(perms)
                }

                val activeProject = projects.firstOrNull { it.id == activeProjectId }

                BackHandler(enabled = isFullscreenPreview || activeProject != null) {
                    if (isFullscreenPreview) {
                        viewModel.setFullscreenPreview(false)
                    } else if (activeProject != null) {
                        viewModel.closeEditor()
                    }
                }

                if (activeProject == null) {
                    HomeScreen(
                        projects = projects,
                        recoveryProject = recoveryProject,
                        selectedAspectRatio = preferredAspectRatio,
                        recentMedia = recentMedia,
                        hasRecentPermission = hasRecentPermission,
                        isImporting = isImporting,
                        onRecoverSession = viewModel::recoverLastSession,
                        onDismissRecovery = viewModel::dismissRecovery,
                        onSelectAspectRatio = viewModel::setPreferredAspectRatio,
                        onNewProjectClick = {
                            newProjectPicker.launch(
                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)
                            )
                        },
                        onOpenProject = viewModel::openProject,
                        onDeleteProject = viewModel::deleteProject,
                        onRequestRecentPermission = requestRecentPermissions,
                        onQuickStartRecent = viewModel::createNewProjectFromRecent
                    )
                } else {
                    EditorScreen(
                        project = activeProject,
                        playerController = viewModel.playerController,
                        isPlaying = isPlaying,
                        globalPositionMs = globalPositionMs,
                        selection = selection,
                        multiSelectedIds = multiSelectedIds,
                        isMultiSelectMode = isMultiSelectMode,
                        timelineZoom = timelineZoom,
                        canUndo = canUndo,
                        canRedo = canRedo,
                        exportResolution = exportResolution,
                        showTrimPanel = showTrimPanel,
                        isFullscreenPreview = isFullscreenPreview,
                        playerError = playerError,
                        bannerMessage = bannerMessage,
                        onBack = viewModel::closeEditor,
                        onUndo = viewModel::undo,
                        onRedo = viewModel::redo,
                        onExportClick = { viewModel.setExportSheetVisible(true) },
                        onTogglePlay = viewModel.playerController::togglePlayPause,
                        onSeek = viewModel.playerController::seekToGlobal,
                        onSelectItem = viewModel::selectTimelineItem,
                        onMoveVideoClip = viewModel::moveVideoClip,
                        onMoveLayerStart = viewModel::moveLayerStartTime,
                        onTrimItem = viewModel::trimItem,
                        onMoveOverlayPosition = viewModel::moveOverlayPosition,
                        onZoomChange = { next -> viewModel.adjustTimelineZoom(next, absolute = true) },
                        onSplitAtPlayhead = viewModel::splitAtPlayhead,
                        onDuplicateSelected = viewModel::duplicateSelected,
                        onToggleMultiSelect = viewModel::toggleMultiSelectMode,
                        onDeleteSelected = viewModel::deleteSelected,
                        onToggleTrimPanel = viewModel::toggleTrimPanel,
                        onCycleAspectRatio = viewModel::cycleActiveAspectRatio,
                        onAddMediaClick = { viewModel.setImportSheetVisible(true) },
                        onAddAudioClick = { audioPicker.launch(arrayOf("audio/*")) },
                        onAddTextClick = { viewModel.setTextSheetVisible(true) },
                        onAddStickerClick = { viewModel.setStickerSheetVisible(true) },
                        onOpenTransitionPicker = { cutIdx -> viewModel.openTransitionPicker(cutIdx) },
                        onOpenTransitionsDock = { viewModel.openTransitionPicker(null) },
                        onOpenEffectsDock = { viewModel.openEffectsSheet(0) },
                        onOpenChromaDock = { viewModel.openEffectsSheet(2) },
                        onOpenSpeedDock = { viewModel.openSpeedTransformSheet(0) },
                        onOpenTransformDock = { viewModel.openSpeedTransformSheet(1) },
                        onOpenKeyframesDock = { viewModel.openKeyframeSheet() },
                        onOpenAudioStudioDock = { viewModel.openAudioStudioSheet(0) },
                        onOpenVoiceoverDock = { viewModel.openAudioStudioSheet(1) },
                        onToggleFullscreen = viewModel::toggleFullscreenPreview,
                        onDismissError = {
                            viewModel.playerController.clearError()
                            viewModel.dismissBanner()
                        }
                    )

                    if (showImportSheet) {
                        RecentMediaSheet(
                            recentMedia = recentMedia,
                            hasPermission = hasRecentPermission,
                            onRequestRecentPermission = requestRecentPermissions,
                            onOpenPhotoPicker = {
                                appendMediaPicker.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)
                                )
                            },
                            onOpenAudioPicker = {
                                audioPicker.launch(arrayOf("audio/*"))
                            },
                            onSelectRecentItem = viewModel::appendRecentItemToActiveProject,
                            onDismiss = { viewModel.setImportSheetVisible(false) }
                        )
                    }

                    if (showTextSheet) {
                        val editingTextLayer = if (selection?.trackType == com.tg7.editor.model.TrackType.TEXT) {
                            activeProject.textLayers.firstOrNull { it.id == selection?.itemId }
                        } else null
                        AddTextSheet(
                            editingLayer = editingTextLayer,
                            onConfirmText = viewModel::addOrUpdateTextLayer,
                            onDismiss = { viewModel.setTextSheetVisible(false) }
                        )
                    }

                    if (showStickerSheet) {
                        AddStickerSheet(
                            onSelectLottieSticker = viewModel::addLottieStickerLayer,
                            onSelectVectorSticker = viewModel::addStickerLayer,
                            onDismiss = { viewModel.setStickerSheetVisible(false) }
                        )
                    }

                    val activeCutIdx = transitionCutIndex
                    if (activeCutIdx != null && activeCutIdx in 0 until activeProject.clips.lastIndex) {
                        val cutClip = activeProject.clips[activeCutIdx]
                        TransitionPickerSheet(
                            cutIndex = activeCutIdx,
                            totalCuts = (activeProject.clips.size - 1).coerceAtLeast(1),
                            currentTransitionId = cutClip.outTransitionId,
                            currentDurationMs = cutClip.outTransitionDurationMs,
                            onApplyTransition = viewModel::applyTransition,
                            onApplyAllCuts = viewModel::applyTransitionToAll,
                            onRemoveTransition = viewModel::removeTransition,
                            onDismiss = viewModel::closeTransitionPicker
                        )
                    }

                    if (showEffectsSheet) {
                        val targetClip = activeProject.clips.firstOrNull { it.id == selection?.itemId }
                            ?: activeProject.clips.firstOrNull()
                        if (targetClip != null) {
                            EffectsAndColorSheet(
                                clip = targetClip,
                                initialTab = effectsInitialTab,
                                onApplyEffect = viewModel::applyClipEffect,
                                onApplyEffectAll = viewModel::applyEffectToAllClips,
                                onUpdateColorGrade = viewModel::updateClipColorGrade,
                                onApplyColorGradeAll = viewModel::applyColorGradeToAllClips,
                                onUpdateChromaKey = viewModel::updateClipChromaKey,
                                onResetClipVisuals = viewModel::resetClipVisuals,
                                onDismiss = viewModel::closeEffectsSheet
                            )
                        }
                    }

                    if (showSpeedTransformSheet) {
                        val targetClip = activeProject.clips.firstOrNull { it.id == selection?.itemId }
                            ?: activeProject.clips.firstOrNull()
                        if (targetClip != null) {
                            SpeedAndTransformSheet(
                                clip = targetClip,
                                initialTab = speedTransformInitialTab,
                                onUpdateSpeed = viewModel::updateClipSpeed,
                                onFreezeFrame = viewModel::freezeFrameAtPlayhead,
                                onUpdateTransform = viewModel::updateClipTransform,
                                onResetTransform = viewModel::resetClipTransform,
                                onDismiss = viewModel::closeSpeedTransformSheet
                            )
                        }
                    }

                    if (showKeyframeSheet) {
                        KeyframeInspectorSheet(
                            project = activeProject,
                            selection = selection,
                            globalPositionMs = globalPositionMs,
                            onSeekGlobal = viewModel.playerController::seekToGlobal,
                            onAddOrUpdateKeyframe = viewModel::addOrUpdateKeyframe,
                            onDeleteKeyframe = viewModel::deleteKeyframe,
                            onDismiss = viewModel::closeKeyframeSheet
                        )
                    }

                    if (showAudioStudioSheet) {
                        val selectedAudioId = if (selection?.trackType == TrackType.AUDIO) {
                            selection?.itemId
                        } else null
                        AudioStudioSheet(
                            audioClips = activeProject.audioClips,
                            selectedAudioId = selectedAudioId,
                            initialTab = audioStudioInitialTab,
                            isRecordingVoiceover = isRecordingVoiceover,
                            voiceoverAmplitude = voiceoverAmplitude,
                            voiceoverElapsedMs = voiceoverElapsedMs,
                            onSelectAudioClip = { audioId -> viewModel.selectTimelineItem(TrackType.AUDIO, audioId) },
                            onImportAudioClick = { audioPicker.launch(arrayOf("audio/*")) },
                            onUpdateAudioMix = viewModel::updateAudioMix,
                            onReanalyzeBeats = viewModel::reanalyzeAudioBeats,
                            onSeekToBeatGlobal = viewModel.playerController::seekToGlobal,
                            onStartVoiceoverClick = launchVoiceoverWithPermission,
                            onStopVoiceoverClick = viewModel::stopVoiceoverRecording,
                            onDismiss = viewModel::closeAudioStudioSheet
                        )
                    }

                    if (showExportSheet) {
                        ExportSheet(
                            aspectRatio = activeProject.aspectRatio,
                            selectedResolution = exportResolution,
                            exportState = exportState,
                            onSelectResolution = viewModel::selectExportResolution,
                            onStartExport = viewModel::startExport,
                            onCancelExport = viewModel::cancelExport,
                            onShareExport = { uriString ->
                                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                    type = "video/mp4"
                                    putExtra(Intent.EXTRA_STREAM, Uri.parse(uriString))
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                }
                                startActivity(Intent.createChooser(shareIntent, "Share TG7 Export"))
                            },
                            onDismiss = { viewModel.setExportSheetVisible(false) }
                        )
                    }
                }
            }
        }
    }

    override fun onPause() {
        super.onPause()
        viewModel.playerController.pause()
    }
}
