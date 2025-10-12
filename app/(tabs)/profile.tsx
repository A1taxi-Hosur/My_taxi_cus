import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert, Platform, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Phone, Mail, LogOut, Settings, CircleHelp as HelpCircle } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter } from 'expo-router';

const privacyPolicyContent = `Privacy Policy

1. Introduction
At A1 Taxi, your privacy is our priority. This Privacy Policy explains how we collect, use, store, and protect your information when you use our mobile application or website.

By using our services, you agree to the practices described in this policy.

2. Definitions
- Driver – An individual registered with A1 Taxi to provide ride services.
- Passenger – An individual who books or avails rides through the A1 Taxi app.
- Vendor – A business or individual providing vehicles and related services on our platform.
- User – Any person using the app, including Drivers, Passengers, and Vendors.

3. Purpose of This Policy
This policy is designed to:
1. Explain how A1 Taxi collects and uses information.
2. Build trust through transparency and accountability.
3. Clarify how your data is stored, shared, and secured.
4. Provide details about your rights to update, delete, or access data.
5. Outline the use of cookies, tracking tools, and third-party integrations.

4. Device Permissions
Depending on your role, the app may request access to certain device features.

Passengers:
- Location – For pick-up, drop-off, and trip tracking.
- Notifications – For booking status, offers, and alerts.
- Contacts – To share rides or set emergency contacts.
- Autofill OTP – For secure and quick verification.
- Display Over Apps – To show live ride updates.
- Phone – To contact drivers or support directly.
- Media Access – To upload documents or complaints.

Drivers:
- Location – For ride requests, navigation, and monitoring.
- Notifications – For trip updates and alerts.
- Autofill OTP – For simple logins.
- Contacts – For SOS/emergency support.
- Display Over Apps – To keep navigation visible.
- Phone – For calling passengers or support.
- Camera/Storage – To upload verification documents.
- Do-Not-Disturb – To reduce distractions while driving.
- Ignore Battery Optimization – To keep the app active.
- Developer Options – Recommended to be disabled for stability.

Vendors:
- Camera/Storage – To upload documents (business, vehicle, bank).
- Notifications – For updates on vehicles and payments.
- Autofill OTP – For faster and safer logins.

5. Information We Collect

Passengers:
- Personal Data – Name, email, phone number, payment details, contacts.
- Location Data – For pick-up and trip routing.
- Usage Data – Trip history, feedback, ratings.
- Device Info – Device type and operating system.

Drivers:
- Personal Data – Name, email, phone, address, ID proof (license, Aadhaar).
- Financial Info – Bank details for payouts.
- Location Data – For dispatch and trip management.
- Usage Data – Ride requests, ratings, performance history.

Vendors:
- Personal Data – Business name, contact details, PAN/Aadhaar.
- Financial Info – Bank account and GST details.
- Vehicle Info – Registration, insurance, chassis/engine numbers.

Non-Personal Data:
- Aggregated statistics and demographics used to improve services.

6. How We Use Your Information
We use the collected information to:
- Deliver and improve ride services.
- Match drivers with passengers effectively.
- Ensure safety and prevent fraud.
- Process payments and transactions.
- Communicate service updates, alerts, and offers.
- Comply with applicable laws.

7. Sharing Your Information
Your data may be shared with:
- Service Providers – Payments, cloud hosting, mapping, customer support.
- Analytics Partners – For service insights (with anonymized data).
- Government Authorities – When legally required.
- Business Partners – In cases of mergers, acquisitions, or restructuring.

8. Choice & Transparency
- You may update your details anytime in account settings.
- You can disable location tracking when not using the app.
- You can request account/data deletion via customer support.
- You may opt out of promotional messages.

9. Account Deletion Policy

Passengers:
- Cancel any active or pending rides.
- Withdraw remaining wallet balance.

Drivers:
- Complete all pending trips and clear payouts.
- Resolve outstanding verification requests.

Vendors:
- Settle pending invoices and payouts.
- Resolve vehicle and driver account statuses.

10. Security & Data Retention
- All sensitive data is encrypted during transfer and storage.
- Access to personal data is restricted to authorized staff only.
- Data is retained only as long as required by law.
- Regular audits are conducted for compliance.
- Analytics data is anonymized to protect privacy.

11. Children's Privacy
We do not knowingly collect information from individuals under the age of 18. If such data is accidentally collected, please contact us, and we will delete it immediately.

12. International Data Transfers
If your data is transferred across borders, A1 Taxi ensures compliance with international data protection laws and applies safeguards to keep your information secure.

13. Policy Updates
This Privacy Policy may be updated periodically. All changes will be posted within the app and on our website. If changes are significant, we will notify you in advance where legally required.`;

const termsConditionsContent = `Rules & Terms

1. Drivers

1.1 Customer Care:
- Greet all passengers politely upon boarding.
- Assist in handling passengers' luggage.
- Always provide air conditioning by default; only turn it off upon the passenger's explicit request.
- Show equal courtesy and respect to elderly, differently-abled, or minor passengers—this is both our duty and responsibility.
- Refrain from initiating or engaging in disputes with passengers.

1.2 Professional Conduct:
- Wear black formal shoes during duty hours.
- Remain alert and never sleep during active duty.
- Maintain uniform neatness; it must be worn both during login and logout—no exceptions.
- Consuming alcohol, tobacco (including pan masala, gutka), or any drugs while on duty is strictly prohibited.

1.3 Grooming Standards:
- Keep hair tidy and shave regularly.
- Ensure daily personal hygiene, including clean hands and trimmed nails.

1.4 Legal Compliance:
- Always follow traffic regulations—wear seat belts, observe speed limits, obey signals, avoid unauthorized overtaking and improper parking.
- Keep all required documents (license, permits, insurance, etc.) valid and updated as per RTO norms.

2. Fleet Partners (Vendors)

2.1 Billing & Payments:
- Rent and GST for the current month must be paid by the 5th day of each month. The previous month's earnings are subject to GST and must be settled by due date.

2.2 Data Privacy & Conduct:
- Under no circumstances should customer contact details be shared with external parties or used for personal purposes.
- Filming or photographing inside the vehicle (via mobile or hidden cameras) during business hours is strictly forbidden.

2.3 Maintenance & Documentation:
- Maintain both vehicle and driver in compliance with legal and RTO standards.
- Renew all essential documents—including RC, permit, insurance, driver's badge, and license—before they expire.

2.4 Branding & Identification:
- Only display A1 Taxi-approved stickers on vehicles; other branding is not allowed.
- Vehicle roofs should be painted in A1 Taxi colors while attached, and repainted white upon detachment.

2.5 Driver Training & Identification:
- Every new driver must undergo training held thrice a week at our office. Assign each a unique login ID.
- Proxy or substitute drivers are disallowed—the driver's photo is shared with customers for verification.
- If using the vehicle for personal use, ensure the uniformed A1 Taxi driver is behind the wheel.

2.6 Operational and Legal Responsibility:
- Record all trips as required by the Indian Transport Act.
- Inform the vendor team in advance if you intend to lease or sell the vehicle.
- Any accidents or legal issues linked to the vehicle are the vendor's responsibility.
- Fares and tariff changes are solely determined by A1 Taxi—they cannot be altered unilaterally.
- Trip cancellations without valid reasons are not tolerated and will attract penalties.

2.7 Pickup Readiness:
- Ensure the vehicle and driver are tidy and well-groomed before starting the day.
- Avoid incentivizing drivers through daily, weekly, or percentage-based commissions.
- Note down fuel and meter readings daily and have drivers complete trip sheets accordingly.

3. Passengers
- Pay applicable fares, including meter charges, parking, night surcharges, tolls, and applicable taxes.
- Using any intoxicants or smoking inside the vehicle is prohibited. Drivers may refuse service or request you to alight under such influence.
- Do not litter or misuse any vehicle equipment. Damaged or misused items will incur compensation charges.
- Never request the driver to violate traffic laws or overload beyond four adults. Drivers may refuse and terminate service if pressured.
- Lost property claims must be reported in writing within 24 hours. A1 Taxi will make best efforts to assist but cannot guarantee retrieval.
- The use of app or driver recordings for trip validation is at your risk.
- A1 Taxi disclaims liability for disruptions due to force majeure, network failures, or service errors.
- By using A1 Taxi, you accept responsibility for your actions and agree to indemnify the company for any legal or financial liabilities arising from misuse.

4. Additional Notes
- A1 Taxi reserves the right to amend these Rules & Terms at any time. Continued use of our services implies acceptance of any changes.
- All calls to A1 Taxi's customer support may be recorded for quality and training purposes.
- GPS tracking is enabled in all vehicles solely for safety and monitoring.`;

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [showSignOutModal, setShowSignOutModal] = React.useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = React.useState(false);
  const [showTermsConditions, setShowTermsConditions] = React.useState(false);

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
      onPress: () => setShowTermsConditions(true),
    },
    {
      icon: HelpCircle,
      title: 'Privacy Policy',
      subtitle: 'Learn how we protect your data',
      onPress: () => setShowPrivacyPolicy(true),
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

        {/* Privacy Policy Modal */}
        <Modal
          visible={showPrivacyPolicy}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowPrivacyPolicy(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.contentModalContainer}>
              <View style={styles.contentModalHeader}>
                <Text style={styles.contentModalTitle}>Privacy Policy</Text>
                <TouchableOpacity onPress={() => setShowPrivacyPolicy(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.contentScrollView} showsVerticalScrollIndicator={true}>
                <Text style={styles.contentText}>{privacyPolicyContent}</Text>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Terms and Conditions Modal */}
        <Modal
          visible={showTermsConditions}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowTermsConditions(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.contentModalContainer}>
              <View style={styles.contentModalHeader}>
                <Text style={styles.contentModalTitle}>Terms and Conditions</Text>
                <TouchableOpacity onPress={() => setShowTermsConditions(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.contentScrollView} showsVerticalScrollIndicator={true}>
                <Text style={styles.contentText}>{termsConditionsContent}</Text>
              </ScrollView>
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
  contentModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    margin: 20,
    marginTop: 60,
    marginBottom: 60,
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  contentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  contentModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    fontSize: 24,
    color: '#6B7280',
    fontWeight: 'bold',
    padding: 4,
  },
  contentScrollView: {
    padding: 20,
  },
  contentText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
});