import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert, Platform, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Phone, Mail, LogOut, Settings, CircleHelp as HelpCircle } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [showSignOutModal, setShowSignOutModal] = React.useState(false);

  const handleSignOut = () => {
    console.log('🚪 Sign out button pressed');
    
    if (Platform.OS === 'web') {
      // Use custom modal for web
      setShowSignOutModal(true);
    } else {
      // Use native Alert for mobile
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Yes', 
            onPress: performSignOut,
            style: 'destructive' 
          },
        ]
      );
    }
  };

  const performSignOut = async () => {
    console.log('🚪 User confirmed sign out');
    try {
      console.log('🚪 Calling signOut function...');
      await signOut();
      console.log('✅ Sign out completed');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const profileItems = [
    {
      icon: HelpCircle,
      title: 'Terms and Conditions',
      subtitle: 'Read our terms of service',
      onPress: () => {},
    },
    {
      icon: HelpCircle,
      title: 'Privacy Policy',
      subtitle: 'Learn how we protect your data',
      onPress: () => {},
    },
    {
      icon: HelpCircle,
      title: 'Help & Support',
      subtitle: 'Get help with your account',
      onPress: () => {},
    },
    {
      icon: LogOut,
      title: 'Sign Out',
      subtitle: 'Sign out of your account',
      onPress: handleSignOut,
      danger: true,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#F8FAFC', '#E2E8F0']}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
          </View>

          <View style={styles.profileCard}>
            <LinearGradient
              colors={['#2563EB', '#1D4ED8']}
              style={styles.avatarContainer}
            >
              <User size={40} color="#FFFFFF" />
            </LinearGradient>
            
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.full_name}</Text>
              <Text style={styles.userRole}>Customer</Text>
            </View>
          </View>

          <View style={styles.contactCard}>
            <View style={styles.contactItem}>
              <Mail size={20} color="#6B7280" />
              <Text style={styles.contactText}>{user?.email}</Text>
            </View>
            {user?.phone && (
              <View style={styles.contactItem}>
                <Phone size={20} color="#6B7280" />
                <Text style={styles.contactText}>{user.phone_number}</Text>
              </View>
            )}
          </View>

          <View style={styles.menuSection}>
            {profileItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuItem,
                  index === profileItems.length - 1 && styles.lastMenuItem,
                ]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[
                    styles.menuIconContainer,
                    item.danger && styles.dangerIconContainer
                  ]}>
                    <item.icon 
                      size={20} 
                      color={item.danger ? '#DC2626' : '#6B7280'} 
                    />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={[
                      styles.menuItemTitle,
                      item.danger && styles.dangerText
                    ]}>
                      {item.title}
                    </Text>
                    <Text style={styles.menuItemSubtitle}>
                      {item.subtitle}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Custom Sign Out Modal for Web */}
        <Modal
          visible={showSignOutModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSignOutModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Sign Out</Text>
              <Text style={styles.modalMessage}>Are you sure you want to sign out?</Text>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    console.log('🚪 Sign out cancelled');
                    setShowSignOutModal(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={async () => {
                    console.log('🚪 Sign out confirmed via modal');
                    setShowSignOutModal(false);
                    await performSignOut();
                  }}
                >
                  <Text style={styles.confirmButtonText}>Yes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  profileCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: '#6B7280',
  },
  contactCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  menuSection: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  menuItem: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dangerIconContainer: {
    backgroundColor: '#FEE2E2',
  },
  menuTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  dangerText: {
    color: '#DC2626',
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 300,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  confirmButton: {
    backgroundColor: '#DC2626',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});