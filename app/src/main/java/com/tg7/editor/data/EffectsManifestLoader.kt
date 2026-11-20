package com.tg7.editor.data

import android.content.Context
import com.tg7.editor.model.EffectShaderFamily
import com.tg7.editor.model.VideoEffectSpec
import org.json.JSONObject

object EffectsManifestLoader {
    @Volatile
    private var cachedEffects: List<VideoEffectSpec>? = null

    fun getAll(context: Context): List<VideoEffectSpec> {
        cachedEffects?.let { return it }
        return synchronized(this) {
            cachedEffects?.let { return@synchronized it }
            val loaded = parseFromAssets(context.applicationContext)
            cachedEffects = loaded
            loaded
        }
    }

    fun findById(context: Context, id: String?): VideoEffectSpec? {
        if (id.isNullOrBlank()) return null
        return getAll(context).firstOrNull { it.id == id }
    }

    fun getCategories(context: Context): List<String> {
        return getAll(context).map { it.category }.distinct()
    }

    private fun parseFromAssets(context: Context): List<VideoEffectSpec> {
        return runCatching {
            val raw = context.assets.open("manifests/effects.json")
                .bufferedReader()
                .use { it.readText() }
            val root = JSONObject(raw)
            val arr = root.optJSONArray("effects") ?: return emptyList()
            buildList(arr.length()) {
                for (i in 0 until arr.length()) {
                    val obj = arr.optJSONObject(i) ?: continue
                    val id = obj.optString("id")
                    if (id.isBlank()) continue
                    add(
                        VideoEffectSpec(
                            id = id,
                            name = obj.optString("name", "Effect"),
                            category = obj.optString("category", "Cinematic & LUT"),
                            shaderFamily = EffectShaderFamily.fromWire(
                                obj.optString("shaderFamily", "LUT_TONE")
                            ),
                            mode = obj.optInt("mode", 0),
                            paramA = obj.optDouble("paramA", 0.0).toFloat(),
                            paramB = obj.optDouble("paramB", 0.0).toFloat(),
                            paramC = obj.optDouble("paramC", 0.0).toFloat(),
                            defaultIntensity = obj.optDouble("defaultIntensity", 0.85)
                                .toFloat()
                                .coerceIn(0f, 1f)
                        )
                    )
                }
            }
        }.getOrDefault(emptyList())
    }
}
