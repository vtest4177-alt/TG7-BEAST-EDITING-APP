package com.tg7.editor.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DoneAll
import androidx.compose.material.icons.rounded.FilterCenterFocus
import androidx.compose.material.icons.rounded.LayersClear
import androidx.compose.material.icons.rounded.Palette
import androidx.compose.material.icons.rounded.RestartAlt
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tg7.editor.data.EffectsManifestLoader
import com.tg7.editor.model.ChromaKeyConfig
import com.tg7.editor.model.ClipColorGrade
import com.tg7.editor.model.EffectShaderFamily
import com.tg7.editor.model.TimelineClip
import com.tg7.editor.model.VideoEffectSpec
import com.tg7.editor.ui.theme.TG7Colors
import java.util.Locale
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

private data class ChromaPresetSwatch(
    val label: String,
    val colorHex: Long
)

private val CHROMA_PRESETS = listOf(
    ChromaPresetSwatch("Green Screen", 0xFF00C853L),
    ChromaPresetSwatch("Neon Lime", 0xFF22FF44L),
    ChromaPresetSwatch("Blue Screen", 0xFF0044FFL),
    ChromaPresetSwatch("Cyan Studio", 0xFF00D8FFL),
    ChromaPresetSwatch("Crimson Key", 0xFFFF1030L)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EffectsAndColorSheet(
    clip: TimelineClip,
    initialTab: Int = 0,
    onApplyEffect: (clipId: String, effectId: String?, intensity: Float) -> Unit,
    onApplyEffectAll: (effectId: String?, intensity: Float) -> Unit,
    onUpdateColorGrade: (clipId: String, grade: ClipColorGrade) -> Unit,
    onApplyColorGradeAll: (grade: ClipColorGrade) -> Unit,
    onUpdateChromaKey: (clipId: String, config: ChromaKeyConfig) -> Unit,
    onResetClipVisuals: (clipId: String) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val haptic = LocalHapticFeedback.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val allEffects = remember { EffectsManifestLoader.getAll(context) }
    val categories = remember { listOf("All") + EffectsManifestLoader.getCategories(context) }

    var activeTab by remember(initialTab) { mutableIntStateOf(initialTab.coerceIn(0, 2)) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("All") }

    var selectedEffectId by remember(clip.id, clip.effectId) {
        mutableStateOf(clip.effectId ?: allEffects.firstOrNull()?.id)
    }
    var intensity by remember(clip.id, clip.effectIntensity) {
        mutableFloatStateOf(clip.effectIntensity.coerceIn(0f, 1f))
    }

    var brightness by remember(clip.id, clip.brightness) { mutableFloatStateOf(clip.brightness) }
    var contrast by remember(clip.id, clip.contrast) { mutableFloatStateOf(clip.contrast) }
    var saturation by remember(clip.id, clip.saturation) { mutableFloatStateOf(clip.saturation) }
    var temperature by remember(clip.id, clip.temperature) { mutableFloatStateOf(clip.temperature) }
    var vignette by remember(clip.id, clip.vignette) { mutableFloatStateOf(clip.vignette) }

    var chromaEnabled by remember(clip.id, clip.chromaEnabled) { mutableStateOf(clip.chromaEnabled) }
    var chromaHex by remember(clip.id, clip.chromaColorHex) { mutableStateOf(clip.chromaColorHex) }
    var chromaSimilarity by remember(clip.id, clip.chromaSimilarity) { mutableFloatStateOf(clip.chromaSimilarity) }
    var chromaSmoothness by remember(clip.id, clip.chromaSmoothness) { mutableFloatStateOf(clip.chromaSmoothness) }

    val filteredEffects = remember(allEffects, searchQuery, selectedCategory) {
        val q = searchQuery.trim()
        allEffects.filter { item ->
            val catOk = selectedCategory == "All" || item.category == selectedCategory
            val qOk = q.isEmpty() ||
                item.name.contains(q, ignoreCase = true) ||
                item.category.contains(q, ignoreCase = true)
            catOk && qOk
        }
    }

    val infiniteTransition = rememberInfiniteTransition(label = "fxLoop")
    val animPhase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1800, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "fxPhase"
    )

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF070A10),
        contentColor = Color.White
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.88f)
                .navigationBarsPadding()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "GPU Studio · ${clip.displayName}",
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = "${allEffects.size} OpenGL Shaders · Color Grade · YCbCr Chroma Key",
                        color = TG7Colors.NeonCyan,
                        fontSize = 11.sp
                    )
                }
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                ) {
                    Icon(Icons.Rounded.Close, contentDescription = "Close", tint = TG7Colors.TextMuted)
                }
            }

            // 3 Studio Mode Tabs
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                StudioSheetTabButton(
                    icon = Icons.Rounded.AutoAwesome,
                    label = "60 VFX",
                    selected = activeTab == 0,
                    accent = TG7Colors.NeonCyan,
                    modifier = Modifier.weight(1f),
                    onClick = { activeTab = 0 }
                )
                StudioSheetTabButton(
                    icon = Icons.Rounded.Palette,
                    label = "Color",
                    selected = activeTab == 1,
                    accent = Color(0xFFFFB020),
                    modifier = Modifier.weight(1f),
                    onClick = { activeTab = 1 }
                )
                StudioSheetTabButton(
                    icon = Icons.Rounded.FilterCenterFocus,
                    label = "Chroma Key",
                    selected = activeTab == 2,
                    accent = Color(0xFF22C55E),
                    modifier = Modifier.weight(1f),
                    onClick = { activeTab = 2 }
                )
            }

            when (activeTab) {
                0 -> {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        singleLine = true,
                        leadingIcon = {
                            Icon(Icons.Rounded.Search, contentDescription = null, tint = TG7Colors.NeonCyan)
                        },
                        placeholder = {
                            Text("Search 60 effects (Teal, VHS, Bloom, Thermal...)", fontSize = 12.sp, color = TG7Colors.TextMuted)
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = TG7Colors.NeonCyan,
                            unfocusedBorderColor = TG7Colors.BorderSubtle,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        categories.forEach { cat ->
                            val selected = selectedCategory == cat
                            Box(
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 40.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (selected) TG7Colors.NeonCyan else Color(0xFF101521))
                                    .border(
                                        1.dp,
                                        if (selected) TG7Colors.NeonCyan else TG7Colors.BorderSubtle,
                                        RoundedCornerShape(10.dp)
                                    )
                                    .clickable { selectedCategory = cat }
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = cat,
                                    color = if (selected) Color.Black else Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = if (selected) FontWeight.Black else FontWeight.SemiBold
                                )
                            }
                        }
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF0E131E), RoundedCornerShape(12.dp))
                            .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(12.dp))
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "Intensity",
                            color = Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Slider(
                            value = intensity,
                            onValueChange = { next ->
                                intensity = next
                                selectedEffectId?.let { id ->
                                    onApplyEffect(clip.id, id, next)
                                }
                            },
                            valueRange = 0f..1f,
                            modifier = Modifier.weight(1f),
                            colors = SliderDefaults.colors(
                                thumbColor = TG7Colors.NeonCyan,
                                activeTrackColor = TG7Colors.NeonCyan,
                                inactiveTrackColor = TG7Colors.BorderSubtle
                            )
                        )
                        Text(
                            text = "${(intensity * 100).toInt()}%",
                            color = TG7Colors.NeonCyan,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    LazyVerticalGrid(
                        columns = GridCells.Fixed(3),
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(bottom = 8.dp)
                    ) {
                        items(filteredEffects, key = { it.id }) { spec ->
                            val isSelected = spec.id == selectedEffectId
                            EffectGridCard(
                                spec = spec,
                                selected = isSelected,
                                animPhase = animPhase,
                                onClick = {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    selectedEffectId = spec.id
                                    intensity = spec.defaultIntensity
                                    onApplyEffect(clip.id, spec.id, spec.defaultIntensity)
                                }
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                selectedEffectId = null
                                onApplyEffect(clip.id, null, 0.85f)
                            },
                            modifier = Modifier.height(48.dp)
                        ) {
                            Icon(Icons.Rounded.LayersClear, contentDescription = null, tint = TG7Colors.BloodRed, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.size(4.dp))
                            Text("Clear", color = TG7Colors.BloodRed, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = {
                                selectedEffectId?.let { onApplyEffectAll(it, intensity) }
                            },
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                        ) {
                            Icon(Icons.Rounded.DoneAll, contentDescription = null, tint = TG7Colors.NeonCyan, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.size(4.dp))
                            Text("All Clips", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = {
                                selectedEffectId?.let { onApplyEffect(clip.id, it, intensity) }
                                onDismiss()
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = TG7Colors.NeonCyan,
                                contentColor = Color.Black
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                        ) {
                            Icon(Icons.Rounded.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.size(4.dp))
                            Text("Done", fontSize = 12.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }

                1 -> {
                    val currentGrade = ClipColorGrade(
                        brightness = brightness,
                        contrast = contrast,
                        saturation = saturation,
                        temperature = temperature,
                        vignette = vignette
                    )

                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        ColorGradePreviewBanner(grade = currentGrade)

                        GradeSliderRow(
                            label = "Brightness",
                            valueText = String.format(Locale.US, "%+.2f", brightness),
                            value = brightness,
                            range = -0.45f..0.45f,
                            accent = Color(0xFFFACC15),
                            onChange = {
                                brightness = it
                                onUpdateColorGrade(
                                    clip.id,
                                    currentGrade.copy(brightness = it)
                                )
                            }
                        )
                        GradeSliderRow(
                            label = "Contrast",
                            valueText = String.format(Locale.US, "%.2fx", contrast),
                            value = contrast,
                            range = 0.5f..1.85f,
                            accent = TG7Colors.NeonCyan,
                            onChange = {
                                contrast = it
                                onUpdateColorGrade(
                                    clip.id,
                                    currentGrade.copy(contrast = it)
                                )
                            }
                        )
                        GradeSliderRow(
                            label = "Saturation",
                            valueText = "${(saturation * 100).toInt()}%",
                            value = saturation,
                            range = 0f..1.9f,
                            accent = Color(0xFFA855F7),
                            onChange = {
                                saturation = it
                                onUpdateColorGrade(
                                    clip.id,
                                    currentGrade.copy(saturation = it)
                                )
                            }
                        )
                        GradeSliderRow(
                            label = "Temperature",
                            valueText = if (temperature >= 0f) "+${(temperature * 100).toInt()} Warm" else "${(temperature * 100).toInt()} Cool",
                            value = temperature,
                            range = -0.8f..0.8f,
                            accent = Color(0xFFFF7A20),
                            onChange = {
                                temperature = it
                                onUpdateColorGrade(
                                    clip.id,
                                    currentGrade.copy(temperature = it)
                                )
                            }
                        )
                        GradeSliderRow(
                            label = "Vignette",
                            valueText = "${(vignette * 100).toInt()}%",
                            value = vignette,
                            range = 0f..1f,
                            accent = TG7Colors.BloodRed,
                            onChange = {
                                vignette = it
                                onUpdateColorGrade(
                                    clip.id,
                                    currentGrade.copy(vignette = it)
                                )
                            }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                brightness = 0f
                                contrast = 1f
                                saturation = 1f
                                temperature = 0f
                                vignette = 0f
                                onUpdateColorGrade(clip.id, ClipColorGrade())
                            },
                            modifier = Modifier.height(48.dp)
                        ) {
                            Icon(Icons.Rounded.RestartAlt, contentDescription = null, tint = TG7Colors.BloodRed, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.size(4.dp))
                            Text("Reset", color = TG7Colors.BloodRed, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = { onApplyColorGradeAll(currentGrade) },
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                        ) {
                            Icon(Icons.Rounded.DoneAll, contentDescription = null, tint = TG7Colors.NeonCyan, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.size(4.dp))
                            Text("All Clips", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = onDismiss,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = TG7Colors.NeonCyan,
                                contentColor = Color.Black
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                        ) {
                            Icon(Icons.Rounded.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.size(4.dp))
                            Text("Done", fontSize = 12.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }

                else -> {
                    val currentChroma = ChromaKeyConfig(
                        enabled = chromaEnabled,
                        keyColorHex = chromaHex,
                        similarity = chromaSimilarity,
                        smoothness = chromaSmoothness
                    )

                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        ChromaPreviewBanner(config = currentChroma, animPhase = animPhase)

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .defaultMinSize(minHeight = 54.dp)
                                .background(Color(0xFF0E131E), RoundedCornerShape(12.dp))
                                .border(
                                    1.dp,
                                    if (chromaEnabled) Color(0xFF22C55E) else TG7Colors.BorderSubtle,
                                    RoundedCornerShape(12.dp)
                                )
                                .clickable {
                                    val next = !chromaEnabled
                                    chromaEnabled = next
                                    onUpdateChromaKey(clip.id, currentChroma.copy(enabled = next))
                                }
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Enable YCbCr Chroma Key",
                                    color = Color.White,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Removes green/blue screen backdrop with edge spill suppression",
                                    color = TG7Colors.TextMuted,
                                    fontSize = 10.sp
                                )
                            }
                            Switch(
                                checked = chromaEnabled,
                                onCheckedChange = { next ->
                                    chromaEnabled = next
                                    onUpdateChromaKey(clip.id, currentChroma.copy(enabled = next))
                                },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.Black,
                                    checkedTrackColor = Color(0xFF22C55E)
                                )
                            )
                        }

                        Text(
                            text = "KEY SCREEN COLOR",
                            color = TG7Colors.TextMuted,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            CHROMA_PRESETS.forEach { preset ->
                                val selected = chromaHex == preset.colorHex
                                Column(
                                    modifier = Modifier
                                        .defaultMinSize(minWidth = 76.dp, minHeight = 56.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(if (selected) Color(0xFF13221A) else Color(0xFF0E131E))
                                        .border(
                                            1.5.dp,
                                            if (selected) Color(0xFF22C55E) else TG7Colors.BorderSubtle,
                                            RoundedCornerShape(12.dp)
                                        )
                                        .clickable {
                                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                            chromaHex = preset.colorHex
                                            chromaEnabled = true
                                            onUpdateChromaKey(
                                                clip.id,
                                                currentChroma.copy(enabled = true, keyColorHex = preset.colorHex)
                                            )
                                        }
                                        .padding(horizontal = 10.dp, vertical = 8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(5.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(22.dp)
                                            .clip(CircleShape)
                                            .background(Color(preset.colorHex))
                                            .border(1.5.dp, Color.White, CircleShape)
                                    )
                                    Text(
                                        text = preset.label,
                                        color = Color.White,
                                        fontSize = 10.sp,
                                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                                    )
                                }
                            }
                        }

                        GradeSliderRow(
                            label = "Color Similarity",
                            valueText = "${(chromaSimilarity * 100).toInt()}%",
                            value = chromaSimilarity,
                            range = 0.06f..0.75f,
                            accent = Color(0xFF22C55E),
                            onChange = {
                                chromaSimilarity = it
                                chromaEnabled = true
                                onUpdateChromaKey(
                                    clip.id,
                                    currentChroma.copy(enabled = true, similarity = it)
                                )
                            }
                        )

                        GradeSliderRow(
                            label = "Edge Smoothness & Spill Cut",
                            valueText = "${(chromaSmoothness * 100).toInt()}%",
                            value = chromaSmoothness,
                            range = 0.02f..0.40f,
                            accent = TG7Colors.NeonCyan,
                            onChange = {
                                chromaSmoothness = it
                                chromaEnabled = true
                                onUpdateChromaKey(
                                    clip.id,
                                    currentChroma.copy(enabled = true, smoothness = it)
                                )
                            }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                chromaEnabled = false
                                chromaHex = 0xFF00C853L
                                chromaSimilarity = 0.35f
                                chromaSmoothness = 0.12f
                                onUpdateChromaKey(clip.id, ChromaKeyConfig())
                            },
                            modifier = Modifier.height(48.dp)
                        ) {
                            Icon(Icons.Rounded.RestartAlt, contentDescription = null, tint = TG7Colors.BloodRed, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.size(4.dp))
                            Text("Disable", color = TG7Colors.BloodRed, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = {
                                selectedEffectId = null
                                brightness = 0f
                                contrast = 1f
                                saturation = 1f
                                temperature = 0f
                                vignette = 0f
                                chromaEnabled = false
                                onResetClipVisuals(clip.id)
                            },
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                        ) {
                            Icon(Icons.Rounded.LayersClear, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.size(4.dp))
                            Text("Reset All", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = onDismiss,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = TG7Colors.NeonCyan,
                                contentColor = Color.Black
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                        ) {
                            Icon(Icons.Rounded.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.size(4.dp))
                            Text("Done", fontSize = 12.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StudioSheetTabButton(
    icon: ImageVector,
    label: String,
    selected: Boolean,
    accent: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Row(
        modifier = modifier
            .defaultMinSize(minHeight = 48.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) accent.copy(alpha = 0.18f) else Color(0xFF0E131E))
            .border(
                1.5.dp,
                if (selected) accent else TG7Colors.BorderSubtle,
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = if (selected) accent else TG7Colors.TextMuted, modifier = Modifier.size(17.dp))
        Spacer(modifier = Modifier.size(5.dp))
        Text(
            text = label,
            color = if (selected) Color.White else TG7Colors.TextMuted,
            fontSize = 11.sp,
            fontWeight = if (selected) FontWeight.Black else FontWeight.SemiBold,
            maxLines = 1
        )
    }
}

@Composable
private fun GradeSliderRow(
    label: String,
    valueText: String,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    accent: Color,
    onChange: (Float) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF0E131E), RoundedCornerShape(12.dp))
            .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(text = label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Text(
                text = valueText,
                color = accent,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
        }
        Slider(
            value = value.coerceIn(range.start, range.endInclusive),
            onValueChange = onChange,
            valueRange = range,
            colors = SliderDefaults.colors(
                thumbColor = accent,
                activeTrackColor = accent,
                inactiveTrackColor = TG7Colors.BorderSubtle
            )
        )
    }
}

@Composable
private fun ColorGradePreviewBanner(grade: ClipColorGrade) {
    val c1 = remember(grade) {
        val r = (0.10f + grade.brightness + grade.temperature * 0.2f).coerceIn(0f, 1f)
        val b = (0.85f + grade.brightness - grade.temperature * 0.2f).coerceIn(0f, 1f)
        val g = (0.65f + grade.brightness).coerceIn(0f, 1f)
        Color(r, g, b)
    }
    val c2 = remember(grade) {
        val r = (0.95f + grade.brightness + grade.temperature * 0.2f).coerceIn(0f, 1f)
        val g = (0.22f + grade.brightness).coerceIn(0f, 1f)
        val b = (0.38f + grade.brightness - grade.temperature * 0.2f).coerceIn(0f, 1f)
        Color(r, g, b)
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(68.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Brush.horizontalGradient(listOf(c1, Color(0xFF181C26), c2)))
            .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(12.dp)),
        contentAlignment = Alignment.Center
    ) {
        if (grade.vignette > 0.02f) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.radialGradient(
                            colors = listOf(Color.Transparent, Color.Black.copy(alpha = grade.vignette.coerceIn(0f, 0.9f)))
                        )
                    )
            )
        }
        Text(
            text = "LIVE LUT & COLOR MATRIX",
            color = Color.White,
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.5.sp
        )
    }
}

@Composable
private fun ChromaPreviewBanner(config: ChromaKeyConfig, animPhase: Float) {
    val keyCol = Color(config.keyColorHex)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(74.dp)
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, if (config.enabled) Color(0xFF22C55E) else TG7Colors.BorderSubtle, RoundedCornerShape(12.dp))
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val cols = 12
            val rows = 4
            val cw = size.width / cols
            val ch = size.height / rows
            for (r in 0 until rows) {
                for (c in 0 until cols) {
                    val odd = (r + c) % 2 == 0
                    val bg = if (config.enabled) {
                        if (odd) Color(0xFF0A101B) else Color(0xFF111C2D)
                    } else {
                        if (odd) keyCol else keyCol.copy(alpha = 0.85f)
                    }
                    drawRect(
                        color = bg,
                        topLeft = Offset(c * cw, r * ch),
                        size = Size(cw + 1f, ch + 1f)
                    )
                }
            }
            val cx = size.width * (0.28f + 0.44f * (0.5f + 0.5f * sin(animPhase * 2f * PI.toFloat())))
            drawCircle(
                color = TG7Colors.NeonCyan,
                radius = size.height * 0.28f,
                center = Offset(cx, size.height / 2f)
            )
            drawCircle(
                color = Color.White,
                radius = size.height * 0.28f,
                center = Offset(cx, size.height / 2f),
                style = Stroke(width = 3f)
            )
        }
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(8.dp)
                .background(Color.Black.copy(alpha = 0.7f), RoundedCornerShape(6.dp))
                .padding(horizontal = 8.dp, vertical = 3.dp)
        ) {
            Text(
                text = if (config.enabled) "CHROMA KEY ACTIVE" else "KEY BYPASSED",
                color = if (config.enabled) Color(0xFF22C55E) else TG7Colors.TextMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.Black
            )
        }
    }
}

@Composable
private fun EffectGridCard(
    spec: VideoEffectSpec,
    selected: Boolean,
    animPhase: Float,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .defaultMinSize(minHeight = 96.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) Color(0xFF0C2029) else Color(0xFF0D1119))
            .border(
                width = if (selected) 2.dp else 1.dp,
                color = if (selected) TG7Colors.NeonCyan else TG7Colors.BorderSubtle,
                shape = RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(6.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 10f)
                .clip(RoundedCornerShape(8.dp))
                .background(Color.Black)
        ) {
            EffectAnimatedGlyph(
                spec = spec,
                phase = animPhase,
                modifier = Modifier.fillMaxSize()
            )
        }
        Text(
            text = spec.name,
            color = if (selected) TG7Colors.NeonCyan else Color.White,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            text = spec.category,
            color = TG7Colors.TextMuted,
            fontSize = 8.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun EffectAnimatedGlyph(
    spec: VideoEffectSpec,
    phase: Float,
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val s = 0.5f + 0.5f * sin(phase * 2f * PI.toFloat())

        when (spec.shaderFamily) {
            EffectShaderFamily.LUT_TONE -> {
                val c1 = when (spec.mode) {
                    0 -> if (spec.paramA > 0f) Color(0xFF0099AA) else Color(0xFF38BDF8)
                    1 -> Color((spec.paramA * 0.9f).coerceIn(0f, 1f), (spec.paramB * 0.9f).coerceIn(0f, 1f), (spec.paramC * 0.9f).coerceIn(0f, 1f))
                    2 -> Color(0xFF1F2937)
                    3 -> Color(0xFF0F172A)
                    5 -> Color(0xFF78552B)
                    else -> Color(0xFF0D9488)
                }
                val c2 = when (spec.mode) {
                    0 -> if (spec.paramA > 0f) Color(0xFFFF7A20) else Color(0xFF0EA5E9)
                    1 -> TG7Colors.BloodRed
                    2 -> Color(0xFF9CA3AF)
                    3 -> Color(0xFF475569)
                    5 -> Color(0xFFD6B588)
                    else -> Color(0xFFF59E0B)
                }
                drawRect(Brush.linearGradient(listOf(c1, c2)))
                drawCircle(color = Color.White.copy(alpha = 0.35f), radius = h * 0.26f, center = Offset(w * 0.35f + s * w * 0.3f, h * 0.5f))
            }
            EffectShaderFamily.GLOW_BLOOM -> {
                drawRect(Color(0xFF0B1120))
                val glowCol = if (spec.mode == 4 || spec.mode == 3) Color(0xFFFF8833) else TG7Colors.NeonCyan
                drawCircle(
                    brush = Brush.radialGradient(listOf(glowCol.copy(alpha = 0.95f), Color.Transparent)),
                    radius = h * (0.4f + 0.25f * s),
                    center = Offset(w * 0.5f, h * 0.5f)
                )
            }
            EffectShaderFamily.GLITCH_CYBER -> {
                drawRect(Color(0xFF090D16))
                val shift = (s - 0.5f) * w * 0.14f
                drawRect(TG7Colors.NeonCyan.copy(alpha = 0.7f), topLeft = Offset(w * 0.25f + shift, h * 0.22f), size = Size(w * 0.5f, h * 0.2f))
                drawRect(TG7Colors.BloodRed.copy(alpha = 0.7f), topLeft = Offset(w * 0.25f - shift, h * 0.52f), size = Size(w * 0.5f, h * 0.2f))
                for (i in 1..4) {
                    val y = h * (i / 5f)
                    drawLine(Color.White.copy(alpha = 0.25f), Offset(0f, y), Offset(w, y), strokeWidth = 1.5f)
                }
            }
            EffectShaderFamily.LENS_OPTICAL -> {
                drawRect(Color(0xFF0C1424))
                rotate(phase * 180f) {
                    drawRect(
                        color = TG7Colors.NeonCyan,
                        topLeft = Offset(w * 0.3f, h * 0.22f),
                        size = Size(w * 0.4f, h * 0.56f),
                        style = Stroke(width = 3f)
                    )
                }
                drawCircle(TG7Colors.BloodRed, radius = h * 0.14f, center = Offset(w * 0.5f, h * 0.5f))
            }
            EffectShaderFamily.MOTION_PULSE -> {
                drawRect(Color(0xFF10131F))
                scale(0.8f + 0.35f * s) {
                    drawCircle(
                        brush = Brush.linearGradient(listOf(TG7Colors.NeonCyan, TG7Colors.BloodRed)),
                        radius = h * 0.34f,
                        center = Offset(w * 0.5f, h * 0.5f)
                    )
                }
            }
            EffectShaderFamily.ARTISTIC_RETRO -> {
                val cols = 6
                val cw = w / cols
                for (c in 0 until cols) {
                    val col = when (spec.mode) {
                        3 -> if (c % 2 == 0) Color(0xFFFF2030) else Color(0xFFFACC15)
                        4 -> if ((c + (s * 3).toInt()) % 2 == 0) Color(0xFF16A34A) else Color(0xFF052E16)
                        else -> if ((c % 2 == 0)) TG7Colors.NeonCyan else Color(0xFF1E293B)
                    }
                    drawRect(col, topLeft = Offset(c * cw, 0f), size = Size(cw, h))
                }
            }
            EffectShaderFamily.DUOTONE_EDGE, EffectShaderFamily.NONE -> {
                drawRect(Color.Black)
                val strokeCol = if (spec.paramA > 0.5f) TG7Colors.BloodRed else TG7Colors.NeonCyan
                drawCircle(
                    color = strokeCol,
                    radius = h * 0.32f,
                    center = Offset(w * 0.5f, h * 0.5f),
                    style = Stroke(width = 3.5f)
                )
            }
        }
    }
}
