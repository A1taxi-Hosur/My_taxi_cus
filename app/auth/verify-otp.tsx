import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Car, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function VerifyOTPScreen() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { sendOTP, setAuthenticatedUser } = useAuth();
  const router = useRouter();
  const { phoneNumber, name } = useLocalSearchParams<{ phoneNumber: string; name: string }>();

  const inputRefs = useRef<Array<TextInput | null>>([]);

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');

    if (otpString.length !== 6) {
      Alert.alert('Error', 'Please enter the complete 6-digit OTP');
      return;
    }

    if (!phoneNumber) {
      Alert.alert('Error', 'Phone number not found. Please try again.');
      router.back();
      return;
    }

    setLoading(true);

    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          otp: otpString,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data.error || 'Failed to verify OTP');
        setLoading(false);
        return;
      }

      if (data.success && data.userId) {
        console.log('✅ OTP verified, user ID (UUID):', data.userId);
        console.log('✅ Customer ID (integer):', data.customerId);

        await AsyncStorage.setItem('customerId', data.customerId.toString());
        await AsyncStorage.setItem('customerName', data.user.user_metadata?.full_name || 'User');
        await AsyncStorage.setItem('customerPhone', data.user.user_metadata?.phone_number || phoneNumber);
        await AsyncStorage.setItem('isAuthenticated', 'true');

        const userData = {
          id: data.userId,  // Use UUID from auth.users, not integer from Customers table
          email: data.email || `${phoneNumber}@phone.a1taxi.local`,
          full_name: data.user.user_metadata?.full_name || 'User',
          phone_number: data.user.user_metadata?.phone_number || phoneNumber,
          role: 'customer',
          customer_id: data.userId  // Use same UUID for consistency
        };

        console.log('✅ Setting authenticated user in context with UUID:', userData.id);
        setAuthenticatedUser(userData);

        console.log('✅ Customer data saved, navigating to home...');
        setLoading(false);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Verification failed');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'An error occurred during verification');
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!phoneNumber || !name) {
      Alert.alert('Error', 'Missing information. Please go back and try again.');
      return;
    }

    setResending(true);
    const { error, otp: newOtp } = await sendOTP(phoneNumber, name);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(
        'OTP Resent',
        `Your new OTP code is: ${newOtp}\n\n(In production, this would be sent via SMS)`,
        [
          {
            text: 'OK',
            onPress: () => {
              setOtp(['', '', '', '', '', '']);
              inputRefs.current[0]?.focus();
            }
          }
        ]
      );
    }
    setResending(false);
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#2563EB', '#1D4ED8']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Car size={48} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>Verify OTP</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit code sent to{'\n'}
                {phoneNumber}
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (inputRefs.current[index] = ref)}
                    style={[
                      styles.otpInput,
                      digit ? styles.otpInputFilled : null,
                    ]}
                    value={digit}
                    onChangeText={(value) => handleOtpChange(value, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.verifyButton, loading && styles.disabledButton]}
                onPress={handleVerifyOTP}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <Text style={styles.verifyButtonText}>Verify OTP</Text>
                )}
              </TouchableOpacity>

              <View style={styles.resendContainer}>
                <Text style={styles.resendText}>Didn't receive the code? </Text>
                <TouchableOpacity onPress={handleResendOTP} disabled={resending}>
                  {resending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.resendLink}>Resend</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 10,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    flex: 1,
    maxHeight: 350,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  otpInput: {
    width: 50,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  otpInputFilled: {
    backgroundColor: '#FFFFFF',
  },
  verifyButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.7,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
});
