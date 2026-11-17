import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { GeoPoint } from '../../location/geo';
import { buildLeafletHtml } from './leafletHtml';
import type { MapFenceConfig, MapMarkerConfig } from './leafletHtml';

export interface AppMapProps {
  center: GeoPoint;
  marker?: MapMarkerConfig;
  user?: GeoPoint;
  fence?: MapFenceConfig;
  height?: number;
  interactive?: boolean;
  accessibilityLabel?: string;
}

/**
 * Peta Leaflet di dalam WebView: tanpa API key dan tetap bekerja di Expo Go.
 * Tile OpenStreetMap/CARTO memerlukan internet; HTML menampilkan fallback bila gagal.
 */
export function AppMap({
  center,
  marker,
  user,
  fence,
  height = 200,
  interactive = true,
  accessibilityLabel = 'Peta lokasi',
}: AppMapProps) {
  const html = buildLeafletHtml({ center, marker, user, fence, interactive });
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.wrap, { height }]}>
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        scrollEnabled={interactive}
        overScrollMode="never"
        androidLayerType="hardware"
        allowsInlineMediaPlayback
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#101415',
    borderWidth: 1,
    borderColor: '#2C353A',
  },
  web: { flex: 1, backgroundColor: '#101415' },
});
