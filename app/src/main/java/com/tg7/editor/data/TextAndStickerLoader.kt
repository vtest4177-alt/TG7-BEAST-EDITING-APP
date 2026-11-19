package com.tg7.editor.data

import android.content.Context
import com.tg7.editor.model.LottieStickerSpec
import com.tg7.editor.model.TextAnimSpec
import com.tg7.editor.model.TextFontFamily
import com.tg7.editor.model.TextStyleTemplate
import org.json.JSONObject

object TextAndStickerLoader {
    @Volatile
    private var cachedTemplates: List<TextStyleTemplate>? = null

    @Volatile
    private var cachedAnimations: List<TextAnimSpec>? = null

    @Volatile
    private var cachedAnimMap: Map<String, TextAnimSpec>? = null

    @Volatile
    private var cachedStickers: List<LottieStickerSpec>? = null

    fun getTemplates(context: Context): List<TextStyleTemplate> {
        cachedTemplates?.let { return it }
        loadTextManifest(context.applicationContext)
        return cachedTemplates ?: emptyList()
    }

    fun getAnimations(context: Context): List<TextAnimSpec> {
        cachedAnimations?.let { return it }
        loadTextManifest(context.applicationContext)
        return cachedAnimations ?: emptyList()
    }

    fun findAnimationById(context: Context, id: String?): TextAnimSpec? {
        if (id.isNullOrBlank()) return null
        if (cachedAnimMap == null) loadTextManifest(context.applicationContext)
        return cachedAnimMap?.get(id)
    }

    fun getAnimationCategories(context: Context): List<String> {
        return getAnimations(context).map { it.category }.distinct()
    }

    fun getLottieStickers(context: Context): List<LottieStickerSpec> {
        cachedStickers?.let { return it }
        return synchronized(this) {
            cachedStickers?.let { return it }
            val loaded = parseStickers(context.applicationContext)
            cachedStickers = loaded
            loaded
        }
    }

    fun getStickerCategories(context: Context): List<String> {
        return getLottieStickers(context).map { it.category }.distinct()
    }

    private fun loadTextManifest(appContext: Context) {
        synchronized(this) {
            if (cachedTemplates != null && cachedAnimations != null) return
            val result = runCatching {
                val raw = appContext.assets.open("manifests/text_styles.json").bufferedReader().use { it.readText() }
                val root = JSONObject(raw)
                val tplArr = root.optJSONArray("templates")
                val templates = buildList {
                    if (tplArr != null) {
                        for (i in 0 until tplArr.length()) {
                            val o = tplArr.optJSONObject(i) ?: continue
                            add(
                                TextStyleTemplate(
                                    id = o.optString("id"),
                                    name = o.optString("name", "Style"),
                                    fontFamily = TextFontFamily.fromWire(o.optString("fontFamily", "DISPLAY")),
                                    colorHex = parseHexColor(o.optString("colorHex", "0xFFFFFFFF"), 0xFFFFFFFFL),
                                    bgColorHex = parseHexColor(o.optString("bgColorHex", "0x00000000"), 0L),
                                    hasOutline = o.optBoolean("hasOutline", true),
                                    letterSpacingEm = o.optDouble("letterSpacingEm", 0.04).toFloat()
                                )
                            )
                        }
                    }
                }
                val animArr = root.optJSONArray("animations")
                val anims = buildList {
                    if (animArr != null) {
                        for (i in 0 until animArr.length()) {
                            val o = animArr.optJSONObject(i) ?: continue
                            add(
                                TextAnimSpec(
                                    id = o.optString("id"),
                                    name = o.optString("name", "Animation"),
                                    category = o.optString("category", "Cinema & Fade"),
                                    animKind = o.optString("animKind", "NONE"),
                                    speedMultiplier = o.optDouble("speedMultiplier", 1.0).toFloat()
                                )
                            )
                        }
                    }
                }
                templates to anims
            }.getOrElse {
                listOf(
                    TextStyleTemplate("tpl_tg7_display", "TG7 Impact", TextFontFamily.DISPLAY, 0xFFFFFFFFL, 0L, true, 0.04f)
                ) to listOf(
                    TextAnimSpec("ta_none", "Static (None)", "Cinema & Fade", "NONE", 1.0f)
                )
            }
            cachedTemplates = result.first
            cachedAnimations = result.second
            cachedAnimMap = result.second.associateBy { it.id }
        }
    }

    private fun parseStickers(appContext: Context): List<LottieStickerSpec> {
        return runCatching {
            val raw = appContext.assets.open("manifests/stickers.json").bufferedReader().use { it.readText() }
            val root = JSONObject(raw)
            val arr = root.optJSONArray("stickers") ?: return emptyList()
            buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val path = o.optString("lottieAssetPath")
                    if (path.isBlank()) continue
                    add(
                        LottieStickerSpec(
                            id = o.optString("id"),
                            name = o.optString("name", "Sticker"),
                            category = o.optString("category", "Energy & Gaming"),
                            lottieAssetPath = path,
                            tintHex = parseHexColor(o.optString("tintHex", "0xFF00F0FF"), 0xFF00F0FFL)
                        )
                    )
                }
            }
        }.getOrDefault(emptyList())
    }

    private fun parseHexColor(raw: String, fallback: Long): Long {
        val clean = raw.trim().removePrefix("0x").removePrefix("0X").removePrefix("#")
        return clean.toLongOrNull(16) ?: fallback
    }
}
