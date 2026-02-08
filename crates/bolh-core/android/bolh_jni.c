// Minimal JNI glue that forwards to bolh_core C ABI
#include <jni.h>
#include <stdio.h>
#include <stdlib.h>

// C ABI from bolh_core
extern const char* bolh_init(void);
extern const char* bolh_create_key(void);
extern const char* bolh_sign_tx(const char* tx);
extern const char* bolh_submit_tx(const char* signed_tx);
extern unsigned long bolh_get_balance(const char* addr);
extern void bolh_free(char* ptr);

// JNI wrapper functions
JNIEXPORT jstring JNICALL Java_com_guardio_bolh_BolhNative_bolhInit(JNIEnv* env, jclass cls) {
    const char* r = bolh_init();
    if (!r) return NULL;
    jstring s = (*env)->NewStringUTF(env, r);
    return s;
}

JNIEXPORT jstring JNICALL Java_com_guardio_bolh_BolhNative_bolhCreateKey(JNIEnv* env, jclass cls) {
    const char* r = bolh_create_key();
    if (!r) return NULL;
    jstring s = (*env)->NewStringUTF(env, r);
    return s;
}

JNIEXPORT jstring JNICALL Java_com_guardio_bolh_BolhNative_bolhSignTx(JNIEnv* env, jclass cls, jstring tx) {
    const char* c_tx = (*env)->GetStringUTFChars(env, tx, 0);
    const char* r = bolh_sign_tx(c_tx);
    jstring s = NULL;
    if (r) s = (*env)->NewStringUTF(env, r);
    (*env)->ReleaseStringUTFChars(env, tx, c_tx);
    return s;
}

JNIEXPORT jstring JNICALL Java_com_guardio_bolh_BolhNative_bolhSubmitTx(JNIEnv* env, jclass cls, jstring signedTx) {
    const char* c_tx = (*env)->GetStringUTFChars(env, signedTx, 0);
    const char* r = bolh_submit_tx(c_tx);
    jstring s = NULL;
    if (r) s = (*env)->NewStringUTF(env, r);
    (*env)->ReleaseStringUTFChars(env, signedTx, c_tx);
    return s;
}

JNIEXPORT jlong JNICALL Java_com_guardio_bolh_BolhNative_bolhGetBalance(JNIEnv* env, jclass cls, jstring addr) {
    const char* c_addr = (*env)->GetStringUTFChars(env, addr, 0);
    unsigned long b = bolh_get_balance(c_addr);
    (*env)->ReleaseStringUTFChars(env, addr, c_addr);
    return (jlong)b;
}
