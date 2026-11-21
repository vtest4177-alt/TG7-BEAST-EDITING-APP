package com.tg7.editor.ui.home

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.displayCutoutPadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AddCircle
import androidx.compose.material.icons.rounded.AspectRatio
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.CloudDownload
import androidx.compose.material.icons.rounded.Crop169
import androidx.compose.material.icons.rounded.CropPortrait
import androidx.compose.material.icons.rounded.CropSquare
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.LockOpen
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.PhotoLibrary
import androidx.compose.material.icons.rounded.Restore
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.tg7.editor.media.MediaPickerHelper
import com.tg7.editor.model.CanvasAspectRatio
import com.tg7.editor.model.EditorProject
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.RecentMediaItem
import com.tg7.editor.ui.components.TG7BrandLogo
import com.tg7.editor.ui.theme.TG7Colors

@Composable
fun HomeScreen(
    projects: List<EditorProject>,
    recoveryProject: EditorProject?,
    selectedAspectRatio: CanvasAspectRatio,
    recentMedia: List<RecentMediaItem>,
    hasRecentPermission: Boolean,
    isImporting: Boolean,
    onRecoverSession: () -> Unit,
    onDismissRecovery: () -> Unit,
    onSelectAspectRatio: (CanvasAspectRatio) -> Unit,
    onNewProjectClick: () -> Unit,
    onOpenProject: (String) -> Unit,
    onDeleteProject: (String) -> Unit,
    onRequestRecentPermission: () -> Unit,
    onQuickStartRecent: (RecentMediaItem) -> Unit,
    onOpenAssetHub: () -> Unit = {}
) {
    val haptic = LocalHapticFeedback.current
    val heroInteraction = remember { MutableInteractionSource() }
    val heroPressed by heroInteraction.collectIsPressedAsState()
    val heroScale by animateFloatAsState(
        targetValue = if (heroPressed) 0.97f else 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessMedium
        ),
        label = "heroScale"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(TG7Colors.Black)
            .statusBarsPadding()
            .displayCutoutPadding()
            .navigationBarsPadding()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TG7BrandLogo()

            Row(
                modifier = Modifier
                    .defaultMinSize(minHeight = 48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(TG7Colors.GlassCard)
                    .border(1.dp, TG7Colors.NeonCyan.copy(alpha = 0.65f), RoundedCornerShape(12.dp))
                    .clickable {
                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onOpenAssetHub()
                    }
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Icon(Icons.Rounded.CloudDownload, contentDescription = "Asset Hub", tint = TG7Colors.NeonCyan, modifier = Modifier.size(16.dp))
                Text(
                    text = "Asset Hub",
                    color = TG7Colors.NeonCyan,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 0.6.sp
                )
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Crash Recovery Banner (Room Auto-Save)
            if (recoveryProject != null) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFF0A1D24))
                            .border(1.5.dp, TG7Colors.NeonCyan, RoundedCornerShape(16.dp))
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Rounded.Restore, contentDescription = null, tint = TG7Colors.NeonCyan)
                            Column {
                                Text(
                                    text = "Recover Active Session",
                                    color = Color.White,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "${recoveryProject.name} · ${recoveryProject.clips.size} clips auto-saved",
                                    color = TG7Colors.NeonCyan,
                                    fontSize = 11.sp
                                )
                            }
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Button(
                                onClick = {
                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    onRecoverSession()
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .heightIn(min = 48.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = TG7Colors.NeonCyan,
                                    contentColor = Color.Black
                                )
                            ) {
                                Icon(Icons.Rounded.Restore, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.size(6.dp))
                                Text("Resume Edit", fontWeight = FontWeight.Bold)
                            }
                            OutlinedButton(
                                onClick = {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    onDismissRecovery()
                                },
                                modifier = Modifier.heightIn(min = 48.dp),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Rounded.Close, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.size(4.dp))
                                Text("Dismiss", color = Color.White)
                            }
                        }
                    }
                }
            }

            // Glass Launch Card + Canvas Ratio Selector (9:16, 16:9, 1:1)
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(TG7Colors.GlassSurface)
                        .border(1.dp, TG7Colors.GlassHighlight, RoundedCornerShape(20.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.AspectRatio,
                            contentDescription = null,
                            tint = TG7Colors.NeonCyan,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = "CANVAS FORMAT",
                            color = TG7Colors.TextMuted,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.1.sp
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        CanvasAspectRatio.entries.forEach { ratio ->
                            val active = ratio == selectedAspectRatio
                            val icon = when (ratio) {
                                CanvasAspectRatio.PORTRAIT_9_16 -> Icons.Rounded.CropPortrait
                                CanvasAspectRatio.LANDSCAPE_16_9 -> Icons.Rounded.Crop169
                                CanvasAspectRatio.SQUARE_1_1 -> Icons.Rounded.CropSquare
                            }
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .heightIn(min = 56.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(if (active) Color(0xFF08242B) else Color(0xFF090C12))
                                    .border(
                                        width = if (active) 1.5.dp else 1.dp,
                                        color = if (active) TG7Colors.NeonCyan else TG7Colors.BorderSubtle,
                                        shape = RoundedCornerShape(14.dp)
                                    )
                                    .clickable {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        onSelectAspectRatio(ratio)
                                    }
                                    .padding(vertical = 8.dp, horizontal = 6.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                Icon(
                                    imageVector = icon,
                                    contentDescription = ratio.label,
                                    tint = if (active) TG7Colors.NeonCyan else Color.White,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = ratio.label,
                                    color = if (active) TG7Colors.NeonCyan else Color.White,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.ExtraBold
                                )
                                Text(
                                    text = ratio.subtitle,
                                    color = TG7Colors.TextMuted,
                                    fontSize = 9.sp,
                                    maxLines = 1
                                )
                            }
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .scale(heroScale)
                            .heightIn(min = 60.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(
                                Brush.linearGradient(
                                    listOf(TG7Colors.NeonCyan, Color(0xFF0099CC), TG7Colors.BloodRed)
                                )
                            )
                            .clickable(
                                enabled = !isImporting,
                                interactionSource = heroInteraction,
                                indication = null,
                                onClick = {
                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    onNewProjectClick()
                                }
                            )
                            .padding(horizontal = 18.dp, vertical = 14.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(
                                    text = "New Project",
                                    color = Color.Black,
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Black
                                )
                                Text(
                                    text = "Multi-track studio · ${selectedAspectRatio.label} Canvas",
                                    color = Color.Black.copy(alpha = 0.8f),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }

                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .background(Color.Black, RoundedCornerShape(12.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                if (isImporting) {
                                    CircularProgressIndicator(
                                        color = TG7Colors.NeonCyan,
                                        modifier = Modifier.size(22.dp),
                                        strokeWidth = 2.5.dp
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Rounded.AddCircle,
                                        contentDescription = "New Project",
                                        tint = TG7Colors.NeonCyan,
                                        modifier = Modifier.size(26.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Recent Media Quick Strip
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "RECENT GALLERY",
                            color = TG7Colors.TextMuted,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.1.sp
                        )
                        if (!hasRecentPermission) {
                            Row(
                                modifier = Modifier
                                    .defaultMinSize(minHeight = 48.dp)
                                    .clickable {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        onRequestRecentPermission()
                                    }
                                    .padding(horizontal = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.LockOpen,
                                    contentDescription = null,
                                    tint = TG7Colors.NeonCyan,
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = "Enable Grid",
                                    color = TG7Colors.NeonCyan,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    if (!hasRecentPermission) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(TG7Colors.GlassCard)
                                .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(14.dp))
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                modifier = Modifier.weight(1f),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.PhotoLibrary,
                                    contentDescription = null,
                                    tint = TG7Colors.NeonCyan
                                )
                                Text(
                                    text = "Show recent clips right here for 1-tap start",
                                    color = TG7Colors.TextMuted,
                                    fontSize = 12.sp
                                )
                            }
                            Spacer(Modifier.width(8.dp))
                            Button(
                                onClick = {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    onRequestRecentPermission()
                                },
                                modifier = Modifier.heightIn(min = 48.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF152030),
                                    contentColor = TG7Colors.NeonCyan
                                ),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Rounded.LockOpen, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Enable", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    } else if (recentMedia.isNotEmpty()) {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            items(recentMedia.take(15), key = { it.id }) { media ->
                                Box(
                                    modifier = Modifier
                                        .size(width = 96.dp, height = 118.dp)
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(TG7Colors.GlassCard)
                                        .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(14.dp))
                                        .clickable {
                                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                            onQuickStartRecent(media)
                                        }
                                ) {
                                    AsyncImage(
                                        model = media.uriString,
                                        contentDescription = media.displayName,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                    Box(
                                        modifier = Modifier
                                            .align(Alignment.BottomEnd)
                                            .padding(6.dp)
                                            .background(Color.Black.copy(alpha = 0.8f), RoundedCornerShape(6.dp))
                                            .padding(horizontal = 5.dp, vertical = 2.dp)
                                    ) {
                                        Text(
                                            text = if (media.kind == MediaKind.VIDEO) {
                                                MediaPickerHelper.formatDuration(media.durationMs)
                                            } else {
                                                "IMG"
                                            },
                                            color = TG7Colors.NeonCyan,
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Room Projects Section Header
            item {
                Text(
                    text = "PROJECTS (${projects.size})",
                    color = TG7Colors.TextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.1.sp
                )
            }

            if (projects.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(TG7Colors.GlassSurface)
                            .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(16.dp))
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Movie,
                            contentDescription = null,
                            tint = TG7Colors.TextMuted,
                            modifier = Modifier.size(34.dp)
                        )
                        Text(
                            text = "No projects yet",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                        Text(
                            text = "Pick your canvas format above and tap New Project.",
                            color = TG7Colors.TextMuted,
                            fontSize = 12.sp
                        )
                    }
                }
            } else {
                items(projects, key = { it.id }) { proj ->
                    val layerSummary = buildString {
                        append("${proj.aspectRatio.label} · ${proj.clips.size} video")
                        if (proj.audioClips.isNotEmpty()) append(" · ${proj.audioClips.size} audio")
                        if (proj.textLayers.isNotEmpty()) append(" · ${proj.textLayers.size} text")
                        if (proj.stickerLayers.isNotEmpty()) append(" · ${proj.stickerLayers.size} sticker")
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(TG7Colors.GlassCard)
                            .border(1.dp, TG7Colors.BorderSubtle, RoundedCornerShape(16.dp))
                            .clickable {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                onOpenProject(proj.id)
                            }
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.Black)
                        ) {
                            if (proj.coverUriString != null) {
                                AsyncImage(
                                    model = proj.coverUriString,
                                    contentDescription = proj.name,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )
                            }
                        }

                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = proj.name,
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = "$layerSummary · ${MediaPickerHelper.formatDuration(proj.totalDurationMs)}",
                                color = TG7Colors.NeonCyan,
                                fontSize = 11.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        Column(
                            modifier = Modifier
                                .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .clickable {
                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    onDeleteProject(proj.id)
                                }
                                .padding(horizontal = 8.dp, vertical = 6.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Delete,
                                contentDescription = "Delete project",
                                tint = TG7Colors.BloodRed,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = "Delete",
                                color = TG7Colors.BloodRed,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }

            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}
