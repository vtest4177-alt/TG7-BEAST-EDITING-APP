package com.tg7.editor.data

import android.content.Context
import com.tg7.editor.model.TransitionShaderFamily
import com.tg7.editor.model.TransitionSpec
import org.json.JSONObject

object TransitionManifestLoader {
    @Volatile
    private var cachedTransitions: List<TransitionSpec>? = null

    @Volatile
    private var cachedMap: Map<String, TransitionSpec>? = null

    fun getAll(context: Context): List<TransitionSpec> {
        cachedTransitions?.let { return it }
        return synchronized(this) {
            cachedTransitions?.let { return it }
            val loaded = parseFromAssets(context.applicationContext)
            cachedTransitions = loaded
            cachedMap = loaded.associateBy { it.id }
            loaded
        }
    }

    fun findById(context: Context, id: String?): TransitionSpec? {
        if (id.isNullOrBlank()) return null
        if (cachedMap == null) getAll(context)
        return cachedMap?.get(id)
    }

    fun getCategories(context: Context): List<String> {
        return getAll(context).map { it.category }.distinct()
    }

    private fun parseFromAssets(context: Context): List<TransitionSpec> {
        return runCatching {
            val raw = context.assets.open("manifests/transitions.json").bufferedReader().use { it.readText() }
            val root = JSONObject(raw)
            val arr = root.optJSONArray("transitions") ?: return emptyList()
            buildList(arr.length()) {
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val id = o.optString("id")
                    if (id.isBlank()) continue
                    add(
                        TransitionSpec(
                            id = id,
                            name = o.optString("name", "Transition"),
                            category = o.optString("category", "Fade & Dissolve"),
                            shaderFamily = TransitionShaderFamily.fromWire(o.optString("shaderFamily", "FADE")),
                            mode = o.optInt("mode", 0),
                            paramA = o.optDouble("paramA", 0.0).toFloat(),
                            paramB = o.optDouble("paramB", 0.0).toFloat(),
                            defaultDurationMs = o.optLong("defaultDurationMs", 500L).coerceIn(190L, 2500L)
                        )
                    )
                }
            }
        }.getOrElse {
            listOf(
                TransitionSpec(
                    id = "tr_001_fade",
                    name = "Crossfade",
                    category = "Fade & Dissolve",
                    shaderFamily = TransitionShaderFamily.FADE,
                    mode = 0,
                    paramA = 0f,
                    paramB = 0f,
                    defaultDurationMs = 500L
                )
            )
        }
    }
}
