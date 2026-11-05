// App variant — lets a development build sit next to the production app on the
// SAME device by giving it a distinct applicationId/bundleId + name. Build the
// dev variant with `APP_VARIANT=development` (e.g.
// `APP_VARIANT=development npx expo run:android`); production is the default.
const IS_DEV_VARIANT = process.env.APP_VARIANT === 'development';
const APP_ID = IS_DEV_VARIANT ? 'so.oxy.inbox.dev' : 'so.oxy.inbox';
const APP_NAME = IS_DEV_VARIANT ? 'Inbox (Dev)' : 'Inbox by Oxy';

module.exports = {
  expo: {
    name: APP_NAME,
    slug: 'inbox',
    // The OTA compatibility boundary (withOxyUpdates, runtime policy
    // `appVersion`) and the source of the derived store build number
    // (@oxy.so/app-preset: 1.2.3 → 1002003). Bump it for any native change: the
    // next push to main releases a new Android binary (`android-release.yml`).
    version: '1.1.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'inbox',
    userInterfaceStyle: 'automatic',
    android: {
      adaptiveIcon: {
        backgroundColor: '#FFFFFF',
        foregroundImage: './assets/images/adaptive-icon-foreground.png',
        backgroundImage: './assets/images/adaptive-icon-background.png',
      },
      softwareKeyboardLayoutMode: 'resize',
      package: APP_ID,
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: APP_ID,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      ['expo-router', { asyncRoutes: { web: false } }],
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            useLegacyPackaging: true,
            gifEnabled: false,
            webpEnabled: false,
          },
        },
      ],
      'expo-font',
      'expo-image',
      'expo-secure-store',
      'expo-sharing',
      'expo-web-browser',
      ['expo-audio', { enableBackgroundPlayback: false }],
      [
        'react-native-audio-api',
        {
          iosMicrophonePermission: 'Allow Inbox to hear what you dictate and say to Alia.',
          iosBackgroundMode: false,
          androidForegroundService: false,
          androidPermissions: ['android.permission.RECORD_AUDIO'],
        },
      ],
      'expo-status-bar',
      '@oxy.so/services/plugins/withOxySharedPermissions',
      [
        '@oxy.so/app-preset/plugin/withOxyUpdates',
        { clientId: 'oxy_dk_7eea1de1d919060dcf9f2d65aeee84c98dddfeab8fd03582' },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '',
      },
    },
    owner: 'oxyhq',
  },
};
