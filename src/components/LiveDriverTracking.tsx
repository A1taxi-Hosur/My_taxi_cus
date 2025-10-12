import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  rideId?: string;
  driverId?: string;
}

export default function LiveDriverTracking({ rideId, driverId }: Props) {
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
