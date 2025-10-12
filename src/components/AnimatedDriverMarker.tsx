import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  coordinate: { latitude: number; longitude: number };
  heading?: number;
}

export default function AnimatedDriverMarker({ coordinate, heading }: Props) {
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
