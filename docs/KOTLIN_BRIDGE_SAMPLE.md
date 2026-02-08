# Kotlin bridge sample for BOLH (Android)

Place this Kotlin file into your Android module (e.g. `app/src/main/java/com/guardio/bolh/BolhNative.kt`). It calls the JNI functions exposed in `bolh_jni.c` and loads `libbolh_core.so`.

```kotlin
package com.guardio.bolh

object BolhNative {
    init { System.loadLibrary("bolh_core") }

    external fun bolhInit(): String
    external fun bolhCreateKey(): String
    external fun bolhSignTx(tx: String): String
    external fun bolhSubmitTx(signedTx: String): String
    external fun bolhGetBalance(addr: String): Long
}

// Example usage
// suspend fun useBolh() {
//   val init = withContext(Dispatchers.IO) { BolhNative.bolhInit() }
//   val key = withContext(Dispatchers.IO) { BolhNative.bolhCreateKey() }
// }
```

Notes:
- Ensure `libbolh_core.so` is bundled (jniLibs) or available at runtime. If you used a separate JNI glue library, also load it.
- Test on device/emulator matching ABI (arm64-v8a, armeabi-v7a) that you built.
