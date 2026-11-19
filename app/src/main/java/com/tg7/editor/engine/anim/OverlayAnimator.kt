package com.tg7.editor.engine.anim

import android.content.Context
import com.tg7.editor.data.TextAndStickerLoader
import com.tg7.editor.model.TextAnimSpec
import com.tg7.editor.model.TextLayer
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin

data class AnimatedTextFrame(
    val visibleText: String,
    val alpha: Float = 1f,
    val scaleX: Float = 1f,
    val scaleY: Float = 1f,
    val offsetXDp: Float = 0f,
    val offsetYDp: Float = 0f,
    val rotationDeg: Float = 0f,
    val overrideColorHex: Long? = null
)

object OverlayAnimator {

    private val cipherChars = charArrayOf('#', '$', '%', '7', 'X', '0', '@', 'Z', '&')

    fun evaluateText(
        context: Context,
        layer: TextLayer,
        localTimeMs: Long
    ): AnimatedTextFrame {
        val spec = TextAndStickerLoader.findAnimationById(context, layer.animationId)
        return evaluateTextSpec(layer.text, layer.durationMs, spec, localTimeMs)
    }

    fun evaluateTextSpec(
        rawText: String,
        durationMs: Long,
        spec: TextAnimSpec?,
        localTimeMs: Long
    ): AnimatedTextFrame {
        val text = rawText.ifBlank { "TG7" }
        if (spec == null || spec.animKind == "NONE") {
            return AnimatedTextFrame(visibleText = text)
        }

        val speed = spec.speedMultiplier.coerceIn(0.4f, 2.5f)
        val safeDur = durationMs.coerceAtLeast(300L).toFloat()
        val tSec = (localTimeMs.coerceAtLeast(0L) / 1000f) * speed
        val entryDurMs = (550f / speed).coerceIn(180f, safeDur * 0.65f)
        val exitDurMs = (350f / speed).coerceIn(140f, safeDur * 0.35f)
        val inP = (localTimeMs / entryDurMs).coerceIn(0f, 1f)
        val outP = ((safeDur - localTimeMs) / exitDurMs).coerceIn(0f, 1f)
        val easeOut = 1f - (1f - inP).pow(3f)

        return when (spec.animKind) {
            "FADE_SMOOTH" -> AnimatedTextFrame(
                visibleText = text,
                alpha = minOf(easeOut, outP)
            )
            "BOUNCE_POP" -> {
                val spring = if (inP < 0.65f) {
                    (inP / 0.65f) * 1.18f
                } else {
                    1.18f - ((inP - 0.65f) / 0.35f) * 0.18f
                }
                AnimatedTextFrame(
                    visibleText = text,
                    alpha = minOf((inP * 2.5f).coerceAtMost(1f), outP),
                    scaleX = spring.coerceAtLeast(0.15f),
                    scaleY = spring.coerceAtLeast(0.15f)
                )
            }
            "ELASTIC_IN" -> {
                val s = if (inP >= 1f) 1f else {
                    (1f - 2f.pow(-8f * inP) * cos(inP * 14f)).coerceIn(0.1f, 1.35f)
                }
                AnimatedTextFrame(visibleText = text, alpha = minOf((inP * 3f).coerceAtMost(1f), outP), scaleX = s, scaleY = s)
            }
            "ZOOM_SLAM" -> {
                val s = 2.6f - 1.6f * easeOut
                AnimatedTextFrame(visibleText = text, alpha = minOf(easeOut, outP), scaleX = s, scaleY = s)
            }
            "ZOOM_REVEAL" -> {
                val s = 0.65f + 0.35f * easeOut
                AnimatedTextFrame(visibleText = text, alpha = minOf(easeOut, outP), scaleX = s, scaleY = s)
            }
            "TYPEWRITER" -> {
                val revealP = (localTimeMs / (safeDur * 0.72f / speed).coerceAtLeast(250f)).coerceIn(0f, 1f)
                val count = (text.length * revealP).roundToInt().coerceIn(1, text.length)
                AnimatedTextFrame(visibleText = text.substring(0, count), alpha = outP)
            }
            "TYPEWRITER_CURSOR" -> {
                val revealP = (localTimeMs / (safeDur * 0.72f / speed).coerceAtLeast(250f)).coerceIn(0f, 1f)
                val count = (text.length * revealP).roundToInt().coerceIn(1, text.length)
                val cursor = if (((localTimeMs / 240L) % 2L) == 0L) "_" else ""
                AnimatedTextFrame(visibleText = text.substring(0, count) + cursor, alpha = outP)
            }
            "MATRIX_DECODE" -> {
                val revealP = (localTimeMs / (safeDur * 0.65f / speed).coerceAtLeast(250f)).coerceIn(0f, 1f)
                val locked = (text.length * revealP).toInt()
                val step = (localTimeMs / 65L).toInt()
                val sb = StringBuilder(text.length)
                for (i in text.indices) {
                    if (i < locked || text[i] == ' ') sb.append(text[i])
                    else sb.append(cipherChars[(i + step) % cipherChars.size])
                }
                AnimatedTextFrame(visibleText = sb.toString(), alpha = outP)
            }
            "WORD_REVEAL" -> {
                val words = text.split(" ")
                val revealP = (localTimeMs / (safeDur * 0.7f / speed).coerceAtLeast(250f)).coerceIn(0f, 1f)
                val count = (words.size * revealP).roundToInt().coerceIn(1, words.size)
                AnimatedTextFrame(visibleText = words.take(count).joinToString(" "), alpha = outP)
            }
            "KARAOKE_GLOW" -> {
                val cycle = (sin(tSec * 5f) * 0.5f + 0.5f)
                val col = if (cycle > 0.5f) 0xFF00F0FFL else 0xFFFACC15L
                val s = 1f + 0.06f * cycle
                AnimatedTextFrame(visibleText = text, alpha = outP, scaleX = s, scaleY = s, overrideColorHex = col)
            }
            "GLITCH_FLICKER" -> {
                val jitterStep = (localTimeMs / 55L).toInt()
                val burst = (jitterStep % 7 == 0) || (inP < 0.75f)
                val dx = if (burst) (((jitterStep * 13) % 15) - 7).toFloat() else 0f
                val dy = if (burst) (((jitterStep * 7) % 7) - 3).toFloat() else 0f
                val alpha = if (jitterStep % 9 == 0 && inP < 0.8f) 0.45f else 1f
                AnimatedTextFrame(
                    visibleText = text,
                    alpha = minOf(alpha, outP),
                    offsetXDp = dx,
                    offsetYDp = dy
                )
            }
            "STROBE_FLASH" -> {
                val flash = if (((localTimeMs / 75L) % 2L) == 0L || inP > 0.75f) 1f else 0.25f
                AnimatedTextFrame(visibleText = text, alpha = minOf(flash, outP))
            }
            "CRT_ON" -> {
                val sx = (inP * 2.2f).coerceIn(0.1f, 1f)
                val sy = if (inP < 0.45f) 0.08f else ((inP - 0.45f) / 0.55f).coerceIn(0.08f, 1f)
                AnimatedTextFrame(visibleText = text, alpha = outP, scaleX = sx, scaleY = sy)
            }
            "SLIDE_UP" -> AnimatedTextFrame(
                visibleText = text,
                alpha = minOf(easeOut, outP),
                offsetYDp = (1f - easeOut) * 44f
            )
            "SLIDE_DOWN" -> AnimatedTextFrame(
                visibleText = text,
                alpha = minOf(easeOut, outP),
                offsetYDp = -(1f - easeOut) * 44f
            )
            "SLIDE_LEFT" -> AnimatedTextFrame(
                visibleText = text,
                alpha = minOf(easeOut, outP),
                offsetXDp = (1f - easeOut) * 72f
            )
            "SLIDE_RIGHT" -> AnimatedTextFrame(
                visibleText = text,
                alpha = minOf(easeOut, outP),
                offsetXDp = -(1f - easeOut) * 72f
            )
            "SPIN_POP" -> {
                val rot = (1f - easeOut) * -28f
                val s = 0.4f + 0.6f * easeOut
                AnimatedTextFrame(visibleText = text, alpha = minOf(easeOut, outP), scaleX = s, scaleY = s, rotationDeg = rot)
            }
            "WAVE_FLOAT" -> {
                val dy = sin(tSec * 2.0 * PI).toFloat() * 7f
                AnimatedTextFrame(visibleText = text, alpha = minOf(easeOut, outP), offsetYDp = dy)
            }
            "PULSE_GLOW" -> {
                val s = 1f + abs(sin(tSec * 3.5f)) * 0.14f
                AnimatedTextFrame(visibleText = text, alpha = minOf(easeOut, outP), scaleX = s, scaleY = s)
            }
            "SHAKE_IMPACT" -> {
                val dx = sin(tSec * 28f) * 5.5f
                val dy = cos(tSec * 22f) * 3.5f
                AnimatedTextFrame(visibleText = text, alpha = outP, offsetXDp = dx, offsetYDp = dy)
            }
            "RAINBOW_NEON" -> {
                val palette = longArrayOf(0xFF00F0FFL, 0xFFFF1030L, 0xFFFACC15L, 0xFF22C55EL, 0xFFC084FCL)
                val idx = ((tSec * 4f).toInt()) % palette.size
                AnimatedTextFrame(visibleText = text, alpha = outP, overrideColorHex = palette[idx])
            }
            "WOBBLE_TILT" -> {
                val rot = sin(tSec * 4f) * 7.5f
                AnimatedTextFrame(visibleText = text, alpha = outP, rotationDeg = rot)
            }
            else -> AnimatedTextFrame(visibleText = text, alpha = minOf(easeOut, outP))
        }
    }
}
