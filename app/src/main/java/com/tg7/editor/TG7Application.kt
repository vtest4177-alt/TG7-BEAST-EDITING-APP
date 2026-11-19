package com.tg7.editor

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.decode.VideoFrameDecoder
import com.tg7.editor.crash.CrashHandler

class TG7Application : Application(), ImageLoaderFactory {

    override fun onCreate() {
        super.onCreate()
        CrashHandler.install(this)
    }

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .components {
                add(VideoFrameDecoder.Factory())
            }
            .crossfade(true)
            .build()
    }
}
