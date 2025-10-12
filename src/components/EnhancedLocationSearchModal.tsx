import React from 'react';
import { View, Modal } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: string, coords: { latitude: number; longitude: number }) => void;
  placeholder?: string;
  title?: string;
  currentLocation?: any;
}

export default function EnhancedLocationSearchModal(props: Props) {
  return <Modal visible={props.visible} onRequestClose={props.onClose}><View /></Modal>;
}
