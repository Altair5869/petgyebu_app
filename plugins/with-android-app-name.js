const { AndroidConfig, withStringsXml } = require('expo/config-plugins');

// Android takes the launcher label from `name`, which also names the iOS project, so set only the
// Android label here. iOS shows ios.infoPlist.CFBundleDisplayName.
module.exports = function withAndroidAppName(config, label) {
  return withStringsXml(config, (mod) => {
    mod.modResults = AndroidConfig.Strings.setStringItem(
      [AndroidConfig.Resources.buildResourceItem({ name: 'app_name', value: label })],
      mod.modResults,
    );
    return mod;
  });
};
