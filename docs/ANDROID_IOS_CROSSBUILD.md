 # Android / iOS cross-build for `bolh-core` (BOLH)

This document describes how to produce native artifacts of `crates/bolh-core` for Android and iOS targets and how to include them into the mobile app (Tauri / native bindings / JNI / Swift).

Prerequisites
- Rust toolchain with `rustup`.
- Android NDK (r21+ recommended) and `ndk-build`/`cargo-ndk` or `cross`.
- For iOS: macOS with Xcode and `cargo-lipo` / `cargo` with proper targets.

Android (recommended flow)
1. Install targets:
```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android
```

2. Install `cargo-ndk` (optional, simplifies builds):
```bash
cargo install cargo-ndk
```

3. Build release libraries for each ABI:
```bash
cd crates/bolh-core
# build for aarch64
cargo ndk -t aarch64-linux-android -o target/android -- cargo build --release
# build for armv7
cargo ndk -t armv7-linux-androideabi -o target/android -- cargo build --release
```

4. Artifacts: built `.so` files will appear under `target/android/<target>/release/` (e.g. `libbolh_core.so`).

5. Integrate into Android app:
- Place `.so` under `android/app/src/main/jniLibs/<abi>/libbolh_core.so` so Gradle packages them.
- Create a JNI wrapper in Java/Kotlin that loads the library with `System.loadLibrary("bolh_core")` and exposes native methods if needed. For our C ABI we can call functions via `JNI` using `System.loadLibrary` and `Native` methods or use `JNA`/`JNI` helper.

Example Gradle snippet to copy libs (app module `build.gradle`):
```groovy
android {
  sourceSets {
    main {
      jniLibs.srcDirs = ['src/main/jniLibs']
    }
  }
}
```

Notes on JNI
- Our `bolh-core` exports C functions. The simplest approach for apps is to create small JNI C/C++ glue that calls these C functions and declares corresponding `Java_native` functions. Alternatively use `Rust` to generate a JNI library directly.

iOS (recommended flow)
1. Targets to add:
```bash
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
```

2. Build with `cargo-lipo` to create a universal static library:
```bash
cargo install cargo-lipo
cd crates/bolh-core
cargo lipo --release
```

3. The produced `libbolh_core.a` can be linked into an Xcode project. Expose C ABI headers and call from Objective‑C/Swift.

General notes
- For Tauri desktop builds we already built `bolh_core.dll` for Windows; for Android/iOS we need platform libs and JNI/ObjC glue.
- Keep cryptographic primitives in Rust; avoid reimplementing in Java/Swift.
- CI: set up GitHub Actions matrix to build targets (linux, windows, macos, android targets via `react-native` or `cargo-ndk`, iOS on macOS runners).

Security and packaging
- Verify signatures/hashes of build artifacts in CI. Do not ship debug builds. Use `strip`/`opt` to reduce size.

If you want, I can add example build scripts (`build_android.sh`, `build_ios.sh`) and a sample JNI glue C file template. Tell me which to create next.
