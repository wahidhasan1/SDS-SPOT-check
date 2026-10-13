import type { ExpoConfig } from 'expo/config';

/**
 * FluentPath mobile app (Android + iOS). Talks to the same API as the web app.
 * Set EXPO_PUBLIC_API_URL to your server, e.g. http://192.168.1.20:4000 or https://api.example.com
 */
const config: ExpoConfig = {
  name: 'FluentPath',
  slug: 'fluentpath',
  scheme: 'fluentpath',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  splash: { image: './assets/icon.png', resizeMode: 'contain', backgroundColor: '#1d4ed8' },
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'com.fluentpath.app',
    supportsTablet: true,
    infoPlist: {
      NSMicrophoneUsageDescription: 'FluentPath uses the microphone for voice practice calls and speaking exercises.',
      NSCameraUsageDescription: 'FluentPath uses the camera to photograph book pages so you can read them with word explanations.',
      NSPhotoLibraryUsageDescription: 'FluentPath lets you choose a photo of a book page to read.',
      NSSpeechRecognitionUsageDescription: 'FluentPath turns your spoken answers into text so you can review them.',
      UIBackgroundModes: ['audio', 'voip'],
    },
  },
  android: {
    package: 'com.fluentpath.app',
    adaptiveIcon: { foregroundImage: './assets/icon.png', backgroundColor: '#1d4ed8' },
    permissions: ['RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS', 'CAMERA', 'INTERNET', 'ACCESS_NETWORK_STATE', 'BLUETOOTH_CONNECT'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-audio', { microphonePermission: 'FluentPath uses the microphone for speaking practice.' }],
    ['expo-image-picker', { cameraPermission: 'FluentPath uses the camera to photograph book pages.', photosPermission: 'FluentPath lets you choose a photo of a book page.' }],
    ['expo-speech-recognition', { microphonePermission: 'FluentPath uses the microphone for speaking practice.', speechRecognitionPermission: 'FluentPath turns your spoken answers into text.' }],
    ['@config-plugins/react-native-webrtc', { microphonePermission: 'FluentPath uses the microphone for voice practice calls.' }],
    // Allow plain HTTP to a local development server. Use HTTPS in production.
    ['expo-build-properties', { android: { usesCleartextTraffic: true } }],
  ],
  experiments: { typedRoutes: false },
  extra: { apiUrl: process.env.EXPO_PUBLIC_API_URL ?? null },
};

export default config;
