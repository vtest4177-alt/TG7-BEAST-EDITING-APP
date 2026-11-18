package com.tg7.editor

import android.Manifest
import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = filePathCallback
        filePathCallback = null
        if (callback == null) return@registerForActivityResult

        val uris = mutableListOf<Uri>()
        val data = result.data
        if (result.resultCode == RESULT_OK && data != null) {
            val clipData = data.clipData
            if (clipData != null) {
                for (i in 0 until clipData.itemCount) {
                    clipData.getItemAt(i)?.uri?.let { uris.add(it) }
                }
            } else {
                data.data?.let { uris.add(it) }
            }
        }
        callback.onReceiveValue(uris.toTypedArray())
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK

        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
        }
        setContentView(webView)

        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, windowInsets ->
            val bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        requestMediaPermissionsIfNeeded()

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportMultipleWindows(true)
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        webView.addJavascriptInterface(TG7AndroidBridge(), "TG7Android")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val uri = request.url
                if (uri.host == "appassets.androidplatform.net") {
                    return false
                }
                if (uri.scheme == "http" || uri.scheme == "https") {
                    openInExternalBrowser(uri)
                    return true
                }
                return false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message?
            ): Boolean {
                val hitTest = view?.hitTestResult
                val url = hitTest?.extra
                if (!url.isNullOrBlank()) {
                    openInExternalBrowser(Uri.parse(url))
                }
                return false
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    request.grant(request.resources)
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val acceptTypes = fileChooserParams.acceptTypes
                    .flatMap { it.split(",") }
                    .map { it.trim() }
                    .filter { it.isNotEmpty() }

                val mimeTypes = mutableListOf<String>()
                var hasFont = false
                for (t in acceptTypes) {
                    if (t.startsWith(".ttf") || t.startsWith(".otf") || t.startsWith(".woff")) {
                        hasFont = true
                    } else if (t.contains("/")) {
                        mimeTypes.add(t)
                    }
                }

                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    putExtra(
                        Intent.EXTRA_ALLOW_MULTIPLE,
                        fileChooserParams.mode == FileChooserParams.MODE_OPEN_MULTIPLE
                    )
                    if (hasFont || mimeTypes.isEmpty()) {
                        type = "*/*"
                    } else if (mimeTypes.size == 1) {
                        type = mimeTypes[0]
                    } else {
                        type = "*/*"
                        putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toTypedArray())
                    }
                }

                return try {
                    fileChooserLauncher.launch(Intent.createChooser(intent, "Select Media or Font"))
                    true
                } catch (_: Exception) {
                    this@MainActivity.filePathCallback = null
                    false
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        webView.loadUrl("https://appassets.androidplatform.net/index.html")
    }

    private fun openInExternalBrowser(uri: Uri) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, uri)
            startActivity(intent)
        } catch (_: Exception) {
            Toast.makeText(this, "Could not open Chrome for link", Toast.LENGTH_SHORT).show()
        }
    }

    private fun requestMediaPermissionsIfNeeded() {
        val perms = mutableListOf(
            Manifest.permission.READ_MEDIA_VIDEO,
            Manifest.permission.READ_MEDIA_IMAGES,
            Manifest.permission.READ_MEDIA_AUDIO
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            perms.add(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED)
        }
        val missing = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    inner class TG7AndroidBridge {
        @JavascriptInterface
        fun saveVideo(base64Data: String, fileName: String): Boolean {
            return try {
                val cleanBase64 = base64Data.substringAfter(",", base64Data)
                val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, "video/webm")
                    put(
                        MediaStore.Downloads.RELATIVE_PATH,
                        Environment.DIRECTORY_DOWNLOADS + "/TG7 Editor"
                    )
                }
                val uri = contentResolver.insert(
                    MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                    values
                ) ?: return false

                contentResolver.openOutputStream(uri)?.use { out ->
                    out.write(bytes)
                }
                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "Saved to Downloads/TG7 Editor/$fileName",
                        Toast.LENGTH_LONG
                    ).show()
                }
                true
            } catch (_: Exception) {
                runOnUiThread {
                    Toast.makeText(
                        this@MainActivity,
                        "Export save failed",
                        Toast.LENGTH_SHORT
                    ).show()
                }
                false
            }
        }
    }
}
