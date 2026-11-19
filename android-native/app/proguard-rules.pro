# GamePlay Live — keep WebView bridge + RootEncoder / AdMob entry points
-keepclassmembers class app.gameplaylive.stream.WebAppInterface {
  @android.webkit.JavascriptInterface <methods>;
}
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.android.ump.** { *; }
