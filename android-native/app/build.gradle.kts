import java.util.Properties

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
  keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}

android {
  namespace = "app.gameplaylive.stream"
  compileSdk = 36

  defaultConfig {
    applicationId = "app.gameplaylive"
    minSdk = 26
    targetSdk = 36
    versionCode = 2
    versionName = "1.0.1"
  }

  signingConfigs {
    if (keystorePropertiesFile.exists()) {
      create("release") {
        storeFile = file(keystoreProperties["storeFile"] as String)
        storePassword = keystoreProperties["storePassword"] as String
        keyAlias = keystoreProperties["keyAlias"] as String
        keyPassword = keystoreProperties["keyPassword"] as String
      }
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro"
      )
      if (keystorePropertiesFile.exists()) {
        signingConfig = signingConfigs.getByName("release")
      }
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions {
    jvmTarget = "17"
  }
}

dependencies {
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.core:core-ktx:1.15.0")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

  // AdMob — native banners for the Android shell (web uses AdSense)
  implementation("com.google.android.gms:play-services-ads:23.6.0")
  // UMP — GDPR/EEA/UK consent before requesting ads
  implementation("com.google.android.ump:user-messaging-platform:3.1.0")

  // Native RTMP / MediaProjection Go Live removed for Play (no FGS declaration).
  // Re-add RootEncoder + ScreenStreamService when shipping phone screen capture again.
}
