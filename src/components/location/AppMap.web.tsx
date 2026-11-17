import { createElement } from 'react';
import type { ComponentType, IframeHTMLAttributes } from 'react';
import { StyleSheet, View } from 'react-native';
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

const Iframe = 'iframe' as unknown as ComponentType<IframeHTMLAttributes<HTMLIFrameElement>>;

/** Fallback web: iframe Leaflet (react-native-webview tidak mendukung web). */
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
    <View style={[styles.wrap, { height }]}>
      {createElement(Iframe, {
        srcDoc: html,
        title: accessibilityLabel,
        loading: 'lazy',
        style: { border: 0, width: '100%', height: '100%', display: 'block' },
      })}
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
});
