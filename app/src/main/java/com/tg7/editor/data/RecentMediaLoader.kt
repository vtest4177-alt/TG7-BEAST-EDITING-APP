package com.tg7.editor.data

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.MediaStore
import androidx.core.content.ContextCompat
import com.tg7.editor.model.MediaKind
import com.tg7.editor.model.RecentMediaItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object RecentMediaLoader {

    fun hasRecentAccessPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val img = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_IMAGES) ==
                PackageManager.PERMISSION_GRANTED
            val vid = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_VIDEO) ==
                PackageManager.PERMISSION_GRANTED
            val selected = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                false
            }
            img || vid || selected
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) ==
                PackageManager.PERMISSION_GRANTED
        }
    }

    suspend fun loadRecentVisualMedia(
        context: Context,
        limit: Int = 45
    ): List<RecentMediaItem> = withContext(Dispatchers.IO) {
        if (!hasRecentAccessPermission(context)) return@withContext emptyList()

        val result = mutableListOf<RecentMediaItem>()
        val collection = MediaStore.Files.getContentUri("external")
        val projection = arrayOf(
            MediaStore.Files.FileColumns._ID,
            MediaStore.Files.FileColumns.DISPLAY_NAME,
            MediaStore.Files.FileColumns.MEDIA_TYPE,
            MediaStore.Video.Media.DURATION
        )
        val selection = "${MediaStore.Files.FileColumns.MEDIA_TYPE}=? OR ${MediaStore.Files.FileColumns.MEDIA_TYPE}=?"
        val selectionArgs = arrayOf(
            MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO.toString(),
            MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE.toString()
        )
        val sortOrder = "${MediaStore.Files.FileColumns.DATE_ADDED} DESC"

        runCatching {
            context.contentResolver.query(
                collection,
                projection,
                selection,
                selectionArgs,
                sortOrder
            )?.use { cursor ->
                val idCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
                val nameCol = cursor.getColumnIndex(MediaStore.Files.FileColumns.DISPLAY_NAME)
                val typeCol = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MEDIA_TYPE)
                val durCol = cursor.getColumnIndex(MediaStore.Video.Media.DURATION)

                while (cursor.moveToNext() && result.size < limit) {
                    val id = cursor.getLong(idCol)
                    val mediaType = cursor.getInt(typeCol)
                    val isVideo = mediaType == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO
                    val contentUri = if (isVideo) {
                        ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id)
                    } else {
                        ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)
                    }
                    val rawDuration = if (isVideo && durCol >= 0) cursor.getLong(durCol) else 3500L
                    val safeDuration = if (rawDuration > 0L) rawDuration else 3500L
                    val name = if (nameCol >= 0) cursor.getString(nameCol) else null
                    result.add(
                        RecentMediaItem(
                            id = id,
                            uriString = contentUri.toString(),
                            displayName = name ?: if (isVideo) "Video" else "Photo",
                            kind = if (isVideo) MediaKind.VIDEO else MediaKind.IMAGE,
                            durationMs = safeDuration
                        )
                    )
                }
            }
        }
        result
    }
}
