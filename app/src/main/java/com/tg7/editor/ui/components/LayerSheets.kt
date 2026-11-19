package com.tg7.editor.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Style
import androidx.compose.material.icons.rounded.TextFields
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.airbnb.lottie.compose.LottieAnimation
import com.airbnb.lottie.compose.LottieCompositionSpec
import com.airbnb.lottie.compose.LottieConstants
import com.airbnb.lottie.compose.animateLottieCompositionAsState
import com.airbnb.lottie.compose.rememberLottieComposition
import com.tg7.editor.data.TextAndStickerLoader
import com.tg7.editor.engine.anim.OverlayAnimator
import com.tg7.editor.model.LottieStickerSpec
import com.tg7.editor.model.StickerPreset
import com.tg7.editor.model.TextFontFamily
import com.tg7.editor.model.TextLayer
import com.tg7.editor.ui.theme.TG7Colors

fun resolveComposeFontFamily(family: TextFontFamily): FontFamily {
    return when (family) {
        TextFontFamily.SERIF -> FontFamily.Serif
        TextFontFamily.MONO -> FontFamily.Monospace
        else -> FontFamily.SansSerif
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddTextSheet(
    editingLayer: TextLayer? = null,
    onConfirmText: (
        editingLayerId: String?,
        text: String,
        colorHex: Long,
        sizeSp: Float,
        templateId: String,
        animationId: String,
        fontFamily: TextFontFamily,
        bgColorHex: Long,
        hasOutline: Boolean,
        letterSpacingEm: Float
    ) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val haptic = LocalHapticFeedback.current

    val templates = remember { TextAndStickerLoader.getTemplates(context) }
    val animations = remember { TextAndStickerLoader.getAnimations(context) }
    val animCategories = remember { listOf("All") + TextAndStickerLoader.getAnimationCategories(context) }

    var activeTab by remember { mutableIntStateOf(0) }
    var textValue by remember(editingLayer) { mutableStateOf(editingLayer?.text ?: "TG7 Studio") }
    var selectedColor by remember(editingLayer) { mutableLongStateOf(editingLayer?.colorHex ?: 0xFFFFFFFFL) }
    var fontSizeSp by remember(editingLayer) { mutableFloatStateOf(editingLayer?.fontSizeSp ?: 28f) }
    var selectedTemplateId by remember(editingLayer) { mutableStateOf(editingLayer?.templateId ?: "tpl_tg7_display") }
    var selectedAnimId by remember(editingLayer) { mutableStateOf(editingLayer?.animationId ?: "ta_pop_bounce") }
    var selectedFont by remember(editingLayer) { mutableStateOf(editingLayer?.fontFamily ?: TextFontFamily.DISPLAY) }
    var selectedBgColor by remember(editingLayer) { mutableLongStateOf(editingLayer?.bgColorHex ?: 0L) }
    var hasOutline by remember(editingLayer) { mutableStateOf(editingLayer?.hasOutline ?: true) }
    var letterSpacingEm by remember(editingLayer) { mutableFloatStateOf(editingLayer?.letterSpacingEm ?: 0.04f) }

    var animSearch by remember { mutableStateOf("") }
    var animCat by remember { mutableStateOf("All") }

    val colorPalette = listOf(0xFFFFFFFFL, 0xFF00F0FFL, 0xFFFF1030L, 0xFFFACC15L, 0xFF22C55EL, 0xFFC084FCL)
    val bgPalette = listOf(
        0x00000000L to "None",
        0xCC0A0D14L to "Dark",
        0xFF00F0FFL to "Cyan",
        0xE6FF1030L to "Blood"
    )

    val filteredAnims = remember(animations, animSearch, animCat) {
        animations.filter { a ->
            val catOk = animCat == "All" || a.category == animCat
            val q = animSearch.trim()
            val qOk = q.isEmpty() || a.name.contains(q, ignoreCase = true) || a.category.contains(q, ignoreCase = true)
            catOk && qOk
        }
    }

    val infiniteAnim = rememberInfiniteTransition(label = "textAnimLoop")
    val previewTimeMs by infiniteAnim.animateFloat(
        initialValue = 0f,
        targetValue = 2200f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "textTime"
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
                Column {
                    Text(
                        text = if (editingLayer != null) "Edit Pro Text" else "Pro Text & 60 Animations",
                        color = Color.White,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Black
                    )
                    val curAnimName = animations.firstOrNull { it.id == selectedAnimId }?.name ?: "Static"
                    Text(
                        text = "${selectedFont.label} · $curAnimName",
                        color = TG7Colors.NeonCyan,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Rounded.Close, contentDescription = "Close", tint = Color.White)
                }
            }

            OutlinedTextField(
                value = textValue,
                onValueChange = { textValue = it },
                label = { Text("Title / Caption Text") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = TG7Colors.NeonCyan,
                    unfocusedBorderColor = TG7Colors.BorderSubtle,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
                )
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                val tabs = listOf(
                    0 to Pair(Icons.Rounded.Style, "Styles & Fonts (${templates.size})"),
                    1 to Pair(Icons.Rounded.AutoAwesome, "Animations (${animations.size})")
                )
                tabs.forEach { (idx, pair) ->
                    val active = activeTab == idx
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (active) TG7Colors.NeonCyan else Color(0xFF0E131E))
                            .border(1.dp, if (active) TG7Colors.NeonCyan else TG7Colors.BorderSubtle, RoundedCornerShape(12.dp))
                            .clickable {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                activeTab = idx
                            }
                            .padding(horizontal = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = pair.first,
                            contentDescription = null,
                            tint = if (active) Color.Black else TG7Colors.NeonCyan,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.size(5.dp))
                        Text(
                            text = pair.second,
                            color = if (active) Color.Black else Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }

            if (activeTab == 0) {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Templates (18 Presets)", color = TG7Colors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        templates.forEach { tpl ->
                            val active = tpl.id == selectedTemplateId
                            Box(
                                modifier = Modifier
                                    .heightIn(min = 52.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (tpl.bgColorHex != 0L) Color(tpl.bgColorHex) else Color(0xFF0E121C))
                                    .border(
                                        width = if (active) 2.dp else 1.dp,
                                        color = if (active) TG7Colors.NeonCyan else TG7Colors.BorderSubtle,
                                        shape = RoundedCornerShape(12.dp)
                                    )
                                    .clickable {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        selectedTemplateId = tpl.id
                                        selectedFont = tpl.fontFamily
                                        selectedColor = tpl.colorHex
                                        selectedBgColor = tpl.bgColorHex
                                        hasOutline = tpl.hasOutline
                                        letterSpacingEm = tpl.letterSpacingEm
                                    }
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = tpl.name,
                                    color = Color(tpl.colorHex),
                                    fontFamily = resolveComposeFontFamily(tpl.fontFamily),
                                    fontWeight = FontWeight.Black,
                                    fontSize = 12.sp,
                                    letterSpacing = tpl.letterSpacingEm.em
                                )
                            }
                        }
                    }

                    Text("Font Family", color = TG7Colors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        TextFontFamily.entries.forEach { ff ->
                            val active = ff == selectedFont
                            Box(
                                modifier = Modifier
                                    .heightIn(min = 48.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (active) TG7Colors.NeonCyan else Color(0xFF0E121C))
                                    .border(1.dp, if (active) TG7Colors.NeonCyan else TG7Colors.BorderSubtle, RoundedCornerShape(10.dp))
                                    .clickable {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        selectedFont = ff
                                    }
                                    .padding(horizontal = 12.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = ff.label,
                                    color = if (active) Color.Black else Color.White,
                                    fontFamily = resolveComposeFontFamily(ff),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Text:", color = TG7Colors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        colorPalette.forEach { hex ->
                            val active = hex == selectedColor
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                                    .background(Color(hex))
                                    .border(if (active) 3.dp else 1.dp, if (active) TG7Colors.NeonCyan else TG7Colors.BorderSubtle, CircleShape)
                                    .clickable {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        selectedColor = hex
                                    }
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Box:", color = TG7Colors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        bgPalette.forEach { (hex, label) ->
                            val active = hex == selectedBgColor
                            Box(
                                modifier = Modifier
                                    .heightIn(min = 42.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (hex == 0L) Color(0xFF0D111A) else Color(hex))
                                    .border(if (active) 2.dp else 1.dp, if (active) TG7Colors.NeonCyan else TG7Colors.BorderSubtle, RoundedCornerShape(10.dp))
                                    .clickable {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        selectedBgColor = hex
                                    }
                                    .padding(horizontal = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = label,
                                    color = if (hex == 0xFF00F0FFL) Color.Black else Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        Box(
                            modifier = Modifier
                                .heightIn(min = 42.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (hasOutline) Color(0xFF10242C) else Color(0xFF0D111A))
                                .border(1.dp, if (hasOutline) TG7Colors.NeonCyan else TG7Colors.BorderSubtle, RoundedCornerShape(10.dp))
                                .clickable {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    hasOutline = !hasOutline
                                }
                                .padding(horizontal = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (hasOutline) "Outline On" else "Outline Off",
                                color = if (hasOutline) TG7Colors.NeonCyan else TG7Colors.TextMuted,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Column {
                        Text("Text Size · ${fontSizeSp.toInt()}sp", color = TG7Colors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Slider(
                            value = fontSizeSp,
                            onValueChange = { fontSizeSp = it },
                            valueRange = 16f..52f,
                            colors = SliderDefaults.colors(
                                thumbColor = TG7Colors.NeonCyan,
                                activeTrackColor = TG7Colors.NeonCyan
                            )
                        )
                    }
                }
            } else {
                OutlinedTextField(
                    value = animSearch,
                    onValueChange = { animSearch = it },
                    placeholder = { Text("Search 60 animations (Typewriter, Glitch, Pop...)", fontSize = 12.sp) },
                    leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null, tint = TG7Colors.NeonCyan) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = TG7Colors.NeonCyan,
                        unfocusedBorderColor = TG7Colors.BorderSubtle,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    animCategories.forEach { cat ->
                        val active = cat == animCat
                        Box(
                            modifier = Modifier
                                .heightIn(min = 42.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (active) TG7Colors.NeonCyan else Color(0xFF0E131E))
                                .border(1.dp, if (active) TG7Colors.NeonCyan else TG7Colors.BorderSubtle, RoundedCornerShape(10.dp))
                                .clickable {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    animCat = cat
                                }
                                .padding(horizontal = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = cat,
                                color = if (active) Color.Black else Color.White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
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
                    items(filteredAnims, key = { it.id }) { spec ->
                        val isSelected = spec.id == selectedAnimId
                        val frame = OverlayAnimator.evaluateTextSpec(
                            rawText = textValue.ifBlank { "TG7" }.take(8),
                            durationMs = 2200L,
                            spec = spec,
                            localTimeMs = previewTimeMs.toLong()
                        )
                        Column(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isSelected) Color(0xFF0E202B) else Color(0xFF0C1018))
                                .border(
                                    width = if (isSelected) 2.dp else 1.dp,
                                    color = if (isSelected) TG7Colors.NeonCyan else TG7Colors.BorderSubtle,
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .clickable {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    selectedAnimId = spec.id
                                }
                                .padding(6.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color.Black),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = frame.visibleText,
                                    color = Color(frame.overrideColorHex ?: selectedColor),
                                    fontFamily = resolveComposeFontFamily(selectedFont),
                                    fontWeight = FontWeight.Black,
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    modifier = Modifier.graphicsLayer {
                                        alpha = frame.alpha
                                        scaleX = frame.scaleX.coerceIn(0.2f, 1.5f)
                                        scaleY = frame.scaleY.coerceIn(0.2f, 1.5f)
                                        translationX = (frame.offsetXDp * 0.4f).dp.toPx()
                                        translationY = (frame.offsetYDp * 0.4f).dp.toPx()
                                        rotationZ = frame.rotationDeg
                                    }
                                )
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
            }

            Button(
                onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    onConfirmText(
                        editingLayer?.id,
                        textValue,
                        selectedColor,
                        fontSizeSp,
                        selectedTemplateId,
                        selectedAnimId,
                        selectedFont,
                        selectedBgColor,
                        hasOutline,
                        letterSpacingEm
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 10.dp)
                    .heightIn(min = 50.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = TG7Colors.NeonCyan,
                    contentColor = Color.Black
                )
            ) {
                Icon(Icons.Rounded.TextFields, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(6.dp))
                Text(
                    text = if (editingLayer != null) "Update Text Layer" else "Add to Text Track",
                    fontWeight = FontWeight.Black
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddStickerSheet(
    onSelectLottieSticker: (LottieStickerSpec) -> Unit,
    onSelectVectorSticker: (StickerPreset) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val haptic = LocalHapticFeedback.current

    val lottieStickers = remember { TextAndStickerLoader.getLottieStickers(context) }
    val categories = remember {
        listOf("All") + TextAndStickerLoader.getStickerCategories(context) + listOf("Vector Badges")
    }
    var selectedCategory by remember { mutableStateOf("All") }
    var search by remember { mutableStateOf("") }

    val filteredLottie = remember(lottieStickers, selectedCategory, search) {
        if (selectedCategory == "Vector Badges") emptyList()
        else lottieStickers.filter { s ->
            val catOk = selectedCategory == "All" || s.category == selectedCategory
            val q = search.trim()
            val qOk = q.isEmpty() || s.name.contains(q, ignoreCase = true)
            catOk && qOk
        }
    }

    val showVectors = selectedCategory == "All" || selectedCategory == "Vector Badges"

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xFF070A10),
        contentColor = Color.White
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.84f)
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
                        text = "Animated Lottie Stickers (${lottieStickers.size + StickerPreset.entries.size})",
                        color = Color.White,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = "Real vector Lottie compositions + hardware MP4 export",
                        color = TG7Colors.NeonCyan,
                        fontSize = 11.sp
                    )
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Rounded.Close, contentDescription = "Close", tint = Color.White)
                }
            }

            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                placeholder = { Text("Search stickers (Pulse, Live, Flame, Hex...)", fontSize = 12.sp) },
                leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null, tint = TG7Colors.NeonCyan) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = TG7Colors.NeonCyan,
                    unfocusedBorderColor = TG7Colors.BorderSubtle,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White
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
                    Box(
                        modifier = Modifier
                            .heightIn(min = 42.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (active) TG7Colors.NeonCyan else Color(0xFF0E131E))
                            .border(1.dp, if (active) TG7Colors.NeonCyan else TG7Colors.BorderSubtle, RoundedCornerShape(10.dp))
                            .clickable {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                selectedCategory = cat
                            }
                            .padding(horizontal = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = cat,
                            color = if (active) Color.Black else Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            LazyVerticalGrid(
                columns = GridCells.Fixed(4),
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentPadding = PaddingValues(bottom = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filteredLottie, key = { it.id }) { spec ->
                    val composition by rememberLottieComposition(
                        LottieCompositionSpec.Asset(spec.lottieAssetPath)
                    )
                    val progress by animateLottieCompositionAsState(
                        composition = composition,
                        iterations = LottieConstants.IterateForever
                    )
                    Column(
                        modifier = Modifier
                            .aspectRatio(0.9f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF0C1018))
                            .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(12.dp))
                            .clickable {
                                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                onSelectLottieSticker(spec)
                            }
                            .padding(6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        LottieAnimation(
                            composition = composition,
                            progress = { progress },
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = spec.name,
                            color = Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                if (showVectors) {
                    val vecItems = StickerPreset.entries.filter {
                        search.isBlank() || it.label.contains(search.trim(), ignoreCase = true)
                    }
                    items(vecItems, key = { "vec_${it.name}" }) { preset ->
                        Column(
                            modifier = Modifier
                                .aspectRatio(0.9f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF0C1018))
                                .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(12.dp))
                                .clickable {
                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    onSelectVectorSticker(preset)
                                }
                                .padding(6.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = preset.icon,
                                contentDescription = preset.label,
                                tint = Color(preset.defaultTintHex),
                                modifier = Modifier.size(30.dp)
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                text = preset.label,
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1
                            )
                        }
                    }
                }
            }
        }
    }
}
