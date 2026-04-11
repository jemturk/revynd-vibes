import 'dotenv/config';

export default {
  android: {
    package: "com.jemturk.revynd", // Change this to your preferred unique name
    kotlinVersion: "1.9.24",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    }
  },
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
      "bundleIdentifier": "com.anonymous.RevyndApp"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "package": "com.anonymous.RevyndApp"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
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
    extra: {
      mapboxPublicToken: process.env.MAPBOX_PUBLIC_TOKEN
    }
  }
};
