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
import com.tg7.editor.data.EffectsManifestLoader
import com.tg7.editor.engine.anim.KeyframeEngine
import com.tg7.editor.model.BlendModePreset
import com.tg7.editor.model.EffectShaderFamily
import com.tg7.editor.model.KeyframeNode
import com.tg7.editor.model.TimelineClip
import com.tg7.editor.model.VideoEffectSpec
import java.util.concurrent.atomic.AtomicReference

data class ClipEffectWindow(
    val clipId: String,
    val startTimeUs: Long,
    val endTimeUs: Long,
    val effectSpec: VideoEffectSpec?,
    val effectIntensity: Float,
    val brightness: Float,
    val contrast: Float,
    val saturation: Float,
    val temperature: Float,
    val vignette: Float,
    val chromaEnabled: Boolean,
    val chromaR: Float,
    val chromaG: Float,
    val chromaB: Float,
    val chromaSimilarity: Float,
    val chromaSmoothness: Float,
    val scale: Float = 1.0f,
    val panX: Float = 0f,
    val panY: Float = 0f,
    val rotationDeg: Float = 0f,
    val flipHorizontal: Boolean = false,
    val flipVertical: Boolean = false,
    val opacity: Float = 1.0f,
    val blendMode: BlendModePreset = BlendModePreset.NORMAL,
    val keyframes: List<KeyframeNode> = emptyList()
)

@OptIn(UnstableApi::class)
class ClipVideoEffectsEffect(
    initialWindows: List<ClipEffectWindow> = emptyList(),
    private val realtimePositionMsProvider: (() -> Long)? = null
) : GlEffect {

    private val windowsRef = AtomicReference(initialWindows)

    fun updateWindows(windows: List<ClipEffectWindow>) {
        windowsRef.set(windows)
    }

    override fun toGlShaderProgram(context: Context, useHdr: Boolean): GlShaderProgram {
        return ClipVideoEffectsShaderProgram(useHdr, windowsRef, realtimePositionMsProvider)
    }

    override fun isNoOp(inputWidth: Int, inputHeight: Int): Boolean = false

    companion object {
        fun buildWindows(context: Context, clips: List<TimelineClip>): List<ClipEffectWindow> {
            if (clips.isEmpty()) return emptyList()
            val out = mutableListOf<ClipEffectWindow>()
            var accMs = 0L
            clips.forEach { clip ->
                val startUs = accMs * 1000L
                val endUs = (accMs + clip.activeDurationMs) * 1000L
                accMs += clip.activeDurationMs

                if (clip.hasActiveVisualProcessing) {
                    val spec = EffectsManifestLoader.findById(context, clip.effectId)
                    val hex = clip.chromaColorHex
                    val r = ((hex ushr 16) and 0xFF) / 255f
                    val g = ((hex ushr 8) and 0xFF) / 255f
                    val b = (hex and 0xFF) / 255f
                    out.add(
                        ClipEffectWindow(
                            clipId = clip.id,
                            startTimeUs = startUs,
                            endTimeUs = endUs,
                            effectSpec = spec,
                            effectIntensity = clip.effectIntensity.coerceIn(0f, 1f),
                            brightness = clip.brightness.coerceIn(-0.5f, 0.5f),
                            contrast = clip.contrast.coerceIn(0.4f, 2.0f),
                            saturation = clip.saturation.coerceIn(0f, 2.0f),
                            temperature = clip.temperature.coerceIn(-1f, 1f),
                            vignette = clip.vignette.coerceIn(0f, 1f),
                            chromaEnabled = clip.chromaEnabled,
                            chromaR = r,
                            chromaG = g,
                            chromaB = b,
                            chromaSimilarity = clip.chromaSimilarity.coerceIn(0.05f, 0.85f),
                            chromaSmoothness = clip.chromaSmoothness.coerceIn(0.01f, 0.45f),
                            scale = clip.scale.coerceIn(0.25f, 4.0f),
                            panX = clip.panX.coerceIn(-0.8f, 0.8f),
                            panY = clip.panY.coerceIn(-0.8f, 0.8f),
                            rotationDeg = clip.rotationDeg,
                            flipHorizontal = clip.flipHorizontal,
                            flipVertical = clip.flipVertical,
                            opacity = clip.opacity.coerceIn(0f, 1f),
                            blendMode = clip.blendMode,
                            keyframes = clip.keyframes
                        )
                    )
                }
            }
            return out
        }
    }
}

@OptIn(UnstableApi::class)
private class ClipVideoEffectsShaderProgram(
    useHdr: Boolean,
    private val windowsRef: AtomicReference<List<ClipEffectWindow>>,
    private val realtimePositionMsProvider: (() -> Long)?
) : BaseGlShaderProgram(useHdr, 1) {

    private val copyProgram: GlProgram
    private val fxProgram: GlProgram

    private var outputWidth = 1
    private var outputHeight = 1

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

            fxProgram = GlProgram(
                GlVideoEffects.VERTEX_SHADER_GLSL,
                GlVideoEffects.EFFECTS_FRAGMENT_SHADER_GLSL
            )
            fxProgram.setBufferAttribute(
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
        val active = windows.firstOrNull { currentTimeUs in it.startTimeUs..it.endTimeUs }
        if (active == null) {
            drawPassthrough(inputTexId, presentationTimeUs)
            return
        }

        val spec = active.effectSpec
        val familyIdx = spec?.shaderFamily?.shaderIndex ?: EffectShaderFamily.NONE.shaderIndex
        val localMs = ((currentTimeUs - active.startTimeUs).coerceAtLeast(0L) / 1000L)
        val timeSec = localMs / 1000f

        val kf = KeyframeEngine.evaluate(
            keyframes = active.keyframes,
            basePosX = 0.5f + active.panX,
            basePosY = 0.5f + active.panY,
            baseScale = active.scale,
            baseRotationDeg = active.rotationDeg,
            baseOpacity = active.opacity,
            localTimeMs = localMs
        )
        val resolvedPanX = (kf.posX - 0.5f).coerceIn(-0.8f, 0.8f)
        val resolvedPanY = (kf.posY - 0.5f).coerceIn(-0.8f, 0.8f)
        val resolvedRad = Math.toRadians(kf.rotationDeg.toDouble()).toFloat()

        try {
            fxProgram.use()
            fxProgram.setSamplerTexIdUniform("uTexSampler", inputTexId, 0)
            fxProgram.setFloatUniform("uTimeSec", timeSec)
            fxProgram.setFloatUniform("uResolutionX", outputWidth.toFloat())
            fxProgram.setFloatUniform("uResolutionY", outputHeight.toFloat())

            fxProgram.setIntUniform("uFamily", familyIdx)
            fxProgram.setIntUniform("uMode", spec?.mode ?: 0)
            fxProgram.setFloatUniform("uIntensity", active.effectIntensity)
            fxProgram.setFloatUniform("uParamA", spec?.paramA ?: 0f)
            fxProgram.setFloatUniform("uParamB", spec?.paramB ?: 0f)
            fxProgram.setFloatUniform("uParamC", spec?.paramC ?: 0f)

            fxProgram.setFloatUniform("uBrightness", active.brightness)
            fxProgram.setFloatUniform("uContrast", active.contrast)
            fxProgram.setFloatUniform("uSaturation", active.saturation)
            fxProgram.setFloatUniform("uTemperature", active.temperature)
            fxProgram.setFloatUniform("uVignette", active.vignette)

            fxProgram.setIntUniform("uChromaEnabled", if (active.chromaEnabled) 1 else 0)
            fxProgram.setFloatUniform("uChromaR", active.chromaR)
            fxProgram.setFloatUniform("uChromaG", active.chromaG)
            fxProgram.setFloatUniform("uChromaB", active.chromaB)
            fxProgram.setFloatUniform("uChromaSimilarity", active.chromaSimilarity)
            fxProgram.setFloatUniform("uChromaSmoothness", active.chromaSmoothness)

            fxProgram.setFloatUniform("uPanX", resolvedPanX)
            fxProgram.setFloatUniform("uPanY", resolvedPanY)
            fxProgram.setFloatUniform("uScale", kf.scale.coerceIn(0.2f, 4.0f))
            fxProgram.setFloatUniform("uRotationRad", resolvedRad)
            fxProgram.setIntUniform("uFlipH", if (active.flipHorizontal) 1 else 0)
            fxProgram.setIntUniform("uFlipV", if (active.flipVertical) 1 else 0)
            fxProgram.setFloatUniform("uOpacity", kf.opacity.coerceIn(0f, 1f))
            fxProgram.setIntUniform("uBlendMode", active.blendMode.shaderIndex)

            fxProgram.bindAttributesAndUniforms()
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

    override fun release() {
        runCatching { copyProgram.delete() }
        runCatching { fxProgram.delete() }
        super.release()
    }
}
