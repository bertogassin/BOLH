# Android JNI example for `bolh_core`

This document shows a minimal JNI C glue file and a Kotlin wrapper to call the `bolh_core` C ABI from Android.

1) Build `.so` for Android ABIs (see `crates/bolh-core/build_android.sh`). Place produced `libbolh_core.so` into `app/src/main/jniLibs/<abi>/` so Gradle packages it.

2) Minimal JNI C glue (example): place under `android/jni/bolh_jni.c` and compile with the NDK if you prefer C glue; alternatively include as part of an Android native module.

```c
// bolh_jni.c - minimal JNI glue
#include <jni.h>
#include <stdio.h>
#include <stdlib.h>

// declare C ABI from bolh_core
extern const char* bolh_init(void);
extern const char* bolh_create_key(void);
extern const char* bolh_sign_tx(const char* tx);
extern const char* bolh_submit_tx(const char* signed_tx);
extern unsigned long bolh_get_balance(const char* addr);
extern void bolh_free(char* ptr);

// Package: com.guardio.bolh.BolhNative
JNIEXPORT jstring JNICALL Java_com_guardio_bolh_BolhNative_bolhInit(JNIEnv* env, jclass cls) {
    const char* r = bolh_init();
    jstring s = (*env)->NewStringUTF(env, r);
    // library may own string; if API returns heap ptr provide free API
    return s;
}

JNIEXPORT jstring JNICALL Java_com_guardio_bolh_BolhNative_bolhCreateKey(JNIEnv* env, jclass cls) {
    const char* r = bolh_create_key();
    jstring s = (*env)->NewStringUTF(env, r);
    return s;
}

JNIEXPORT jstring JNICALL Java_com_guardio_bolh_BolhNative_bolhSignTx(JNIEnv* env, jclass cls, jstring tx) {
    const char* c_tx = (*env)->GetStringUTFChars(env, tx, 0);
    const char* r = bolh_sign_tx(c_tx);
    jstring s = (*env)->NewStringUTF(env, r);
    (*env)->ReleaseStringUTFChars(env, tx, c_tx);
    return s;
}

JNIEXPORT jstring JNICALL Java_com_guardio_bolh_BolhNative_bolhSubmitTx(JNIEnv* env, jclass cls, jstring signedTx) {
    const char* c_tx = (*env)->GetStringUTFChars(env, signedTx, 0);
    const char* r = bolh_submit_tx(c_tx);
    jstring s = (*env)->NewStringUTF(env, r);
    (*env)->ReleaseStringUTFChars(env, signedTx, c_tx);
    return s;
}

JNIEXPORT jlong JNICALL Java_com_guardio_bolh_BolhNative_bolhGetBalance(JNIEnv* env, jclass cls, jstring addr) {
    const char* c_addr = (*env)->GetStringUTFChars(env, addr, 0);
    unsigned long b = bolh_get_balance(c_addr);
    (*env)->ReleaseStringUTFChars(env, addr, c_addr);
    return (jlong)b;
}

```

3) Kotlin wrapper example (call native methods):

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

// Usage in Kotlin coroutine
// val init = BolhNative.bolhInit()
// val pk = BolhNative.bolhCreateKey()

```

Notes:
- Ensure `libbolh_core.so` is visible to the app (jniLibs) or bundled by Gradle. If you compile JNI glue into a separate native library, it should link against `libbolh_core.so`.
- The example assumes `bolh_core` exports the simple C ABI created earlier. In production handle errors, NULL checks and memory ownership carefully.
