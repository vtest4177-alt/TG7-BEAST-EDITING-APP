package com.tg7.editor.engine.anim

import com.tg7.editor.model.EasingCurve
import com.tg7.editor.model.KeyframeNode
import org.json.JSONArray
import org.json.JSONObject

data class ResolvedKeyframeState(
    val posX: Float,
    val posY: Float,
    val scale: Float,
    val rotationDeg: Float,
    val opacity: Float
)

object KeyframeEngine {

    fun evaluate(
        keyframes: List<KeyframeNode>,
        basePosX: Float,
        basePosY: Float,
        baseScale: Float,
        baseRotationDeg: Float,
        baseOpacity: Float,
        localTimeMs: Long
    ): ResolvedKeyframeState {
        if (keyframes.isEmpty()) {
            return ResolvedKeyframeState(
                posX = basePosX,
                posY = basePosY,
                scale = baseScale,
                rotationDeg = baseRotationDeg,
                opacity = baseOpacity
            )
        }
        val sorted = keyframes.sortedBy { it.timeOffsetMs }
        if (sorted.size == 1 || localTimeMs <= sorted.first().timeOffsetMs) {
            val k = sorted.first()
            return ResolvedKeyframeState(k.posX, k.posY, k.scale, k.rotationDeg, k.opacity)
        }
        if (localTimeMs >= sorted.last().timeOffsetMs) {
            val k = sorted.last()
            return ResolvedKeyframeState(k.posX, k.posY, k.scale, k.rotationDeg, k.opacity)
        }

        for (i in 0 until sorted.lastIndex) {
            val a = sorted[i]
            val b = sorted[i + 1]
            if (localTimeMs in a.timeOffsetMs..b.timeOffsetMs) {
                val span = (b.timeOffsetMs - a.timeOffsetMs).coerceAtLeast(1L).toFloat()
                val rawT = ((localTimeMs - a.timeOffsetMs) / span).coerceIn(0f, 1f)
                val eased = b.easing.evaluate(rawT)
                return ResolvedKeyframeState(
                    posX = lerp(a.posX, b.posX, eased),
                    posY = lerp(a.posY, b.posY, eased),
                    scale = lerp(a.scale, b.scale, eased),
                    rotationDeg = lerp(a.rotationDeg, b.rotationDeg, eased),
                    opacity = lerp(a.opacity, b.opacity, eased).coerceIn(0f, 1f)
                )
            }
        }
        val last = sorted.last()
        return ResolvedKeyframeState(last.posX, last.posY, last.scale, last.rotationDeg, last.opacity)
    }

    private fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t

    fun keyframesToJson(list: List<KeyframeNode>): String {
        if (list.isEmpty()) return "[]"
        val arr = JSONArray()
        list.forEach { k ->
            val obj = JSONObject()
            obj.put("id", k.id)
            obj.put("t", k.timeOffsetMs)
            obj.put("x", k.posX.toDouble())
            obj.put("y", k.posY.toDouble())
            obj.put("s", k.scale.toDouble())
            obj.put("r", k.rotationDeg.toDouble())
            obj.put("o", k.opacity.toDouble())
            obj.put("e", k.easing.name)
            arr.put(obj)
        }
        return arr.toString()
    }

    fun keyframesFromJson(raw: String?): List<KeyframeNode> {
        if (raw.isNullOrBlank() || raw == "[]") return emptyList()
        return runCatching {
            val arr = JSONArray(raw)
            buildList(arr.length()) {
                for (i in 0 until arr.length()) {
                    val obj = arr.optJSONObject(i) ?: continue
                    add(
                        KeyframeNode(
                            id = obj.optString("id").ifBlank { java.util.UUID.randomUUID().toString() },
                            timeOffsetMs = obj.optLong("t", 0L).coerceAtLeast(0L),
                            posX = obj.optDouble("x", 0.5).toFloat(),
                            posY = obj.optDouble("y", 0.5).toFloat(),
                            scale = obj.optDouble("s", 1.0).toFloat(),
                            rotationDeg = obj.optDouble("r", 0.0).toFloat(),
                            opacity = obj.optDouble("o", 1.0).toFloat(),
                            easing = EasingCurve.fromWire(obj.optString("e", "EASE_IN_OUT"))
                        )
                    )
                }
            }
        }.getOrDefault(emptyList())
    }

    fun floatListToJson(list: List<Float>): String {
        if (list.isEmpty()) return "[]"
        val arr = JSONArray()
        list.forEach { arr.put(it.toDouble()) }
        return arr.toString()
    }

    fun floatListFromJson(raw: String?): List<Float> {
        if (raw.isNullOrBlank() || raw == "[]") return emptyList()
        return runCatching {
            val arr = JSONArray(raw)
            buildList(arr.length()) {
                for (i in 0 until arr.length()) {
                    add(arr.optDouble(i, 0.0).toFloat().coerceIn(0f, 1f))
                }
            }
        }.getOrDefault(emptyList())
    }

    fun longListToJson(list: List<Long>): String {
        if (list.isEmpty()) return "[]"
        val arr = JSONArray()
        list.forEach { arr.put(it) }
        return arr.toString()
    }

    fun longListFromJson(raw: String?): List<Long> {
        if (raw.isNullOrBlank() || raw == "[]") return emptyList()
        return runCatching {
            val arr = JSONArray(raw)
            buildList(arr.length()) {
                for (i in 0 until arr.length()) {
                    add(arr.optLong(i, 0L).coerceAtLeast(0L))
                }
            }
        }.getOrDefault(emptyList())
    }
}
