import 'dotenv/config';

export default {
  "expo": {
    "name": "RevyndApp",
    "slug": "RevyndApp",
    "scheme": "revynd",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.jemturk.revynd"
    },
    "android": {
      "package": "com.revynd", // 👈 Consolidated your unique branding package name here
      "kotlinVersion": "1.9.24",       // 👈 Brought your custom kotlin engine target inside the bundle
      "edgeToEdgeEnabled": true,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "permissions": [                 // 👈 CRITICAL: Force-opens Android external network access paths
        "INTERNET"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "@rnmapbox/maps",
        {
          "RNMapboxMapsVersion": "11.18.2",
          "MAPBOX_DOWNLOADS_TOKEN": process.env.MAPBOX_DOWNLOAD_TOKEN,
          "RNMapboxMapsAccessToken": process.env.MAPBOX_PUBLIC_TOKEN
        }
      ],
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "Allow Revynd to find local spots near you."
        }
      ]
    ],
    "extra": {
      "mapboxPublicToken": process.env.MAPBOX_PUBLIC_TOKEN
    }
  }
};