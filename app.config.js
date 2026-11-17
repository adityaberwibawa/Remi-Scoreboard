const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? [])];
  if (googleMapsApiKey) {
    plugins.push([
      'react-native-maps',
      {
        androidGoogleMapsApiKey: googleMapsApiKey,
        iosGoogleMapsApiKey: googleMapsApiKey,
      },
    ]);
  }
  return {
    ...config,
    plugins,
    extra: {
      ...(config.extra ?? {}),
      googleMapsConfigured: Boolean(googleMapsApiKey),
    },
  };
};
