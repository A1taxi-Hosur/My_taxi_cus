import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  selected: string;
  onSelect: (type: string) => void;
  vehicles?: any[];
}

export default function VehicleSelector({ selected, onSelect, vehicles }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Select Vehicle</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
});
