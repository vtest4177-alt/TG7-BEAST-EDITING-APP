package com.tg7.editor.data.db

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Relation
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Entity(tableName = "projects")
data class ProjectEntity(
    @PrimaryKey val id: String,
    val name: String,
    val aspectRatio: String,
    val updatedAtMs: Long,
    val inActiveSession: Boolean = false
)

@Entity(
    tableName = "video_clips",
    foreignKeys = [
        ForeignKey(
            entity = ProjectEntity::class,
            parentColumns = ["id"],
            childColumns = ["projectId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("projectId")]
)
data class VideoClipEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val orderIndex: Int,
    val uriString: String,
    val displayName: String,
    val kind: String,
    val sourceDurationMs: Long,
    val trimStartMs: Long,
    val trimEndMs: Long,
    val outTransitionId: String? = null,
    val outTransitionDurationMs: Long = 500L
)

@Entity(
    tableName = "audio_clips",
    foreignKeys = [
        ForeignKey(
            entity = ProjectEntity::class,
            parentColumns = ["id"],
            childColumns = ["projectId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("projectId")]
)
data class AudioClipEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val uriString: String,
    val displayName: String,
    val startTimeMs: Long,
    val sourceDurationMs: Long,
    val trimStartMs: Long,
    val trimEndMs: Long,
    val volume: Float
)

@Entity(
    tableName = "text_layers",
    foreignKeys = [
        ForeignKey(
            entity = ProjectEntity::class,
            parentColumns = ["id"],
            childColumns = ["projectId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("projectId")]
)
data class TextLayerEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val text: String,
    val startTimeMs: Long,
    val durationMs: Long,
    val posXFraction: Float,
    val posYFraction: Float,
    val colorHex: Long,
    val fontSizeSp: Float,
    val templateId: String = "tpl_tg7_display",
    val animationId: String = "ta_none",
    val fontFamily: String = "DISPLAY",
    val bgColorHex: Long = 0L,
    val hasOutline: Boolean = true,
    val letterSpacingEm: Float = 0.04f
)

@Entity(
    tableName = "sticker_layers",
    foreignKeys = [
        ForeignKey(
            entity = ProjectEntity::class,
            parentColumns = ["id"],
            childColumns = ["projectId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("projectId")]
)
data class StickerLayerEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val presetName: String,
    val startTimeMs: Long,
    val durationMs: Long,
    val posXFraction: Float,
    val posYFraction: Float,
    val sizeDp: Float,
    val tintHex: Long,
    val lottieAssetPath: String? = null,
    val label: String = "Sticker"
)

data class ProjectWithLayers(
    @Embedded val project: ProjectEntity,
    @Relation(parentColumn = "id", entityColumn = "projectId")
    val videoClips: List<VideoClipEntity>,
    @Relation(parentColumn = "id", entityColumn = "projectId")
    val audioClips: List<AudioClipEntity>,
    @Relation(parentColumn = "id", entityColumn = "projectId")
    val textLayers: List<TextLayerEntity>,
    @Relation(parentColumn = "id", entityColumn = "projectId")
    val stickerLayers: List<StickerLayerEntity>
)

@Dao
interface ProjectDao {
    @Transaction
    @Query("SELECT * FROM projects ORDER BY updatedAtMs DESC")
    suspend fun getAllProjectsWithLayers(): List<ProjectWithLayers>

    @Transaction
    @Query("SELECT * FROM projects WHERE inActiveSession = 1 ORDER BY updatedAtMs DESC LIMIT 1")
    suspend fun getRecoveryProject(): ProjectWithLayers?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertProject(project: ProjectEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVideoClips(clips: List<VideoClipEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAudioClips(clips: List<AudioClipEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTextLayers(layers: List<TextLayerEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStickerLayers(layers: List<StickerLayerEntity>)

    @Query("DELETE FROM video_clips WHERE projectId = :projectId")
    suspend fun clearVideoClips(projectId: String)

    @Query("DELETE FROM audio_clips WHERE projectId = :projectId")
    suspend fun clearAudioClips(projectId: String)

    @Query("DELETE FROM text_layers WHERE projectId = :projectId")
    suspend fun clearTextLayers(projectId: String)

    @Query("DELETE FROM sticker_layers WHERE projectId = :projectId")
    suspend fun clearStickerLayers(projectId: String)

    @Query("DELETE FROM projects WHERE id = :projectId")
    suspend fun deleteProjectById(projectId: String)

    @Query("UPDATE projects SET inActiveSession = 0")
    suspend fun clearAllActiveSessions()

    @Query("UPDATE projects SET inActiveSession = :active WHERE id = :projectId")
    suspend fun setSessionActive(projectId: String, active: Boolean)

    @Transaction
    suspend fun saveProjectFull(
        project: ProjectEntity,
        videoClips: List<VideoClipEntity>,
        audioClips: List<AudioClipEntity>,
        textLayers: List<TextLayerEntity>,
        stickerLayers: List<StickerLayerEntity>
    ) {
        upsertProject(project)
        clearVideoClips(project.id)
        clearAudioClips(project.id)
        clearTextLayers(project.id)
        clearStickerLayers(project.id)
        if (videoClips.isNotEmpty()) insertVideoClips(videoClips)
        if (audioClips.isNotEmpty()) insertAudioClips(audioClips)
        if (textLayers.isNotEmpty()) insertTextLayers(textLayers)
        if (stickerLayers.isNotEmpty()) insertStickerLayers(stickerLayers)
    }
}

@Database(
    entities = [
        ProjectEntity::class,
        VideoClipEntity::class,
        AudioClipEntity::class,
        TextLayerEntity::class,
        StickerLayerEntity::class
    ],
    version = 3,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun projectDao(): ProjectDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE video_clips ADD COLUMN outTransitionId TEXT")
                db.execSQL("ALTER TABLE video_clips ADD COLUMN outTransitionDurationMs INTEGER NOT NULL DEFAULT 500")
            }
        }

        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE text_layers ADD COLUMN templateId TEXT NOT NULL DEFAULT 'tpl_tg7_display'")
                db.execSQL("ALTER TABLE text_layers ADD COLUMN animationId TEXT NOT NULL DEFAULT 'ta_none'")
                db.execSQL("ALTER TABLE text_layers ADD COLUMN fontFamily TEXT NOT NULL DEFAULT 'DISPLAY'")
                db.execSQL("ALTER TABLE text_layers ADD COLUMN bgColorHex INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE text_layers ADD COLUMN hasOutline INTEGER NOT NULL DEFAULT 1")
                db.execSQL("ALTER TABLE text_layers ADD COLUMN letterSpacingEm REAL NOT NULL DEFAULT 0.04")
                db.execSQL("ALTER TABLE sticker_layers ADD COLUMN lottieAssetPath TEXT")
                db.execSQL("ALTER TABLE sticker_layers ADD COLUMN label TEXT NOT NULL DEFAULT 'Sticker'")
            }
        }

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "tg7_editor_studio.db"
                )
                    .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
