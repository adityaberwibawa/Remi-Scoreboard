/**
 * Setup global Jest.
 *
 * Mock native module @react-native-async-storage/async-storage (cara resmi paket itu)
 * supaya import rantai auth — AuthContext → supabase → sessionStorage → AsyncStorage —
 * tidak gagal dengan "NativeModule: AsyncStorage is null" saat test.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
