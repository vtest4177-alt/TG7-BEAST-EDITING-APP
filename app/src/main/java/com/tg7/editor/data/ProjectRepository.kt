package com.tg7.editor.data

import android.content.Context
import com.tg7.editor.model.CanvasAspectRatio
import com.tg7.editor.model.EditorProject
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.TimelineClip
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class ProjectRepository(context: Context) {
    private val file = File(context.applicationContext.filesDir, "tg7_projects_v1.json")

    suspend fun loadProjects(): List<EditorProject> = withContext(Dispatchers.IO) {
        if (!file.exists()) return@withContext emptyList()
        runCatching {
            val raw = file.readText()
            if (raw.isBlank()) return@withContext emptyList()
            val arr = JSONArray(raw)
            buildList {
                for (i in 0 until arr.length()) {
                    val obj = arr.optJSONObject(i) ?: continue
                    val aspect = runCatching {
                        CanvasAspectRatio.valueOf(
                            obj.optString("aspectRatio", CanvasAspectRatio.PORTRAIT_9_16.name)
                        )
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
                    add(
                        EditorProject(
                            id = obj.optString("id"),
                            name = obj.optString("name", "Untitled Edit"),
                            aspectRatio = aspect,
                            updatedAtMs = obj.optLong("updatedAtMs", System.currentTimeMillis()),
                            clips = clips
                        )
                    )
                }
            }.sortedByDescending { it.updatedAtMs }
        }.getOrDefault(emptyList())
    }

    suspend fun saveProjects(projects: List<EditorProject>) = withContext(Dispatchers.IO) {
        runCatching {
            val root = JSONArray()
            projects.sortedByDescending { it.updatedAtMs }.forEach { project ->
                val obj = JSONObject().apply {
                    put("id", project.id)
                    put("name", project.name)
                    put("aspectRatio", project.aspectRatio.name)
                    put("updatedAtMs", project.updatedAtMs)
                    val clipsArr = JSONArray()
                    project.clips.forEach { clip ->
                        clipsArr.put(
                            JSONObject().apply {
                                put("id", clip.id)
                                put("uriString", clip.uriString)
                                put("displayName", clip.displayName)
                                put("kind", clip.kind.name)
                                put("sourceDurationMs", clip.sourceDurationMs)
                                put("trimStartMs", clip.trimStartMs)
                                put("trimEndMs", clip.trimEndMs)
                            }
                        )
                    }
                    put("clips", clipsArr)
                }
                root.put(obj)
            }
            file.writeText(root.toString())
        }
    }
}
