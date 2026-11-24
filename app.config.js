const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? [])];
  if (googleMapsApiKey) {
    // iOS memakai Apple Maps, jadi hanya Android yang membutuhkan API key.
    plugins.push([
      'react-native-maps',
      {
        androidGoogleMapsApiKey: googleMapsApiKey,
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
