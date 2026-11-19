package com.tg7.editor.ui.editor

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tg7.editor.data.ProjectRepository
import com.tg7.editor.data.RecentMediaLoader
import com.tg7.editor.engine.export.HardwareVideoExporter
import com.tg7.editor.engine.player.StudioPlayerController
import com.tg7.editor.media.MediaPickerHelper
import com.tg7.editor.model.CanvasAspectRatio
import com.tg7.editor.model.EditorProject
import com.tg7.editor.model.ExportResolution
import com.tg7.editor.model.ExportState
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.RecentMediaItem
import com.tg7.editor.model.TimelineClip
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

class EditorViewModel(application: Application) : AndroidViewModel(application) {
    private val appContext = application.applicationContext
    private val repository = ProjectRepository(appContext)
    val playerController = StudioPlayerController(appContext, viewModelScope)
    private val exporter = HardwareVideoExporter(appContext)

    private val _projects = MutableStateFlow<List<EditorProject>>(emptyList())
    val projects: StateFlow<List<EditorProject>> = _projects.asStateFlow()

    private val _activeProjectId = MutableStateFlow<String?>(null)
    val activeProjectId: StateFlow<String?> = _activeProjectId.asStateFlow()

    private val _selectedClipId = MutableStateFlow<String?>(null)
    val selectedClipId: StateFlow<String?> = _selectedClipId.asStateFlow()

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

    private val _showTrimPanel = MutableStateFlow(false)
    val showTrimPanel: StateFlow<Boolean> = _showTrimPanel.asStateFlow()

    private val _isFullscreenPreview = MutableStateFlow(false)
    val isFullscreenPreview: StateFlow<Boolean> = _isFullscreenPreview.asStateFlow()

    private val _isImporting = MutableStateFlow(false)
    val isImporting: StateFlow<Boolean> = _isImporting.asStateFlow()

    private val _bannerMessage = MutableStateFlow<String?>(null)
    val bannerMessage: StateFlow<String?> = _bannerMessage.asStateFlow()

    private var trimSyncJob: Job? = null

    init {
        viewModelScope.launch {
            _projects.value = repository.loadProjects()
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

    fun cycleActiveAspectRatio() {
        val proj = activeProject() ?: return
        val nextRatio = proj.aspectRatio.next()
        val updatedProjects = _projects.value.map { p ->
            if (p.id == proj.id) p.copy(aspectRatio = nextRatio, updatedAtMs = System.currentTimeMillis())
            else p
        }
        _projects.value = updatedProjects
        viewModelScope.launch { repository.saveProjects(updatedProjects) }
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
                clips = probed
            )
            val updated = listOf(project) + _projects.value
            _projects.value = updated
            _activeProjectId.value = project.id
            _selectedClipId.value = probed.first().id
            _showTrimPanel.value = false
            _isFullscreenPreview.value = false
            playerController.setTimelineClips(probed, preservePositionMs = 0L)
            repository.saveProjects(updated)
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
            clips = listOf(clip)
        )
        val updated = listOf(project) + _projects.value
        _projects.value = updated
        _activeProjectId.value = project.id
        _selectedClipId.value = clip.id
        _showTrimPanel.value = false
        _isFullscreenPreview.value = false
        playerController.setTimelineClips(project.clips, preservePositionMs = 0L)
        viewModelScope.launch { repository.saveProjects(updated) }
    }

    fun openProject(projectId: String) {
        val proj = _projects.value.firstOrNull { it.id == projectId } ?: return
        _activeProjectId.value = proj.id
        _selectedClipId.value = proj.clips.firstOrNull()?.id
        _showTrimPanel.value = false
        _isFullscreenPreview.value = false
        playerController.setTimelineClips(proj.clips, preservePositionMs = 0L)
    }

    fun closeEditor() {
        playerController.pause()
        _isFullscreenPreview.value = false
        _showTrimPanel.value = false
        _showImportSheet.value = false
        _activeProjectId.value = null
    }

    fun deleteProject(projectId: String) {
        val updated = _projects.value.filterNot { it.id == projectId }
        _projects.value = updated
        if (_activeProjectId.value == projectId) {
            closeEditor()
        }
        viewModelScope.launch { repository.saveProjects(updated) }
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
            val updatedClips = proj.clips + probed
            updateActiveClips(updatedClips, selectClipId = probed.first().id, rebuildPlayer = true)
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
        updateActiveClips(proj.clips + clip, selectClipId = clip.id, rebuildPlayer = true)
        _showImportSheet.value = false
    }

    fun onAudioPicked(uri: Uri) {
        MediaPickerHelper.persistReadPermission(appContext, uri)
        _showImportSheet.value = false
        _bannerMessage.value = "Audio file permission saved (full audio track & SFX mixer comes in Phase 2+)."
    }

    fun selectClip(clipId: String) {
        _selectedClipId.value = clipId
    }

    fun trimClip(clipId: String, newTrimStartMs: Long, newTrimEndMs: Long) {
        val proj = activeProject() ?: return
        val updatedClips = proj.clips.map { clip ->
            if (clip.id != clipId) clip
            else {
                val maxEnd = if (clip.kind == MediaKind.IMAGE) 30_000L else clip.sourceDurationMs
                val safeEnd = newTrimEndMs.coerceIn(300L, maxEnd)
                val safeStart = newTrimStartMs.coerceIn(0L, safeEnd - 300L)
                clip.copy(trimStartMs = safeStart, trimEndMs = safeEnd)
            }
        }
        updateActiveClips(updatedClips, selectClipId = clipId, rebuildPlayer = false)
        trimSyncJob?.cancel()
        trimSyncJob = viewModelScope.launch {
            delay(85L)
            playerController.setTimelineClips(updatedClips, preservePositionMs = playerController.globalPositionMs.value)
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
        updateActiveClips(updatedClips, selectClipId = rightClip.id, rebuildPlayer = true)
    }

    fun deleteSelectedClip() {
        val proj = activeProject() ?: return
        val selId = _selectedClipId.value ?: return
        if (proj.clips.size <= 1) {
            _bannerMessage.value = "Project needs at least one clip on the timeline."
            return
        }
        val updatedClips = proj.clips.filterNot { it.id == selId }
        updateActiveClips(updatedClips, selectClipId = updatedClips.firstOrNull()?.id, rebuildPlayer = true)
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
            projectName = proj.name,
            clips = proj.clips,
            aspectRatio = proj.aspectRatio,
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

    private fun updateActiveClips(
        newClips: List<TimelineClip>,
        selectClipId: String?,
        rebuildPlayer: Boolean
    ) {
        val activeId = _activeProjectId.value ?: return
        val updatedProjects = _projects.value.map { proj ->
            if (proj.id == activeId) {
                proj.copy(clips = newClips, updatedAtMs = System.currentTimeMillis())
            } else {
                proj
            }
        }
        _projects.value = updatedProjects
        _selectedClipId.value = selectClipId
        if (rebuildPlayer) {
            playerController.setTimelineClips(
                newClips,
                preservePositionMs = playerController.globalPositionMs.value
            )
        }
        viewModelScope.launch { repository.saveProjects(updatedProjects) }
    }

    override fun onCleared() {
        super.onCleared()
        trimSyncJob?.cancel()
        exporter.cancel()
        playerController.release()
    }
}
