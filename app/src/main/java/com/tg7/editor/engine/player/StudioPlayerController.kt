package com.tg7.editor.engine.player

import android.content.Context
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import com.tg7.editor.engine.gl.ClipVideoEffectsEffect
import com.tg7.editor.engine.gl.TransitionTimelineEffect
import com.tg7.editor.model.AudioClip
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.TimelineClip
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.abs

@OptIn(UnstableApi::class)
class StudioPlayerController(
    context: Context,
    private val scope: CoroutineScope
) {
    private val appContext = context.applicationContext
    val player: ExoPlayer = ExoPlayer.Builder(appContext).build()
    private val audioPlayer: ExoPlayer = ExoPlayer.Builder(appContext).build()

    private var currentClips: List<TimelineClip> = emptyList()
    private var currentAudioClips: List<AudioClip> = emptyList()
    private var clipOffsetsMs: List<Long> = emptyList()
    private var preparedAudioClipId: String? = null
    private var tickerJob: Job? = null

    private val clipEffectsEffect = ClipVideoEffectsEffect(
        realtimePositionMsProvider = { _globalPositionMs.value }
    )
    private val transitionEffect = TransitionTimelineEffect(
        realtimePositionMsProvider = { _globalPositionMs.value }
    )

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _globalPositionMs = MutableStateFlow(0L)
    val globalPositionMs: StateFlow<Long> = _globalPositionMs.asStateFlow()

    private val _playerError = MutableStateFlow<String?>(null)
    val playerError: StateFlow<String?> = _playerError.asStateFlow()

    private val listener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            _isPlaying.value = isPlaying
            if (isPlaying) {
                startTicker()
                syncAudioToGlobal(_globalPositionMs.value, forcePlay = true)
            } else {
                stopTicker()
                if (audioPlayer.isPlaying) audioPlayer.pause()
            }
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_ENDED) {
                _isPlaying.value = false
                stopTicker()
                if (audioPlayer.isPlaying) audioPlayer.pause()
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            _isPlaying.value = false
            stopTicker()
            if (audioPlayer.isPlaying) audioPlayer.pause()
            _playerError.value =
                "Playback error (${error.errorCodeName}): ${error.localizedMessage ?: "Unsupported media"}"
        }
    }

    init {
        player.setVideoEffects(listOf(clipEffectsEffect, transitionEffect))
        player.addListener(listener)
    }

    fun refreshTransitionEffects(clips: List<TimelineClip>) {
        currentClips = clips
        transitionEffect.updateWindows(TransitionTimelineEffect.buildWindows(appContext, clips))
    }

    fun refreshClipEffects(clips: List<TimelineClip>) {
        currentClips = clips
        clipEffectsEffect.updateWindows(ClipVideoEffectsEffect.buildWindows(appContext, clips))
        if (!player.isPlaying && currentClips.isNotEmpty()) {
            player.seekTo(player.currentMediaItemIndex, player.currentPosition)
        }
    }

    fun refreshAudioClips(audioClips: List<AudioClip>) {
        currentAudioClips = audioClips
        syncAudioToGlobal(_globalPositionMs.value, forcePlay = player.isPlaying)
    }

    fun clearError() {
        _playerError.value = null
    }

    fun setTimelineMedia(
        clips: List<TimelineClip>,
        audioClips: List<AudioClip> = emptyList(),
        preservePositionMs: Long? = null
    ) {
        currentClips = clips
        currentAudioClips = audioClips

        val offsets = ArrayList<Long>(clips.size)
        var acc = 0L
        clips.forEach { clip ->
            offsets.add(acc)
            acc += clip.activeDurationMs
        }
        clipOffsetsMs = offsets
        clipEffectsEffect.updateWindows(ClipVideoEffectsEffect.buildWindows(appContext, clips))
        transitionEffect.updateWindows(TransitionTimelineEffect.buildWindows(appContext, clips))

        if (clips.isEmpty()) {
            player.pause()
            player.clearMediaItems()
            audioPlayer.pause()
            audioPlayer.clearMediaItems()
            preparedAudioClipId = null
            _globalPositionMs.value = 0L
            return
        }

        val mediaItems = clips.map { clip ->
            val builder = MediaItem.Builder()
                .setMediaId(clip.id)
                .setUri(Uri.parse(clip.uriString))

            if (clip.kind == MediaKind.IMAGE) {
                builder.setImageDurationMs(clip.activeDurationMs)
            } else {
                builder.setClippingConfiguration(
                    MediaItem.ClippingConfiguration.Builder()
                        .setStartPositionMs(clip.trimStartMs)
                        .setEndPositionMs(clip.trimEndMs)
                        .build()
                )
            }
            builder.build()
        }

        val targetPos = (preservePositionMs ?: _globalPositionMs.value)
            .coerceIn(0L, acc.coerceAtLeast(0L))
        val (targetIdx, localMs) = mapGlobalToClip(targetPos)

        _playerError.value = null
        player.setMediaItems(mediaItems, targetIdx, localMs)
        player.prepare()
        _globalPositionMs.value = targetPos
        syncAudioToGlobal(targetPos, forcePlay = player.isPlaying)
    }

    fun togglePlayPause() {
        if (currentClips.isEmpty()) return
        if (player.isPlaying) {
            player.pause()
            if (audioPlayer.isPlaying) audioPlayer.pause()
        } else {
            val total = totalDurationMs()
            if (player.playbackState == Player.STATE_ENDED || _globalPositionMs.value >= total - 40L) {
                seekToGlobal(0L)
            }
            player.play()
            syncAudioToGlobal(_globalPositionMs.value, forcePlay = true)
        }
    }

    fun pause() {
        if (player.isPlaying) player.pause()
        if (audioPlayer.isPlaying) audioPlayer.pause()
    }

    fun seekToGlobal(globalMs: Long) {
        if (currentClips.isEmpty()) {
            _globalPositionMs.value = 0L
            return
        }
        val clamped = globalMs.coerceIn(0L, totalDurationMs())
        val (idx, localMs) = mapGlobalToClip(clamped)
        player.seekTo(idx, localMs)
        _globalPositionMs.value = clamped
        syncAudioToGlobal(clamped, forcePlay = player.isPlaying)
    }

    fun totalDurationMs(): Long = currentClips.sumOf { it.activeDurationMs }

    private fun syncAudioToGlobal(globalMs: Long, forcePlay: Boolean) {
        val activeAudio = currentAudioClips.firstOrNull { clip ->
            globalMs >= clip.startTimeMs && globalMs < clip.startTimeMs + clip.activeDurationMs
        }
        if (activeAudio == null) {
            if (audioPlayer.isPlaying) audioPlayer.pause()
            return
        }

        val localAudioPos = (activeAudio.trimStartMs + (globalMs - activeAudio.startTimeMs))
            .coerceIn(activeAudio.trimStartMs, activeAudio.trimEndMs)

        if (preparedAudioClipId != activeAudio.id) {
            preparedAudioClipId = activeAudio.id
            val audioItem = MediaItem.Builder()
                .setMediaId(activeAudio.id)
                .setUri(Uri.parse(activeAudio.uriString))
                .build()
            audioPlayer.setMediaItem(audioItem, localAudioPos)
            audioPlayer.prepare()
        } else if (abs(audioPlayer.currentPosition - localAudioPos) > 140L) {
            audioPlayer.seekTo(localAudioPos)
        }

        val activeDur = activeAudio.activeDurationMs.coerceAtLeast(300L)
        val localTimelineMs = (globalMs - activeAudio.startTimeMs).coerceIn(0L, activeDur)
        var fadeEnv = 1.0f
        if (activeAudio.fadeInMs > 0L && localTimelineMs < activeAudio.fadeInMs) {
            fadeEnv *= (localTimelineMs.toFloat() / activeAudio.fadeInMs.toFloat()).coerceIn(0f, 1f)
        }
        if (activeAudio.fadeOutMs > 0L) {
            val remMs = (activeDur - localTimelineMs).coerceAtLeast(0L)
            if (remMs < activeAudio.fadeOutMs) {
                fadeEnv *= (remMs.toFloat() / activeAudio.fadeOutMs.toFloat()).coerceIn(0f, 1f)
            }
        }
        audioPlayer.volume = (activeAudio.volume * fadeEnv).coerceIn(0f, 1f)
        if (forcePlay && !audioPlayer.isPlaying) {
            audioPlayer.play()
        } else if (!forcePlay && audioPlayer.isPlaying) {
            audioPlayer.pause()
        }
    }

    private fun mapGlobalToClip(globalMs: Long): Pair<Int, Long> {
        if (currentClips.isEmpty()) return 0 to 0L
        for (i in currentClips.indices) {
            val clip = currentClips[i]
            val start = clipOffsetsMs[i]
            val dur = clip.activeDurationMs
            if (globalMs <= start + dur || i == currentClips.lastIndex) {
                val timelineLocal = (globalMs - start).coerceIn(0L, dur)
                val sourceLocal = if (clip.kind == MediaKind.IMAGE) {
                    timelineLocal.coerceIn(0L, (dur - 10L).coerceAtLeast(0L))
                } else {
                    val maxSpan = (clip.trimEndMs - clip.trimStartMs - 10L).coerceAtLeast(0L)
                    (timelineLocal * clip.effectiveSpeed).toLong().coerceIn(0L, maxSpan)
                }
                return i to sourceLocal
            }
        }
        return 0 to 0L
    }

    private fun startTicker() {
        if (tickerJob?.isActive == true) return
        tickerJob = scope.launch(Dispatchers.Main.immediate) {
            while (isActive && player.isPlaying) {
                val idx = player.currentMediaItemIndex
                if (idx in clipOffsetsMs.indices && idx in currentClips.indices) {
                    val clip = currentClips[idx]
                    val base = clipOffsetsMs[idx]
                    val sourceLocal = player.currentPosition.coerceAtLeast(0L)
                    val timelineLocal = if (clip.kind == MediaKind.IMAGE) {
                        sourceLocal
                    } else {
                        (sourceLocal / clip.effectiveSpeed).toLong()
                    }
                    val gPos = (base + timelineLocal).coerceIn(0L, totalDurationMs())
                    _globalPositionMs.value = gPos

                    val progress = (timelineLocal.toFloat() / clip.activeDurationMs.coerceAtLeast(1L)).coerceIn(0f, 1f)
                    val targetSpeed = if (clip.kind == MediaKind.IMAGE) {
                        1.0f
                    } else {
                        clip.speedRamp.evaluateAt(progress, clip.speed)
                    }
                    if (abs(player.playbackParameters.speed - targetSpeed) > 0.02f) {
                        player.setPlaybackSpeed(targetSpeed)
                    }

                    syncAudioToGlobal(gPos, forcePlay = true)
                }
                delay(16L)
            }
        }
    }

    private fun stopTicker() {
        tickerJob?.cancel()
        tickerJob = null
    }

    fun release() {
        stopTicker()
        player.removeListener(listener)
        player.release()
        audioPlayer.release()
    }
}
