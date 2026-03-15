package com.guardian.android

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.content.Context
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.guardian.android.ui.theme.GuardianTheme
import java.util.Locale

class MainActivity : ComponentActivity() {
    companion object {
        private const val TAG = "GuardianWebView"
    }

    private fun parseAppUri(): Uri {
        val parsed = Uri.parse(BuildConfig.WEB_APP_URL)
        require(!parsed.scheme.isNullOrBlank()) { "WEB_APP_URL must include scheme" }
        require(!parsed.host.isNullOrBlank()) { "WEB_APP_URL must include host" }
        return parsed
    }

    private fun isLocalHost(host: String?): Boolean {
        return host == "127.0.0.1" || host == "localhost" || host == "10.0.2.2"
    }

    private fun isNetworkAvailable(context: Context): Boolean {
        val connectivityManager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return false
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun parseCssColor(valueFromJs: String?): Int? {
        if (valueFromJs.isNullOrBlank()) return null
        val raw = valueFromJs.trim().trim('"').lowercase(Locale.US)
        if (raw.isBlank() || raw == "null") return null
        if (raw.startsWith("#")) {
            return runCatching { Color.parseColor(raw) }.getOrNull()
        }
        if (raw.startsWith("rgb(") && raw.endsWith(")")) {
            val parts = raw.removePrefix("rgb(").removeSuffix(")").split(",")
            if (parts.size == 3) {
                val r = parts[0].trim().toIntOrNull() ?: return null
                val g = parts[1].trim().toIntOrNull() ?: return null
                val b = parts[2].trim().toIntOrNull() ?: return null
                return Color.rgb(r.coerceIn(0, 255), g.coerceIn(0, 255), b.coerceIn(0, 255))
            }
        }
        if (raw.startsWith("rgba(") && raw.endsWith(")")) {
            val parts = raw.removePrefix("rgba(").removeSuffix(")").split(",")
            if (parts.size >= 3) {
                val r = parts[0].trim().toIntOrNull() ?: return null
                val g = parts[1].trim().toIntOrNull() ?: return null
                val b = parts[2].trim().toIntOrNull() ?: return null
                return Color.rgb(r.coerceIn(0, 255), g.coerceIn(0, 255), b.coerceIn(0, 255))
            }
        }
        return null
    }

    private fun isLightColor(color: Int): Boolean {
        val r = Color.red(color)
        val g = Color.green(color)
        val b = Color.blue(color)
        // Relative luminance threshold tuned for status bar icon contrast.
        val luminance = (0.299 * r + 0.587 * g + 0.114 * b)
        return luminance > 170
    }

    private fun syncStatusBarWithPage(webView: WebView?) {
        val view = webView ?: return
        val script = """
            (function () {
              try {
                var body = document.body;
                var html = document.documentElement;
                var c1 = body ? window.getComputedStyle(body).backgroundColor : '';
                var c2 = html ? window.getComputedStyle(html).backgroundColor : '';
                return c1 || c2 || '';
              } catch (e) {
                return '';
              }
            })();
        """.trimIndent()
        view.evaluateJavascript(script) { result ->
            val color = parseCssColor(result) ?: Color.BLACK
            window.statusBarColor = color
            WindowInsetsControllerCompat(window, window.decorView).apply {
                // true => dark icons (for light background), false => light icons (for dark background)
                isAppearanceLightStatusBars = isLightColor(color)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Install the splash screen before super.onCreate so the system transition is smooth.
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        Log.i(TAG, "MainActivity created")

        // Fade + scale-down exit animation for the splash screen.
        splashScreen.setOnExitAnimationListener { splashScreenView ->
            val scaleX = ObjectAnimator.ofFloat(splashScreenView.view, View.SCALE_X, 1f, 0.85f)
            val scaleY = ObjectAnimator.ofFloat(splashScreenView.view, View.SCALE_Y, 1f, 0.85f)
            val alpha = ObjectAnimator.ofFloat(splashScreenView.view, View.ALPHA, 1f, 0f)
            AnimatorSet().apply {
                playTogether(scaleX, scaleY, alpha)
                duration = 350L
                interpolator = AccelerateDecelerateInterpolator()
                addListener(object : AnimatorListenerAdapter() {
                    override fun onAnimationEnd(animation: Animator) {
                        splashScreenView.remove()
                    }
                })
                start()
            }
        }

        val brandDark = ContextCompat.getColor(this, R.color.bolh_dark_bg)
        window.statusBarColor = brandDark
        window.navigationBarColor = brandDark
        // Keep default fit behavior so bottom system area remains stable.
        WindowCompat.setDecorFitsSystemWindows(window, true)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        setContent {
            GuardianTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val appUri = remember { parseAppUri() }
                    val appUrl = remember { appUri.toString() }
                    val appHost = remember { appUri.host }
                    val appPort = remember { appUri.port }
                    val appScheme = remember { appUri.scheme }
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
                            .retry-link {
                              display: inline-block;
                              text-decoration: none;
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
                            <p>The app opens in offline mode and keeps local access to basic screens.</p>
                            <div class="actions">
                              <a id="retryLink" class="retry-link" href="$appUrl">Retry now</a>
                            </div>
                          </main>
                          <script>
                            (function () {
                              var link = document.getElementById('retryLink');
                              if (!link) return;
                              link.addEventListener('click', function (e) {
                                if (window.BOLH && window.BOLH.retryOnline) {
                                  e.preventDefault();
                                  window.BOLH.retryOnline();
                                }
                              });
                            })();
                          </script>
                        </body>
                        </html>
                        """.trimIndent()
                    }
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { context ->
                            WebView(context).apply {
                                class OfflineBridge {
                                    @JavascriptInterface
                                    fun retryOnline() {
                                        post {
                                            Toast.makeText(
                                                context,
                                                "Trying to reconnect...",
                                                Toast.LENGTH_SHORT
                                            ).show()
                                            Log.i(TAG, "Offline retry tapped: loading appUrl=$appUrl")
                                            loadUrl(appUrl)
                                        }
                                    }
                                }

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
                                addJavascriptInterface(OfflineBridge(), "BOLH")
                                // Keep cache enabled so previously loaded web assets can still render offline.
                                settings.cacheMode = WebSettings.LOAD_DEFAULT
                                webViewClient = object : WebViewClient() {
                                    var mainFrameFailed = false

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
                                    }

                                    override fun shouldOverrideUrlLoading(
                                        view: WebView?,
                                        request: WebResourceRequest?
                                    ): Boolean {
                                        val url = request?.url ?: return false
                                        val raw = url.toString().trim()
                                        val requestHost = url.host
                                        val requestScheme = url.scheme
                                        val requestPort = url.port
                                        val isOfflineAsset = raw.startsWith("file:///android_asset/")
                                        val sameConfiguredOrigin =
                                            requestScheme == appScheme &&
                                                requestHost == appHost &&
                                                requestPort == appPort
                                        val isDebugLocalOrigin =
                                            BuildConfig.DEBUG &&
                                                (requestScheme == "http" || requestScheme == "https") &&
                                                isLocalHost(requestHost)
                                        val isAppHost = sameConfiguredOrigin || isDebugLocalOrigin
                                        return !(isOfflineAsset || isAppHost)
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
                                        val loadedUri = Uri.parse(loaded)
                                        Log.i(TAG, "onPageFinished url=$loaded")
                                        syncStatusBarWithPage(view)
                                        val isOfflinePage = loaded.startsWith("https://offline.local/")
                                        val isAppPage =
                                            loadedUri.scheme == appScheme &&
                                                loadedUri.host == appHost &&
                                                loadedUri.port == appPort
                                        if (isOfflinePage) {
                                            Log.i(TAG, "onPageFinished: offline page active")
                                        } else if (isAppPage && !mainFrameFailed) {
                                            Log.i(TAG, "onPageFinished: app page active")
                                        }
                                    }

                                    override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                                        super.onPageStarted(view, url, favicon)
                                        val started = url ?: return
                                        val startedUri = Uri.parse(started)
                                        val isAppPage =
                                            startedUri.scheme == appScheme &&
                                                startedUri.host == appHost &&
                                                startedUri.port == appPort
                                        if (isAppPage) {
                                            mainFrameFailed = false
                                        }
                                    }
                                }
                                webChromeClient = WebChromeClient()
                                val shouldStartOffline = !isNetworkAvailable(context)
                                if (shouldStartOffline) {
                                    Log.i(TAG, "No network detected: opening offline page immediately")
                                    loadDataWithBaseURL(
                                        "https://offline.local/",
                                        offlineHtml,
                                        "text/html",
                                        "utf-8",
                                        null
                                    )
                                } else {
                                    Log.i(TAG, "WebView loading appUrl=$appUrl")
                                    loadUrl(appUrl)
                                }
                            }
                        }
                    )
                }
            }
        }
    }
}
