package com.tg7.editor.engine.audio

import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor.AudioFormat
import androidx.media3.common.audio.AudioProcessor.UnhandledAudioFormatException
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import kotlin.math.roundToInt

@OptIn(UnstableApi::class)
class VolumeFadeAudioProcessor(
    private val volumeGain: Float,
    private val fadeInMs: Long,
    private val fadeOutMs: Long,
    private val activeDurationMs: Long
) : BaseAudioProcessor() {

    private var processedFrames: Long = 0L

    override fun onConfigure(inputAudioFormat: AudioFormat): AudioFormat {
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) {
            throw UnhandledAudioFormatException(inputAudioFormat)
        }
        return inputAudioFormat
    }

    override fun isActive(): Boolean {
        return super.isActive() && (
            kotlin.math.abs(volumeGain - 1.0f) > 0.01f ||
                fadeInMs > 0L ||
                fadeOutMs > 0L
            )
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val remaining = inputBuffer.remaining()
        if (remaining == 0) return

        val outBuf = replaceOutputBuffer(remaining)
        val channels = inputAudioFormat.channelCount.coerceAtLeast(1)
        val sampleRate = inputAudioFormat.sampleRate.coerceAtLeast(8000)

        while (inputBuffer.remaining() >= 2 * channels) {
            val timeMs = (processedFrames * 1000L) / sampleRate
            val env = computeEnvelope(timeMs)
            val gain = (volumeGain * env).coerceIn(0f, 2.0f)

            for (ch in 0 until channels) {
                val sample = inputBuffer.getShort()
                val scaled = (sample * gain).roundToInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt())
                outBuf.putShort(scaled.toShort())
            }
            processedFrames++
        }

        while (inputBuffer.hasRemaining()) {
            outBuf.put(inputBuffer.get())
        }
        outBuf.flip()
    }

    private fun computeEnvelope(timeMs: Long): Float {
        var env = 1.0f
        if (fadeInMs > 0L && timeMs < fadeInMs) {
            env *= (timeMs.toFloat() / fadeInMs.toFloat()).coerceIn(0f, 1f)
        }
        if (fadeOutMs > 0L && activeDurationMs > 0L) {
            val remMs = (activeDurationMs - timeMs).coerceAtLeast(0L)
            if (remMs < fadeOutMs) {
                env *= (remMs.toFloat() / fadeOutMs.toFloat()).coerceIn(0f, 1f)
            }
        }
        return env
    }

    override fun onFlush() {
        processedFrames = 0L
    }

    override fun onReset() {
        processedFrames = 0L
    }
}
