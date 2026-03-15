plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.github.triplet.play")
}
android {
    namespace = "com.guardian.android"
    compileSdk = 35
    val debugApiBaseUrl = providers.gradleProperty("DEBUG_API_BASE_URL").orElse("http://10.0.2.2:8080").get()
    val releaseApiBaseUrl = providers.gradleProperty("RELEASE_API_BASE_URL").orElse("https://api.omnixius.com").get()
    val debugWebAppUrl = providers.gradleProperty("DEBUG_WEB_APP_URL").orElse("http://10.0.2.2:3003/").get()
    val releaseWebAppUrl = providers.gradleProperty("RELEASE_WEB_APP_URL").orElse("https://app.omnixius.com/").get()
    defaultConfig {
        applicationId = "com.omnixius.bolh487373a"
        minSdk = 26
        targetSdk = 35
        versionCode = 13
        versionName = "1.1.0-beta1"
        buildConfigField("String", "API_BASE_URL", "\"$releaseApiBaseUrl\"")
        buildConfigField("String", "WEB_APP_URL", "\"$releaseWebAppUrl\"")
    }
    signingConfigs {
        create("release") {
            val storeFilePath = providers.gradleProperty("RELEASE_STORE_FILE").orNull
            val storePasswordValue = providers.gradleProperty("RELEASE_STORE_PASSWORD").orNull
            val keyAliasValue = providers.gradleProperty("RELEASE_KEY_ALIAS").orNull
            val keyPasswordValue = providers.gradleProperty("RELEASE_KEY_PASSWORD").orNull

            if (
                !storeFilePath.isNullOrBlank() &&
                !storePasswordValue.isNullOrBlank() &&
                !keyAliasValue.isNullOrBlank() &&
                !keyPasswordValue.isNullOrBlank()
            ) {
                storeFile = rootProject.file(storeFilePath)
                storePassword = storePasswordValue
                keyAlias = keyAliasValue
                keyPassword = keyPasswordValue
            }
        }
    }
    val releaseSigningValues = mapOf(
        "RELEASE_STORE_FILE" to providers.gradleProperty("RELEASE_STORE_FILE").orNull,
        "RELEASE_STORE_PASSWORD" to providers.gradleProperty("RELEASE_STORE_PASSWORD").orNull,
        "RELEASE_KEY_ALIAS" to providers.gradleProperty("RELEASE_KEY_ALIAS").orNull,
        "RELEASE_KEY_PASSWORD" to providers.gradleProperty("RELEASE_KEY_PASSWORD").orNull
    )
    val missingReleaseSigningProps =
        releaseSigningValues.filterValues { it.isNullOrBlank() }.keys
    val isReleaseTaskRequested =
        gradle.startParameter.taskNames.any { task ->
            task.contains("Release", ignoreCase = true)
        }
    if (isReleaseTaskRequested && missingReleaseSigningProps.isNotEmpty()) {
        throw GradleException(
            "Missing release signing properties: ${missingReleaseSigningProps.joinToString(", ")}"
        )
    }
    buildTypes {
        getByName("debug") {
            buildConfigField("String", "API_BASE_URL", "\"$debugApiBaseUrl\"")
            buildConfigField("String", "WEB_APP_URL", "\"$debugWebAppUrl\"")
            manifestPlaceholders["usesCleartextTraffic"] = "true"
        }
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
            buildConfigField("String", "API_BASE_URL", "\"$releaseApiBaseUrl\"")
            buildConfigField("String", "WEB_APP_URL", "\"$releaseWebAppUrl\"")
            manifestPlaceholders["usesCleartextTraffic"] = "false"
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf("-opt-in=androidx.compose.material3.ExperimentalMaterial3Api")
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.5"
    }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.01.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.json:json:20240303")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

play {
    val serviceAccountFile =
        providers.gradleProperty("PLAY_SERVICE_ACCOUNT_FILE")
            .orElse("keys/play-service-account.json")
            .get()
    val releaseTrack =
        providers.gradleProperty("PLAY_TRACK")
            .orElse("internal")
            .get()
    serviceAccountCredentials.set(rootProject.file(serviceAccountFile))
    track.set(releaseTrack)
    defaultToAppBundles.set(true)
}
