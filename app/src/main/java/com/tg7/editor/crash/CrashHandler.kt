package com.tg7.editor.crash

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tg7.editor.MainActivity
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import kotlin.system.exitProcess

object CrashHandler {
    private const val CRASH_FILE_NAME = "tg7_last_crash.txt"
    const val EXTRA_CRASH_TRACE = "tg7_crash_trace"

    @Volatile
    private var appStartTimeMs: Long = 0L

    fun install(context: Context) {
        val appContext = context.applicationContext
        appStartTimeMs = System.currentTimeMillis()
        val previousHandler = Thread.getDefaultUncaughtExceptionHandler()

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            val trace = buildTraceString(thread, throwable)
            runCatching {
                File(appContext.filesDir, CRASH_FILE_NAME).writeText(trace)
            }

            val aliveMs = System.currentTimeMillis() - appStartTimeMs
            if (aliveMs > 2500L) {
                val restartIntent = Intent(appContext, MainActivity::class.java).apply {
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP
                    )
                    putExtra(EXTRA_CRASH_TRACE, trace)
                }
                runCatching { appContext.startActivity(restartIntent) }
                exitProcess(1)
            } else {
                previousHandler?.uncaughtException(thread, throwable)
            }
        }
    }

    fun consumeSavedCrash(context: Context): String? {
        val file = File(context.filesDir, CRASH_FILE_NAME)
        if (!file.exists()) return null
        val text = runCatching { file.readText() }.getOrNull()
        runCatching { file.delete() }
        return text?.takeIf { it.isNotBlank() }
    }

    private fun buildTraceString(thread: Thread, throwable: Throwable): String {
        val sw = StringWriter()
        sw.append("Thread: ").append(thread.name).append("\n")
        throwable.printStackTrace(PrintWriter(sw))
        return sw.toString()
    }
}

@Composable
fun CrashErrorScreen(
    title: String = "TG7 Editor Recovered from an Error",
    traceText: String,
    onContinue: () -> Unit
) {
    val clipboard = LocalClipboardManager.current
    val haptic = LocalHapticFeedback.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF000000))
            .safeDrawingPadding()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(Color(0x28FF1030), RoundedCornerShape(12.dp))
                    .border(1.dp, Color(0xFFFF1030), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Rounded.Warning,
                    contentDescription = "Crash warning",
                    tint = Color(0xFFFF1030)
                )
            }
            Column {
                Text(
                    text = title,
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Safe recovery screen active. Copy trace or return to studio.",
                    color = Color(0xFF9CA3AF),
                    fontSize = 12.sp
                )
            }
        }

        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(Color(0xFF0B0D13), RoundedCornerShape(14.dp))
                .border(1.dp, Color(0xFF222733), RoundedCornerShape(14.dp))
                .padding(14.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text(
                text = traceText,
                color = Color(0xFF00F0FF),
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                lineHeight = 16.sp
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    clipboard.setText(AnnotatedString(traceText))
                },
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = 50.dp),
                shape = RoundedCornerShape(14.dp)
            ) {
                Icon(Icons.Rounded.ContentCopy, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(6.dp))
                Text("Copy Log", color = Color.White, fontWeight = FontWeight.SemiBold)
            }

            Button(
                onClick = {
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    onContinue()
                },
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = 50.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF00F0FF),
                    contentColor = Color.Black
                )
            ) {
                Icon(Icons.Rounded.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(6.dp))
                Text("Return to Studio", fontWeight = FontWeight.Bold)
            }
        }
    }
}
