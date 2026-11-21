package com.tg7.editor.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tg7.editor.media.MediaPickerHelper
import com.tg7.editor.model.AudioClip
import com.tg7.editor.ui.theme.TG7Colors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AudioStudioSheet(
    audioClips: List<AudioClip>,
    selectedAudioId: String?,
    initialTab: Int = 0,
    isRecordingVoiceover: Boolean,
    voiceoverAmplitude: Float,
    voiceoverElapsedMs: Long,
    onSelectAudioClip: (String) -> Unit,
    onImportAudioClick: () -> Unit,
    onUpdateAudioMix: (audioId: String, volume: Float, fadeInMs: Long, fadeOutMs: Long) -> Unit,
    onReanalyzeBeats: (audioId: String) -> Unit,
    onSeekToBeatGlobal: (Long) -> Unit,
    onStartVoiceoverClick: () -> Unit,
    onStopVoiceoverClick: () -> Unit,
    onDismiss: () -> Unit
) {
    val haptic = LocalHapticFeedback.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var activeTab by remember(initialTab) { mutableIntStateOf(initialTab.coerceIn(0, 1)) }

    val activeAudio = remember(audioClips, selectedAudioId) {
        audioClips.firstOrNull { it.id == selectedAudioId } ?: audioClips.firstOrNull()
    }

    var volume by remember(activeAudio?.id, activeAudio?.volume) {
        mutableFloatStateOf(activeAudio?.volume ?: 1.0f)
    }
    var fadeInMs by remember(activeAudio?.id, activeAudio?.fadeInMs) {
        mutableLongStateOf(activeAudio?.fadeInMs ?: 0L)
    }
    var fadeOutMs by remember(activeAudio?.id, activeAudio?.fadeOutMs) {
        mutableLongStateOf(activeAudio?.fadeOutMs ?: 0L)
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF070A10),
        contentColor = Color.White,
        dragHandle = null
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Audio Studio & Voiceover",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = if (activeTab == 0) "Real PCM waveform, beat markers, volume & fades" else "Record studio AAC voiceover directly to timeline",
                        color = TG7Colors.TextMuted,
                        fontSize = 11.sp
                    )
                }
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                ) {
                    Icon(Icons.Rounded.Close, contentDescription = "Close", tint = Color.White)
                }
            }

            Spacer(Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                AudioTabChip(
                    icon = Icons.Rounded.GraphicEq,
                    label = "Mix & Beats (${audioClips.size})",
                    selected = activeTab == 0,
                    onClick = { activeTab = 0 },
                    modifier = Modifier.weight(1f)
                )
                AudioTabChip(
                    icon = Icons.Rounded.Mic,
                    label = if (isRecordingVoiceover) "REC LIVE" else "Voiceover Mic",
                    selected = activeTab == 1,
                    onClick = { activeTab = 1 },
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(Modifier.height(12.dp))

            if (activeTab == 0) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 420.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (audioClips.isNotEmpty()) {
                            Row(
                                modifier = Modifier
                                    .weight(1f)
                                    .horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                audioClips.forEach { clip ->
                                    val selected = clip.id == activeAudio?.id
                                    Box(
                                        modifier = Modifier
                                            .defaultMinSize(minHeight = 48.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(if (selected) Color(0xFF0E2530) else Color(0xFF101521))
                                            .border(1.dp, if (selected) Color(0xFF22C55E) else TG7Colors.BorderSubtle, RoundedCornerShape(10.dp))
                                            .clickable { onSelectAudioClip(clip.id) }
                                            .padding(horizontal = 12.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = clip.displayName.take(18),
                                            color = if (selected) Color(0xFF22C55E) else Color.White,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                            }
                        } else {
                            Spacer(Modifier.weight(1f))
                        }

                        Button(
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                onImportAudioClick()
                            },
                            modifier = Modifier.heightIn(min = 48.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF22C55E),
                                contentColor = Color.Black
                            )
                        ) {
                            Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Import Audio", fontWeight = FontWeight.Black, fontSize = 12.sp)
                        }
                    }

                    if (activeAudio == null) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF0C101B))
                                .padding(20.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Import music/SFX from device or record a Voiceover to unlock Waveform & Beat Detection.",
                                color = TG7Colors.TextMuted,
                                fontSize = 12.sp
                            )
                        }
                    } else {
                        // Waveform & Interactive Beat Markers Canvas
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF0B111C))
                                .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(12.dp))
                                .padding(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "PCM Waveform · ${activeAudio.beatMarkersMs.size} Beats",
                                    color = Color(0xFF22C55E),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Row(
                                    modifier = Modifier
                                        .defaultMinSize(minHeight = 48.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .clickable {
                                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                            onReanalyzeBeats(activeAudio.id)
                                        }
                                        .padding(horizontal = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(Icons.Rounded.Refresh, contentDescription = null, tint = TG7Colors.NeonCyan, modifier = Modifier.size(16.dp))
                                    Text("Detect Beats", color = TG7Colors.NeonCyan, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }

                            val peaks = activeAudio.waveformPeaks.ifEmpty {
                                List(48) { idx -> 0.25f + (idx % 5) * 0.14f }
                            }
                            Canvas(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(74.dp)
                                    .pointerInput(activeAudio.id, activeAudio.activeDurationMs) {
                                        detectTapGestures { offset ->
                                            val frac = (offset.x / size.width.coerceAtLeast(1)).coerceIn(0f, 1f)
                                            val targetGlobal = activeAudio.startTimeMs +
                                                (frac * activeAudio.activeDurationMs).toLong()
                                            onSeekToBeatGlobal(targetGlobal)
                                        }
                                    }
                            ) {
                                val barStep = size.width / peaks.size.coerceAtLeast(1)
                                val midY = size.height / 2f
                                peaks.forEachIndexed { idx, amp ->
                                    val x = idx * barStep + barStep * 0.5f
                                    val barH = (amp.coerceIn(0.08f, 1f) * size.height * 0.72f).coerceAtLeast(6f)
                                    drawLine(
                                        color = Color(0xFF22C55E).copy(alpha = 0.78f),
                                        start = Offset(x, midY - barH / 2f),
                                        end = Offset(x, midY + barH / 2f),
                                        strokeWidth = (barStep * 0.55f).coerceIn(2f, 6f),
                                        cap = StrokeCap.Round
                                    )
                                }

                                // Beat onset diamonds (Cyan)
                                val srcSpan = activeAudio.sourceDurationMs.coerceAtLeast(1000L).toFloat()
                                activeAudio.beatMarkersMs.forEach { beatMs ->
                                    if (beatMs in activeAudio.trimStartMs..activeAudio.trimEndMs) {
                                        val frac = ((beatMs - activeAudio.trimStartMs) /
                                            (activeAudio.activeDurationMs.coerceAtLeast(300L)).toFloat()).coerceIn(0f, 1f)
                                        val bx = frac * size.width
                                        val d = Path().apply {
                                            moveTo(bx, 4f)
                                            lineTo(bx + 6f, 10f)
                                            lineTo(bx, 16f)
                                            lineTo(bx - 6f, 10f)
                                            close()
                                        }
                                        drawPath(path = d, color = TG7Colors.NeonCyan)
                                        drawLine(
                                            color = TG7Colors.NeonCyan.copy(alpha = 0.35f),
                                            start = Offset(bx, 16f),
                                            end = Offset(bx, size.height),
                                            strokeWidth = 1.5f
                                        )
                                    } else if (srcSpan > 0f) {
                                        // outside trim window
                                    }
                                }
                            }
                            Text(
                                text = "Tap anywhere on the waveform or cyan beat diamonds to jump playhead.",
                                color = TG7Colors.TextMuted,
                                fontSize = 10.sp
                            )
                        }

                        // Volume Slider
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0xFF0D111C))
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                    Icon(Icons.AutoMirrored.Rounded.VolumeUp, contentDescription = null, tint = Color(0xFF22C55E), modifier = Modifier.size(16.dp))
                                    Text("Track Gain", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                                Text(
                                    text = "${(volume * 100).toInt()}%",
                                    color = Color(0xFF22C55E),
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Black
                                )
                            }
                            Slider(
                                value = volume.coerceIn(0f, 2f),
                                onValueChange = { next ->
                                    volume = next
                                    onUpdateAudioMix(activeAudio.id, volume, fadeInMs, fadeOutMs)
                                },
                                valueRange = 0f..2.0f,
                                colors = SliderDefaults.colors(
                                    thumbColor = Color(0xFF22C55E),
                                    activeTrackColor = Color(0xFF22C55E),
                                    inactiveTrackColor = TG7Colors.BorderSubtle
                                )
                            )
                        }

                        // Fade In & Fade Out Sliders
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0xFF0D111C))
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Fade In", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                Text(
                                    text = "${fadeInMs / 1000f}s",
                                    color = TG7Colors.NeonCyan,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 12.sp
                                )
                            }
                            Slider(
                                value = fadeInMs.toFloat(),
                                onValueChange = { next ->
                                    fadeInMs = (next / 100f).toLong() * 100L
                                    onUpdateAudioMix(activeAudio.id, volume, fadeInMs, fadeOutMs)
                                },
                                valueRange = 0f..3000f,
                                colors = SliderDefaults.colors(
                                    thumbColor = TG7Colors.NeonCyan,
                                    activeTrackColor = TG7Colors.NeonCyan,
                                    inactiveTrackColor = TG7Colors.BorderSubtle
                                )
                            )

                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Fade Out", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                Text(
                                    text = "${fadeOutMs / 1000f}s",
                                    color = TG7Colors.NeonCyan,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 12.sp
                                )
                            }
                            Slider(
                                value = fadeOutMs.toFloat(),
                                onValueChange = { next ->
                                    fadeOutMs = (next / 100f).toLong() * 100L
                                    onUpdateAudioMix(activeAudio.id, volume, fadeInMs, fadeOutMs)
                                },
                                valueRange = 0f..3000f,
                                colors = SliderDefaults.colors(
                                    thumbColor = TG7Colors.NeonCyan,
                                    activeTrackColor = TG7Colors.NeonCyan,
                                    inactiveTrackColor = TG7Colors.BorderSubtle
                                )
                            )
                        }
                    }
                }
            } else {
                // Tab 1: Voiceover Microphone Studio
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFF0C101B))
                        .border(1.dp, if (isRecordingVoiceover) TG7Colors.BloodRed else TG7Colors.BorderSubtle, RoundedCornerShape(14.dp))
                        .padding(18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = if (isRecordingVoiceover) "RECORDING VOICEOVER" else "Tap Mic to Record Voiceover",
                        color = if (isRecordingVoiceover) TG7Colors.BloodRed else Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = MediaPickerHelper.formatDuration(voiceoverElapsedMs),
                        color = if (isRecordingVoiceover) TG7Colors.NeonCyan else TG7Colors.TextMuted,
                        fontSize = 26.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Black
                    )

                    // Live Mic VU Level Meter
                    Canvas(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(26.dp)
                    ) {
                        val bars = 24
                        val step = size.width / bars
                        val litCount = (voiceoverAmplitude.coerceIn(0f, 1f) * bars).toInt()
                        for (i in 0 until bars) {
                            val lit = i < litCount
                            val barColor = when {
                                !lit -> Color(0xFF1A2232)
                                i > (bars * 0.78f) -> TG7Colors.BloodRed
                                i > (bars * 0.5f) -> Color(0xFFFACC15)
                                else -> Color(0xFF22C55E)
                            }
                            drawLine(
                                color = barColor,
                                start = Offset(i * step + step * 0.5f, 4f),
                                end = Offset(i * step + step * 0.5f, size.height - 4f),
                                strokeWidth = (step * 0.6f).coerceIn(3f, 8f),
                                cap = StrokeCap.Round
                            )
                        }
                    }

                    Button(
                        onClick = {
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            if (isRecordingVoiceover) onStopVoiceoverClick() else onStartVoiceoverClick()
                        },
                        modifier = Modifier
                            .defaultMinSize(minWidth = 170.dp, minHeight = 56.dp),
                        shape = CircleShape,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isRecordingVoiceover) Color.White else TG7Colors.BloodRed,
                            contentColor = if (isRecordingVoiceover) Color.Black else Color.White
                        )
                    ) {
                        Icon(
                            imageVector = if (isRecordingVoiceover) Icons.Rounded.Stop else Icons.Rounded.Mic,
                            contentDescription = if (isRecordingVoiceover) "Stop Recording" else "Start Recording",
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = if (isRecordingVoiceover) "Stop & Add Track" else "Start Recording",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Black
                        )
                    }

                    Text(
                        text = "Recorded AAC (.m4a) audio is automatically placed at your current playhead with live waveform & beat markers.",
                        color = TG7Colors.TextMuted,
                        fontSize = 11.sp
                    )
                }
            }

            Spacer(Modifier.height(10.dp))

            OutlinedButton(
                onClick = onDismiss,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(Icons.Rounded.Check, contentDescription = null, tint = TG7Colors.NeonCyan)
                Spacer(Modifier.width(6.dp))
                Text("Done", color = TG7Colors.NeonCyan, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun AudioTabChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .defaultMinSize(minHeight = 48.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) Color(0xFF0E2530) else Color(0xFF10141F))
            .border(1.dp, if (selected) Color(0xFF22C55E) else TG7Colors.BorderSubtle, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Icon(icon, contentDescription = null, tint = if (selected) Color(0xFF22C55E) else TG7Colors.TextMuted, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(6.dp))
        Text(
            text = label,
            color = if (selected) Color(0xFF22C55E) else Color.White,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}
