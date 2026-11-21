package com.tg7.editor.data

import android.content.Context
import com.tg7.editor.data.db.AppDatabase
import com.tg7.editor.data.db.AudioClipEntity
import com.tg7.editor.data.db.ProjectEntity
import com.tg7.editor.data.db.ProjectWithLayers
import com.tg7.editor.data.db.StickerLayerEntity
import com.tg7.editor.data.db.TextLayerEntity
import com.tg7.editor.data.db.VideoClipEntity
import com.tg7.editor.engine.anim.KeyframeEngine
import com.tg7.editor.model.AudioClip
import com.tg7.editor.model.BlendModePreset
import com.tg7.editor.model.CanvasAspectRatio
import com.tg7.editor.model.EditorProject
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.SpeedRampPreset
import com.tg7.editor.model.StickerLayer
import com.tg7.editor.model.StickerPreset
import com.tg7.editor.model.TextFontFamily
import com.tg7.editor.model.TextLayer
import com.tg7.editor.model.TimelineClip
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.io.File

class ProjectRepository(context: Context) {
    private val appContext = context.applicationContext
    private val dao = AppDatabase.getInstance(appContext).projectDao()
    private val legacyJsonFile = File(appContext.filesDir, "tg7_projects_v1.json")

    suspend fun loadProjects(): List<EditorProject> = withContext(Dispatchers.IO) {
        migrateLegacyJsonIfNeeded()
        dao.getAllProjectsWithLayers().map { it.toDomain() }
    }

    suspend fun findRecoveryProject(): EditorProject? = withContext(Dispatchers.IO) {
        dao.getRecoveryProject()?.toDomain()
    }

    suspend fun saveProject(project: EditorProject) = withContext(Dispatchers.IO) {
        val projectEntity = ProjectEntity(
            id = project.id,
            name = project.name,
            aspectRatio = project.aspectRatio.name,
            updatedAtMs = project.updatedAtMs,
            inActiveSession = project.inActiveSession
        )
        val videoEntities = project.clips.mapIndexed { idx, c ->
            VideoClipEntity(
                id = c.id,
                projectId = project.id,
                orderIndex = idx,
                uriString = c.uriString,
                displayName = c.displayName,
                kind = c.kind.name,
                sourceDurationMs = c.sourceDurationMs,
                trimStartMs = c.trimStartMs,
                trimEndMs = c.trimEndMs,
                outTransitionId = c.outTransitionId,
                outTransitionDurationMs = c.outTransitionDurationMs,
                effectId = c.effectId,
                effectIntensity = c.effectIntensity,
                brightness = c.brightness,
                contrast = c.contrast,
                saturation = c.saturation,
                temperature = c.temperature,
                vignette = c.vignette,
                chromaEnabled = c.chromaEnabled,
                chromaColorHex = c.chromaColorHex,
                chromaSimilarity = c.chromaSimilarity,
                chromaSmoothness = c.chromaSmoothness,
                speed = c.speed,
                speedRamp = c.speedRamp.name,
                scale = c.scale,
                panX = c.panX,
                panY = c.panY,
                rotationDeg = c.rotationDeg,
                flipHorizontal = c.flipHorizontal,
                flipVertical = c.flipVertical,
                opacity = c.opacity,
                blendMode = c.blendMode.name,
                keyframesJson = KeyframeEngine.keyframesToJson(c.keyframes)
            )
        }
        val audioEntities = project.audioClips.map { a ->
            AudioClipEntity(
                id = a.id,
                projectId = project.id,
                uriString = a.uriString,
                displayName = a.displayName,
                startTimeMs = a.startTimeMs,
                sourceDurationMs = a.sourceDurationMs,
                trimStartMs = a.trimStartMs,
                trimEndMs = a.trimEndMs,
                volume = a.volume,
                fadeInMs = a.fadeInMs,
                fadeOutMs = a.fadeOutMs,
                waveformJson = KeyframeEngine.floatListToJson(a.waveformPeaks),
                beatsJson = KeyframeEngine.longListToJson(a.beatMarkersMs)
            )
        }
        val textEntities = project.textLayers.map { t ->
            TextLayerEntity(
                id = t.id,
                projectId = project.id,
                text = t.text,
                startTimeMs = t.startTimeMs,
                durationMs = t.durationMs,
                posXFraction = t.posXFraction,
                posYFraction = t.posYFraction,
                colorHex = t.colorHex,
                fontSizeSp = t.fontSizeSp,
                templateId = t.templateId,
                animationId = t.animationId,
                fontFamily = t.fontFamily.wireName,
                bgColorHex = t.bgColorHex,
                hasOutline = t.hasOutline,
                letterSpacingEm = t.letterSpacingEm,
                scale = t.scale,
                rotationDeg = t.rotationDeg,
                opacity = t.opacity,
                keyframesJson = KeyframeEngine.keyframesToJson(t.keyframes)
            )
        }
        val stickerEntities = project.stickerLayers.map { s ->
            StickerLayerEntity(
                id = s.id,
                projectId = project.id,
                presetName = s.preset.name,
                startTimeMs = s.startTimeMs,
                durationMs = s.durationMs,
                posXFraction = s.posXFraction,
                posYFraction = s.posYFraction,
                sizeDp = s.sizeDp,
                tintHex = s.tintHex,
                lottieAssetPath = s.lottieAssetPath,
                label = s.label,
                scale = s.scale,
                rotationDeg = s.rotationDeg,
                opacity = s.opacity,
                keyframesJson = KeyframeEngine.keyframesToJson(s.keyframes)
            )
        }
        dao.saveProjectFull(
            project = projectEntity,
            videoClips = videoEntities,
            audioClips = audioEntities,
            textLayers = textEntities,
            stickerLayers = stickerEntities
        )
    }

    suspend fun deleteProject(projectId: String) = withContext(Dispatchers.IO) {
        dao.deleteProjectById(projectId)
    }

    suspend fun markSessionActive(projectId: String?) = withContext(Dispatchers.IO) {
        dao.clearAllActiveSessions()
        if (projectId != null) {
            dao.setSessionActive(projectId, true)
        }
    }

    private suspend fun migrateLegacyJsonIfNeeded() {
        if (!legacyJsonFile.exists()) return
        runCatching {
            val raw = legacyJsonFile.readText()
            if (raw.isNotBlank()) {
                val arr = JSONArray(raw)
                for (i in 0 until arr.length()) {
                    val obj = arr.optJSONObject(i) ?: continue
                    val aspect = runCatching {
                        CanvasAspectRatio.valueOf(obj.optString("aspectRatio", CanvasAspectRatio.PORTRAIT_9_16.name))
                    }.getOrDefault(CanvasAspectRatio.PORTRAIT_9_16)
                    val clipsArr = obj.optJSONArray("clips") ?: JSONArray()
                    val clips = buildList {
                        for (j in 0 until clipsArr.length()) {
                            val c = clipsArr.optJSONObject(j) ?: continue
                            val kind = runCatching {
                                MediaKind.valueOf(c.optString("kind", MediaKind.VIDEO.name))
                            }.getOrDefault(MediaKind.VIDEO)
                            val dur = c.optLong("sourceDurationMs", 4000L).coerceAtLeast(300L)
                            add(
                                TimelineClip(
                                    id = c.optString("id"),
                                    uriString = c.optString("uriString"),
                                    displayName = c.optString("displayName", "Clip"),
                                    kind = kind,
                                    sourceDurationMs = dur,
                                    trimStartMs = c.optLong("trimStartMs", 0L).coerceIn(0L, dur - 300L),
                                    trimEndMs = c.optLong("trimEndMs", dur).coerceIn(300L, dur)
                                )
                            )
                        }
                    }
                    saveProject(
                        EditorProject(
                            id = obj.optString("id"),
                            name = obj.optString("name", "Untitled Edit"),
                            aspectRatio = aspect,
                            updatedAtMs = obj.optLong("updatedAtMs", System.currentTimeMillis()),
                            clips = clips
                        )
                    )
                }
            }
            legacyJsonFile.delete()
        }
    }

    private fun ProjectWithLayers.toDomain(): EditorProject {
        val ratio = runCatching {
            CanvasAspectRatio.valueOf(project.aspectRatio)
        }.getOrDefault(CanvasAspectRatio.PORTRAIT_9_16)

        return EditorProject(
            id = project.id,
            name = project.name,
            aspectRatio = ratio,
            updatedAtMs = project.updatedAtMs,
            inActiveSession = project.inActiveSession,
            clips = videoClips.sortedBy { it.orderIndex }.map { c ->
                val kind = runCatching { MediaKind.valueOf(c.kind) }.getOrDefault(MediaKind.VIDEO)
                TimelineClip(
                    id = c.id,
                    uriString = c.uriString,
                    displayName = c.displayName,
                    kind = kind,
                    sourceDurationMs = c.sourceDurationMs,
                    trimStartMs = c.trimStartMs,
                    trimEndMs = c.trimEndMs,
                    outTransitionId = c.outTransitionId,
                    outTransitionDurationMs = c.outTransitionDurationMs,
                    effectId = c.effectId,
                    effectIntensity = c.effectIntensity,
                    brightness = c.brightness,
                    contrast = c.contrast,
                    saturation = c.saturation,
                    temperature = c.temperature,
                    vignette = c.vignette,
                    chromaEnabled = c.chromaEnabled,
                    chromaColorHex = c.chromaColorHex,
                    chromaSimilarity = c.chromaSimilarity,
                    chromaSmoothness = c.chromaSmoothness,
                    speed = c.speed,
                    speedRamp = runCatching { SpeedRampPreset.valueOf(c.speedRamp) }.getOrDefault(SpeedRampPreset.NONE),
                    scale = c.scale,
                    panX = c.panX,
                    panY = c.panY,
                    rotationDeg = c.rotationDeg,
                    flipHorizontal = c.flipHorizontal,
                    flipVertical = c.flipVertical,
                    opacity = c.opacity,
                    blendMode = runCatching { BlendModePreset.valueOf(c.blendMode) }.getOrDefault(BlendModePreset.NORMAL),
                    keyframes = KeyframeEngine.keyframesFromJson(c.keyframesJson)
                )
            },
            audioClips = audioClips.sortedBy { it.startTimeMs }.map { a ->
                AudioClip(
                    id = a.id,
                    uriString = a.uriString,
                    displayName = a.displayName,
                    startTimeMs = a.startTimeMs,
                    sourceDurationMs = a.sourceDurationMs,
                    trimStartMs = a.trimStartMs,
                    trimEndMs = a.trimEndMs,
                    volume = a.volume,
                    fadeInMs = a.fadeInMs,
                    fadeOutMs = a.fadeOutMs,
                    waveformPeaks = KeyframeEngine.floatListFromJson(a.waveformJson),
                    beatMarkersMs = KeyframeEngine.longListFromJson(a.beatsJson)
                )
            },
            textLayers = textLayers.sortedBy { it.startTimeMs }.map { t ->
                TextLayer(
                    id = t.id,
                    text = t.text,
                    startTimeMs = t.startTimeMs,
                    durationMs = t.durationMs,
                    posXFraction = t.posXFraction,
                    posYFraction = t.posYFraction,
                    colorHex = t.colorHex,
                    fontSizeSp = t.fontSizeSp,
                    templateId = t.templateId,
                    animationId = t.animationId,
                    fontFamily = TextFontFamily.fromWire(t.fontFamily),
                    bgColorHex = t.bgColorHex,
                    hasOutline = t.hasOutline,
                    letterSpacingEm = t.letterSpacingEm,
                    scale = t.scale,
                    rotationDeg = t.rotationDeg,
                    opacity = t.opacity,
                    keyframes = KeyframeEngine.keyframesFromJson(t.keyframesJson)
                )
            },
            stickerLayers = stickerLayers.sortedBy { it.startTimeMs }.map { s ->
                val preset = runCatching { StickerPreset.valueOf(s.presetName) }.getOrDefault(StickerPreset.STAR)
                StickerLayer(
                    id = s.id,
                    preset = preset,
                    startTimeMs = s.startTimeMs,
                    durationMs = s.durationMs,
                    posXFraction = s.posXFraction,
                    posYFraction = s.posYFraction,
                    sizeDp = s.sizeDp,
                    tintHex = s.tintHex,
                    lottieAssetPath = s.lottieAssetPath,
                    label = s.label,
                    scale = s.scale,
                    rotationDeg = s.rotationDeg,
                    opacity = s.opacity,
                    keyframes = KeyframeEngine.keyframesFromJson(s.keyframesJson)
                )
            }
        )
    }
}
