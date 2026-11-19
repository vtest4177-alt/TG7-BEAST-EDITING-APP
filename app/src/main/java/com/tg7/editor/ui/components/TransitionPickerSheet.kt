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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoFixHigh
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DoneAll
import androidx.compose.material.icons.rounded.LayersClear
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
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
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
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tg7.editor.data.TransitionManifestLoader
import com.tg7.editor.model.TransitionShaderFamily
import com.tg7.editor.model.TransitionSpec
import com.tg7.editor.ui.theme.TG7Colors
import java.util.Locale
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransitionPickerSheet(
    cutIndex: Int,
    totalCuts: Int,
    currentTransitionId: String?,
    currentDurationMs: Long,
    onApplyTransition: (cutIndex: Int, transitionId: String, durationMs: Long) -> Unit,
    onApplyAllCuts: (transitionId: String, durationMs: Long) -> Unit,
    onRemoveTransition: (cutIndex: Int) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val haptic = LocalHapticFeedback.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val allTransitions = remember { TransitionManifestLoader.getAll(context) }
    val categories = remember { listOf("All") + TransitionManifestLoader.getCategories(context) }

    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("All") }
    var selectedId by remember(cutIndex, currentTransitionId) {
        mutableStateOf(currentTransitionId ?: allTransitions.firstOrNull()?.id ?: "tr_001_fade")
    }
    var durationMs by remember(cutIndex, currentDurationMs) {
        mutableLongStateOf(currentDurationMs.coerceIn(200L, 2500L))
    }

    val filtered = remember(allTransitions, searchQuery, selectedCategory) {
        allTransitions.filter { item ->
            val catOk = selectedCategory == "All" || item.category == selectedCategory
            val q = searchQuery.trim()
            val queryOk = q.isEmpty() ||
                item.name.contains(q, ignoreCase = true) ||
                item.category.contains(q, ignoreCase = true)
            catOk && queryOk
        }
    }

    val activeSpec = remember(selectedId, allTransitions) {
        allTransitions.firstOrNull { it.id == selectedId }
    }

    val infiniteTransition = rememberInfiniteTransition(label = "trPreviewLoop")
    val animProgress by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1500, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "trProgress"
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
                .fillMaxHeight(0.86f)
                .navigationBarsPadding()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "${allTransitions.size} Transitions · Cut #${cutIndex + 1}/$totalCuts",
                        color = Color.White,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = activeSpec?.let { "${it.name} · ${it.category}" } ?: "Select a GPU shader transition",
                        color = TG7Colors.NeonCyan,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Rounded.Close, contentDescription = "Close", tint = Color.White)
                }
            }

            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search 225 transitions (Whip, Glitch, Cube, Iris...)", fontSize = 12.sp) },
                leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null, tint = TG7Colors.NeonCyan) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }, modifier = Modifier.size(48.dp)) {
                            Icon(Icons.Rounded.Close, contentDescription = "Clear search", tint = TG7Colors.TextMuted)
                        }
                    }
                },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = TG7Colors.NeonCyan,
                    unfocusedBorderColor = TG7Colors.BorderSubtle,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedContainerColor = Color(0xFF0D111B),
                    unfocusedContainerColor = Color(0xFF0D111B)
                )
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                categories.forEach { cat ->
                    val active = cat == selectedCategory
                    val displayLabel = if (cat == "All") "All (${allTransitions.size})" else cat
                    Box(
                        modifier = Modifier
                            .heightIn(min = 42.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (active) TG7Colors.NeonCyan else Color(0xFF0F1420))
                            .border(
                                width = 1.dp,
                                color = if (active) TG7Colors.NeonCyan else TG7Colors.BorderSubtle,
                                shape = RoundedCornerShape(10.dp)
                            )
                            .clickable {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                selectedCategory = cat
                            }
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = displayLabel,
                            color = if (active) Color.Black else Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF0C101A), RoundedCornerShape(12.dp))
                    .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(12.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Transition Duration", color = TG7Colors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    Text(
                        text = String.format(Locale.US, "%.2fs", durationMs / 1000f),
                        color = TG7Colors.NeonCyan,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }
                Slider(
                    value = durationMs.toFloat(),
                    onValueChange = { durationMs = ((it / 50f).toInt() * 50L).coerceIn(200L, 2500L) },
                    valueRange = 200f..2500f,
                    colors = SliderDefaults.colors(
                        thumbColor = TG7Colors.NeonCyan,
                        activeTrackColor = TG7Colors.NeonCyan,
                        inactiveTrackColor = TG7Colors.BorderSubtle
                    )
                )
            }

            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentPadding = PaddingValues(bottom = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filtered, key = { it.id }) { spec ->
                    val isSelected = spec.id == selectedId
                    Column(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (isSelected) Color(0xFF0D202A) else Color(0xFF0C1019))
                            .border(
                                width = if (isSelected) 2.dp else 1.dp,
                                color = if (isSelected) TG7Colors.NeonCyan else TG7Colors.BorderSubtle,
                                shape = RoundedCornerShape(12.dp)
                            )
                            .clickable {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                selectedId = spec.id
                                durationMs = spec.defaultDurationMs.coerceIn(200L, 2500L)
                                onApplyTransition(cutIndex, spec.id, durationMs)
                            }
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
                            LiveTransitionPreviewCanvas(
                                spec = spec,
                                progress = animProgress,
                                modifier = Modifier.fillMaxSize()
                            )
                            if (isSelected) {
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .padding(4.dp)
                                        .size(18.dp)
                                        .clip(RoundedCornerShape(5.dp))
                                        .background(TG7Colors.NeonCyan),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Check,
                                        contentDescription = null,
                                        tint = Color.Black,
                                        modifier = Modifier.size(13.dp)
                                    )
                                }
                            }
                        }
                        Text(
                            text = spec.name,
                            color = if (isSelected) TG7Colors.NeonCyan else Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = {
                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onRemoveTransition(cutIndex)
                    },
                    modifier = Modifier.heightIn(min = 48.dp),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = TG7Colors.BloodRed)
                ) {
                    Icon(Icons.Rounded.LayersClear, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.size(4.dp))
                    Text("None", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }

                if (totalCuts > 1) {
                    OutlinedButton(
                        onClick = {
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            onApplyAllCuts(selectedId, durationMs)
                        },
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 48.dp),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = TG7Colors.NeonCyan)
                    ) {
                        Icon(Icons.Rounded.DoneAll, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.size(4.dp))
                        Text("All Cuts", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Button(
                    onClick = {
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        onApplyTransition(cutIndex, selectedId, durationMs)
                        onDismiss()
                    },
                    modifier = Modifier
                        .weight(1.2f)
                        .heightIn(min = 48.dp),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = TG7Colors.NeonCyan,
                        contentColor = Color.Black
                    )
                ) {
                    Icon(Icons.Rounded.AutoFixHigh, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.size(4.dp))
                    Text("Apply Cut", fontSize = 12.sp, fontWeight = FontWeight.Black)
                }
            }
        }
    }
}

@Composable
private fun LiveTransitionPreviewCanvas(
    spec: TransitionSpec,
    progress: Float,
    modifier: Modifier = Modifier
) {
    val p = progress.coerceIn(0f, 1f)
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val brushA = Brush.linearGradient(listOf(Color(0xFF00485A), Color(0xFF00C2D1)))
        val brushB = Brush.linearGradient(listOf(Color(0xFF420816), Color(0xFFFF1030)))

        clipRect {
            when (spec.shaderFamily) {
                TransitionShaderFamily.FADE -> {
                    drawRect(brush = brushA)
                    if (spec.mode == 1) {
                        drawRect(color = Color.Black.copy(alpha = sin(p * PI).toFloat()))
                        drawRect(brush = brushB, alpha = if (p > 0.5f) (p - 0.5f) * 2f else 0f)
                    } else if (spec.mode == 2) {
                        drawRect(brush = brushB, alpha = p)
                        drawRect(color = Color.White.copy(alpha = sin(p * PI).toFloat() * 0.85f))
                    } else {
                        drawRect(brush = brushB, alpha = p)
                    }
                }
                TransitionShaderFamily.WIPE -> {
                    drawRect(brush = brushA)
                    val dirX = spec.paramA
                    val dirY = spec.paramB
                    val right = if (dirX < 0f) w else w * p
                    val left = if (dirX < 0f) w * (1f - p) else 0f
                    val bottom = if (dirY < 0f) h else if (dirY > 0f) h * p else h
                    val top = if (dirY < 0f) h * (1f - p) else 0f
                    clipRect(left = left, top = top, right = right, bottom = bottom) {
                        drawRect(brush = brushB)
                    }
                }
                TransitionShaderFamily.SLIDE -> {
                    val dx = if (spec.paramA == 0f && spec.paramB == 0f) -1f else spec.paramA
                    val dy = spec.paramB
                    drawRect(
                        brush = brushA,
                        topLeft = Offset(dx * w * p * 0.6f, dy * h * p * 0.6f)
                    )
                    drawRect(
                        brush = brushB,
                        topLeft = Offset(-dx * w * (1f - p), -dy * h * (1f - p))
                    )
                }
                TransitionShaderFamily.ZOOM -> {
                    val scaleVal = if (spec.mode == 1) 1.5f - p * 0.5f else 1f + p * 0.6f
                    drawRect(brush = brushA)
                    scale(scale = scaleVal.coerceAtLeast(0.4f)) {
                        drawRect(brush = brushB, alpha = p)
                    }
                }
                TransitionShaderFamily.GLITCH -> {
                    drawRect(brush = if (p < 0.5f) brushA else brushB)
                    val env = sin(p * PI).toFloat()
                    for (band in 0..4) {
                        val y = h * (band / 5f)
                        val shift = ((band % 2) * 2 - 1) * w * 0.14f * env
                        drawRect(
                            color = if (band % 2 == 0) TG7Colors.NeonCyan.copy(alpha = 0.5f * env)
                            else TG7Colors.BloodRed.copy(alpha = 0.5f * env),
                            topLeft = Offset(shift, y),
                            size = Size(w * 0.6f, h * 0.12f)
                        )
                    }
                }
                TransitionShaderFamily.CUBE_3D -> {
                    drawRect(brush = brushA)
                    val foldW = w * p
                    drawRect(
                        brush = brushB,
                        topLeft = Offset(if (spec.paramA >= 0f) 0f else w - foldW, 0f),
                        size = Size(foldW, h)
                    )
                    drawLine(
                        color = Color.White.copy(alpha = 0.5f),
                        start = Offset(if (spec.paramA >= 0f) foldW else w - foldW, 0f),
                        end = Offset(if (spec.paramA >= 0f) foldW else w - foldW, h),
                        strokeWidth = 2f
                    )
                }
                TransitionShaderFamily.SWIRL_RIPPLE -> {
                    drawRect(brush = brushA)
                    drawRect(brush = brushB, alpha = p)
                    val radius = (w * 0.65f) * p
                    drawCircle(
                        color = TG7Colors.NeonCyan.copy(alpha = 0.5f * (1f - p)),
                        radius = radius,
                        style = androidx.compose.ui.graphics.drawscope.Stroke(width = 3f)
                    )
                }
                TransitionShaderFamily.RADIAL_PINWHEEL -> {
                    drawRect(brush = brushA)
                    val r = maxOf(w, h) * 0.75f * p
                    drawCircle(brush = brushB, radius = r)
                    rotate(degrees = p * 180f) {
                        drawLine(
                            color = Color.White.copy(alpha = 0.35f),
                            start = Offset(w / 2f, 0f),
                            end = Offset(w / 2f, h),
                            strokeWidth = 2f
                        )
                    }
                }
                TransitionShaderFamily.LIGHT_FLASH -> {
                    drawRect(brush = if (p < 0.5f) brushA else brushB)
                    val flashAlpha = sin(p * PI).toFloat()
                    val flashColor = if (spec.mode == 1 && spec.paramA < 0.5f) TG7Colors.NeonCyan else Color.White
                    drawRect(color = flashColor.copy(alpha = flashAlpha * 0.9f))
                }
                TransitionShaderFamily.MOSAIC_GRID -> {
                    drawRect(brush = brushA)
                    val cols = 4
                    val rows = 3
                    val cw = w / cols
                    val ch = h / rows
                    for (r in 0 until rows) {
                        for (c in 0 until cols) {
                            val thresh = ((r * cols + c).toFloat()) / (cols * rows)
                            if (p > thresh) {
                                drawRect(
                                    brush = brushB,
                                    topLeft = Offset(c * cw, r * ch),
                                    size = Size(cw + 1f, ch + 1f)
                                )
                            }
                        }
                    }
                }
                TransitionShaderFamily.BLUR_WHIP -> {
                    val offset = sin(p * PI).toFloat() * w * 0.25f
                    drawRect(brush = brushA, topLeft = Offset(-offset, 0f))
                    drawRect(brush = brushB, topLeft = Offset(w * (1f - p), 0f), alpha = p)
                }
                TransitionShaderFamily.KALEIDO_SHAPE -> {
                    drawRect(brush = brushA)
                    rotate(degrees = p * 90f) {
                        val s = abs(cos(p * PI)).toFloat() * 0.4f + 0.6f
                        scale(scale = s) {
                            drawRect(brush = brushB, alpha = p)
                        }
                    }
                }
            }
        }
    }
}
