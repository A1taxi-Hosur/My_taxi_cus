import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Info, X } from 'lucide-react-native';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'error' | 'success' | 'info' | 'warning';
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
  onRequestClose?: () => void;
}

export default function CustomAlert({
  visible,
  title,
  message,
  type = 'info',
  buttons = [{ text: 'OK' }],
  onRequestClose,
}: CustomAlertProps) {
  const getAlertIcon = () => {
    switch (type) {
      case 'error':
        return <AlertTriangle size={24} color="#DC2626" />;
      case 'success':
        return <CheckCircle size={24} color="#059669" />;
      case 'warning':
        return <AlertTriangle size={24} color="#F59E0B" />;
      default:
        return <Info size={24} color="#2563EB" />;
    }
  };

  const getAlertColor = () => {
    switch (type) {
      case 'error':
        return '#DC2626';
      case 'success':
        return '#059669';
      case 'warning':
        return '#F59E0B';
      default:
        return '#2563EB';
    }
  };

  const handleButtonPress = (button: typeof buttons[0]) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onRequestClose) {
      onRequestClose();
    }
  };

  const getButtonStyle = (buttonStyle?: string) => {
    switch (buttonStyle) {
      case 'destructive':
        return [styles.alertButton, styles.destructiveButton];
      case 'cancel':
        return [styles.alertButton, styles.cancelButton];
      default:
        return [styles.alertButton, { backgroundColor: getAlertColor() }];
    }
  };

  const getButtonTextStyle = (buttonStyle?: string) => {
    switch (buttonStyle) {
      case 'cancel':
        return [styles.alertButtonText, styles.cancelButtonText];
      default:
        return styles.alertButtonText;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            {getAlertIcon()}
            <Text style={styles.title}>{title}</Text>
          </View>
          
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.buttonsContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={getButtonStyle(button.style)}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.8}
              >
                <Text style={getButtonTextStyle(button.style)}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    minWidth: 300,
    maxWidth: 400,
    width: '90%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 12,
    flex: 1,
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 24,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  alertButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  destructiveButton: {
    backgroundColor: '#DC2626',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  alertButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cancelButtonText: {
    color: '#374151',
  },
});