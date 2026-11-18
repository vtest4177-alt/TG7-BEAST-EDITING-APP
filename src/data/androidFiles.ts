export interface AndroidFileSnippet {
  id: string;
  filename: string;
  path: string;
  language: string;
  summary: string;
  content: string;
}

export const ANDROID_OVERLAY_FILES: AndroidFileSnippet[] = [
  {
    id: 'workflow',
    filename: 'build-apk.yml',
    path: '.github/workflows/build-apk.yml',
    language: 'yaml',
    summary: 'Automatically compiles TG7-Editor-com.tg7.editor-debug.apk on GitHub Actions whenever you push.',
    content: `name: Build TG7 Editor APK
on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build-tg7-apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - uses: android-actions/setup-android@v3
      - run: git clone --depth 1 https://github.com/tharunbirla/LibreCuts.git librecuts-build
      - run: python3 android-tg7/apply_tg7_overlay.py librecuts-build android-tg7
      - uses: gradle/actions/setup-gradle@v4
      - working-directory: librecuts-build
        run: chmod +x gradlew && ./gradlew assembleDebug --no-daemon`,
  },
  {
    id: 'manifest',
    filename: 'AndroidManifest.xml',
    path: 'android-tg7/AndroidManifest.xml',
    language: 'xml',
    summary: 'Updated label (@string/app_name), hardware acceleration, largeHeap, Android 13+ media permissions, and FileProvider authority.',
    content: `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />

    <application
        android:hardwareAccelerated="true"
        android:label="@string/app_name"
        android:largeHeap="true"
        android:theme="@style/Theme.TG7Editor">
        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true" />
    </application>
</manifest>`,
  },
  {
    id: 'strings',
    filename: 'strings.xml',
    path: 'android-tg7/strings.xml',
    language: 'xml',
    summary: 'Sets Android launcher app name to TG7 Editor.',
    content: `<resources>
    <string name="app_name">TG7 Editor</string>
    <string name="tg7_tagline">Multi-Track &amp; Keyframe Studio</string>
    <string name="tg7_export_cta">Export 4K</string>
</resources>`,
  },
  {
    id: 'themes',
    filename: 'themes.xml & colors.xml',
    path: 'android-tg7/themes.xml',
    language: 'xml',
    summary: 'Material3 Dark NoActionBar Black (#060608) and Neon Crimson Red (#FF1E38) gamer theme.',
    content: `<resources>
    <color name="tg7_pitch_black">#060608</color>
    <color name="tg7_carbon_surface">#101015</color>
    <color name="tg7_neon_red">#FF1E38</color>
    <color name="tg7_hyper_red">#FF4D64</color>

    <style name="Theme.TG7Editor" parent="Theme.Material3.Dark.NoActionBar">
        <item name="colorPrimary">@color/tg7_neon_red</item>
        <item name="android:colorBackground">@color/tg7_pitch_black</item>
        <item name="colorSurface">@color/tg7_carbon_surface</item>
        <item name="android:statusBarColor">@color/tg7_pitch_black</item>
        <item name="android:navigationBarColor">@color/tg7_pitch_black</item>
    </style>
</resources>`,
  },
];
