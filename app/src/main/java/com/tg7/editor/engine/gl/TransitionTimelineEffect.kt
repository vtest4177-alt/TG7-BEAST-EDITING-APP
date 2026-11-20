package com.tg7.editor.engine.gl

import android.content.Context
import android.opengl.GLES20
import androidx.annotation.OptIn
import androidx.media3.common.VideoFrameProcessingException
import androidx.media3.common.util.GlProgram
import androidx.media3.common.util.GlUtil
import androidx.media3.common.util.Size
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BaseGlShaderProgram
import androidx.media3.effect.GlEffect
import androidx.media3.effect.GlShaderProgram
import com.tg7.editor.data.TransitionManifestLoader
import com.tg7.editor.model.TimelineClip
import com.tg7.editor.model.TransitionSpec
import java.util.concurrent.atomic.AtomicReference

data class TransitionWindow(
    val cutIndex: Int,
    val cutTimeUs: Long,
    val endTimeUs: Long,
    val spec: TransitionSpec
)

@OptIn(UnstableApi::class)
class TransitionTimelineEffect(
    initialWindows: List<TransitionWindow> = emptyList(),
    private val realtimePositionMsProvider: (() -> Long)? = null
) : GlEffect {

    private val windowsRef = AtomicReference(initialWindows)

    fun updateWindows(windows: List<TransitionWindow>) {
        windowsRef.set(windows)
    }

    override fun toGlShaderProgram(context: Context, useHdr: Boolean): GlShaderProgram {
        return TransitionTimelineShaderProgram(useHdr, windowsRef, realtimePositionMsProvider)
    }

    override fun isNoOp(inputWidth: Int, inputHeight: Int): Boolean = false

    companion object {
        fun buildWindows(context: Context, clips: List<TimelineClip>): List<TransitionWindow> {
            if (clips.size < 2) return emptyList()
            val result = mutableListOf<TransitionWindow>()
            var accMs = 0L
            for (i in 0 until clips.lastIndex) {
                val clip = clips[i]
                accMs += clip.activeDurationMs
                val trId = clip.outTransitionId ?: continue
                val spec = TransitionManifestLoader.findById(context, trId) ?: continue
                val nextClipDur = clips[i + 1].activeDurationMs
                val safeDurMs = clip.outTransitionDurationMs
                    .coerceIn(180L, (nextClipDur * 85L / 100L).coerceAtLeast(180L))
                val startUs = accMs * 1000L
                val endUs = (accMs + safeDurMs) * 1000L
                result.add(
                    TransitionWindow(
                        cutIndex = i,
                        cutTimeUs = startUs,
                        endTimeUs = endUs,
                        spec = spec
                    )
                )
            }
            return result
        }
    }
}

@OptIn(UnstableApi::class)
private class TransitionTimelineShaderProgram(
    private val useHdr: Boolean,
    private val windowsRef: AtomicReference<List<TransitionWindow>>,
    private val realtimePositionMsProvider: (() -> Long)?
) : BaseGlShaderProgram(useHdr, 1) {

    private val copyProgram: GlProgram
    private val transitionProgram: GlProgram

    private var outputWidth = 1
    private var outputHeight = 1

    private var snapshotTexId = 0
    private var snapshotFboId = 0
    private var snapshotWidth = 0
    private var snapshotHeight = 0
    private var snapshotCutIndex = -1

    init {
        try {
            copyProgram = GlProgram(
                GlTransitionShaders.VERTEX_SHADER_GLSL,
                GlTransitionShaders.COPY_FRAGMENT_SHADER_GLSL
            )
            copyProgram.setBufferAttribute(
                "aFramePosition",
                GlUtil.getNormalizedCoordinateBounds(),
                GlUtil.HOMOGENEOUS_COORDINATE_VECTOR_SIZE
            )

            transitionProgram = GlProgram(
                GlTransitionShaders.VERTEX_SHADER_GLSL,
                GlTransitionShaders.TRANSITION_FRAGMENT_SHADER_GLSL
            )
            transitionProgram.setBufferAttribute(
                "aFramePosition",
                GlUtil.getNormalizedCoordinateBounds(),
                GlUtil.HOMOGENEOUS_COORDINATE_VECTOR_SIZE
            )
        } catch (e: GlUtil.GlException) {
            throw VideoFrameProcessingException(e)
        }
    }

    override fun configure(inputWidth: Int, inputHeight: Int): Size {
        outputWidth = inputWidth.coerceAtLeast(1)
        outputHeight = inputHeight.coerceAtLeast(1)
        return Size(outputWidth, outputHeight)
    }

    override fun drawFrame(inputTexId: Int, presentationTimeUs: Long) {
        val windows = windowsRef.get()
        if (windows.isEmpty()) {
            drawPassthrough(inputTexId, presentationTimeUs)
            return
        }

        val currentTimeUs = realtimePositionMsProvider?.invoke()?.let { it * 1000L } ?: presentationTimeUs
        val activeWindow = windows.firstOrNull { currentTimeUs in it.cutTimeUs..it.endTimeUs }

        if (activeWindow == null) {
            // Capture outgoing pre-cut frame for the upcoming transition cut
            val upcoming = windows.firstOrNull { currentTimeUs < it.cutTimeUs }
            if (upcoming != null && upcoming.cutTimeUs - currentTimeUs <= 450_000L) {
                captureSnapshotFrame(inputTexId, upcoming.cutIndex)
            } else if (windows.all { currentTimeUs > it.endTimeUs }) {
                snapshotCutIndex = -1
            }
            drawPassthrough(inputTexId, presentationTimeUs)
            return
        }

        val durUs = (activeWindow.endTimeUs - activeWindow.cutTimeUs).coerceAtLeast(1L)
        val progress = ((currentTimeUs - activeWindow.cutTimeUs).toFloat() / durUs.toFloat()).coerceIn(0f, 1f)
        val hasSnapshot = snapshotCutIndex == activeWindow.cutIndex && snapshotTexId != 0

        try {
            transitionProgram.use()
            transitionProgram.setSamplerTexIdUniform("uToTex", inputTexId, 0)
            transitionProgram.setSamplerTexIdUniform(
                "uFromTex",
                if (hasSnapshot) snapshotTexId else inputTexId,
                1
            )
            transitionProgram.setFloatUniform("uProgress", progress)
            transitionProgram.setIntUniform("uFamily", activeWindow.spec.shaderFamily.shaderIndex)
            transitionProgram.setIntUniform("uMode", activeWindow.spec.mode)
            transitionProgram.setFloatUniform("uParamA", activeWindow.spec.paramA)
            transitionProgram.setFloatUniform("uParamB", activeWindow.spec.paramB)
            transitionProgram.setIntUniform("uHasFrom", if (hasSnapshot) 1 else 0)
            transitionProgram.bindAttributesAndUniforms()
            GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
            GlUtil.checkGlError()
        } catch (e: GlUtil.GlException) {
            throw VideoFrameProcessingException(e, presentationTimeUs)
        }
    }

    private fun drawPassthrough(inputTexId: Int, presentationTimeUs: Long) {
        try {
            copyProgram.use()
            copyProgram.setSamplerTexIdUniform("uTexSampler", inputTexId, 0)
            copyProgram.bindAttributesAndUniforms()
            GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
            GlUtil.checkGlError()
        } catch (e: GlUtil.GlException) {
            throw VideoFrameProcessingException(e, presentationTimeUs)
        }
    }

    private fun captureSnapshotFrame(inputTexId: Int, cutIndex: Int) {
        try {
            if (snapshotTexId == 0 || snapshotWidth != outputWidth || snapshotHeight != outputHeight) {
                releaseSnapshotResources()
                snapshotTexId = GlUtil.createTexture(outputWidth, outputHeight, useHdr)
                snapshotFboId = GlUtil.createFboForTexture(snapshotTexId)
                snapshotWidth = outputWidth
                snapshotHeight = outputHeight
            }

            val prevFbo = IntArray(1)
            val prevViewport = IntArray(4)
            GLES20.glGetIntegerv(GLES20.GL_FRAMEBUFFER_BINDING, prevFbo, 0)
            GLES20.glGetIntegerv(GLES20.GL_VIEWPORT, prevViewport, 0)

            GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, snapshotFboId)
            GLES20.glViewport(0, 0, snapshotWidth, snapshotHeight)
            copyProgram.use()
            copyProgram.setSamplerTexIdUniform("uTexSampler", inputTexId, 0)
            copyProgram.bindAttributesAndUniforms()
            GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)

            GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, prevFbo[0])
            GLES20.glViewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3])
            GlUtil.checkGlError()
            snapshotCutIndex = cutIndex
        } catch (_: Throwable) {
            snapshotCutIndex = -1
        }
    }

    private fun releaseSnapshotResources() {
        if (snapshotFboId != 0) {
            runCatching { GlUtil.deleteFbo(snapshotFboId) }
            snapshotFboId = 0
        }
        if (snapshotTexId != 0) {
            runCatching { GlUtil.deleteTexture(snapshotTexId) }
            snapshotTexId = 0
        }
        snapshotWidth = 0
        snapshotHeight = 0
        snapshotCutIndex = -1
    }

    override fun release() {
        releaseSnapshotResources()
        runCatching { copyProgram.delete() }
        runCatching { transitionProgram.delete() }
        super.release()
    }
}
