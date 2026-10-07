import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    // AGP 9 ships built-in Kotlin support, so org.jetbrains.kotlin.android is not applied.
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.example.hapticlab"
    compileSdk = 37

    defaultConfig {
        // Permanent Play Store identifier. "com.example.*" is rejected by Google Play.
        applicationId = "io.github.visionmonkey.vibrationdex"
        // API 26: VibrationEffect + amplitude waveforms.
        // API 30/31: Composition primitives. API 36: envelope effects. All gated at runtime.
        minSdk = 26
        targetSdk = 37
        // CI passes the workflow run number so every uploaded build has a higher versionCode.
        versionCode = providers.environmentVariable("VERSION_CODE").orNull?.toInt() ?: 1
        versionName = "1.0.$versionCode"
    }

    // Upload key for Google Play, supplied by CI secrets or local environment variables.
    // Without them the release build is produced unsigned (useful only to validate R8).
    val uploadKeystore = providers.environmentVariable("UPLOAD_KEYSTORE_FILE").orNull
    signingConfigs {
        if (uploadKeystore != null) {
            create("upload") {
                storeFile = file(uploadKeystore)
                storePassword = providers.environmentVariable("UPLOAD_KEYSTORE_PASSWORD").get()
                keyAlias = providers.environmentVariable("UPLOAD_KEY_ALIAS").get()
                keyPassword = providers.environmentVariable("UPLOAD_KEY_PASSWORD").get()
            }
        }
    }

    buildTypes {
        release {
            if (uploadKeystore != null) signingConfig = signingConfigs.getByName("upload")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = false
        aidl = false
        resValues = false
        shaders = false
    }

    lint {
        abortOnError = true
        warningsAsErrors = false
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_17
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.kotlinx.coroutines.android)
    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit)
}
