package com.guardian.android

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Log
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
    companion object {
        private const val TAG = "GuardianWebView"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i(TAG, "MainActivity created")
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
                            .actions { display: flex; gap: 10px; margin-top: 16px; }
                            button {
                              border: 1px solid rgba(139, 92, 246, 0.55);
                              background: #111827;
                              color: #f9fafb;
                              border-radius: 10px;
                              padding: 10px 14px;
                              font-size: 14px;
                            }
                          </style>
                        </head>
                        <body>
                          <main class="card">
                            <h1>BOLH Security - Offline</h1>
                            <p>Offline mode is active on this device.</p>
                            <p>App will continue automatically when connection returns.</p>
                            <div class="actions">
                              <button onclick="window.location.href='http://127.0.0.1:3003/'">Retry now</button>
                            </div>
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
                                // Keep cache enabled so previously loaded web assets can still render offline.
                                settings.cacheMode = WebSettings.LOAD_DEFAULT
                                webViewClient = object : WebViewClient() {
                                    var retryScheduled = false
                                    var mainFrameFailed = false

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
                                        Log.w(TAG, "showOffline: loading embedded offline page")
                                        mainFrameFailed = true
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
                                            mainFrameFailed = true
                                            Log.w(
                                                TAG,
                                                "onReceivedError mainFrame code=${error?.errorCode} desc=${error?.description}"
                                            )
                                            showOffline(view)
                                        }
                                    }

                                    override fun onReceivedHttpError(
                                        view: WebView?,
                                        request: WebResourceRequest?,
                                        errorResponse: WebResourceResponse?
                                    ) {
                                        if (request?.isForMainFrame == true && (errorResponse?.statusCode ?: 200) >= 400) {
                                            mainFrameFailed = true
                                            Log.w(
                                                TAG,
                                                "onReceivedHttpError mainFrame status=${errorResponse?.statusCode}"
                                            )
                                            showOffline(view)
                                        }
                                    }

                                    override fun onPageFinished(view: WebView?, url: String?) {
                                        super.onPageFinished(view, url)
                                        val loaded = url ?: return
                                        Log.i(TAG, "onPageFinished url=$loaded")
                                        val isOfflinePage = loaded.startsWith("https://offline.local/")
                                        val isLocalAppPage =
                                            loaded.startsWith("http://127.0.0.1:3003") ||
                                                loaded.startsWith("http://localhost:3003")
                                        if (isOfflinePage) {
                                            Log.i(TAG, "onPageFinished: offline page active, schedule reconnect")
                                            scheduleReconnect(view)
                                        } else if (isLocalAppPage && !mainFrameFailed) {
                                            Log.i(TAG, "onPageFinished: app page active")
                                            retryScheduled = false
                                        }
                                    }

                                    override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                                        super.onPageStarted(view, url, favicon)
                                        val started = url ?: return
                                        if (
                                            started.startsWith("http://127.0.0.1:3003") ||
                                            started.startsWith("http://localhost:3003")
                                        ) {
                                            mainFrameFailed = false
                                        }
                                    }
                                }
                                webChromeClient = WebChromeClient()
                                Log.i(TAG, "WebView loading appUrl=$appUrl")
                                loadUrl(appUrl)
                            }
                        }
                    )
                }
            }
        }
    }
}
