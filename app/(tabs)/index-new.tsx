import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
  Platform,
  TextInput,
} from 'react-native';
import { MapPin, Navigation, Menu, Phone, User, Car, MoreVertical, Mic, MessageCircle } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter } from 'expo-router';
import EnhancedGoogleMapView from '../../src/components/EnhancedGoogleMapView';
import EnhancedLocationSearchModal from '../../src/components/EnhancedLocationSearchModal';
import { fareCalculator } from '../../src/services/fareCalculator';
import { enhancedLocationService } from '../../src/services/enhancedLocationService';
import { rideService } from '../../src/services/rideService';
import { DEFAULT_REGION } from '../../src/config/maps';
import { useActiveRideTracking } from '../../src/hooks/useActiveRideTracking';
import { driverLocationService } from '../../src/services/driverLocationService';

const { width, height } = Dimensions.get('window');

type RideState = 'booking' | 'finding' | 'tracking';

type VehicleOption = {
  type: string;
  name: string;
  icon: string;
  capacity: number;
  eta: string;
  price: string;
  priceRange: string;
  badge?: string;
};

const vehicleOptions: VehicleOption[] = [
  {
    type: 'sedan',
    name: 'Book Any',
    icon: '🚗',
    capacity: 4,
    eta: '9 mins',
    price: '₹277 - ₹302',
    priceRange: '₹277-₹302',
    badge: 'Fastest',
  },
  {
    type: 'sedan',
    name: 'Sedan',
    icon: '🚗',
    capacity: 4,
    eta: '9 mins',
    price: '₹287 - ₹302',
    priceRange: '₹287-₹302',
  },
  {
    type: 'mini',
    name: 'Mini',
    icon: '🚙',
    capacity: 4,
    eta: '10 mins',
    price: '₹250 - ₹280',
    priceRange: '₹250-₹280',
  },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  // Location states
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [pickupLocation, setPickupLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Ride states
  const [rideState, setRideState] = useState<RideState>('booking');
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption>(vehicleOptions[0]);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showDestinationModal, setShowDestinationModal] = useState(false);

  // Map state
  const [mapRegion, setMapRegion] = useState(DEFAULT_REGION);

  // Active ride tracking
  const {
    activeRide,
    driverLocation,
    isTracking,
    shouldShowMap,
  } = useActiveRideTracking(user?.id || null);

  // Animations
  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Update ride state based on active ride
  useEffect(() => {
    if (activeRide) {
      if (activeRide.status === 'requested' || activeRide.status === 'pending') {
        setRideState('finding');
        startPulseAnimation();
      } else if (['accepted', 'driver_arrived', 'in_progress', 'picked_up'].includes(activeRide.status)) {
        setRideState('tracking');
        stopPulseAnimation();
      }
    } else {
      setRideState('booking');
      stopPulseAnimation();
    }
  }, [activeRide]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setCurrentLocation(location);
      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });

      const address = await enhancedLocationService.reverseGeocode(
        location.coords.latitude,
        location.coords.longitude
      );

      if (address) {
        setPickupLocation(address);
        setPickupCoords({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleBookRide = async () => {
    if (!pickupCoords || !destinationCoords || !user) {
      return;
    }

    setLoading(true);
    setRideState('finding');

    try {
      const rideData = {
        customer_id: user.id,
        pickup_latitude: pickupCoords.latitude,
        pickup_longitude: pickupCoords.longitude,
        pickup_address: pickupLocation,
        destination_latitude: destinationCoords.latitude,
        destination_longitude: destinationCoords.longitude,
        destination_address: destinationLocation,
        vehicle_type: selectedVehicle.type,
        fare_amount: parseFloat(selectedVehicle.price.replace(/[^0-9]/g, '')),
        booking_type: 'local',
      };

      await rideService.createRide(rideData);
    } catch (error) {
      console.error('Error creating ride:', error);
      setRideState('booking');
    } finally {
      setLoading(false);
    }
  };

  const renderBookingSheet = () => (
    <View style={styles.bottomSheet}>
      {/* Pickup/Destination */}
      <View style={styles.locationInputsContainer}>
        <TouchableOpacity
          style={styles.locationInput}
          onPress={() => setShowPickupModal(true)}
        >
          <View style={styles.locationDot} />
          <Text style={styles.locationInputText} numberOfLines={1}>
            {pickupLocation || 'Enter pickup location'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.locationInput}
          onPress={() => setShowDestinationModal(true)}
        >
          <MapPin size={16} color="#DC2626" />
          <Text style={styles.locationInputText} numberOfLines={1}>
            {destinationLocation || 'Enter destination'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.moreOptionsButton}>
          <MoreVertical size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Vehicle Options */}
      {pickupCoords && destinationCoords && (
        <>
          <View style={styles.vehicleList}>
            {vehicleOptions.map((vehicle, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.vehicleCard,
                  selectedVehicle.name === vehicle.name && styles.vehicleCardSelected,
                ]}
                onPress={() => setSelectedVehicle(vehicle)}
              >
                <View style={styles.vehicleCardLeft}>
                  <View style={styles.vehicleIconContainer}>
                    <Text style={styles.vehicleIcon}>{vehicle.icon}</Text>
                    {vehicle.badge && (
                      <View style={styles.vehicleBadge}>
                        <Text style={styles.vehicleBadgeText}>{vehicle.badge}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehicleName}>{vehicle.name}</Text>
                    <Text style={styles.vehicleEta}>
                      {vehicle.eta} • Drop at {new Date(Date.now() + 9 * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
                <Text style={styles.vehiclePrice}>{vehicle.priceRange}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Payment & Schedule */}
          <View style={styles.optionsRow}>
            <TouchableOpacity style={styles.optionButton}>
              <Text style={styles.optionIcon}>💰</Text>
              <Text style={styles.optionText}>Cash</Text>
              <Navigation size={14} color="#9CA3AF" style={{ transform: [{ rotate: '90deg' }] }} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionButton}>
              <Text style={styles.optionIcon}>📅</Text>
              <Text style={styles.optionText}>Now</Text>
              <Navigation size={14} color="#9CA3AF" style={{ transform: [{ rotate: '90deg' }] }} />
            </TouchableOpacity>
          </View>

          {/* Book Button */}
          <TouchableOpacity
            style={[styles.bookButton, loading && styles.bookButtonDisabled]}
            onPress={handleBookRide}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.bookButtonText}>Book {selectedVehicle.name}</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderFindingSheet = () => (
    <View style={styles.bottomSheet}>
      <Animated.View style={[styles.findingContainer, { transform: [{ scale: pulseAnim }] }]}>
        <View style={styles.findingMap}>
          <View style={styles.findingMapCircle} />
          <MapPin size={32} color="#DC2626" />
        </View>
      </Animated.View>

      <Text style={styles.findingTitle}>Finding Drivers Nearby</Text>
      <Text style={styles.findingSubtitle}>Searching for the closest driver near you</Text>

      <View style={styles.findingLocations}>
        <View style={styles.findingLocationRow}>
          <View style={styles.locationDot} />
          <Text style={styles.findingLocationText} numberOfLines={1}>
            {pickupLocation}
          </Text>
        </View>
        <View style={styles.findingLocationRow}>
          <MapPin size={14} color="#DC2626" />
          <Text style={styles.findingLocationText} numberOfLines={1}>
            {destinationLocation}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderTrackingSheet = () => {
    if (!activeRide || !driverLocation) {
      return null;
    }

    const distance = calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      pickupCoords?.latitude || 0,
      pickupCoords?.longitude || 0
    );

    return (
      <View style={styles.bottomSheet}>
        <Text style={styles.trackingTitle}>Your driver is {distance.toFixed(1)} Kms away</Text>

        {/* OTP Display */}
        {activeRide.pickup_otp && (
          <View style={styles.otpContainer}>
            <Text style={styles.otpLabel}>Start OTP</Text>
            <View style={styles.otpDigits}>
              {activeRide.pickup_otp.split('').map((digit: string, index: number) => (
                <View key={index} style={styles.otpDigit}>
                  <Text style={styles.otpDigitText}>{digit}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Driver Info */}
        <View style={styles.driverCard}>
          <View style={styles.driverHeader}>
            <View style={styles.driverAvatar}>
              <User size={24} color="#FFFFFF" />
            </View>
            <View style={styles.driverImageContainer}>
              <Text style={styles.vehicleImageIcon}>🚗</Text>
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverPlate}>TN38CU9861</Text>
              <Text style={styles.driverName}>Naveenkumar</Text>
              <Text style={styles.driverVehicle}>DZIRE - WHITE</Text>
            </View>
          </View>
        </View>

        {/* Destination */}
        <View style={styles.destinationContainer}>
          <Text style={styles.destinationLabel}>Destination</Text>
          <View style={styles.destinationRow}>
            <Text style={styles.destinationText} numberOfLines={2}>
              {destinationLocation}
            </Text>
            <TouchableOpacity>
              <Text style={styles.tripDetailsLink}>Trip Details</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton}>
            <MessageCircle size={20} color="#6B7280" />
            <Text style={styles.actionButtonText}>Send a text note</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconButton}>
            <Mic size={20} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconButton}>
            <Phone size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  return (
    <View style={styles.container}>
      {/* Full Screen Map */}
      <View style={styles.mapContainer}>
        <EnhancedGoogleMapView
          initialRegion={mapRegion}
          pickupCoords={pickupCoords}
          destinationCoords={rideState === 'tracking' && destinationCoords ? destinationCoords : undefined}
          driverLocation={rideState === 'tracking' && driverLocation ? driverLocation : undefined}
          showRoute={rideState === 'tracking'}
          style={styles.map}
          showUserLocation={true}
          followUserLocation={rideState === 'booking'}
        />

        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.menuButton}>
            {rideState === 'tracking' ? (
              <Text style={styles.backIcon}>←</Text>
            ) : (
              <Menu size={24} color="#1F2937" />
            )}
          </TouchableOpacity>
          <Text style={styles.appTitle}>Red Taxi</Text>
        </View>

        {/* Recenter Button */}
        <TouchableOpacity style={styles.recenterButton} onPress={getCurrentLocation}>
          <Navigation size={20} color="#1F2937" />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheetContainer}>
        {rideState === 'booking' && renderBookingSheet()}
        {rideState === 'finding' && renderFindingSheet()}
        {rideState === 'tracking' && renderTrackingSheet()}
      </View>

      {/* Location Modals */}
      <EnhancedLocationSearchModal
        visible={showPickupModal}
        onClose={() => setShowPickupModal(false)}
        onSelectLocation={(location) => {
          setPickupLocation(location.address);
          setPickupCoords({
            latitude: location.latitude,
            longitude: location.longitude,
          });
          setShowPickupModal(false);
        }}
        currentLocation={currentLocation}
        placeholder="Enter pickup location"
      />

      <EnhancedLocationSearchModal
        visible={showDestinationModal}
        onClose={() => setShowDestinationModal(false)}
        onSelectLocation={(location) => {
          setDestinationLocation(location.address);
          setDestinationCoords({
            latitude: location.latitude,
            longitude: location.longitude,
          });
          setShowDestinationModal(false);
        }}
        currentLocation={currentLocation}
        placeholder="Enter destination"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  menuButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backIcon: {
    fontSize: 24,
    color: '#1F2937',
  },
  appTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 12,
  },
  recenterButton: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bottomSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  bottomSheet: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  locationInputsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    position: 'relative',
  },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#059669',
    marginRight: 12,
  },
  locationInputText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  moreOptionsButton: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -10,
    padding: 4,
  },
  vehicleList: {
    marginBottom: 16,
  },
  vehicleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  vehicleCardSelected: {
    borderColor: '#DC2626',
    borderWidth: 2,
    backgroundColor: '#FEF2F2',
  },
  vehicleCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vehicleIconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  vehicleIcon: {
    fontSize: 32,
  },
  vehicleBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vehicleBadgeText: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  vehicleEta: {
    fontSize: 12,
    color: '#6B7280',
  },
  vehiclePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  optionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    gap: 8,
  },
  optionIcon: {
    fontSize: 16,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  bookButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    opacity: 0.6,
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  findingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  findingMap: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  findingMapCircle: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEE2E2',
    opacity: 0.5,
  },
  findingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  findingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  findingLocations: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  findingLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  findingLocationText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  trackingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  otpContainer: {
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  otpLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  otpDigits: {
    flexDirection: 'row',
    gap: 12,
  },
  otpDigit: {
    width: 48,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpDigitText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  driverCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverImageContainer: {
    width: 80,
    height: 60,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleImageIcon: {
    fontSize: 48,
  },
  driverDetails: {
    flex: 1,
  },
  driverPlate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  driverName: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 2,
  },
  driverVehicle: {
    fontSize: 12,
    color: '#6B7280',
  },
  destinationContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  destinationLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  destinationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  destinationText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    marginRight: 12,
  },
  tripDetailsLink: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
  },
  actionIconButton: {
    width: 44,
    height: 44,
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
