const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Wires the Play Store upload keystore into the generated android/app/build.gradle.
 * Set MYAPP_UPLOAD_* in %USERPROFILE%\.gradle\gradle.properties so secrets never
 * live in the repo and survive `expo prebuild` (which regenerates /android).
 */
function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let src = mod.modResults.contents;
    if (src.includes('MYAPP_UPLOAD_STORE_FILE')) {
      return mod;
    }

    src = src.replace(
      `storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`,
      `storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
    }`
    );

    src = src.replace(
      `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`,
      `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.release`
    );

    mod.modResults.contents = src;
    return mod;
  });
}

module.exports = withAndroidReleaseSigning;
