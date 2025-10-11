import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, RotateCcw, Settings, Car, Clock, MapPin, Navigation as NavIcon } from 'lucide-react-native';
import DriverArrivingAnimation from '../src/components/DriverArrivingAnimation';
import AnimatedETAProgressRing from '../src/components/AnimatedETAProgressRing';
import AnimatedDriverMarker from '../src/components/AnimatedDriverMarker';
import { useRouter } from 'expo-router';

export default function TestAnimationsScreen() {
  const router = useRouter();
  const [showCelebration, setShowCelebration] = useState(false);
  const [driverName, setDriverName] = useState('John Smith');
  const [vehicleInfo, setVehicleInfo] = useState('Toyota Camry');
  const [eta, setEta] = useState(5);
  const [heading, setHeading] = useState(0);
  const [isMoving, setIsMoving] = useState(true);
  const [speed, setSpeed] = useState(30);
  const [latitude, setLatitude] = useState(12.9716);
  const [longitude, setLongitude] = useState(77.5946);
  const [autoRotate, setAutoRotate] = useState(false);
  const [autoUpdateETA, setAutoUpdateETA] = useState(false);

  useEffect(() => {
    if (autoRotate) {
      const interval = setInterval(() => {
        setHeading((prev) => (prev + 15) % 360);
        setLatitude((prev) => prev + 0.0001);
        setLongitude((prev) => prev + 0.0001);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [autoRotate]);

  useEffect(() => {
    if (autoUpdateETA && eta > 0) {
      const interval = setInterval(() => {
        setEta((prev) => Math.max(0, prev - 1));
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [autoUpdateETA, eta]);

  const simulateDriverAcceptance = () => {
    setShowCelebration(true);
  };

  const resetSimulation = () => {
    setShowCelebration(false);
    setEta(5);
    setHeading(0);
    setAutoRotate(false);
    setAutoUpdateETA(false);
  };

  const simulateDriverMovement = () => {
    setAutoRotate(true);
    setIsMoving(true);
  };

  const simulateETACountdown = () => {
    setAutoUpdateETA(true);
  };

  const quickTestScenarios = [
    {
      name: 'Driver Accepts Ride',
      description: 'Full celebration animation',
      action: simulateDriverAcceptance,
      icon: Play,
      color: '#10B981',
    },
    {
      name: 'Driver Moving',
      description: 'Rotating car with location updates',
      action: simulateDriverMovement,
      icon: Car,
      color: '#2563EB',
    },
    {
      name: 'Live Tracking Test',
      description: 'Test real-time driver movement',
      action: () => router.push('/test-live-tracking'),
      icon: NavIcon,
      color: '#8B5CF6',
    },
    {
      name: 'GPS Tracking Test',
      description: 'Test with real database updates',
      action: () => router.push('/test-gps-tracking'),
      icon: MapPin,
      color: '#10B981',
    },
    {
      name: 'ETA Countdown',
      description: 'Animated countdown from current ETA',
      action: simulateETACountdown,
      icon: Clock,
      color: '#F59E0B',
    },
    {
      name: 'Reset All',
      description: 'Reset to initial state',
      action: resetSimulation,
      icon: RotateCcw,
      color: '#DC2626',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#F0F9FF', '#E0F2FE']} style={styles.gradient}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Settings size={32} color="#2563EB" />
            <Text style={styles.headerTitle}>Animation Test Studio</Text>
          </View>

          <Text style={styles.sectionDescription}>
            Test all driver arriving animations with interactive controls
          </Text>

          {/* Quick Test Scenarios */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Test Scenarios</Text>
            <View style={styles.scenariosGrid}>
              {quickTestScenarios.map((scenario, index) => {
                const Icon = scenario.icon;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.scenarioCard, { borderColor: scenario.color }]}
                    onPress={scenario.action}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.scenarioIcon, { backgroundColor: scenario.color }]}>
                      <Icon size={24} color="#FFFFFF" />
                    </View>
                    <Text style={styles.scenarioName}>{scenario.name}</Text>
                    <Text style={styles.scenarioDescription}>{scenario.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Live Preview Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Live Animation Preview</Text>

            {/* ETA Progress Ring */}
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>ETA Progress Ring</Text>
              <View style={styles.previewContent}>
                <AnimatedETAProgressRing
                  etaMinutes={eta}
                  maxETA={15}
                  size={140}
                  strokeWidth={10}
                />
              </View>
            </View>

            {/* Driver Marker */}
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>Driver Marker (Rotating Car)</Text>
              <View style={styles.previewContent}>
                <View style={styles.markerBackground}>
                  <AnimatedDriverMarker
                    latitude={latitude}
                    longitude={longitude}
                    heading={heading}
                    speed={speed}
                    isMoving={isMoving}
                  />
                </View>
                <View style={styles.markerInfo}>
                  <Text style={styles.markerInfoText}>Heading: {heading}°</Text>
                  <Text style={styles.markerInfoText}>Speed: {speed} km/h</Text>
                  <Text style={styles.markerInfoText}>
                    Moving: {isMoving ? 'Yes' : 'No'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Control Panel */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Control Panel</Text>

            {/* Driver Info Controls */}
            <View style={styles.controlCard}>
              <Text style={styles.controlLabel}>Driver Name</Text>
              <TextInput
                style={styles.input}
                value={driverName}
                onChangeText={setDriverName}
                placeholder="Enter driver name"
              />
            </View>

            <View style={styles.controlCard}>
              <Text style={styles.controlLabel}>Vehicle Info</Text>
              <TextInput
                style={styles.input}
                value={vehicleInfo}
                onChangeText={setVehicleInfo}
                placeholder="Enter vehicle info"
              />
            </View>

            {/* ETA Controls */}
            <View style={styles.controlCard}>
              <View style={styles.controlHeader}>
                <Text style={styles.controlLabel}>ETA (minutes)</Text>
                <Text style={styles.controlValue}>{eta} min</Text>
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => setEta(Math.max(0, eta - 1))}
                >
                  <Text style={styles.smallButtonText}>-1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => setEta(eta + 1)}
                >
                  <Text style={styles.smallButtonText}>+1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => setEta(5)}
                >
                  <Text style={styles.smallButtonText}>Reset</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Auto countdown</Text>
                <Switch
                  value={autoUpdateETA}
                  onValueChange={setAutoUpdateETA}
                  trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                  thumbColor={autoUpdateETA ? '#2563EB' : '#F3F4F6'}
                />
              </View>
            </View>

            {/* Heading Controls */}
            <View style={styles.controlCard}>
              <View style={styles.controlHeader}>
                <Text style={styles.controlLabel}>Car Heading (degrees)</Text>
                <Text style={styles.controlValue}>{heading}°</Text>
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => setHeading((heading - 45 + 360) % 360)}
                >
                  <Text style={styles.smallButtonText}>-45°</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => setHeading((heading + 45) % 360)}
                >
                  <Text style={styles.smallButtonText}>+45°</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => setHeading(0)}
                >
                  <Text style={styles.smallButtonText}>North</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Auto rotate</Text>
                <Switch
                  value={autoRotate}
                  onValueChange={setAutoRotate}
                  trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                  thumbColor={autoRotate ? '#2563EB' : '#F3F4F6'}
                />
              </View>
            </View>

            {/* Speed Controls */}
            <View style={styles.controlCard}>
              <View style={styles.controlHeader}>
                <Text style={styles.controlLabel}>Speed (km/h)</Text>
                <Text style={styles.controlValue}>{speed} km/h</Text>
              </View>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => setSpeed(Math.max(0, speed - 10))}
                >
                  <Text style={styles.smallButtonText}>-10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => setSpeed(speed + 10)}
                >
                  <Text style={styles.smallButtonText}>+10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => setSpeed(30)}
                >
                  <Text style={styles.smallButtonText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Movement Toggle */}
            <View style={styles.controlCard}>
              <View style={styles.switchRow}>
                <Text style={styles.controlLabel}>Car is Moving</Text>
                <Switch
                  value={isMoving}
                  onValueChange={setIsMoving}
                  trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                  thumbColor={isMoving ? '#2563EB' : '#F3F4F6'}
                />
              </View>
            </View>
          </View>

          {/* Test Instructions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Testing Instructions</Text>
            <View style={styles.instructionsCard}>
              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>1</Text>
                </View>
                <Text style={styles.instructionText}>
                  Click "Driver Accepts Ride" to see the full-screen celebration animation
                </Text>
              </View>

              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>2</Text>
                </View>
                <Text style={styles.instructionText}>
                  Enable "Auto rotate" to see the car marker rotate and move smoothly
                </Text>
              </View>

              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>3</Text>
                </View>
                <Text style={styles.instructionText}>
                  Enable "Auto countdown" to see the ETA ring animate as time decreases
                </Text>
              </View>

              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>4</Text>
                </View>
                <Text style={styles.instructionText}>
                  Use manual controls to test specific heading angles and ETA values
                </Text>
              </View>

              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>5</Text>
                </View>
                <Text style={styles.instructionText}>
                  Watch how colors change: Blue (far) → Yellow (close) → Green (arriving)
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Celebration Animation Overlay */}
        {showCelebration && (
          <DriverArrivingAnimation
            visible={showCelebration}
            driverName={driverName}
            vehicleInfo={vehicleInfo}
            eta={eta}
            onAnimationComplete={() => {
              setShowCelebration(false);
            }}
          />
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 12,
  },
  sectionDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  scenariosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  scenarioCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  scenarioIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  scenarioName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  scenarioDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  previewContent: {
    alignItems: 'center',
  },
  markerBackground: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 40,
    marginBottom: 16,
  },
  markerInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    width: '100%',
  },
  markerInfoText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  controlCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  controlValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  smallButton: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  smallButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  instructionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instructionNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
});
