import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Square, MapPin, Navigation, Zap, RotateCcw } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import EnhancedGoogleMapView from '../src/components/EnhancedGoogleMapView';
import LiveDriverTracking from '../src/components/LiveDriverTracking';
import { useDriverLocationTracking } from '../src/hooks/useDriverLocationTracking';
import { supabase } from '../src/utils/supabase';

const { height } = Dimensions.get('window');

const BANGALORE_CENTER = { latitude: 12.9716, longitude: 77.5946 };

const TEST_SCENARIOS = [
  {
    id: 'nearby',
    name: 'Nearby Pickup',
    description: 'Driver 500m away',
    start: { lat: 12.9680, lon: 77.5910 },
    end: BANGALORE_CENTER,
    duration: 45,
  },
  {
    id: 'medium',
    name: 'Medium Distance',
    description: 'Driver 2km away',
    start: { lat: 12.9550, lon: 77.5800 },
    end: BANGALORE_CENTER,
    duration: 90,
  },
  {
    id: 'far',
    name: 'Far Distance',
    description: 'Driver 5km away',
    start: { lat: 12.9400, lon: 77.5600 },
    end: BANGALORE_CENTER,
    duration: 180,
  },
  {
    id: 'traffic',
    name: 'Heavy Traffic',
    description: 'Slow movement',
    start: { lat: 12.9650, lon: 77.5880 },
    end: BANGALORE_CENTER,
    duration: 120,
  },
];

export default function TestGPSTrackingScreen() {
  const router = useRouter();
  const [testDriverId] = useState('ac79d0ad-abe4-4e7d-830e-5908cfba0681');
  const [testRideId] = useState('test-ride-001');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState('');
  const [pickupLocation] = useState({
    latitude: BANGALORE_CENTER.latitude,
    longitude: BANGALORE_CENTER.longitude,
    address: 'Cubbon Park, Bangalore',
  });

  const {
    driverLocation,
    isTracking,
    error: trackingError,
    lastUpdate,
  } = useDriverLocationTracking(testRideId, testDriverId);

  const startSimulation = async (scenario: typeof TEST_SCENARIOS[0]) => {
    if (isSimulating) {
      Alert.alert('Simulation Running', 'Please wait for current simulation to complete');
      return;
    }

    setIsSimulating(true);
    setSimulationStatus(`Starting ${scenario.name}...`);

    try {
      console.log('🚀 Starting GPS simulation:', scenario);

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      console.log('🔧 Edge function URL will be:', `${supabaseUrl}/functions/v1/simulate-driver-movement`);

      setSimulationStatus('Initializing driver location...');

      const { error: initError } = await supabase
        .from('driver_locations')
        .upsert({
          driver_id: testDriverId,
          latitude: scenario.start.lat,
          longitude: scenario.start.lon,
          heading: 0,
          speed: 0,
          accuracy: 10,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'driver_id',
        });

      if (initError) {
        console.error('❌ Error initializing location:', initError);
        throw new Error('Failed to initialize driver location');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      setSimulationStatus(`🚗 Watch the map! Driver moving for ${scenario.duration}s...`);
      console.log('📡 Starting edge function simulation...');

      const simulationPayload = {
        driverId: testDriverId,
        startLat: scenario.start.lat,
        startLon: scenario.start.lon,
        endLat: scenario.end.latitude,
        endLon: scenario.end.longitude,
        durationSeconds: scenario.duration,
        updateIntervalSeconds: 3,
      };

      console.log('📦 Simulation payload:', simulationPayload);

      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/simulate-driver-movement`;
      console.log('🌐 Calling edge function:', edgeFunctionUrl);

      const fetchPromise = fetch(
        edgeFunctionUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(simulationPayload),
        }
      );

      console.log('⏳ Fetch initiated, waiting for response...');

      fetchPromise.then(async (response) => {
        console.log('📨 Edge function response received! Status:', response.status);
        const result = await response.json();
        console.log('📦 Response body:', result);
        if (response.ok) {
          console.log('✅ Simulation completed successfully:', result);
          setSimulationStatus('✅ Simulation completed!');
          Alert.alert('Success', 'GPS simulation completed successfully!');
        } else {
          console.error('❌ Simulation failed with status', response.status, ':', result);
          setSimulationStatus('❌ Simulation failed');
          Alert.alert('Error', result.error || 'Simulation failed');
        }
        setIsSimulating(false);
      }).catch((error) => {
        console.error('❌ Edge function fetch error:', error);
        console.error('❌ Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        setSimulationStatus(`❌ Error: ${error.message}`);
        Alert.alert('Error', error.message || 'Failed to start simulation');
        setIsSimulating(false);
      });

      console.log('👀 Simulation running in background. Watch for real-time updates on the map!');
    } catch (error) {
      console.error('❌ Simulation error:', error);
      setSimulationStatus('❌ Simulation failed');
      Alert.alert('Error', error.message || 'Failed to start simulation');
    } finally {
      setIsSimulating(false);
    }
  };

  const stopSimulation = () => {
    setIsSimulating(false);
    setSimulationStatus('Simulation stopped');
  };

  const resetDriver = async () => {
    try {
      setSimulationStatus('Resetting driver position...');

      const { error } = await supabase
        .from('driver_locations')
        .upsert({
          driver_id: testDriverId,
          latitude: 12.9680,
          longitude: 77.5910,
          heading: 0,
          speed: 0,
          accuracy: 10,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'driver_id',
        });

      if (error) throw error;

      setSimulationStatus('Driver position reset');
      Alert.alert('Success', 'Driver position has been reset');
    } catch (error) {
      console.error('Error resetting driver:', error);
      Alert.alert('Error', 'Failed to reset driver position');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>GPS Tracking Test</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Connection Status */}
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Connection Status</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isTracking && styles.statusDotActive]} />
              <Text style={styles.statusText}>
                {isTracking ? '🟢 Tracking Active' : '🔴 Not Tracking'}
              </Text>
            </View>
            {lastUpdate && (
              <Text style={styles.statusSubtext}>
                Last update: {Math.floor((Date.now() - lastUpdate.getTime()) / 1000)}s ago
              </Text>
            )}
            {trackingError && (
              <Text style={styles.errorText}>Error: {trackingError}</Text>
            )}
          </View>

          {/* Map View */}
          <View style={styles.mapSection}>
            <Text style={styles.sectionTitle}>Live Map View</Text>
            <View style={styles.mapContainer}>
              <EnhancedGoogleMapView
                initialRegion={{
                  latitude: BANGALORE_CENTER.latitude,
                  longitude: BANGALORE_CENTER.longitude,
                  latitudeDelta: 0.03,
                  longitudeDelta: 0.03,
                }}
                pickupCoords={pickupLocation}
                destinationCoords={
                  driverLocation
                    ? {
                        latitude: driverLocation.latitude,
                        longitude: driverLocation.longitude,
                      }
                    : undefined
                }
                driverLocation={driverLocation || undefined}
                showRoute={true}
                style={styles.map}
                showUserLocation={false}
                followUserLocation={false}
              />
            </View>

            {driverLocation && (
              <View style={styles.trackingInfoCard}>
                <View style={styles.trackingBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.trackingBadgeText}>LIVE TRACKING</Text>
                </View>

                <View style={styles.driverInfoRow}>
                  <Text style={styles.driverName}>Test Driver</Text>
                  <Text style={styles.driverVehicle}>Toyota Camry • KA 01 TEST 1234</Text>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Distance</Text>
                    <Text style={styles.statValue}>
                      {(Math.sqrt(
                        Math.pow(driverLocation.latitude - pickupLocation.latitude, 2) +
                        Math.pow(driverLocation.longitude - pickupLocation.longitude, 2)
                      ) * 111).toFixed(2)} km
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Speed</Text>
                    <Text style={styles.statValue}>{driverLocation.speed?.toFixed(1) || '0'} km/h</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Heading</Text>
                    <Text style={styles.statValue}>{Math.round(driverLocation.heading || 0)}°</Text>
                  </View>
                </View>

                <View style={styles.coordsRow}>
                  <Text style={styles.coordsLabel}>Position:</Text>
                  <Text style={styles.coordsValue}>
                    {driverLocation.latitude.toFixed(6)}, {driverLocation.longitude.toFixed(6)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Test Scenarios */}
          <View style={styles.scenariosSection}>
            <Text style={styles.sectionTitle}>Test Scenarios</Text>
            <Text style={styles.sectionSubtitle}>
              Select a scenario to simulate driver movement
            </Text>

            {TEST_SCENARIOS.map((scenario) => (
              <TouchableOpacity
                key={scenario.id}
                style={[
                  styles.scenarioCard,
                  isSimulating && styles.scenarioCardDisabled,
                ]}
                onPress={() => startSimulation(scenario)}
                disabled={isSimulating}
                activeOpacity={0.7}
              >
                <View style={styles.scenarioHeader}>
                  <View style={styles.scenarioIcon}>
                    <MapPin size={20} color="#2563EB" />
                  </View>
                  <View style={styles.scenarioInfo}>
                    <Text style={styles.scenarioName}>{scenario.name}</Text>
                    <Text style={styles.scenarioDescription}>
                      {scenario.description}
                    </Text>
                  </View>
                  <View style={styles.scenarioDuration}>
                    <Text style={styles.durationText}>{scenario.duration}s</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Simulation Controls */}
          <View style={styles.controlsSection}>
            <Text style={styles.sectionTitle}>Controls</Text>

            <TouchableOpacity
              style={[styles.controlButton, styles.resetButton]}
              onPress={resetDriver}
              disabled={isSimulating}
              activeOpacity={0.7}
            >
              <RotateCcw size={20} color="#FFFFFF" />
              <Text style={styles.controlButtonText}>Reset Driver Position</Text>
            </TouchableOpacity>

            {simulationStatus && (
              <View style={styles.simulationStatusCard}>
                {isSimulating && <ActivityIndicator size="small" color="#2563EB" />}
                <Text style={styles.simulationStatusText}>{simulationStatus}</Text>
              </View>
            )}
          </View>

          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>📖 How to Test</Text>

            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.instructionText}>
                Choose a test scenario (Nearby, Medium, Far, or Traffic)
              </Text>
            </View>

            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.instructionText}>
                Watch the map as the driver marker moves in real-time
              </Text>
            </View>

            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.instructionText}>
                Observe the distance and ETA updating automatically
              </Text>
            </View>

            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={styles.instructionText}>
                See the tracking card update with live information
              </Text>
            </View>

            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>💡 Note:</Text>
              <Text style={styles.noteText}>
                • GPS updates every 3 seconds{'\n'}
                • Driver moves smoothly along the route{'\n'}
                • Heading rotates based on movement direction{'\n'}
                • Real-time updates via Supabase subscriptions
              </Text>
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC2626',
    marginRight: 8,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  statusSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 8,
  },
  mapSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  mapContainer: {
    height: height * 0.4,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  trackingInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  trackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    marginRight: 6,
  },
  trackingBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  driverInfoRow: {
    marginBottom: 16,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  driverVehicle: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  coordsRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  coordsLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
  },
  coordsValue: {
    fontSize: 11,
    color: '#1F2937',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    flex: 1,
  },
  scenariosSection: {
    marginBottom: 16,
  },
  scenarioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  scenarioCardDisabled: {
    opacity: 0.5,
  },
  scenarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scenarioIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  scenarioInfo: {
    flex: 1,
  },
  scenarioName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  scenarioDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  scenarioDuration: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  controlsSection: {
    marginBottom: 16,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B7280',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  resetButton: {
    backgroundColor: '#F59E0B',
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  simulationStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  simulationStatusText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  instructionsCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 16,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
    paddingTop: 4,
  },
  noteBox: {
    backgroundColor: '#FCD34D',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 20,
  },
});
