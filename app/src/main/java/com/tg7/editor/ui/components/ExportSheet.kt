package com.tg7.editor.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Cancel
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Done
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tg7.editor.model.CanvasAspectRatio
import com.tg7.editor.model.ExportResolution
import com.tg7.editor.model.ExportState
import com.tg7.editor.ui.theme.TG7Colors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExportSheet(
    aspectRatio: CanvasAspectRatio,
    selectedResolution: ExportResolution,
    exportState: ExportState,
    onSelectResolution: (ExportResolution) -> Unit,
    onStartExport: () -> Unit,
    onCancelExport: () -> Unit,
    onShareExport: (uriString: String) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val haptic = LocalHapticFeedback.current

    ModalBottomSheet(
        onDismissRequest = {
            if (exportState !is ExportState.Exporting) onDismiss()
        },
        sheetState = sheetState,
        containerColor = Color(0xFF0A0D14),
        contentColor = Color.White
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 18.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Hardware Export (H.264 MP4)",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    val (w, h) = aspectRatio.outputDimensions(selectedResolution.shortEdgePx)
                    Text(
                        text = "Canvas ${aspectRatio.label} · ${w}x${h} MediaCodec",
                        color = TG7Colors.NeonCyan,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                if (exportState !is ExportState.Exporting) {
                    IconButton(
                        onClick = {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            onDismiss()
                        },
                        modifier = Modifier.size(48.dp)
                    ) {
                        Icon(Icons.Rounded.Close, contentDescription = "Close", tint = Color.White)
                    }
                }
            }

            when (exportState) {
                ExportState.Idle -> {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        ExportResolution.entries.forEach { res ->
                            val selected = res == selectedResolution
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .heightIn(min = 58.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(if (selected) Color(0xFF08242B) else TG7Colors.GlassCard)
                                    .border(
                                        width = if (selected) 1.5.dp else 1.dp,
                                        color = if (selected) TG7Colors.NeonCyan else TG7Colors.BorderSubtle,
                                        shape = RoundedCornerShape(14.dp)
                                    )
                                    .clickable {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        onSelectResolution(res)
                                    }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        text = res.label,
                                        color = if (selected) TG7Colors.NeonCyan else Color.White,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 16.sp
                                    )
                                    Text(
                                        text = if (res == ExportResolution.FHD_1080) "60fps Std" else res.badge,
                                        color = TG7Colors.TextMuted,
                                        fontSize = 10.sp
                                    )
                                }
                            }
                        }
                    }

                    Button(
                        onClick = {
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            onStartExport()
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 52.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = TG7Colors.NeonCyan,
                            contentColor = Color.Black
                        )
                    ) {
                        Icon(Icons.Rounded.Download, contentDescription = null, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.size(8.dp))
                        Text("Export ${selectedResolution.badge}", fontWeight = FontWeight.Black)
                    }
                }

                is ExportState.Exporting -> {
                    Text(
                        text = "Hardware Encoding ${exportState.resolution.badge} · ${exportState.progressPercent}%",
                        color = TG7Colors.NeonCyan,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp
                    )
                    LinearProgressIndicator(
                        progress = { exportState.progressPercent / 100f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp)
                            .clip(RoundedCornerShape(4.dp)),
                        color = TG7Colors.NeonCyan,
                        trackColor = TG7Colors.BorderSubtle
                    )
                    OutlinedButton(
                        onClick = {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            onCancelExport()
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Icon(Icons.Rounded.Cancel, contentDescription = null, tint = TG7Colors.BloodRed, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.size(6.dp))
                        Text("Cancel Export", color = TG7Colors.BloodRed, fontWeight = FontWeight.SemiBold)
                    }
                }

                is ExportState.Completed -> {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.CheckCircle,
                            contentDescription = null,
                            tint = TG7Colors.NeonCyan,
                            modifier = Modifier.size(28.dp)
                        )
                        Column {
                            Text(
                                text = "Saved to Movies/TG7 Editor",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp
                            )
                            Text(
                                text = exportState.fileName,
                                color = TG7Colors.TextMuted,
                                fontSize = 12.sp
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        if (exportState.galleryUriString != null) {
                            Button(
                                onClick = {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    onShareExport(exportState.galleryUriString)
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .heightIn(min = 50.dp),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = TG7Colors.NeonCyan,
                                    contentColor = Color.Black
                                )
                            ) {
                                Icon(Icons.Rounded.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.size(6.dp))
                                Text("Share Video", fontWeight = FontWeight.Bold)
                            }
                        }
                        OutlinedButton(
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                onDismiss()
                            },
                            modifier = Modifier
                                .weight(1f)
                                .heightIn(min = 50.dp),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Icon(Icons.Rounded.Done, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.size(6.dp))
                            Text("Done", color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                is ExportState.Failed -> {
                    Text(
                        text = exportState.message,
                        color = TG7Colors.BloodRed,
                        fontSize = 13.sp
                    )
                    Button(
                        onClick = {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            onStartExport()
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = TG7Colors.NeonCyan,
                            contentColor = Color.Black
                        )
                    ) {
                        Icon(Icons.Rounded.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.size(6.dp))
                        Text("Retry Export", fontWeight = FontWeight.Bold)
                    }
                }
            }
            Spacer(Modifier.height(6.dp))
        }
    }
}
