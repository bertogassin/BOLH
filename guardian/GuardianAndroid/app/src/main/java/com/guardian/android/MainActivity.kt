package com.guardian.android

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.guardian.android.ui.theme.GuardianTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK
        WindowCompat.setDecorFitsSystemWindows(window, true)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        setContent {
            GuardianTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val appUrl = remember { "http://127.0.0.1:3003/" }
                    val offlineHtml = remember {
                        """
                        <!doctype html>
                        <html lang="en">
                        <head>
                          <meta charset="utf-8" />
                          <meta name="viewport" content="width=device-width, initial-scale=1" />
                          <title>BOLH Offline</title>
                          <style>
                            body { margin: 0; min-height: 100vh; font-family: Arial, sans-serif; background: #111827; color: #f9fafb; display: grid; place-items: center; padding: 20px; }
                            .card { width: min(520px, 100%); background: rgba(31, 41, 55, 0.95); border: 1px solid rgba(139, 92, 246, 0.35); border-radius: 16px; padding: 20px; }
                            h1 { margin: 0 0 8px; font-size: 24px; }
                            p { margin: 8px 0; color: #9ca3af; line-height: 1.5; }
                          </style>
                        </head>
                        <body>
                          <main class="card">
                            <h1>BOLH Security - Offline</h1>
                            <p>Offline mode is active on this device.</p>
                            <p>App will continue automatically when connection returns.</p>
                          </main>
                        </body>
                        </html>
                        """.trimIndent()
                    }
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { context ->
                            WebView(context).apply {
                                settings.javaScriptEnabled = true
                                settings.domStorageEnabled = true
                                settings.allowFileAccess = false
                                settings.allowContentAccess = false
                                settings.javaScriptCanOpenWindowsAutomatically = false
                                settings.setSupportMultipleWindows(false)
                                settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                    settings.safeBrowsingEnabled = true
                                }
                                settings.cacheMode = WebSettings.LOAD_NO_CACHE
                                clearCache(true)
                                webViewClient = object : WebViewClient() {
                                    var retryScheduled = false

                                    fun scheduleReconnect(view: WebView?) {
                                        val webView = view ?: return
                                        if (retryScheduled) return
                                        retryScheduled = true
                                        webView.postDelayed({
                                            retryScheduled = false
                                            webView.loadUrl(appUrl)
                                        }, 3000)
                                    }

                                    fun showOffline(view: WebView?) {
                                        view?.loadDataWithBaseURL(
                                            "https://offline.local/",
                                            offlineHtml,
                                            "text/html",
                                            "utf-8",
                                            null
                                        )
                                        scheduleReconnect(view)
                                    }

                                    override fun shouldOverrideUrlLoading(
                                        view: WebView?,
                                        request: WebResourceRequest?
                                    ): Boolean {
                                        val url = request?.url ?: return false
                                        val raw = url.toString()
                                        val isOfflineAsset = raw.startsWith("file:///android_asset/")
                                        val isLocalAppHost =
                                            (url.scheme == "http" || url.scheme == "https") &&
                                                    (url.host == "127.0.0.1" || url.host == "localhost")
                                        return !(isOfflineAsset || isLocalAppHost)
                                    }

                                    override fun onReceivedError(
                                        view: WebView?,
                                        request: WebResourceRequest?,
                                        error: WebResourceError?
                                    ) {
                                        if (request?.isForMainFrame == true) {
                                            showOffline(view)
                                        }
                                    }

                                    override fun onReceivedHttpError(
                                        view: WebView?,
                                        request: WebResourceRequest?,
                                        errorResponse: WebResourceResponse?
                                    ) {
                                        if (request?.isForMainFrame == true && (errorResponse?.statusCode ?: 200) >= 400) {
                                            showOffline(view)
                                        }
                                    }

                                    override fun onPageFinished(view: WebView?, url: String?) {
                                        super.onPageFinished(view, url)
                                        val loaded = url ?: return
                                        val isOfflinePage = loaded.startsWith("https://offline.local/")
                                        val isLocalAppPage =
                                            loaded.startsWith("http://127.0.0.1:3003") ||
                                                loaded.startsWith("http://localhost:3003")
                                        if (isOfflinePage) {
                                            scheduleReconnect(view)
                                        } else if (isLocalAppPage) {
                                            retryScheduled = false
                                        }
                                    }
                                }
                                webChromeClient = WebChromeClient()
                                loadUrl(appUrl)
                            }
                        }
                    )
                }
            }
        }
    }
}
