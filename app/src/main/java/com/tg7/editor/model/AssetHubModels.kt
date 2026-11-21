package com.tg7.editor.model

enum class HubAssetKind(val label: String) {
    FONT("Fonts"),
    SFX("SFX"),
    STICKER("Stickers"),
    EFFECT("Effects"),
    TRANSITION("Transitions");

    companion object {
        fun fromWire(value: String): HubAssetKind {
            return entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: EFFECT
        }
    }
}

data class HubAssetItem(
    val id: String,
    val name: String,
    val kind: HubAssetKind,
    val category: String,
    val license: String,
    val source: String,
    val downloadUrl: String = "",
    val localAssetFallback: String? = null,
    val engineRefId: String = "",
    val sizeLabel: String = "",
    val isCached: Boolean = false,
    val cachedFilePath: String? = null
)

data class CustomFontEntry(
    val id: String,
    val name: String,
    val filePath: String,
    val license: String,
    val source: String
)
