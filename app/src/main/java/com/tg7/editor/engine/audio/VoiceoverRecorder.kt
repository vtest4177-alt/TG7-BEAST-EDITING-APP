package com.tg7.editor.engine.audio

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

class VoiceoverRecorder(context: Context) {
    private val appContext = context.applicationContext
    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var startedAtMs: Long = 0L

    fun startRecording(): Boolean {
        stopRecordingInternal(deleteFile = true)
        val dir = File(appContext.filesDir, "voiceovers").apply { mkdirs() }
        val file = File(dir, "tg7_vo_${System.currentTimeMillis()}.m4a")
        return runCatching {
            val rec = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(appContext)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            rec.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(128_000)
                setAudioSamplingRate(44_100)
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }
            recorder = rec
            outputFile = file
            startedAtMs = System.currentTimeMillis()
            true
        }.getOrElse {
            runCatching { file.delete() }
            false
        }
    }

    fun currentAmplitudeNormalized(): Float {
        val amp = runCatching { recorder?.maxAmplitude ?: 0 }.getOrDefault(0)
        return (amp / 22_000f).coerceIn(0f, 1f)
    }

    fun elapsedMs(): Long {
        if (recorder == null || startedAtMs == 0L) return 0L
        return (System.currentTimeMillis() - startedAtMs).coerceAtLeast(0L)
    }

    fun stopAndFinalize(): Pair<File, Long>? {
        val dur = elapsedMs().coerceAtLeast(350L)
        val file = outputFile
        stopRecordingInternal(deleteFile = false)
        return if (file != null && file.exists() && file.length() > 512L) {
            file to dur
        } else {
            runCatching { file?.delete() }
            null
        }
    }

    fun cancel() {
        stopRecordingInternal(deleteFile = true)
    }

    private fun stopRecordingInternal(deleteFile: Boolean) {
        val rec = recorder
        recorder = null
        startedAtMs = 0L
        if (rec != null) {
            runCatching { rec.stop() }
            runCatching { rec.reset() }
            runCatching { rec.release() }
        }
        if (deleteFile) {
            runCatching { outputFile?.delete() }
        }
        outputFile = null
    }
}
