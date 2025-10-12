import React from 'react';
import { View, Modal } from 'react-native';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  type: 'error' | 'success' | 'info' | 'warning';
  buttons: Array<{ text: string; onPress?: () => void; style?: string }>;
  onRequestClose: () => void;
}

export default function CustomAlert(props: Props) {
  return <Modal visible={props.visible} onRequestClose={props.onRequestClose}><View /></Modal>;
}
