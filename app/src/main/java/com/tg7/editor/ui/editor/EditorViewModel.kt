package com.tg7.editor.ui.editor

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tg7.editor.data.ProjectRepository
import com.tg7.editor.data.RecentMediaLoader
import com.tg7.editor.engine.audio.AudioWaveformExtractor
import com.tg7.editor.engine.audio.VoiceoverRecorder
import com.tg7.editor.engine.export.HardwareVideoExporter
import com.tg7.editor.engine.player.StudioPlayerController
import com.tg7.editor.media.FreezeFrameHelper
import com.tg7.editor.media.MediaPickerHelper
import com.tg7.editor.model.AudioClip
import com.tg7.editor.model.BlendModePreset
import com.tg7.editor.model.CanvasAspectRatio
import com.tg7.editor.model.ChromaKeyConfig
import com.tg7.editor.model.ClipColorGrade
import com.tg7.editor.model.EditorProject
import com.tg7.editor.model.ExportResolution
import com.tg7.editor.model.ExportState
import com.tg7.editor.model.KeyframeNode
import com.tg7.editor.model.LottieStickerSpec
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.RecentMediaItem
import com.tg7.editor.model.SpeedRampPreset
import com.tg7.editor.model.StickerLayer
import com.tg7.editor.model.StickerPreset
import com.tg7.editor.model.TextFontFamily
import com.tg7.editor.model.TextLayer
import com.tg7.editor.model.TimelineClip
import com.tg7.editor.model.TimelineSelection
import com.tg7.editor.model.TrackType
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.UUID

class EditorViewModel(application: Application) : AndroidViewModel(application) {
    private val appContext = application.applicationContext
    private val repository = ProjectRepository(appContext)
    val playerController = StudioPlayerController(appContext, viewModelScope)
    private val exporter = HardwareVideoExporter(appContext)
    private val voiceoverRecorder = VoiceoverRecorder(appContext)

    private val _projects = MutableStateFlow<List<EditorProject>>(emptyList())
    val projects: StateFlow<List<EditorProject>> = _projects.asStateFlow()

    private val _recoveryProject = MutableStateFlow<EditorProject?>(null)
    val recoveryProject: StateFlow<EditorProject?> = _recoveryProject.asStateFlow()

    private val _activeProjectId = MutableStateFlow<String?>(null)
    val activeProjectId: StateFlow<String?> = _activeProjectId.asStateFlow()

    private val _selection = MutableStateFlow<TimelineSelection?>(null)
    val selection: StateFlow<TimelineSelection?> = _selection.asStateFlow()

    private val _isMultiSelectMode = MutableStateFlow(false)
    val isMultiSelectMode: StateFlow<Boolean> = _isMultiSelectMode.asStateFlow()

    private val _multiSelectedIds = MutableStateFlow<Set<String>>(emptySet())
    val multiSelectedIds: StateFlow<Set<String>> = _multiSelectedIds.asStateFlow()

    private val _timelineZoom = MutableStateFlow(1.0f)
    val timelineZoom: StateFlow<Float> = _timelineZoom.asStateFlow()

    private val undoStack = ArrayDeque<EditorProject>()
    private val redoStack = ArrayDeque<EditorProject>()
    private val _canUndo = MutableStateFlow(false)
    val canUndo: StateFlow<Boolean> = _canUndo.asStateFlow()
    private val _canRedo = MutableStateFlow(false)
    val canRedo: StateFlow<Boolean> = _canRedo.asStateFlow()

    private val _preferredAspectRatio = MutableStateFlow(CanvasAspectRatio.PORTRAIT_9_16)
    val preferredAspectRatio: StateFlow<CanvasAspectRatio> = _preferredAspectRatio.asStateFlow()

    private val _recentMedia = MutableStateFlow<List<RecentMediaItem>>(emptyList())
    val recentMedia: StateFlow<List<RecentMediaItem>> = _recentMedia.asStateFlow()

    private val _hasRecentPermission = MutableStateFlow(
        RecentMediaLoader.hasRecentAccessPermission(appContext)
    )
    val hasRecentPermission: StateFlow<Boolean> = _hasRecentPermission.asStateFlow()

    private val _exportResolution = MutableStateFlow(ExportResolution.FHD_1080)
    val exportResolution: StateFlow<ExportResolution> = _exportResolution.asStateFlow()

    private val _exportState = MutableStateFlow<ExportState>(ExportState.Idle)
    val exportState: StateFlow<ExportState> = _exportState.asStateFlow()

    private val _showExportSheet = MutableStateFlow(false)
    val showExportSheet: StateFlow<Boolean> = _showExportSheet.asStateFlow()

    private val _showImportSheet = MutableStateFlow(false)
    val showImportSheet: StateFlow<Boolean> = _showImportSheet.asStateFlow()

    private val _showTextSheet = MutableStateFlow(false)
    val showTextSheet: StateFlow<Boolean> = _showTextSheet.asStateFlow()

    private val _showStickerSheet = MutableStateFlow(false)
    val showStickerSheet: StateFlow<Boolean> = _showStickerSheet.asStateFlow()

    private val _transitionCutIndex = MutableStateFlow<Int?>(null)
    val transitionCutIndex: StateFlow<Int?> = _transitionCutIndex.asStateFlow()

    private val _showEffectsSheet = MutableStateFlow(false)
    val showEffectsSheet: StateFlow<Boolean> = _showEffectsSheet.asStateFlow()

    private val _effectsInitialTab = MutableStateFlow(0)
    val effectsInitialTab: StateFlow<Int> = _effectsInitialTab.asStateFlow()

    private val _showSpeedTransformSheet = MutableStateFlow(false)
    val showSpeedTransformSheet: StateFlow<Boolean> = _showSpeedTransformSheet.asStateFlow()

    private val _speedTransformInitialTab = MutableStateFlow(0)
    val speedTransformInitialTab: StateFlow<Int> = _speedTransformInitialTab.asStateFlow()

    private val _showKeyframeSheet = MutableStateFlow(false)
    val showKeyframeSheet: StateFlow<Boolean> = _showKeyframeSheet.asStateFlow()

    private val _showAudioStudioSheet = MutableStateFlow(false)
    val showAudioStudioSheet: StateFlow<Boolean> = _showAudioStudioSheet.asStateFlow()

    private val _audioStudioInitialTab = MutableStateFlow(0)
    val audioStudioInitialTab: StateFlow<Int> = _audioStudioInitialTab.asStateFlow()

    private val _isRecordingVoiceover = MutableStateFlow(false)
    val isRecordingVoiceover: StateFlow<Boolean> = _isRecordingVoiceover.asStateFlow()

    private val _voiceoverAmplitude = MutableStateFlow(0f)
    val voiceoverAmplitude: StateFlow<Float> = _voiceoverAmplitude.asStateFlow()

    private val _voiceoverElapsedMs = MutableStateFlow(0L)
    val voiceoverElapsedMs: StateFlow<Long> = _voiceoverElapsedMs.asStateFlow()

    private val _showTrimPanel = MutableStateFlow(false)
    val showTrimPanel: StateFlow<Boolean> = _showTrimPanel.asStateFlow()

    private val _isFullscreenPreview = MutableStateFlow(false)
    val isFullscreenPreview: StateFlow<Boolean> = _isFullscreenPreview.asStateFlow()

    private val _isImporting = MutableStateFlow(false)
    val isImporting: StateFlow<Boolean> = _isImporting.asStateFlow()

    private val _bannerMessage = MutableStateFlow<String?>(null)
    val bannerMessage: StateFlow<String?> = _bannerMessage.asStateFlow()

    private var trimSyncJob: Job? = null
    private var voiceoverPollJob: Job? = null
    private var lastContinuousHistoryMs = 0L

    init {
        viewModelScope.launch {
            _projects.value = repository.loadProjects()
            _recoveryProject.value = repository.findRecoveryProject()
            refreshRecentMedia()
            exporter.clearOldExports()
        }
    }

    fun activeProject(): EditorProject? {
        val id = _activeProjectId.value ?: return null
        return _projects.value.firstOrNull { it.id == id }
    }

    fun setPreferredAspectRatio(ratio: CanvasAspectRatio) {
        _preferredAspectRatio.value = ratio
    }

    fun adjustTimelineZoom(factorOrDelta: Float, absolute: Boolean = false) {
        val next = if (absolute) factorOrDelta else _timelineZoom.value * factorOrDelta
        _timelineZoom.value = next.coerceIn(0.4f, 2.8f)
    }

    fun recoverLastSession() {
        val rec = _recoveryProject.value ?: return
        _recoveryProject.value = null
        openProject(rec.id)
        _bannerMessage.value = "Session restored from Room auto-save."
    }

    fun dismissRecovery() {
        _recoveryProject.value = null
        viewModelScope.launch { repository.markSessionActive(null) }
    }

    fun refreshRecentMedia() {
        val granted = RecentMediaLoader.hasRecentAccessPermission(appContext)
        _hasRecentPermission.value = granted
        if (!granted) return
        viewModelScope.launch {
            _recentMedia.value = RecentMediaLoader.loadRecentVisualMedia(appContext, limit = 45)
        }
    }

    fun createNewProject(uris: List<Uri>) {
        if (uris.isEmpty()) return
        viewModelScope.launch {
            _isImporting.value = true
            val probed = uris.mapNotNull { MediaPickerHelper.probeUriToClip(appContext, it) }
            _isImporting.value = false
            if (probed.isEmpty()) {
                _bannerMessage.value = "Could not decode selected media files."
                return@launch
            }
            val project = EditorProject(
                name = "TG7 Edit ${_projects.value.size + 1}",
                aspectRatio = _preferredAspectRatio.value,
                inActiveSession = true,
                clips = probed
            )
            val updated = listOf(project) + _projects.value
            _projects.value = updated
            clearHistory()
            _activeProjectId.value = project.id
            _recoveryProject.value = null
            _selection.value = TimelineSelection(TrackType.VIDEO, probed.first().id)
            _multiSelectedIds.value = emptySet()
            _isMultiSelectMode.value = false
            _showTrimPanel.value = false
            _isFullscreenPreview.value = false
            playerController.setTimelineMedia(probed, emptyList(), preservePositionMs = 0L)
            repository.saveProject(project)
            repository.markSessionActive(project.id)
        }
    }

    fun createNewProjectFromRecent(item: RecentMediaItem) {
        val clip = TimelineClip(
            uriString = item.uriString,
            displayName = item.displayName,
            kind = item.kind,
            sourceDurationMs = item.durationMs.coerceAtLeast(300L),
            trimStartMs = 0L,
            trimEndMs = item.durationMs.coerceAtLeast(300L)
        )
        val project = EditorProject(
            name = "TG7 Edit ${_projects.value.size + 1}",
            aspectRatio = _preferredAspectRatio.value,
            inActiveSession = true,
            clips = listOf(clip)
        )
        val updated = listOf(project) + _projects.value
        _projects.value = updated
        clearHistory()
        _activeProjectId.value = project.id
        _recoveryProject.value = null
        _selection.value = TimelineSelection(TrackType.VIDEO, clip.id)
        _multiSelectedIds.value = emptySet()
        _isMultiSelectMode.value = false
        _showTrimPanel.value = false
        _isFullscreenPreview.value = false
        playerController.setTimelineMedia(project.clips, emptyList(), preservePositionMs = 0L)
        viewModelScope.launch {
            repository.saveProject(project)
            repository.markSessionActive(project.id)
        }
    }

    fun openProject(projectId: String) {
        val proj = _projects.value.firstOrNull { it.id == projectId } ?: return
        clearHistory()
        _activeProjectId.value = proj.id
        _recoveryProject.value = null
        _selection.value = proj.clips.firstOrNull()?.let { TimelineSelection(TrackType.VIDEO, it.id) }
        _multiSelectedIds.value = emptySet()
        _isMultiSelectMode.value = false
        _showTrimPanel.value = false
        _isFullscreenPreview.value = false
        playerController.setTimelineMedia(proj.clips, proj.audioClips, preservePositionMs = 0L)
        viewModelScope.launch { repository.markSessionActive(proj.id) }
        proj.audioClips.filter { it.waveformPeaks.isEmpty() }.forEach { audio ->
            analyzeAudioInBackground(proj.id, audio.id, audio.uriString, audio.sourceDurationMs)
        }
    }

    fun closeEditor() {
        playerController.pause()
        cancelVoiceoverIfRecording()
        _isFullscreenPreview.value = false
        _showTrimPanel.value = false
        _showImportSheet.value = false
        _showTextSheet.value = false
        _showStickerSheet.value = false
        _transitionCutIndex.value = null
        _showEffectsSheet.value = false
        _showSpeedTransformSheet.value = false
        _showKeyframeSheet.value = false
        _showAudioStudioSheet.value = false
        _isMultiSelectMode.value = false
        _multiSelectedIds.value = emptySet()
        _activeProjectId.value = null
        viewModelScope.launch { repository.markSessionActive(null) }
    }

    fun deleteProject(projectId: String) {
        val updated = _projects.value.filterNot { it.id == projectId }
        _projects.value = updated
        if (_activeProjectId.value == projectId) {
            closeEditor()
        }
        viewModelScope.launch { repository.deleteProject(projectId) }
    }

    fun appendUrisToActiveProject(uris: List<Uri>) {
        val proj = activeProject() ?: return
        if (uris.isEmpty()) return
        viewModelScope.launch {
            _isImporting.value = true
            val probed = uris.mapNotNull { MediaPickerHelper.probeUriToClip(appContext, it) }
            _isImporting.value = false
            if (probed.isEmpty()) {
                _bannerMessage.value = "Unsupported media file selected."
                return@launch
            }
            mutateProject(
                newProject = proj.copy(clips = proj.clips + probed),
                newSelection = TimelineSelection(TrackType.VIDEO, probed.first().id),
                rebuildPlayer = true
            )
            _showImportSheet.value = false
        }
    }

    fun appendRecentItemToActiveProject(item: RecentMediaItem) {
        val proj = activeProject() ?: return
        val clip = TimelineClip(
            uriString = item.uriString,
            displayName = item.displayName,
            kind = item.kind,
            sourceDurationMs = item.durationMs.coerceAtLeast(300L),
            trimStartMs = 0L,
            trimEndMs = item.durationMs.coerceAtLeast(300L)
        )
        mutateProject(
            newProject = proj.copy(clips = proj.clips + clip),
            newSelection = TimelineSelection(TrackType.VIDEO, clip.id),
            rebuildPlayer = true
        )
        _showImportSheet.value = false
    }

    fun onAudioPicked(uri: Uri) {
        val proj = activeProject() ?: return
        val playheadMs = playerController.globalPositionMs.value
        viewModelScope.launch {
            val probed = MediaPickerHelper.probeAudioUri(appContext, uri, playheadMs)
            if (probed == null) {
                _bannerMessage.value = "Could not load selected audio file."
                return@launch
            }
            val analysis = AudioWaveformExtractor.analyze(appContext, probed.uriString, probed.sourceDurationMs)
            val enriched = probed.copy(
                waveformPeaks = analysis.waveformPeaks,
                beatMarkersMs = analysis.beatMarkersMs
            )
            val latest = activeProject() ?: proj
            mutateProject(
                newProject = latest.copy(audioClips = latest.audioClips + enriched),
                newSelection = TimelineSelection(TrackType.AUDIO, enriched.id),
                rebuildPlayer = true
            )
            _showImportSheet.value = false
        }
    }

    fun addOrUpdateTextLayer(
        editingLayerId: String?,
        text: String,
        colorHex: Long,
        fontSizeSp: Float,
        templateId: String,
        animationId: String,
        fontFamily: TextFontFamily,
        bgColorHex: Long,
        hasOutline: Boolean,
        letterSpacingEm: Float
    ) {
        val proj = activeProject() ?: return
        val cleanText = text.trim().ifBlank { return }
        if (editingLayerId != null && proj.textLayers.any { it.id == editingLayerId }) {
            val updatedLayers = proj.textLayers.map { existing ->
                if (existing.id == editingLayerId) {
                    existing.copy(
                        text = cleanText,
                        colorHex = colorHex,
                        fontSizeSp = fontSizeSp,
                        templateId = templateId,
                        animationId = animationId,
                        fontFamily = fontFamily,
                        bgColorHex = bgColorHex,
                        hasOutline = hasOutline,
                        letterSpacingEm = letterSpacingEm
                    )
                } else existing
            }
            mutateProject(
                newProject = proj.copy(textLayers = updatedLayers),
                newSelection = TimelineSelection(TrackType.TEXT, editingLayerId),
                rebuildPlayer = false
            )
        } else {
            val start = playerController.globalPositionMs.value
            val dur = 3000L.coerceAtMost((proj.totalDurationMs - start).coerceAtLeast(1500L))
            val layer = TextLayer(
                text = cleanText,
                startTimeMs = start,
                durationMs = dur,
                colorHex = colorHex,
                fontSizeSp = fontSizeSp,
                templateId = templateId,
                animationId = animationId,
                fontFamily = fontFamily,
                bgColorHex = bgColorHex,
                hasOutline = hasOutline,
                letterSpacingEm = letterSpacingEm
            )
            mutateProject(
                newProject = proj.copy(textLayers = proj.textLayers + layer),
                newSelection = TimelineSelection(TrackType.TEXT, layer.id),
                rebuildPlayer = false
            )
        }
        _showTextSheet.value = false
    }

    fun addLottieStickerLayer(spec: LottieStickerSpec) {
        val proj = activeProject() ?: return
        val start = playerController.globalPositionMs.value
        val dur = 3000L.coerceAtMost((proj.totalDurationMs - start).coerceAtLeast(1500L))
        val sticker = StickerLayer(
            preset = StickerPreset.SPARKLE,
            startTimeMs = start,
            durationMs = dur,
            sizeDp = 76f,
            tintHex = spec.tintHex,
            lottieAssetPath = spec.lottieAssetPath,
            label = spec.name
        )
        mutateProject(
            newProject = proj.copy(stickerLayers = proj.stickerLayers + sticker),
            newSelection = TimelineSelection(TrackType.STICKER, sticker.id),
            rebuildPlayer = false
        )
        _showStickerSheet.value = false
    }

    fun addStickerLayer(preset: StickerPreset) {
        val proj = activeProject() ?: return
        val start = playerController.globalPositionMs.value
        val dur = 3000L.coerceAtMost((proj.totalDurationMs - start).coerceAtLeast(1500L))
        val sticker = StickerLayer(
            preset = preset,
            startTimeMs = start,
            durationMs = dur,
            tintHex = preset.defaultTintHex,
            lottieAssetPath = null,
            label = preset.label
        )
        mutateProject(
            newProject = proj.copy(stickerLayers = proj.stickerLayers + sticker),
            newSelection = TimelineSelection(TrackType.STICKER, sticker.id),
            rebuildPlayer = false
        )
        _showStickerSheet.value = false
    }

    fun moveOverlayPosition(trackType: TrackType, itemId: String, posXFraction: Float, posYFraction: Float) {
        val proj = activeProject() ?: return
        val x = posXFraction.coerceIn(0.08f, 0.92f)
        val y = posYFraction.coerceIn(0.08f, 0.92f)
        val updated = when (trackType) {
            TrackType.TEXT -> proj.copy(
                textLayers = proj.textLayers.map {
                    if (it.id == itemId) it.copy(posXFraction = x, posYFraction = y) else it
                }
            )
            TrackType.STICKER -> proj.copy(
                stickerLayers = proj.stickerLayers.map {
                    if (it.id == itemId) it.copy(posXFraction = x, posYFraction = y) else it
                }
            )
            else -> return
        }
        mutateProject(updated, recordHistoryThrottled = true, rebuildPlayer = false)
    }

    fun selectTimelineItem(trackType: TrackType, itemId: String) {
        if (_isMultiSelectMode.value) {
            val current = _multiSelectedIds.value.toMutableSet()
            if (current.contains(itemId)) current.remove(itemId) else current.add(itemId)
            _multiSelectedIds.value = current
        }
        _selection.value = TimelineSelection(trackType, itemId)
    }

    fun toggleMultiSelectMode() {
        val next = !_isMultiSelectMode.value
        _isMultiSelectMode.value = next
        _multiSelectedIds.value = if (next) {
            _selection.value?.itemId?.let { setOf(it) } ?: emptySet()
        } else {
            emptySet()
        }
    }

    fun moveVideoClip(fromIndex: Int, toIndex: Int) {
        val proj = activeProject() ?: return
        if (fromIndex !in proj.clips.indices || toIndex !in proj.clips.indices || fromIndex == toIndex) return
        val mutable = proj.clips.toMutableList()
        val moved = mutable.removeAt(fromIndex)
        mutable.add(toIndex, moved)
        mutateProject(
            newProject = proj.copy(clips = mutable),
            newSelection = TimelineSelection(TrackType.VIDEO, moved.id),
            rebuildPlayer = true
        )
    }

    fun moveLayerStartTime(trackType: TrackType, itemId: String, newStartMs: Long) {
        val proj = activeProject() ?: return
        val safeStart = newStartMs.coerceAtLeast(0L)
        val updated = when (trackType) {
            TrackType.AUDIO -> proj.copy(
                audioClips = proj.audioClips.map {
                    if (it.id == itemId) it.copy(startTimeMs = safeStart) else it
                }
            )
            TrackType.TEXT -> proj.copy(
                textLayers = proj.textLayers.map {
                    if (it.id == itemId) it.copy(startTimeMs = safeStart) else it
                }
            )
            TrackType.STICKER -> proj.copy(
                stickerLayers = proj.stickerLayers.map {
                    if (it.id == itemId) it.copy(startTimeMs = safeStart) else it
                }
            )
            TrackType.VIDEO -> return
        }
        mutateProject(updated, recordHistoryThrottled = true, rebuildPlayer = (trackType == TrackType.AUDIO))
    }

    fun trimItem(trackType: TrackType, itemId: String, newStartOrTrimMs: Long, newEndOrDurationMs: Long) {
        val proj = activeProject() ?: return
        when (trackType) {
            TrackType.VIDEO -> {
                val updatedClips = proj.clips.map { clip ->
                    if (clip.id != itemId) clip
                    else {
                        val maxEnd = if (clip.kind == MediaKind.IMAGE) 30_000L else clip.sourceDurationMs
                        val safeEnd = newEndOrDurationMs.coerceIn(300L, maxEnd)
                        val safeStart = newStartOrTrimMs.coerceIn(0L, safeEnd - 300L)
                        clip.copy(trimStartMs = safeStart, trimEndMs = safeEnd)
                    }
                }
                mutateProject(proj.copy(clips = updatedClips), recordHistoryThrottled = true, rebuildPlayer = false)
                trimSyncJob?.cancel()
                trimSyncJob = viewModelScope.launch {
                    delay(85L)
                    activeProject()?.let {
                        playerController.setTimelineMedia(it.clips, it.audioClips, playerController.globalPositionMs.value)
                    }
                }
            }
            TrackType.AUDIO -> {
                val updatedAudio = proj.audioClips.map { a ->
                    if (a.id != itemId) a
                    else {
                        val safeEnd = newEndOrDurationMs.coerceIn(300L, a.sourceDurationMs)
                        val safeStart = newStartOrTrimMs.coerceIn(0L, safeEnd - 300L)
                        a.copy(trimStartMs = safeStart, trimEndMs = safeEnd)
                    }
                }
                mutateProject(proj.copy(audioClips = updatedAudio), recordHistoryThrottled = true, rebuildPlayer = true)
            }
            TrackType.TEXT -> {
                val updatedText = proj.textLayers.map { t ->
                    if (t.id != itemId) t
                    else t.copy(
                        startTimeMs = newStartOrTrimMs.coerceAtLeast(0L),
                        durationMs = newEndOrDurationMs.coerceIn(400L, 60_000L)
                    )
                }
                mutateProject(proj.copy(textLayers = updatedText), recordHistoryThrottled = true, rebuildPlayer = false)
            }
            TrackType.STICKER -> {
                val updatedStickers = proj.stickerLayers.map { s ->
                    if (s.id != itemId) s
                    else s.copy(
                        startTimeMs = newStartOrTrimMs.coerceAtLeast(0L),
                        durationMs = newEndOrDurationMs.coerceIn(400L, 60_000L)
                    )
                }
                mutateProject(proj.copy(stickerLayers = updatedStickers), recordHistoryThrottled = true, rebuildPlayer = false)
            }
        }
    }

    fun splitAtPlayhead() {
        val proj = activeProject() ?: return
        if (proj.clips.isEmpty()) return

        playerController.pause()
        val playheadMs = playerController.globalPositionMs.value

        var accMs = 0L
        var targetIndex = -1
        var clipStartOnTimeline = 0L
        for (i in proj.clips.indices) {
            val c = proj.clips[i]
            val end = accMs + c.activeDurationMs
            if (playheadMs >= accMs && playheadMs <= end) {
                targetIndex = i
                clipStartOnTimeline = accMs
                break
            }
            accMs = end
        }
        if (targetIndex < 0) return

        val target = proj.clips[targetIndex]
        val localOffsetMs = playheadMs - clipStartOnTimeline
        if (localOffsetMs < 350L || target.activeDurationMs - localOffsetMs < 350L) {
            _bannerMessage.value = "Move playhead slightly away from clip edges to split."
            return
        }

        val leftClip: TimelineClip
        val rightClip: TimelineClip

        if (target.kind == MediaKind.IMAGE) {
            val rightDur = (target.activeDurationMs - localOffsetMs).coerceAtLeast(300L)
            leftClip = target.copy(trimStartMs = 0L, trimEndMs = localOffsetMs, sourceDurationMs = localOffsetMs)
            rightClip = target.copy(
                id = UUID.randomUUID().toString(),
                displayName = "${target.displayName} (2)",
                sourceDurationMs = rightDur,
                trimStartMs = 0L,
                trimEndMs = rightDur
            )
        } else {
            val splitSourceMs = target.trimStartMs + localOffsetMs
            leftClip = target.copy(trimEndMs = splitSourceMs)
            rightClip = target.copy(
                id = UUID.randomUUID().toString(),
                displayName = "${target.displayName} (2)",
                trimStartMs = splitSourceMs
            )
        }

        val updatedClips = buildList {
            proj.clips.forEachIndexed { index, clip ->
                if (index == targetIndex) {
                    add(leftClip)
                    add(rightClip)
                } else {
                    add(clip)
                }
            }
        }
        mutateProject(
            newProject = proj.copy(clips = updatedClips),
            newSelection = TimelineSelection(TrackType.VIDEO, rightClip.id),
            rebuildPlayer = true
        )
    }

    fun duplicateSelected() {
        val proj = activeProject() ?: return
        val idsToDup = if (_isMultiSelectMode.value && _multiSelectedIds.value.isNotEmpty()) {
            _multiSelectedIds.value
        } else {
            _selection.value?.itemId?.let { setOf(it) } ?: return
        }

        val newVideos = buildList {
            proj.clips.forEach { clip ->
                add(clip)
                if (clip.id in idsToDup) {
                    add(clip.copy(id = UUID.randomUUID().toString(), displayName = "${clip.displayName} Copy"))
                }
            }
        }
        val newAudios = buildList {
            proj.audioClips.forEach { a ->
                add(a)
                if (a.id in idsToDup) {
                    add(a.copy(id = UUID.randomUUID().toString(), startTimeMs = a.startTimeMs + a.activeDurationMs))
                }
            }
        }
        val newTexts = buildList {
            proj.textLayers.forEach { t ->
                add(t)
                if (t.id in idsToDup) {
                    add(t.copy(id = UUID.randomUUID().toString(), startTimeMs = t.startTimeMs + t.durationMs))
                }
            }
        }
        val newStickers = buildList {
            proj.stickerLayers.forEach { s ->
                add(s)
                if (s.id in idsToDup) {
                    add(s.copy(id = UUID.randomUUID().toString(), startTimeMs = s.startTimeMs + s.durationMs))
                }
            }
        }

        mutateProject(
            newProject = proj.copy(
                clips = newVideos,
                audioClips = newAudios,
                textLayers = newTexts,
                stickerLayers = newStickers
            ),
            rebuildPlayer = true
        )
        _bannerMessage.value = "Duplicated ${idsToDup.size} item(s)."
    }

    fun deleteSelected(ripple: Boolean) {
        val proj = activeProject() ?: return
        val idsToDelete = if (_isMultiSelectMode.value && _multiSelectedIds.value.isNotEmpty()) {
            _multiSelectedIds.value
        } else {
            _selection.value?.itemId?.let { setOf(it) } ?: return
        }

        val remainingVideos = proj.clips.filterNot { it.id in idsToDelete }
        if (remainingVideos.isEmpty()) {
            _bannerMessage.value = "Main Video track needs at least 1 clip."
            return
        }

        // Compute deleted video duration windows for true cross-track Ripple Delete
        var accMs = 0L
        val deletedVideoWindows = mutableListOf<Pair<Long, Long>>()
        proj.clips.forEach { clip ->
            val dur = clip.activeDurationMs
            if (clip.id in idsToDelete) {
                deletedVideoWindows.add(accMs to dur)
            }
            accMs += dur
        }

        fun shiftTimeForRipple(startMs: Long): Long {
            if (!ripple || deletedVideoWindows.isEmpty()) return startMs
            var shift = 0L
            deletedVideoWindows.forEach { (winStart, winDur) ->
                if (startMs >= winStart + winDur) shift += winDur
            }
            return (startMs - shift).coerceAtLeast(0L)
        }

        var nextAudios = proj.audioClips.filterNot { it.id in idsToDelete }
            .map { it.copy(startTimeMs = shiftTimeForRipple(it.startTimeMs)) }
        var nextTexts = proj.textLayers.filterNot { it.id in idsToDelete }
            .map { it.copy(startTimeMs = shiftTimeForRipple(it.startTimeMs)) }
        var nextStickers = proj.stickerLayers.filterNot { it.id in idsToDelete }
            .map { it.copy(startTimeMs = shiftTimeForRipple(it.startTimeMs)) }

        if (ripple) {
            // Also ripple-close gaps on Audio/Text/Sticker tracks when items on those tracks were deleted
            if (proj.audioClips.any { it.id in idsToDelete }) {
                var cursor = 0L
                nextAudios = nextAudios.sortedBy { it.startTimeMs }.map { a ->
                    val out = a.copy(startTimeMs = cursor)
                    cursor += a.activeDurationMs
                    out
                }
            }
            if (proj.textLayers.any { it.id in idsToDelete }) {
                var cursor = 0L
                nextTexts = nextTexts.sortedBy { it.startTimeMs }.map { t ->
                    val out = t.copy(startTimeMs = cursor)
                    cursor += t.durationMs
                    out
                }
            }
            if (proj.stickerLayers.any { it.id in idsToDelete }) {
                var cursor = 0L
                nextStickers = nextStickers.sortedBy { it.startTimeMs }.map { s ->
                    val out = s.copy(startTimeMs = cursor)
                    cursor += s.durationMs
                    out
                }
            }
        }

        val nextSel = remainingVideos.firstOrNull()?.let { TimelineSelection(TrackType.VIDEO, it.id) }
        _multiSelectedIds.value = emptySet()
        _isMultiSelectMode.value = false
        mutateProject(
            newProject = proj.copy(
                clips = remainingVideos,
                audioClips = nextAudios,
                textLayers = nextTexts,
                stickerLayers = nextStickers
            ),
            newSelection = nextSel,
            rebuildPlayer = true
        )
    }

    fun undo() {
        val current = activeProject() ?: return
        if (undoStack.isEmpty()) return
        val prev = undoStack.removeLast()
        redoStack.addLast(current)
        applyHistoryState(prev)
    }

    fun redo() {
        val current = activeProject() ?: return
        if (redoStack.isEmpty()) return
        val next = redoStack.removeLast()
        undoStack.addLast(current)
        applyHistoryState(next)
    }

    private fun applyHistoryState(snapshot: EditorProject) {
        val restored = snapshot.copy(updatedAtMs = System.currentTimeMillis(), inActiveSession = true)
        _projects.value = _projects.value.map { if (it.id == restored.id) restored else it }
        syncHistoryFlags()
        playerController.setTimelineMedia(restored.clips, restored.audioClips, playerController.globalPositionMs.value)
        viewModelScope.launch { repository.saveProject(restored) }
    }

    fun cycleActiveAspectRatio() {
        val proj = activeProject() ?: return
        mutateProject(proj.copy(aspectRatio = proj.aspectRatio.next()), rebuildPlayer = false)
    }

    fun toggleTrimPanel() {
        _showTrimPanel.value = !_showTrimPanel.value
    }

    fun toggleFullscreenPreview() {
        _isFullscreenPreview.value = !_isFullscreenPreview.value
    }

    fun setFullscreenPreview(enabled: Boolean) {
        _isFullscreenPreview.value = enabled
    }

    fun setImportSheetVisible(visible: Boolean) {
        _showImportSheet.value = visible
        if (visible) refreshRecentMedia()
    }

    fun setTextSheetVisible(visible: Boolean) {
        _showTextSheet.value = visible
    }

    fun setStickerSheetVisible(visible: Boolean) {
        _showStickerSheet.value = visible
    }

    fun openTransitionPicker(cutIndex: Int? = null) {
        val proj = activeProject() ?: return
        if (proj.clips.size < 2) {
            _bannerMessage.value = "Split a clip or add 2+ clips to apply a cut transition."
            return
        }
        val maxCut = proj.clips.lastIndex - 1
        val resolvedCut = cutIndex?.coerceIn(0, maxCut) ?: run {
            val selId = _selection.value?.itemId
            val selIdx = proj.clips.indexOfFirst { it.id == selId }
            if (selIdx >= 0) selIdx.coerceIn(0, maxCut) else 0
        }
        _transitionCutIndex.value = resolvedCut
    }

    fun closeTransitionPicker() {
        _transitionCutIndex.value = null
    }

    fun applyTransition(cutIndex: Int, transitionId: String, durationMs: Long) {
        val proj = activeProject() ?: return
        if (cutIndex !in 0 until proj.clips.lastIndex) return
        val safeDur = durationMs.coerceIn(200L, 2500L)
        val updatedClips = proj.clips.mapIndexed { idx, clip ->
            if (idx == cutIndex) {
                clip.copy(outTransitionId = transitionId, outTransitionDurationMs = safeDur)
            } else clip
        }
        mutateProject(
            newProject = proj.copy(clips = updatedClips),
            rebuildPlayer = false
        )
        playerController.refreshTransitionEffects(updatedClips)
    }

    fun applyTransitionToAll(transitionId: String, durationMs: Long) {
        val proj = activeProject() ?: return
        if (proj.clips.size < 2) return
        val safeDur = durationMs.coerceIn(200L, 2500L)
        val updatedClips = proj.clips.mapIndexed { idx, clip ->
            if (idx < proj.clips.lastIndex) {
                clip.copy(outTransitionId = transitionId, outTransitionDurationMs = safeDur)
            } else clip
        }
        mutateProject(
            newProject = proj.copy(clips = updatedClips),
            rebuildPlayer = false
        )
        playerController.refreshTransitionEffects(updatedClips)
        _bannerMessage.value = "Applied transition to all ${proj.clips.size - 1} cuts."
        _transitionCutIndex.value = null
    }

    fun removeTransition(cutIndex: Int) {
        val proj = activeProject() ?: return
        if (cutIndex !in 0 until proj.clips.lastIndex) return
        val updatedClips = proj.clips.mapIndexed { idx, clip ->
            if (idx == cutIndex) clip.copy(outTransitionId = null) else clip
        }
        mutateProject(
            newProject = proj.copy(clips = updatedClips),
            rebuildPlayer = false
        )
        playerController.refreshTransitionEffects(updatedClips)
        _transitionCutIndex.value = null
    }

    fun openEffectsSheet(initialTab: Int = 0) {
        val proj = activeProject() ?: return
        if (proj.clips.isEmpty()) {
            _bannerMessage.value = "Add a video or photo clip first."
            return
        }
        _effectsInitialTab.value = initialTab.coerceIn(0, 2)
        _showEffectsSheet.value = true
    }

    fun closeEffectsSheet() {
        _showEffectsSheet.value = false
    }

    fun applyClipEffect(clipId: String, effectId: String?, intensity: Float) {
        val proj = activeProject() ?: return
        val safeIntensity = intensity.coerceIn(0f, 1f)
        val updatedClips = proj.clips.map { clip ->
            if (clip.id == clipId) {
                clip.copy(effectId = effectId, effectIntensity = safeIntensity)
            } else clip
        }
        mutateProject(
            newProject = proj.copy(clips = updatedClips),
            recordHistoryThrottled = true,
            rebuildPlayer = false
        )
        playerController.refreshClipEffects(updatedClips)
    }

    fun applyEffectToAllClips(effectId: String?, intensity: Float) {
        val proj = activeProject() ?: return
        val safeIntensity = intensity.coerceIn(0f, 1f)
        val updatedClips = proj.clips.map { clip ->
            clip.copy(effectId = effectId, effectIntensity = safeIntensity)
        }
        mutateProject(
            newProject = proj.copy(clips = updatedClips),
            rebuildPlayer = false
        )
        playerController.refreshClipEffects(updatedClips)
        _bannerMessage.value = "Applied effect to all ${updatedClips.size} clips."
    }

    fun updateClipColorGrade(clipId: String, grade: ClipColorGrade) {
        val proj = activeProject() ?: return
        val updatedClips = proj.clips.map { clip ->
            if (clip.id == clipId) {
                clip.copy(
                    brightness = grade.brightness.coerceIn(-0.5f, 0.5f),
                    contrast = grade.contrast.coerceIn(0.4f, 2.0f),
                    saturation = grade.saturation.coerceIn(0f, 2.0f),
                    temperature = grade.temperature.coerceIn(-1f, 1f),
                    vignette = grade.vignette.coerceIn(0f, 1f)
                )
            } else clip
        }
        mutateProject(
            newProject = proj.copy(clips = updatedClips),
            recordHistoryThrottled = true,
            rebuildPlayer = false
        )
        playerController.refreshClipEffects(updatedClips)
    }

    fun applyColorGradeToAllClips(grade: ClipColorGrade) {
        val proj = activeProject() ?: return
        val updatedClips = proj.clips.map { clip ->
            clip.copy(
                brightness = grade.brightness.coerceIn(-0.5f, 0.5f),
                contrast = grade.contrast.coerceIn(0.4f, 2.0f),
                saturation = grade.saturation.coerceIn(0f, 2.0f),
                temperature = grade.temperature.coerceIn(-1f, 1f),
                vignette = grade.vignette.coerceIn(0f, 1f)
            )
        }
        mutateProject(
            newProject = proj.copy(clips = updatedClips),
            rebuildPlayer = false
        )
        playerController.refreshClipEffects(updatedClips)
        _bannerMessage.value = "Applied color grade to all ${updatedClips.size} clips."
    }

    fun updateClipChromaKey(clipId: String, config: ChromaKeyConfig) {
        val proj = activeProject() ?: return
        val updatedClips = proj.clips.map { clip ->
            if (clip.id == clipId) {
                clip.copy(
                    chromaEnabled = config.enabled,
                    chromaColorHex = config.keyColorHex,
                    chromaSimilarity = config.similarity.coerceIn(0.05f, 0.85f),
                    chromaSmoothness = config.smoothness.coerceIn(0.01f, 0.45f)
                )
            } else clip
        }
        mutateProject(
            newProject = proj.copy(clips = updatedClips),
            recordHistoryThrottled = true,
            rebuildPlayer = false
        )
        playerController.refreshClipEffects(updatedClips)
    }

    fun resetClipVisuals(clipId: String) {
        val proj = activeProject() ?: return
        val updatedClips = proj.clips.map { clip ->
            if (clip.id == clipId) {
                clip.copy(
                    effectId = null,
                    effectIntensity = 0.85f,
                    brightness = 0f,
                    contrast = 1f,
                    saturation = 1f,
                    temperature = 0f,
                    vignette = 0f,
                    chromaEnabled = false,
                    chromaColorHex = 0xFF00C853L,
                    chromaSimilarity = 0.35f,
                    chromaSmoothness = 0.12f
                )
            } else clip
        }
        mutateProject(
            newProject = proj.copy(clips = updatedClips),
            rebuildPlayer = false
        )
        playerController.refreshClipEffects(updatedClips)
        _bannerMessage.value = "Reset clip VFX, Color & Chroma Key."
    }

    fun openSpeedTransformSheet(initialTab: Int = 0) {
        val proj = activeProject() ?: return
        if (proj.clips.isEmpty()) {
            _bannerMessage.value = "Add a video or photo clip first."
            return
        }
        _speedTransformInitialTab.value = initialTab.coerceIn(0, 1)
        _showSpeedTransformSheet.value = true
    }

    fun closeSpeedTransformSheet() {
        _showSpeedTransformSheet.value = false
    }

    fun openKeyframeSheet() {
        val proj = activeProject() ?: return
        if (proj.clips.isEmpty() && proj.textLayers.isEmpty() && proj.stickerLayers.isEmpty()) {
            _bannerMessage.value = "Add a clip, text, or sticker first."
            return
        }
        _showKeyframeSheet.value = true
    }

    fun closeKeyframeSheet() {
        _showKeyframeSheet.value = false
    }

    fun openAudioStudioSheet(initialTab: Int = 0) {
        _audioStudioInitialTab.value = initialTab.coerceIn(0, 1)
        _showAudioStudioSheet.value = true
    }

    fun closeAudioStudioSheet() {
        _showAudioStudioSheet.value = false
    }

    fun updateClipSpeed(clipId: String, speed: Float, ramp: SpeedRampPreset) {
        val proj = activeProject() ?: return
        val safeSpeed = speed.coerceIn(0.1f, 10.0f)
        val updatedClips = proj.clips.map { clip ->
            if (clip.id == clipId && clip.kind == MediaKind.VIDEO) {
                clip.copy(speed = safeSpeed, speedRamp = ramp)
            } else clip
        }
        mutateProject(
            newProject = proj.copy(clips = updatedClips),
            recordHistoryThrottled = true,
            rebuildPlayer = false
        )
        trimSyncJob?.cancel()
        trimSyncJob = viewModelScope.launch {
            delay(110L)
            activeProject()?.let {
                playerController.setTimelineMedia(it.clips, it.audioClips, playerController.globalPositionMs.value)
            }
        }
    }

    fun freezeFrameAtPlayhead(clipId: String) {
        val proj = activeProject() ?: return
        val idx = proj.clips.indexOfFirst { it.id == clipId }.takeIf { it >= 0 } ?: 0
        val clip = proj.clips.getOrNull(idx) ?: return
        playerController.pause()

        var accMs = 0L
        for (i in 0 until idx) accMs += proj.clips[i].activeDurationMs
        val globalPos = playerController.globalPositionMs.value
        val localMs = (globalPos - accMs).coerceIn(0L, clip.activeDurationMs)
        val sourceTimeMs = if (clip.kind == MediaKind.IMAGE) {
            0L
        } else {
            (clip.trimStartMs + (localMs * clip.effectiveSpeed).toLong())
                .coerceIn(clip.trimStartMs, clip.trimEndMs)
        }

        viewModelScope.launch {
            val file = FreezeFrameHelper.captureFrameFile(appContext, clip.uriString, sourceTimeMs)
            if (file == null) {
                _bannerMessage.value = "Could not capture freeze frame from this clip."
                return@launch
            }
            val freezeClip = TimelineClip(
                uriString = Uri.fromFile(file).toString(),
                displayName = "Freeze ${clip.displayName.take(8)}",
                kind = MediaKind.IMAGE,
                sourceDurationMs = 3000L,
                trimStartMs = 0L,
                trimEndMs = 3000L
            )
            val latest = activeProject() ?: proj
            val insertAt = (latest.clips.indexOfFirst { it.id == clip.id }.takeIf { it >= 0 } ?: 0) + 1
            val updatedClips = latest.clips.toMutableList().apply { add(insertAt, freezeClip) }
            mutateProject(
                newProject = latest.copy(clips = updatedClips),
                newSelection = TimelineSelection(TrackType.VIDEO, freezeClip.id),
                rebuildPlayer = true
            )
            _bannerMessage.value = "Freeze frame added (3.0s)."
        }
    }

    fun updateClipTransform(
        clipId: String,
        scale: Float,
        panX: Float,
        panY: Float,
        rotationDeg: Float,
        flipH: Boolean,
        flipV: Boolean,
        opacity: Float,
        blendMode: BlendModePreset
    ) {
        val proj = activeProject() ?: return
        val updatedClips = proj.clips.map { clip ->
            if (clip.id == clipId) {
                clip.copy(
                    scale = scale.coerceIn(0.25f, 4.0f),
                    panX = panX.coerceIn(-0.8f, 0.8f),
                    panY = panY.coerceIn(-0.8f, 0.8f),
                    rotationDeg = rotationDeg.coerceIn(-180f, 180f),
                    flipHorizontal = flipH,
                    flipVertical = flipV,
                    opacity = opacity.coerceIn(0f, 1f),
                    blendMode = blendMode
                )
            } else clip
        }
        mutateProject(
            newProject = proj.copy(clips = updatedClips),
            recordHistoryThrottled = true,
            rebuildPlayer = false
        )
        playerController.refreshClipEffects(updatedClips)
    }

    fun resetClipTransform(clipId: String) {
        val proj = activeProject() ?: return
        val updatedClips = proj.clips.map { clip ->
            if (clip.id == clipId) {
                clip.copy(
                    scale = 1.0f,
                    panX = 0f,
                    panY = 0f,
                    rotationDeg = 0f,
                    flipHorizontal = false,
                    flipVertical = false,
                    opacity = 1.0f,
                    blendMode = BlendModePreset.NORMAL
                )
            } else clip
        }
        mutateProject(
            newProject = proj.copy(clips = updatedClips),
            rebuildPlayer = false
        )
        playerController.refreshClipEffects(updatedClips)
        _bannerMessage.value = "Transform & Blend reset."
    }

    fun addOrUpdateKeyframe(trackType: TrackType, itemId: String, node: KeyframeNode) {
        val proj = activeProject() ?: return
        fun upsert(list: List<KeyframeNode>): List<KeyframeNode> {
            val filtered = list.filterNot {
                it.id == node.id || kotlin.math.abs(it.timeOffsetMs - node.timeOffsetMs) <= 80L
            }
            return (filtered + node).sortedBy { it.timeOffsetMs }
        }

        val updated = when (trackType) {
            TrackType.VIDEO -> {
                val nextClips = proj.clips.map { if (it.id == itemId) it.copy(keyframes = upsert(it.keyframes)) else it }
                playerController.refreshClipEffects(nextClips)
                proj.copy(clips = nextClips)
            }
            TrackType.TEXT -> proj.copy(
                textLayers = proj.textLayers.map { if (it.id == itemId) it.copy(keyframes = upsert(it.keyframes)) else it }
            )
            TrackType.STICKER -> proj.copy(
                stickerLayers = proj.stickerLayers.map { if (it.id == itemId) it.copy(keyframes = upsert(it.keyframes)) else it }
            )
            TrackType.AUDIO -> return
        }
        mutateProject(updated, recordHistoryThrottled = true, rebuildPlayer = false)
    }

    fun deleteKeyframe(trackType: TrackType, itemId: String, keyframeId: String) {
        val proj = activeProject() ?: return
        val updated = when (trackType) {
            TrackType.VIDEO -> {
                val nextClips = proj.clips.map { clip ->
                    if (clip.id == itemId) clip.copy(keyframes = clip.keyframes.filterNot { it.id == keyframeId }) else clip
                }
                playerController.refreshClipEffects(nextClips)
                proj.copy(clips = nextClips)
            }
            TrackType.TEXT -> proj.copy(
                textLayers = proj.textLayers.map { layer ->
                    if (layer.id == itemId) layer.copy(keyframes = layer.keyframes.filterNot { it.id == keyframeId }) else layer
                }
            )
            TrackType.STICKER -> proj.copy(
                stickerLayers = proj.stickerLayers.map { sticker ->
                    if (sticker.id == itemId) sticker.copy(keyframes = sticker.keyframes.filterNot { it.id == keyframeId }) else sticker
                }
            )
            TrackType.AUDIO -> return
        }
        mutateProject(updated, rebuildPlayer = false)
    }

    fun updateAudioMix(audioId: String, volume: Float, fadeInMs: Long, fadeOutMs: Long) {
        val proj = activeProject() ?: return
        val updatedAudio = proj.audioClips.map { audio ->
            if (audio.id == audioId) {
                audio.copy(
                    volume = volume.coerceIn(0f, 2f),
                    fadeInMs = fadeInMs.coerceIn(0L, 5000L),
                    fadeOutMs = fadeOutMs.coerceIn(0L, 5000L)
                )
            } else audio
        }
        mutateProject(
            newProject = proj.copy(audioClips = updatedAudio),
            recordHistoryThrottled = true,
            rebuildPlayer = false
        )
        playerController.refreshAudioClips(updatedAudio)
    }

    fun reanalyzeAudioBeats(audioId: String) {
        val proj = activeProject() ?: return
        val audio = proj.audioClips.firstOrNull { it.id == audioId } ?: return
        analyzeAudioInBackground(proj.id, audio.id, audio.uriString, audio.sourceDurationMs)
        _bannerMessage.value = "Analyzing PCM waveform & beats..."
    }

    private fun analyzeAudioInBackground(projectId: String, audioId: String, uriString: String, durationMs: Long) {
        viewModelScope.launch {
            val result = AudioWaveformExtractor.analyze(appContext, uriString, durationMs)
            val currentList = _projects.value
            val targetProj = currentList.firstOrNull { it.id == projectId } ?: return@launch
            if (targetProj.audioClips.none { it.id == audioId }) return@launch
            val updatedProj = targetProj.copy(
                audioClips = targetProj.audioClips.map { a ->
                    if (a.id == audioId) {
                        a.copy(waveformPeaks = result.waveformPeaks, beatMarkersMs = result.beatMarkersMs)
                    } else a
                }
            )
            _projects.value = currentList.map { if (it.id == updatedProj.id) updatedProj else it }
            repository.saveProject(updatedProj)
        }
    }

    fun startVoiceoverRecording() {
        if (_isRecordingVoiceover.value) return
        playerController.pause()
        val ok = voiceoverRecorder.startRecording()
        if (!ok) {
            _bannerMessage.value = "Could not initialize microphone recorder."
            return
        }
        _isRecordingVoiceover.value = true
        _voiceoverElapsedMs.value = 0L
        _voiceoverAmplitude.value = 0f
        voiceoverPollJob?.cancel()
        voiceoverPollJob = viewModelScope.launch {
            while (isActive && _isRecordingVoiceover.value) {
                _voiceoverAmplitude.value = voiceoverRecorder.currentAmplitudeNormalized()
                _voiceoverElapsedMs.value = voiceoverRecorder.elapsedMs()
                delay(60L)
            }
        }
    }

    fun stopVoiceoverRecording() {
        if (!_isRecordingVoiceover.value) return
        _isRecordingVoiceover.value = false
        voiceoverPollJob?.cancel()
        voiceoverPollJob = null
        val finalized = voiceoverRecorder.stopAndFinalize()
        _voiceoverAmplitude.value = 0f
        _voiceoverElapsedMs.value = 0L

        if (finalized == null) {
            _bannerMessage.value = "Voiceover too short or empty."
            return
        }
        val (file, durMs) = finalized
        val proj = activeProject() ?: return
        val startMs = playerController.globalPositionMs.value
        val uriString = Uri.fromFile(file).toString()

        viewModelScope.launch {
            val analysis = AudioWaveformExtractor.analyze(appContext, uriString, durMs)
            val voClip = AudioClip(
                uriString = uriString,
                displayName = "Voiceover ${proj.audioClips.size + 1}",
                startTimeMs = startMs,
                sourceDurationMs = durMs,
                trimStartMs = 0L,
                trimEndMs = durMs,
                volume = 1.0f,
                waveformPeaks = analysis.waveformPeaks,
                beatMarkersMs = analysis.beatMarkersMs
            )
            val latest = activeProject() ?: proj
            mutateProject(
                newProject = latest.copy(audioClips = latest.audioClips + voClip),
                newSelection = TimelineSelection(TrackType.AUDIO, voClip.id),
                rebuildPlayer = true
            )
            _bannerMessage.value = "Voiceover added (${MediaPickerHelper.formatDuration(durMs)})."
        }
    }

    private fun cancelVoiceoverIfRecording() {
        _isRecordingVoiceover.value = false
        voiceoverPollJob?.cancel()
        voiceoverPollJob = null
        voiceoverRecorder.cancel()
        _voiceoverAmplitude.value = 0f
        _voiceoverElapsedMs.value = 0L
    }

    fun setExportSheetVisible(visible: Boolean) {
        if (visible) {
            playerController.pause()
            _exportState.value = ExportState.Idle
        }
        _showExportSheet.value = visible
    }

    fun selectExportResolution(resolution: ExportResolution) {
        _exportResolution.value = resolution
    }

    fun startExport() {
        val proj = activeProject() ?: return
        playerController.pause()
        exporter.startExport(
            project = proj,
            resolution = _exportResolution.value
        ) { nextState ->
            _exportState.value = nextState
        }
    }

    fun cancelExport() {
        exporter.cancel()
        _exportState.value = ExportState.Idle
    }

    fun dismissBanner() {
        _bannerMessage.value = null
    }

    private fun mutateProject(
        newProject: EditorProject,
        newSelection: TimelineSelection? = _selection.value,
        recordHistoryThrottled: Boolean = false,
        rebuildPlayer: Boolean
    ) {
        val current = activeProject() ?: return
        val now = System.currentTimeMillis()
        if (!recordHistoryThrottled || now - lastContinuousHistoryMs > 700L) {
            if (undoStack.size >= 40) undoStack.removeFirst()
            undoStack.addLast(current)
            redoStack.clear()
            lastContinuousHistoryMs = now
        }
        syncHistoryFlags()

        val saved = newProject.copy(updatedAtMs = now, inActiveSession = true)
        _projects.value = _projects.value.map { if (it.id == saved.id) saved else it }
        _selection.value = newSelection
        if (rebuildPlayer) {
            playerController.setTimelineMedia(
                saved.clips,
                saved.audioClips,
                preservePositionMs = playerController.globalPositionMs.value
            )
        }
        viewModelScope.launch { repository.saveProject(saved) }
    }

    private fun clearHistory() {
        undoStack.clear()
        redoStack.clear()
        syncHistoryFlags()
    }

    private fun syncHistoryFlags() {
        _canUndo.value = undoStack.isNotEmpty()
        _canRedo.value = redoStack.isNotEmpty()
    }

    override fun onCleared() {
        super.onCleared()
        trimSyncJob?.cancel()
        cancelVoiceoverIfRecording()
        exporter.cancel()
        playerController.release()
    }
}
