package com.tg7.editor.engine.audio

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.abs
import kotlin.math.sqrt

data class AudioAnalysisResult(
    val waveformPeaks: List<Float>,
    val beatMarkersMs: List<Long>
)

object AudioWaveformExtractor {

    suspend fun analyze(
        context: Context,
        uriString: String,
        durationMs: Long,
        targetBins: Int = 64
    ): AudioAnalysisResult = withContext(Dispatchers.IO) {
        val bins = targetBins.coerceIn(16, 128)
        val safeDurMs = durationMs.coerceAtLeast(1000L)
        val extractor = MediaExtractor()
        var codec: MediaCodec? = null

        val sumSq = DoubleArray(bins)
        val counts = IntArray(bins)

        try {
            extractor.setDataSource(context, Uri.parse(uriString), null)
            var audioTrackIdx = -1
            var format: MediaFormat? = null
            for (i in 0 until extractor.trackCount) {
                val f = extractor.getTrackFormat(i)
                val mime = f.getString(MediaFormat.KEY_MIME) ?: continue
                if (mime.startsWith("audio/")) {
                    audioTrackIdx = i
                    format = f
                    break
                }
            }
            if (audioTrackIdx < 0 || format == null) {
                return@withContext AudioAnalysisResult(fallbackBars(bins), emptyList())
            }

            extractor.selectTrack(audioTrackIdx)
            val mime = format.getString(MediaFormat.KEY_MIME) ?: return@withContext AudioAnalysisResult(fallbackBars(bins), emptyList())
            codec = MediaCodec.createDecoderByType(mime).apply {
                configure(format, null, null, 0)
                start()
            }

            val info = MediaCodec.BufferInfo()
            var inputDone = false
            var outputDone = false
            val startWallMs = System.currentTimeMillis()
            val maxWallBudgetMs = 2500L

            while (!outputDone && System.currentTimeMillis() - startWallMs < maxWallBudgetMs) {
                if (!inputDone) {
                    val inIdx = codec.dequeueInputBuffer(4000L)
                    if (inIdx >= 0) {
                        val buf = codec.getInputBuffer(inIdx)
                        if (buf != null) {
                            val size = extractor.readSampleData(buf, 0)
                            if (size < 0) {
                                codec.queueInputBuffer(inIdx, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                                inputDone = true
                            } else {
                                codec.queueInputBuffer(inIdx, 0, size, extractor.sampleTime, 0)
                                // Sample fast across long tracks by advancing normally; budget guards max runtime
                                extractor.advance()
                            }
                        }
                    }
                }

                val outIdx = codec.dequeueOutputBuffer(info, 4000L)
                if (outIdx >= 0) {
                    val outBuf = codec.getOutputBuffer(outIdx)
                    if (outBuf != null && info.size > 0) {
                        val ptsMs = (info.presentationTimeUs / 1000L).coerceIn(0L, safeDurMs)
                        val bin = (((ptsMs.toDouble() / safeDurMs.toDouble()) * bins).toInt()).coerceIn(0, bins - 1)
                        val shortBuf = outBuf.asShortBuffer()
                        var acc = 0.0
                        var samples = 0
                        val stride = 4
                        var pos = 0
                        while (pos < shortBuf.remaining()) {
                            val s = shortBuf.get(pos) / 32768.0
                            acc += s * s
                            samples++
                            pos += stride
                        }
                        if (samples > 0) {
                            sumSq[bin] += acc
                            counts[bin] += samples
                        }
                    }
                    codec.releaseOutputBuffer(outIdx, false)
                    if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                        outputDone = true
                    }
                }
            }
        } catch (_: Throwable) {
            return@withContext AudioAnalysisResult(fallbackBars(bins), emptyList())
        } finally {
            runCatching { codec?.stop() }
            runCatching { codec?.release() }
            runCatching { extractor.release() }
        }

        val rawRms = FloatArray(bins) { idx ->
            val c = counts[idx]
            if (c > 0) sqrt(sumSq[idx] / c).toFloat() else 0f
        }
        val peakMax = (rawRms.maxOrNull() ?: 0f).coerceAtLeast(0.02f)
        if (peakMax <= 0.021f) {
            return@withContext AudioAnalysisResult(fallbackBars(bins), emptyList())
        }

        val normalized = rawRms.map { v -> (v / peakMax).coerceIn(0.08f, 1.0f) }
        val beats = detectBeatOnsets(normalized, safeDurMs)
        AudioAnalysisResult(normalized, beats)
    }

    private fun detectBeatOnsets(peaks: List<Float>, durationMs: Long): List<Long> {
        if (peaks.size < 6) return emptyList()
        val result = mutableListOf<Long>()
        val binDurMs = durationMs.toDouble() / peaks.size.toDouble()
        var lastBeatMs = -500L

        for (i in 1 until peaks.lastIndex) {
            val localAvg = ((peaks[i - 1] + peaks[i] + peaks[i + 1]) / 3f)
            val jump = peaks[i] - peaks[i - 1]
            if (peaks[i] > 0.58f && jump > 0.14f && peaks[i] >= localAvg * 1.08f) {
                val timeMs = (i * binDurMs).toLong()
                if (timeMs - lastBeatMs >= 320L) {
                    result.add(timeMs)
                    lastBeatMs = timeMs
                }
            }
        }
        return result.take(32)
    }

    private fun fallbackBars(bins: Int): List<Float> {
        return List(bins) { idx ->
            (0.25f + 0.55f * abs(kotlin.math.sin(idx * 0.45))).toFloat().coerceIn(0.15f, 0.95f)
        }
    }
}
