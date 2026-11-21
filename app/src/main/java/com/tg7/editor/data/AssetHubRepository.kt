package com.tg7.editor.data

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.tg7.editor.model.CustomFontEntry
import com.tg7.editor.model.HubAssetItem
import com.tg7.editor.model.HubAssetKind
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin
import kotlin.random.Random

class AssetHubRepository(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences("tg7_asset_hub_prefs", Context.MODE_PRIVATE)

    private val hubRoot = File(appContext.filesDir, "asset_hub").apply { mkdirs() }
    private val fontsDir = File(hubRoot, "fonts").apply { mkdirs() }
    private val customFontsDir = File(hubRoot, "custom_fonts").apply { mkdirs() }
    private val sfxDir = File(hubRoot, "sfx").apply { mkdirs() }
    private val stickersDir = File(hubRoot, "stickers").apply { mkdirs() }
    private val cachedManifestFile = File(hubRoot, "manifest_cache.json")

    companion object {
        const val DEFAULT_MANIFEST_URL =
            "https://raw.githubusercontent.com/tg7-studio/tg7-editor-assets/main/assets/manifest.json"
        private const val PREF_MANIFEST_URL = "manifest_url"
        private const val PREF_FONT_META_PREFIX = "font_meta_"
        private const val MAX_DOWNLOAD_BYTES = 16 * 1024 * 1024 // 16 MB safety cap
    }

    fun getManifestUrl(): String {
        return prefs.getString(PREF_MANIFEST_URL, DEFAULT_MANIFEST_URL) ?: DEFAULT_MANIFEST_URL
    }

    fun setManifestUrl(url: String) {
        val clean = url.trim()
        if (clean.startsWith("https://")) {
            prefs.edit().putString(PREF_MANIFEST_URL, clean).apply()
        }
    }

    suspend fun loadCatalog(): List<HubAssetItem> = withContext(Dispatchers.IO) {
        val rawJson = if (cachedManifestFile.exists() && cachedManifestFile.length() > 50L) {
            runCatching { cachedManifestFile.readText() }.getOrNull()
        } else {
            null
        } ?: runCatching {
            appContext.assets.open("manifests/asset_hub.json").bufferedReader().use { it.readText() }
        }.getOrNull()

        if (rawJson.isNullOrBlank()) return@withContext emptyList()
        parseCatalog(rawJson).map { enrichCacheState(it) }
    }

    suspend fun refreshRemoteCatalog(urlOverride: String? = null): Result<List<HubAssetItem>> = withContext(Dispatchers.IO) {
        val targetUrl = (urlOverride ?: getManifestUrl()).trim()
        if (!targetUrl.startsWith("https://")) {
            return@withContext Result.failure(IllegalArgumentException("Only HTTPS manifest URLs are allowed."))
        }
        runCatching {
            val conn = (URL(targetUrl).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 7000
                readTimeout = 9000
                setRequestProperty("Accept", "application/json")
            }
            try {
                val code = conn.responseCode
                if (code !in 200..299) {
                    throw IllegalStateException("HTTP $code while fetching manifest.json")
                }
                val bytes = readBoundedBytes(conn, 4 * 1024 * 1024)
                val raw = bytes.toString(Charsets.UTF_8)
                val parsed = parseCatalog(raw)
                if (parsed.isEmpty()) {
                    throw IllegalStateException("Manifest JSON contained 0 valid items.")
                }
                cachedManifestFile.writeText(raw)
                prefs.edit().putString(PREF_MANIFEST_URL, targetUrl).apply()
                parsed.map { enrichCacheState(it) }
            } finally {
                conn.disconnect()
            }
        }
    }

    suspend fun ensureAssetCached(item: HubAssetItem): Result<HubAssetItem> = withContext(Dispatchers.IO) {
        val enriched = enrichCacheState(item)
        if (enriched.isCached) {
            return@withContext Result.success(enriched)
        }

        return@withContext when (item.kind) {
            HubAssetKind.EFFECT, HubAssetKind.TRANSITION -> {
                // Built-in 60fps OpenGL shaders run directly without binary download
                Result.success(item.copy(isCached = true))
            }
            HubAssetKind.STICKER -> {
                val dest = File(stickersDir, "${safeFileId(item.id)}.json")
                if (item.downloadUrl.startsWith("https://")) {
                    val dl = downloadToFile(item.downloadUrl, dest)
                    if (dl.isSuccess) {
                        return@withContext Result.success(
                            item.copy(isCached = true, cachedFilePath = dest.absolutePath)
                        )
                    }
                }
                // Fallback copy from bundled Lottie vector JSON if available
                val assetPath = item.localAssetFallback
                if (!assetPath.isNullOrBlank()) {
                    runCatching {
                        appContext.assets.open(assetPath).use { input ->
                            FileOutputStream(dest).use { out -> input.copyTo(out) }
                        }
                    }
                }
                if (dest.exists() && dest.length() > 16L) {
                    Result.success(item.copy(isCached = true, cachedFilePath = dest.absolutePath))
                } else {
                    Result.failure(IllegalStateException("Sticker asset unavailable offline."))
                }
            }
            HubAssetKind.FONT -> {
                if (!item.downloadUrl.startsWith("https://")) {
                    return@withContext Result.failure(IllegalArgumentException("Invalid font download URL."))
                }
                val ext = if (item.downloadUrl.endsWith(".otf", ignoreCase = true)) "otf" else "ttf"
                val dest = File(fontsDir, "${safeFileId(item.id)}.$ext")
                val dl = downloadToFile(item.downloadUrl, dest)
                if (dl.isSuccess && isValidFontFile(dest)) {
                    prefs.edit().putString("$PREF_FONT_META_PREFIX${dest.name}", "${item.name}|${item.license}|${item.source}").apply()
                    Result.success(item.copy(isCached = true, cachedFilePath = dest.absolutePath))
                } else {
                    runCatching { dest.delete() }
                    Result.failure(dl.exceptionOrNull() ?: IllegalStateException("Could not download font from Google Fonts."))
                }
            }
            HubAssetKind.SFX -> {
                val dest = File(sfxDir, "${safeFileId(item.id)}.wav")
                if (item.downloadUrl.startsWith("https://")) {
                    val dl = downloadToFile(item.downloadUrl, dest)
                    if (dl.isSuccess && dest.length() > 512L) {
                        return@withContext Result.success(
                            item.copy(isCached = true, cachedFilePath = dest.absolutePath)
                        )
                    }
                    runCatching { dest.delete() }
                }
                // Guaranteed CC0 offline procedural PCM WAV studio SFX synthesis fallback
                val generated = synthesizeCc0SfxWav(item.engineRefId.ifBlank { item.id }, dest)
                if (generated && dest.exists()) {
                    Result.success(item.copy(isCached = true, cachedFilePath = dest.absolutePath))
                } else {
                    Result.failure(IllegalStateException("Failed to prepare SFX audio."))
                }
            }
        }
    }

    suspend fun importUserFont(uri: Uri): Result<CustomFontEntry> = withContext(Dispatchers.IO) {
        runCatching {
            val rawName = queryDisplayName(uri) ?: "CustomFont_${System.currentTimeMillis()}.ttf"
            val ext = when {
                rawName.endsWith(".otf", ignoreCase = true) -> "otf"
                else -> "ttf"
            }
            val cleanBase = rawName.substringBeforeLast('.')
                .replace(Regex("[^A-Za-z0-9_\\- ]"), "")
                .trim()
                .ifBlank { "CustomFont" }
            val dest = File(customFontsDir, "${cleanBase.replace(' ', '_')}_${System.currentTimeMillis() % 10000}.$ext")
            appContext.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(dest).use { out -> input.copyTo(out) }
            } ?: throw IllegalStateException("Cannot read selected font file.")

            if (!isValidFontFile(dest)) {
                dest.delete()
                throw IllegalArgumentException("Selected file is not a valid .ttf or .otf font.")
            }

            prefs.edit().putString("$PREF_FONT_META_PREFIX${dest.name}", "$cleanBase|User Import|Local Device").apply()
            CustomFontEntry(
                id = "custom_${dest.name}",
                name = cleanBase,
                filePath = dest.absolutePath,
                license = "User File",
                source = "Device Import"
            )
        }
    }

    suspend fun listInstalledFonts(): List<CustomFontEntry> = withContext(Dispatchers.IO) {
        val list = mutableListOf<CustomFontEntry>()
        listOf(fontsDir, customFontsDir).forEach { dir ->
            dir.listFiles()?.forEach { file ->
                if (file.isFile && (file.extension.equals("ttf", true) || file.extension.equals("otf", true))) {
                    val meta = prefs.getString("$PREF_FONT_META_PREFIX${file.name}", null)
                    val parts = meta?.split('|')
                    val displayName = parts?.getOrNull(0)?.ifBlank { null } ?: file.nameWithoutExtension.replace('_', ' ')
                    val license = parts?.getOrNull(1) ?: "SIL-OFL-1.1"
                    val source = parts?.getOrNull(2) ?: "Cached"
                    list.add(
                        CustomFontEntry(
                            id = file.name,
                            name = displayName,
                            filePath = file.absolutePath,
                            license = license,
                            source = source
                        )
                    )
                }
            }
        }
        list.sortedBy { it.name.lowercase() }
    }

    suspend fun getCacheSizeLabel(): String = withContext(Dispatchers.IO) {
        val bytes = hubRoot.walkTopDown().filter { it.isFile }.sumOf { it.length() }
        val mb = bytes / (1024.0 * 1024.0)
        String.format(java.util.Locale.US, "%.2f MB cached", mb)
    }

    suspend fun clearDownloadedCache(): Unit = withContext(Dispatchers.IO) {
        listOf(fontsDir, sfxDir, stickersDir).forEach { dir ->
            dir.listFiles()?.forEach { runCatching { it.delete() } }
        }
        runCatching { cachedManifestFile.delete() }
    }

    private fun enrichCacheState(item: HubAssetItem): HubAssetItem {
        val file: File? = when (item.kind) {
            HubAssetKind.FONT -> {
                val ttf = File(fontsDir, "${safeFileId(item.id)}.ttf")
                val otf = File(fontsDir, "${safeFileId(item.id)}.otf")
                when {
                    ttf.exists() -> ttf
                    otf.exists() -> otf
                    else -> null
                }
            }
            HubAssetKind.SFX -> File(sfxDir, "${safeFileId(item.id)}.wav").takeIf { it.exists() }
            HubAssetKind.STICKER -> File(stickersDir, "${safeFileId(item.id)}.json").takeIf { it.exists() }
            HubAssetKind.EFFECT, HubAssetKind.TRANSITION -> null
        }
        val builtInReady = item.kind == HubAssetKind.EFFECT ||
            item.kind == HubAssetKind.TRANSITION ||
            (item.kind == HubAssetKind.STICKER && !item.localAssetFallback.isNullOrBlank())
        return item.copy(
            isCached = file != null || builtInReady,
            cachedFilePath = file?.absolutePath ?: item.localAssetFallback
        )
    }

    private fun parseCatalog(rawJson: String): List<HubAssetItem> {
        return runCatching {
            val root = JSONObject(rawJson)
            val arr = root.optJSONArray("items") ?: return emptyList()
            buildList(arr.length()) {
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val id = o.optString("id")
                    val name = o.optString("name")
                    if (id.isBlank() || name.isBlank()) continue
                    add(
                        HubAssetItem(
                            id = id,
                            name = name,
                            kind = HubAssetKind.fromWire(o.optString("kind")),
                            category = o.optString("category", "General"),
                            license = o.optString("license", "CC0-1.0"),
                            source = o.optString("source", "TG7 Open Hub"),
                            downloadUrl = o.optString("downloadUrl", ""),
                            localAssetFallback = o.optString("localAssetFallback").ifBlank { null },
                            engineRefId = o.optString("engineRefId", id),
                            sizeLabel = o.optString("sizeLabel", "")
                        )
                    )
                }
            }
        }.getOrDefault(emptyList())
    }

    private fun downloadToFile(urlString: String, dest: File): Result<Unit> {
        return runCatching {
            val tmp = File(dest.parentFile, "${dest.name}.tmp")
            val conn = (URL(urlString).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8000
                readTimeout = 15000
                instanceFollowRedirects = true
            }
            try {
                val code = conn.responseCode
                if (code !in 200..299) {
                    throw IllegalStateException("Download failed (HTTP $code)")
                }
                val bytes = readBoundedBytes(conn, MAX_DOWNLOAD_BYTES)
                if (bytes.size < 64) {
                    throw IllegalStateException("Downloaded file is empty")
                }
                tmp.writeBytes(bytes)
                if (dest.exists()) dest.delete()
                if (!tmp.renameTo(dest)) {
                    tmp.copyTo(dest, overwrite = true)
                    tmp.delete()
                }
            } finally {
                conn.disconnect()
            }
        }
    }

    private fun readBoundedBytes(conn: HttpURLConnection, maxBytes: Int): ByteArray {
        val baos = ByteArrayOutputStream()
        val buf = ByteArray(8192)
        var total = 0
        conn.inputStream.use { input ->
            while (true) {
                val n = input.read(buf)
                if (n <= 0) break
                total += n
                if (total > maxBytes) throw IllegalStateException("File exceeds safety size limit")
                baos.write(buf, 0, n)
            }
        }
        return baos.toByteArray()
    }

    private fun isValidFontFile(file: File): Boolean {
        if (!file.exists() || file.length() < 128L) return false
        return runCatching {
            val head = ByteArray(4)
            file.inputStream().use { it.read(head) }
            val isTtf = head[0] == 0x00.toByte() && head[1] == 0x01.toByte() &&
                head[2] == 0x00.toByte() && head[3] == 0x00.toByte()
            val tag = String(head, Charsets.US_ASCII)
            isTtf || tag == "OTTO" || tag == "true" || tag == "typ1"
        }.getOrDefault(false)
    }

    private fun queryDisplayName(uri: Uri): String? {
        return runCatching {
            appContext.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0) else null
            }
        }.getOrNull()
    }

    private fun safeFileId(id: String): String {
        return id.replace(Regex("[^A-Za-z0-9_\\-]"), "_")
    }

    /**
     * Synthesizes crisp CC0 16-bit 44.1kHz mono PCM WAV sound effects for instant offline preview/editing.
     */
    private fun synthesizeCc0SfxWav(preset: String, dest: File): Boolean {
        return runCatching {
            val sampleRate = 44_100
            val durSec = when (preset) {
                "riser", "whoosh", "boom", "drop" -> 1.15f
                "pop", "tick", "shutter" -> 0.28f
                else -> 0.65f
            }
            val totalSamples = (sampleRate * durSec).toInt()
            val pcm = ShortArray(totalSamples)
            val rng = Random(preset.hashCode())
            var lp = 0f

            for (i in 0 until totalSamples) {
                val t = i.toFloat() / sampleRate
                val norm = i.toFloat() / totalSamples
                val sample = when (preset) {
                    "whoosh", "swish" -> {
                        val env = sin(norm * PI).toFloat()
                        val cutoff = 0.04f + 0.36f * sin(norm * PI).toFloat()
                        val white = rng.nextFloat() * 2f - 1f
                        lp += cutoff * (white - lp)
                        lp * env * 0.85f
                    }
                    "boom", "drop" -> {
                        val freq = 140f * exp(-4.8f * t) + 42f
                        val env = exp(-2.9f * t)
                        sin(2.0 * PI * freq * t).toFloat() * env * 0.92f
                    }
                    "pop" -> {
                        val freq = 320f + 580f * exp(-18f * t)
                        val env = exp(-16f * t)
                        sin(2.0 * PI * freq * t).toFloat() * env * 0.88f
                    }
                    "zap" -> {
                        val freq = 1400f - 1150f * norm + (if ((i / 180) % 2 == 0) 260f else -140f)
                        val env = exp(-4.2f * t)
                        val sq = if (sin(2.0 * PI * freq * t) >= 0.0) 0.7f else -0.7f
                        sq * env
                    }
                    "riser" -> {
                        val freq = 180f + 1350f * norm * norm
                        val env = norm * (1f - exp(-8f * t))
                        sin(2.0 * PI * freq * t).toFloat() * env * 0.75f
                    }
                    "ding" -> {
                        val env = exp(-4.5f * t)
                        (0.65f * sin(2.0 * PI * 1046.5 * t).toFloat() +
                            0.35f * sin(2.0 * PI * 1567.98 * t).toFloat()) * env
                    }
                    "laser" -> {
                        val freq = 1650f * exp(-5.2f * t) + 120f
                        val env = exp(-5.0f * t)
                        sin(2.0 * PI * freq * t).toFloat() * env * 0.85f
                    }
                    "scratch" -> {
                        val modFreq = 260f + 220f * sin(2.0 * PI * 9.0 * t).toFloat()
                        val env = sin(norm * PI).toFloat()
                        val noise = (rng.nextFloat() * 2f - 1f) * 0.25f
                        (sin(2.0 * PI * modFreq * t).toFloat() * 0.7f + noise) * env
                    }
                    else -> { // shutter, tick
                        val white = rng.nextFloat() * 2f - 1f
                        val env = exp(-28f * t)
                        (white * 0.55f + sin(2.0 * PI * 920.0 * t).toFloat() * 0.45f) * env
                    }
                }
                pcm[i] = (sample.coerceIn(-1f, 1f) * 32767f).toInt().toShort()
            }

            writeWav16Mono(dest, sampleRate, pcm)
            true
        }.getOrDefault(false)
    }

    private fun writeWav16Mono(file: File, sampleRate: Int, samples: ShortArray) {
        val dataBytes = samples.size * 2
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN).apply {
            put("RIFF".toByteArray(Charsets.US_ASCII))
            putInt(36 + dataBytes)
            put("WAVE".toByteArray(Charsets.US_ASCII))
            put("fmt ".toByteArray(Charsets.US_ASCII))
            putInt(16) // PCM subchunk size
            putShort(1) // PCM format
            putShort(1) // mono
            putInt(sampleRate)
            putInt(sampleRate * 2) // byteRate
            putShort(2) // blockAlign
            putShort(16) // bitsPerSample
            put("data".toByteArray(Charsets.US_ASCII))
            putInt(dataBytes)
        }.array()

        val pcmBuf = ByteBuffer.allocate(dataBytes).order(ByteOrder.LITTLE_ENDIAN)
        samples.forEach { pcmBuf.putShort(it) }

        FileOutputStream(file).use { out ->
            out.write(header)
            out.write(pcmBuf.array())
        }
    }
}
