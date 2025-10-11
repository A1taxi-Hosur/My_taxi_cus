import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Pause, RotateCcw, MapPin, Navigation, Car, Zap } from 'lucide-react-native';
import EnhancedGoogleMapView from '../src/components/EnhancedGoogleMapView';
import LiveDriverTracking from '../src/components/LiveDriverTracking';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

const BANGALORE_CENTER = { latitude: 12.9716, longitude: 77.5946 };

export default function TestLiveTrackingScreen() {
  const router = useRouter();
  const [driverLocation, setDriverLocation] = useState({
    latitude: 12.9650,
    longitude: 77.5880,
    heading: 0,
  });
  const [pickupLocation] = useState({
    latitude: BANGALORE_CENTER.latitude,
    longitude: BANGALORE_CENTER.longitude,
    address: 'Cubbon Park, Bangalore',
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [showRoute, setShowRoute] = useState(true);
  const [distance, setDistance] = useState(0);

  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    calculateDistance();
  }, [driverLocation]);

  useEffect(() => {
    if (isSimulating) {
      startSimulation();
    } else {
      stopSimulation();
    }
    return () => stopSimulation();
  }, [isSimulating, simulationSpeed]);

  const calculateDistance = () => {
    const R = 6371;
    const dLat = ((pickupLocation.latitude - driverLocation.latitude) * Math.PI) / 180;
    const dLon = ((pickupLocation.longitude - driverLocation.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((driverLocation.latitude * Math.PI) / 180) *
        Math.cos((pickupLocation.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    setDistance(R * c);
  };

  const calculateHeading = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.cos(dLon);
    const heading = Math.atan2(y, x);
    return ((heading * 180) / Math.PI + 360) % 360;
  };

  const startSimulation = () => {
    stopSimulation();

    const interval = setInterval(() => {
      setDriverLocation((prev) => {
        const latDiff = pickupLocation.latitude - prev.latitude;
        const lonDiff = pickupLocation.longitude - prev.longitude;
        const dist = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);

        if (dist < 0.0001) {
          setIsSimulating(false);
          return prev;
        }

        const step = 0.0001 * simulationSpeed;
        const newLat = prev.latitude + (latDiff / dist) * step;
        const newLon = prev.longitude + (lonDiff / dist) * step;
        const newHeading = calculateHeading(prev.latitude, prev.longitude, newLat, newLon);

        return {
          latitude: newLat,
          longitude: newLon,
          heading: newHeading,
        };
      });
    }, 100);

    simulationIntervalRef.current = interval;
  };

  const stopSimulation = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
  };

  const resetSimulation = () => {
    setIsSimulating(false);
    setDriverLocation({
      latitude: 12.9650,
      longitude: 77.5880,
      heading: 0,
    });
  };

  const moveDriverToRandomLocation = () => {
    const randomLat = BANGALORE_CENTER.latitude + (Math.random() - 0.5) * 0.02;
    const randomLon = BANGALORE_CENTER.longitude + (Math.random() - 0.5) * 0.02;
    setDriverLocation({
      latitude: randomLat,
      longitude: randomLon,
      heading: Math.random() * 360,
    });
  };

  const moveDriverNearPickup = () => {
    setDriverLocation({
      latitude: pickupLocation.latitude + 0.003,
      longitude: pickupLocation.longitude + 0.003,
      heading: 225,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Live Driver Tracking Test</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Map Section */}
        <View style={styles.mapSection}>
          <EnhancedGoogleMapView
            initialRegion={{
              latitude: BANGALORE_CENTER.latitude,
              longitude: BANGALORE_CENTER.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            pickupCoords={pickupLocation}
            destinationCoords={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
            }}
            driverLocation={driverLocation}
            showRoute={showRoute}
            style={styles.map}
            showUserLocation={false}
            followUserLocation={false}
          />

          {/* Live Tracking Overlay */}
          <View style={styles.trackingOverlay}>
            <LiveDriverTracking
              driverLocation={driverLocation}
              pickupLocation={pickupLocation}
              driverInfo={{
                name: 'Test Driver',
                vehicle: 'Toyota Camry',
                plateNumber: 'KA 01 AB 1234',
                phone: '+91 98765 43210',
              }}
            />
          </View>
        </View>

        {/* Controls Section */}
        <ScrollView style={styles.controlsSection} showsVerticalScrollIndicator={false}>
          <View style={styles.controlsContainer}>
            {/* Simulation Controls */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Simulation Controls</Text>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.controlButton, isSimulating && styles.controlButtonActive]}
                  onPress={() => setIsSimulating(!isSimulating)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={isSimulating ? ['#EF4444', '#DC2626'] : ['#10B981', '#059669']}
                    style={styles.buttonGradient}
                  >
                    {isSimulating ? (
                      <Pause size={20} color="#FFFFFF" />
                    ) : (
                      <Play size={20} color="#FFFFFF" />
                    )}
                    <Text style={styles.buttonText}>
                      {isSimulating ? 'Pause' : 'Start'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={resetSimulation}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#6B7280', '#4B5563']}
                    style={styles.buttonGradient}
                  >
                    <RotateCcw size={20} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Reset</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Distance</Text>
                  <Text style={styles.infoValue}>
                    {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(2)}km`}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Heading</Text>
                  <Text style={styles.infoValue}>{Math.round(driverLocation.heading)}°</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Status</Text>
                  <Text style={[styles.infoValue, isSimulating && styles.infoValueActive]}>
                    {isSimulating ? 'Moving' : 'Stopped'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Speed Control */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Simulation Speed</Text>
              <View style={styles.speedButtons}>
                {[0.5, 1, 2, 5].map((speed) => (
                  <TouchableOpacity
                    key={speed}
                    style={[
                      styles.speedButton,
                      simulationSpeed === speed && styles.speedButtonActive,
                    ]}
                    onPress={() => setSimulationSpeed(speed)}
                  >
                    <Text
                      style={[
                        styles.speedButtonText,
                        simulationSpeed === speed && styles.speedButtonTextActive,
                      ]}
                    >
                      {speed}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={moveDriverToRandomLocation}
                activeOpacity={0.7}
              >
                <MapPin size={20} color="#2563EB" />
                <Text style={styles.actionButtonText}>Move to Random Location</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={moveDriverNearPickup}
                activeOpacity={0.7}
              >
                <Navigation size={20} color="#059669" />
                <Text style={styles.actionButtonText}>Move Near Pickup</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setDriverLocation({
                    ...driverLocation,
                    heading: (driverLocation.heading + 45) % 360,
                  });
                }}
                activeOpacity={0.7}
              >
                <Car size={20} color="#F59E0B" />
                <Text style={styles.actionButtonText}>Rotate Driver 45°</Text>
              </TouchableOpacity>
            </View>

            {/* Display Options */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Display Options</Text>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Show Route</Text>
                <Switch
                  value={showRoute}
                  onValueChange={setShowRoute}
                  trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                  thumbColor={showRoute ? '#2563EB' : '#F3F4F6'}
                />
              </View>
            </View>

            {/* Instructions */}
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>How to Test</Text>
              <View style={styles.instructionItem}>
                <View style={styles.bullet} />
                <Text style={styles.instructionText}>
                  Click "Start" to begin driver movement simulation
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.bullet} />
                <Text style={styles.instructionText}>
                  Watch the driver marker animate smoothly toward pickup
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.bullet} />
                <Text style={styles.instructionText}>
                  ETA and distance update in real-time
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.bullet} />
                <Text style={styles.instructionText}>
                  Route line shows path from driver to customer
                </Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.bullet} />
                <Text style={styles.instructionText}>
                  Adjust speed to see faster/slower movement
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFF6FF',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButtonText: {
    fontSize: 24,
    color: '#1F2937',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  mapSection: {
    height: height * 0.45,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  trackingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  controlsSection: {
    flex: 1,
  },
  controlsContainer: {
    padding: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  controlButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  controlButtonActive: {
    transform: [{ scale: 1.02 }],
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  infoValueActive: {
    color: '#10B981',
  },
  speedButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  speedButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  speedButtonActive: {
    backgroundColor: '#2563EB',
  },
  speedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  speedButtonTextActive: {
    color: '#FFFFFF',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  instructionsCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
    marginTop: 6,
    marginRight: 10,
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
});
