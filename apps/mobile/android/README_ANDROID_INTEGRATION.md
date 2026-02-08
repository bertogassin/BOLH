# Android integration (auto-include native libs)

This shows a minimal Gradle snippet and packaging approach to automatically include `libbolh_core.so` and the JNI glue library into the Android APK.

1) Place built native artifacts into `app/src/main/jniLibs/<abi>/`:

```
app/src/main/jniLibs/arm64-v8a/libbolh_core.so
app/src/main/jniLibs/armeabi-v7a/libbolh_core.so
app/src/main/jniLibs/arm64-v8a/libbolh_jni.so
```

2) Gradle snippet (module `app/build.gradle`):

```groovy
android {
  sourceSets {
    main {
      jniLibs.srcDirs = ['src/main/jniLibs']
    }
  }
}

// Optional task to copy built libraries from repository build output
task copyNativeLibs(type: Copy) {
    def out = project(':')
    from("${rootDir}/crates/bolh-core/target/android/aarch64-linux-android/release") {
        include 'libbolh_core.so'
        into 'arm64-v8a'
    }
    into "$projectDir/src/main/jniLibs"
}

preBuild.dependsOn copyNativeLibs
```

3) Build sequence (developer):
- Build Rust libs (`crates/bolh-core/build_android.sh`).
- Run Android Gradle build (assembleDebug / installDebug). The `copyNativeLibs` task will copy `.so` into `jniLibs`.
