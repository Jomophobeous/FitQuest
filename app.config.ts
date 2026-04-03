import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Dual-profile Expo config.
 *
 * FITQUEST_DEV_CLIENT=1  → Dev Client build: adds native plugins + expo-dev-client
 * (unset or 0)           → Expo Go (default): no native plugins, no runtimeVersion
 *
 * Usage:
 *   npm run go           # start Expo Go server
 *   npm run dev:android  # prebuild + run native Android dev client
 */

const IS_DEV_CLIENT = process.env.FITQUEST_DEV_CLIENT === '1';
const APP_ENV = process.env.EXPO_PUBLIC_ENV || (__DEV__ ? 'development' : 'production');

export default ({ config: _config }: ConfigContext): ExpoConfig => {
  // ── Plugins common to both profiles ──
  const basePlugins: ExpoConfig['plugins'] = [
    'expo-router',
    'expo-notifications',
    'expo-updates',
    'expo-location',
    './plugins/withAndroidAaptOptions',
    // '@maplibre/maplibre-react-native', // REMOVED: v10.4.2 incompatible with New Architecture (Bridgeless) — causes fatal ReactNativeHost crash
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 26,
        },
      },
    ],
    // Health Connect plugin — always included since we do native APK builds
    [
      'react-native-health-connect',
      {
        requestPermissionsOnFirstLaunch: false,
      },
    ],
    // Sentry crash reporting — always included for native builds
    [
      '@sentry/react-native',
      {
        organization: 'fitquest-x4',
        project: 'react-native',
      },
    ],
  ];

  // ── Native-only plugins (require dev-client build) ──
  const nativePlugins: ExpoConfig['plugins'] = IS_DEV_CLIENT ? [] : [];

  return {
    name: 'FitQuest',
    slug: 'fitquest',
    version: '1.0.0',
    sdkVersion: '55.0.0',

    // runtimeVersion required for EAS Update on all build profiles
    runtimeVersion: { policy: 'appVersion' as const },

    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',

    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0B0B0F',
    },

    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.hugelet.fitquest',
      buildNumber: '2',
      infoPlist: {
        NSCameraUsageDescription: 'FitQuest needs camera access to capture progress photos and profile pictures.',
        NSPhotoLibraryUsageDescription:
          'FitQuest needs photo library access to select profile pictures and import documents.',
        NSLocationWhenInUseUsageDescription: 'FitQuest uses your location to track jog routes and estimate distance.',
        NSMotionUsageDescription: 'FitQuest uses motion sensors to count steps and track workout movements.',
        NSFaceIDUsageDescription: 'FitQuest uses Face ID to securely protect your health data and app access.',
        // Health permissions for dev-client only
        ...(IS_DEV_CLIENT && {
          NSHealthShareUsageDescription:
            'FitQuest reads your health data to provide personalised workout and recovery insights.',
          NSHealthUpdateUsageDescription:
            'FitQuest writes workout data to Apple Health so your activity stays in sync.',
        }),
      },
    },

    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0B0B0F',
      },
      package: 'com.hugelet.fitquest',
      permissions: [
        'CAMERA',
        'NOTIFICATIONS',
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACTIVITY_RECOGNITION',
        'com.android.vending.BILLING',
        // Health Connect permissions — always included for native builds
        'android.permission.health.READ_STEPS',
        'android.permission.health.READ_DISTANCE',
        'android.permission.health.READ_TOTAL_CALORIES_BURNED',
        'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
        'android.permission.health.READ_HEART_RATE',
        'android.permission.health.READ_SLEEP',
        'android.permission.health.READ_EXERCISE',
        'android.permission.health.READ_WEIGHT',
        'android.permission.health.READ_HEIGHT',
        'android.permission.health.READ_BODY_FAT_PERCENTAGE',
        'android.permission.health.READ_BLOOD_PRESSURE',
        'android.permission.health.READ_BLOOD_GLUCOSE',
        'android.permission.health.WRITE_STEPS',
        'android.permission.health.WRITE_DISTANCE',
        'android.permission.health.WRITE_TOTAL_CALORIES_BURNED',
        'android.permission.health.WRITE_ACTIVE_CALORIES_BURNED',
        'android.permission.health.WRITE_HEART_RATE',
        'android.permission.health.WRITE_SLEEP',
        'android.permission.health.WRITE_EXERCISE',
        'android.permission.health.WRITE_WEIGHT',
      ],
    },

    web: {
      favicon: './assets/favicon.png',
    },

    updates: {
      enabled: true,
      checkAutomatically: 'ON_LOAD' as const,
      fallbackToCacheTimeout: 5000,
      url: 'https://u.expo.dev/5952667d-bab3-4bce-9cb0-be0106c98d01',
    },

    extra: {
      eas: {
        projectId: '5952667d-bab3-4bce-9cb0-be0106c98d01',
      },
      legal: {
        privacyPolicyUrl: 'https://fitquest.app/privacy',
        termsOfServiceUrl: 'https://fitquest.app/terms',
      },
      profile: IS_DEV_CLIENT ? 'dev' : 'go',
      appEnv: APP_ENV,
    },

    owner: 'hugelet',
    scheme: 'fitquest',

    plugins: [...basePlugins, ...nativePlugins],
  };
};
