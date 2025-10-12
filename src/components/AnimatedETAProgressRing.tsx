import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  eta?: number;
  size?: number;
}

export default function AnimatedETAProgressRing({ eta, size }: Props) {
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
