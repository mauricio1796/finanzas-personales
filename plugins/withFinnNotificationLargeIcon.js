/**
 * Config plugin: logo de Finn a color como "ícono grande" de las notificaciones
 * en Android.
 *
 * expo-notifications ya lee el meta-data `expo.modules.notifications.large_notification_icon`
 * (ExpoNotificationBuilder.largeIcon), pero su plugin todavía no lo expone. Este
 * plugin copia el PNG a res/drawable-nodpi y declara el meta-data en el manifest.
 *
 * Uso en app.json:  ["./plugins/withFinnNotificationLargeIcon", { "icon": "./assets/images/notification-large-icon.png" }]
 */
const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');

const META_KEY = 'expo.modules.notifications.large_notification_icon';
const DRAWABLE = 'finn_notification_large';

const withLargeIconFile = (config, icon) =>
  withDangerousMod(config, [
    'android',
    async cfg => {
      const src = path.resolve(cfg.modRequest.projectRoot, icon);
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'drawable-nodpi');
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(src, path.join(dir, `${DRAWABLE}.png`));
      return cfg;
    },
  ]);

const withLargeIconMeta = config =>
  withAndroidManifest(config, cfg => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, META_KEY, `@drawable/${DRAWABLE}`, 'resource');
    return cfg;
  });

module.exports = function withFinnNotificationLargeIcon(config, props = {}) {
  const icon = props.icon;
  if (!icon) throw new Error('withFinnNotificationLargeIcon: falta la opción "icon"');
  config = withLargeIconFile(config, icon);
  return withLargeIconMeta(config);
};
