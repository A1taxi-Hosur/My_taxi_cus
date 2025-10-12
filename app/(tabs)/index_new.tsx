import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Animated,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Navigation, ArrowUpDown, Clock, Plane, X } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter } from 'expo-router';
import EnhancedGoogleMapView from '../../src/components/EnhancedGoogleMapView';
import EnhancedLocationSearchModal from '../../src/components/EnhancedLocationSearchModal';
import CustomAlert from '../../src/components/CustomAlert';
import { fareCalculator, FareBreakdown } from '../../src/services/fareCalculator';
import { enhancedLocationService } from '../../src/services/enhancedLocationService';
import { rideService } from '../../src/services/rideService';
import { zoneService } from '../../src/services/zoneService';
import { isPointInAnyActiveZone } from '../../src/utils/zoneHelpers';
import { DEFAULT_REGION } from '../../src/config/maps';
import { driverLocationService, AvailableDriver } from '../../src/services/driverLocationService';
import { supabase } from '../../src/utils/supabase';
import DriverArrivingAnimation from '../../src/components/DriverArrivingAnimation';

const { width, height } = Dimensions.get('window');

type VehicleType = 'sedan' | 'suv' | 'hatchback' | 'hatchback_ac' | 'sedan_ac' | 'suv_ac';
type BottomSheetView = 'booking' | 'driver-search' | 'driver-found';

const serviceOptions = [
  {
    id: 'rental',
    title: 'Rental',
    icon: Clock,
    color: '#059669',
    route: '/booking/rental',
  },
  {
    id: 'outstation',
    title: 'Outstation',
    icon: MapPin,
    color: '#DC2626',
    route: '/booking/outstation',
  },
  {
    id: 'airport',
    title: 'Airport',
    icon: Plane,
    color: '#EA580C',
    route: '/booking/airport',
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

  // Booking states
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('sedan');
  const [fareBreakdown, setFareBreakdown] = useState<FareBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);

  // UI states
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [mapRegion, setMapRegion] = useState(DEFAULT_REGION);
  const [bottomSheetView, setBottomSheetView] = useState<BottomSheetView>('booking');

  // Vehicle and driver states
  const [vehicles, setVehicles] = useState<Array<any>>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [activeZones, setActiveZones] = useState<any[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);
  const [showDriversOnMap, setShowDriversOnMap] = useState(true);
  const [isCalculatingFare, setIsCalculatingFare] = useState(false);
  const [allVehicleFares, setAllVehicleFares] = useState<{ [key in VehicleType]?: number }>({});

  // Driver search states
  const [rideId, setRideId] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<'searching' | 'found' | 'cancelled'>('searching');
  const [driverData, setDriverData] = useState<any>(null);

  // Custom alert state
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'error' | 'success' | 'info' | 'warning';
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [{ text: 'OK' }],
  });

  // Bottom sheet animation
  const bottomSheetHeight = useRef(new Animated.Value(height * 0.5)).current;
  const EXPANDED_HEIGHT = height * 0.7;
  const COLLAPSED_HEIGHT = height * 0.5;

  useEffect(() => {
    getCurrentLocation();
    loadVehicleTypes();
    loadActiveZones();
  }, []);

  useEffect(() => {
    if (currentLocation) {
      startDriverLocationPolling();
    }
  }, [currentLocation]);

  useEffect(() => {
    if (pickupCoords && destinationCoords) {
      setShowDriversOnMap(false);
      stopDriverLocationPolling();
    } else if (currentLocation && (!pickupCoords || !destinationCoords)) {
      setShowDriversOnMap(true);
      startDriverLocationPolling();
    }
  }, [pickupCoords, destinationCoords]);

  // Monitor ride status when searching for driver
  useEffect(() => {
    if (rideId && bottomSheetView === 'driver-search') {
      const pollInterval = setInterval(async () => {
        try {
          const { data: ride, error } = await supabase
            .from('rides')
            .select('*, driver:drivers(*)')
            .eq('id', rideId)
            .single();

          if (error) {
            console.error('Error fetching ride:', error);
            return;
          }

          if (ride && ride.status === 'accepted' && ride.driver_id) {
            console.log('✅ Driver found!', ride.driver);
            setDriverData(ride.driver);
            setSearchStatus('found');
            setBottomSheetView('driver-found');

            // Navigate to rides page after 2 seconds
            setTimeout(() => {
              router.push('/(tabs)/rides');
            }, 2000);
          }
        } catch (error) {
          console.error('Error polling ride status:', error);
        }
      }, 2000);

      return () => clearInterval(pollInterval);
    }
  }, [rideId, bottomSheetView]);

  const startDriverLocationPolling = () => {
    if (!currentLocation) return;

    driverLocationService.startPolling(
      currentLocation.coords.latitude,
      currentLocation.coords.longitude,
      (drivers) => {
        setAvailableDrivers(drivers);
      },
      undefined,
      10000
    );
  };

  const stopDriverLocationPolling = () => {
    driverLocationService.stopPolling();
  };

  const loadVehicleTypes = async () => {
    try {
      const fareConfigs = await fareCalculator.getAllVehicleConfigs();

      const vehicleTypes = fareConfigs.map(config => ({
        type: config.vehicle_type as VehicleType,
        name: formatVehicleName(config.vehicle_type),
        description: getVehicleDescription(config.vehicle_type),
        eta: getVehicleETA(config.vehicle_type),
        config: config,
      }));

      setVehicles(vehicleTypes);

      const initialFares: { [key in VehicleType]?: number } = {};
      vehicleTypes.forEach(vehicle => {
        initialFares[vehicle.type] = vehicle.config.minimum_fare;
      });
      setAllVehicleFares(initialFares);

    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setVehiclesLoading(false);
    }
  };

  const loadActiveZones = async () => {
    try {
      const zones = await zoneService.fetchActiveZones();
      setActiveZones(zones);
    } catch (error) {
      console.error('Error loading zones:', error);
      setActiveZones([]);
    }
  };

  const formatVehicleName = (vehicleType: string): string => {
    const nameMap: { [key: string]: string } = {
      'hatchback': 'Hatchback',
      'hatchback_ac': 'Hatchback AC',
      'sedan': 'Sedan',
      'sedan_ac': 'Sedan AC',
      'suv': 'SUV',
      'suv_ac': 'SUV AC',
    };
    return nameMap[vehicleType] || vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1);
  };

  const getVehicleDescription = (vehicleType: string): string => {
    const descriptionMap: { [key: string]: string } = {
      'hatchback': 'Compact & comfortable',
      'hatchback_ac': 'Compact with AC',
      'sedan': 'Comfortable for all trips',
      'sedan_ac': 'Comfortable with AC',
      'suv': 'Spacious & premium',
      'suv_ac': 'Premium with AC',
    };
    return descriptionMap[vehicleType] || 'Available for booking';
  };

  const getVehicleETA = (vehicleType: string): string => {
    return '2-4 min';
  };

  const showCustomAlert = (
    title: string,
    message: string,
    type: 'error' | 'success' | 'info' | 'warning' = 'info',
    buttons?: Array<any>
  ) => {
    setCustomAlert({
      visible: true,
      title,
      message,
      type,
      buttons: buttons || [{ text: 'OK' }],
    });
  };

  const hideCustomAlert = (buttonAction?: () => void) => {
    if (buttonAction) {
      buttonAction();
    }
    setCustomAlert({
      visible: false,
      title: '',
      message: '',
      type: 'info',
      buttons: [{ text: 'OK' }],
    });
  };

  const getCurrentLocation = async () => {
    try {
      const locationWithAddress = await enhancedLocationService.getCurrentLocationWithAddress();

      if (!locationWithAddress) {
        throw new Error('Unable to get current location');
      }

      const expoLocation: Location.LocationObject = {
        coords: {
          latitude: locationWithAddress.coords.latitude,
          longitude: locationWithAddress.coords.longitude,
          altitude: locationWithAddress.coords.altitude || null,
          accuracy: locationWithAddress.coords.accuracy || null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: locationWithAddress.timestamp,
      };

      setCurrentLocation(expoLocation);
      setPickupLocation(locationWithAddress.address);
      setPickupCoords({
        latitude: locationWithAddress.coords.latitude,
        longitude: locationWithAddress.coords.longitude,
      });

      setMapRegion({
        latitude: locationWithAddress.coords.latitude,
        longitude: locationWithAddress.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

    } catch (error) {
      console.error('Error getting location:', error);
      showCustomAlert(
        'Location Error',
        'Unable to get your current location. Please allow location access.',
        'error'
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const calculateFare = async () => {
    if (!pickupCoords || !destinationCoords || isCalculatingFare) return;

    setIsCalculatingFare(true);

    try {
      const breakdown = await fareCalculator.calculateFare(
        pickupCoords,
        destinationCoords,
        selectedVehicle
      );

      if (breakdown) {
        const newAllVehicleFares: { [key in VehicleType]?: number } = {};

        vehicles.forEach(vehicle => {
          if (vehicle.type === selectedVehicle) {
            newAllVehicleFares[vehicle.type] = breakdown.totalFare;
          } else {
            const selectedConfig = vehicles.find(v => v.type === selectedVehicle)?.config;
            if (selectedConfig) {
              const rateRatio = vehicle.config.per_km_rate / selectedConfig.per_km_rate;
              const baseFareRatio = vehicle.config.base_fare / selectedConfig.base_fare;

              const estimatedBaseFare = breakdown.baseFare * baseFareRatio;
              const estimatedDistanceFare = breakdown.distanceFare * rateRatio;
              const estimatedDeadheadCharge = breakdown.deadheadCharge * rateRatio;

              const estimatedTotal = Math.round(
                estimatedBaseFare +
                estimatedDistanceFare +
                breakdown.timeFare +
                breakdown.surgeFare +
                breakdown.platformFee +
                estimatedDeadheadCharge
              );

              newAllVehicleFares[vehicle.type] = Math.max(estimatedTotal, vehicle.config.minimum_fare);
            }
          }
        });

        setAllVehicleFares(prev => ({
          ...prev,
          ...newAllVehicleFares
        }));
      }

      setFareBreakdown(breakdown);
    } catch (error) {
      console.error('Error calculating fare:', error);
      setFareBreakdown(null);
      setAllVehicleFares({});
    } finally {
      setIsCalculatingFare(false);
    }
  };

  const swapLocations = () => {
    const tempLocation = pickupLocation;
    const tempCoords = pickupCoords;

    setPickupLocation(destinationLocation);
    setPickupCoords(destinationCoords);
    setDestinationLocation(tempLocation);
    setDestinationCoords(tempCoords);

    setFareBreakdown(null);
  };

  const handleBookRide = async () => {
    if (!user || !pickupLocation || !destinationLocation || !fareBreakdown) {
      showCustomAlert('Error', 'Please select pickup and destination locations', 'error');
      return;
    }

    setLoading(true);

    try {
      // Validate zones
      const isPickupInZone = isPointInAnyActiveZone(pickupCoords!, activeZones);
      const isDestinationInZone = isPointInAnyActiveZone(destinationCoords!, activeZones);

      if (!isPickupInZone) {
        showCustomAlert('Service Unavailable', 'Sorry! We are not available at this pickup location.', 'warning');
        setLoading(false);
        return;
      }

      if (!isDestinationInZone) {
        showCustomAlert(
          'Out of Service Area',
          'This destination is outside our service area. Please try booking an outstation ride instead.',
          'warning'
        );
        setLoading(false);
        return;
      }

      // Get actual customer UUID
      let actualCustomerId = user.id;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (typeof user.id === 'string' && !uuidRegex.test(user.id)) {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

        const response = await fetch(`${supabaseUrl}/functions/v1/get-customer-uuid`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ customerId: user.id }),
        });

        const result = await response.json();

        if (response.ok && result.user_id) {
          actualCustomerId = result.user_id;
        } else {
          showCustomAlert('Error', 'Failed to validate user account.', 'error');
          setLoading(false);
          return;
        }
      }

      // Create the ride
      const { data: ride, error } = await rideService.createRide({
        customerId: actualCustomerId,
        pickupLocation,
        pickupLatitude: pickupCoords!.latitude,
        pickupLongitude: pickupCoords!.longitude,
        destinationLocation,
        destinationLatitude: destinationCoords!.latitude,
        destinationLongitude: destinationCoords!.longitude,
        vehicleType: selectedVehicle,
        fareAmount: fareBreakdown.totalFare,
      });

      if (error || !ride) {
        showCustomAlert('Error', 'Failed to create ride. Please try again.', 'error');
        setLoading(false);
        return;
      }

      // Store ride ID and switch to driver search view
      setRideId(ride.id);
      setSearchStatus('searching');
      setBottomSheetView('driver-search');

    } catch (error) {
      console.error('Error in handleBookRide:', error);
      showCustomAlert('Error', 'Failed to book ride. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSearch = async () => {
    if (!rideId) return;

    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      await fetch(`${supabaseUrl}/functions/v1/ride-api/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          rideId: rideId,
          userId: user?.id,
          reason: 'Cancelled by customer during driver search',
        }),
      });

      // Reset to booking view
      setRideId(null);
      setSearchStatus('searching');
      setBottomSheetView('booking');
    } catch (error) {
      console.error('Error cancelling ride:', error);
    }
  };

  const handleVehicleSelect = (vehicleType: VehicleType) => {
    setSelectedVehicle(vehicleType);
    if (pickupCoords && destinationCoords && !allVehicleFares[vehicleType]) {
      calculateFare();
    }
  };

  useEffect(() => {
    if (pickupCoords && destinationCoords) {
      calculateFare();
    }
  }, [pickupCoords, destinationCoords]);

  if (locationLoading || vehiclesLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>
            {locationLoading ? 'Getting your location...' : 'Loading vehicle options...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderBookingView = () => (
    <>
      <View style={styles.locationInputs}>
        <View style={styles.locationDots}>
          <View style={styles.pickupDot} />
          <View style={styles.routeLine} />
          <View style={styles.destinationDot} />
        </View>

        <View style={styles.inputsContainer}>
          <TouchableOpacity
            style={styles.locationInput}
            onPress={() => setShowPickupModal(true)}
          >
            <Text style={[styles.locationInputText, !pickupLocation && styles.placeholder]}>
              {pickupLocation || 'Pickup location'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.locationInput}
            onPress={() => setShowDestinationModal(true)}
          >
            <Text style={[styles.locationInputText, !destinationLocation && styles.placeholder]}>
              {destinationLocation || 'Where to?'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.swapButton} onPress={swapLocations}>
          <ArrowUpDown size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <View style={styles.servicesSection}>
        <Text style={styles.servicesTitle}>Other Services</Text>
        <View style={styles.servicesContainer}>
          {serviceOptions.map((service) => {
            const IconComponent = service.icon;
            return (
              <TouchableOpacity
                key={service.id}
                style={styles.serviceButton}
                onPress={() => router.push(service.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.serviceIcon, { backgroundColor: service.color }]}>
                  <IconComponent size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.serviceText}>{service.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {pickupCoords && destinationCoords && vehicles.length > 0 && (
        <View style={styles.vehicleSection}>
          <Text style={styles.sectionTitle}>Choose a ride</Text>

          <View style={styles.vehiclesContainer}>
            {vehicles.map((vehicle) => {
              const isSelected = selectedVehicle === vehicle.type;
              const vehicleFare = allVehicleFares[vehicle.type] || vehicle.config.minimum_fare;

              return (
                <TouchableOpacity
                  key={vehicle.type}
                  style={[
                    styles.vehicleCard,
                    isSelected && styles.selectedVehicleCard,
                  ]}
                  onPress={() => handleVehicleSelect(vehicle.type)}
                  activeOpacity={0.8}
                >
                  <View style={styles.vehicleInfo}>
                    <View style={[
                      styles.vehicleIcon,
                      isSelected && styles.selectedVehicleIcon,
                    ]}>
                      <Text style={styles.vehicleEmoji}>🚗</Text>
                    </View>

                    <View style={styles.vehicleDetails}>
                      <Text style={[
                        styles.vehicleName,
                        isSelected && styles.selectedVehicleName,
                      ]}>
                        {vehicle.name}
                      </Text>

                      <Text style={[
                        styles.vehicleDescription,
                        isSelected && styles.selectedVehicleDescription,
                      ]}>
                        {vehicle.eta}
                      </Text>

                      {fareBreakdown && (
                        <Text style={[
                          styles.vehicleDistance,
                          isSelected && styles.selectedVehicleDescription,
                        ]}>
                          {fareBreakdown.distance}km • {Math.round(fareBreakdown.duration)}min
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.vehiclePricing}>
                    <Text style={[
                      styles.vehiclePrice,
                      isSelected && styles.selectedVehicleText,
                    ]}>
                      {isCalculatingFare && isSelected ? (
                        <ActivityIndicator size="small" color={isSelected ? "#FFFFFF" : "#059669"} />
                      ) : (
                        `₹${vehicleFare.toLocaleString('en-IN')}`
                      )}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {pickupCoords && destinationCoords && vehicles.length > 0 && (
        <View style={styles.bookingSection}>
          <TouchableOpacity
            style={[
              styles.bookButton,
              (!fareBreakdown || loading) && styles.disabledButton
            ]}
            onPress={handleBookRide}
            disabled={!fareBreakdown || loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#1F2937', '#374151']}
              style={styles.bookButtonGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.bookButtonText}>
                  Book {vehicles.find(v => v.type === selectedVehicle)?.name || 'Ride'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const renderDriverSearchView = () => (
    <View style={styles.driverSearchContainer}>
      <View style={styles.searchHeader}>
        <Text style={styles.searchTitle}>Finding Drivers Nearby</Text>
        <TouchableOpacity onPress={handleCancelSearch} style={styles.cancelButton}>
          <X size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <View style={styles.animationContainer}>
        <DriverArrivingAnimation />
      </View>

      <Text style={styles.searchSubtitle}>Searching for the closest driver near you</Text>

      <View style={styles.tripDetails}>
        <View style={styles.tripDetailRow}>
          <View style={styles.locationDotSmall} style={{ backgroundColor: '#059669' }} />
          <Text style={styles.tripLocation}>{pickupLocation}</Text>
        </View>
        <View style={styles.tripDetailRow}>
          <View style={styles.locationDotSmall} style={{ backgroundColor: '#DC2626' }} />
          <Text style={styles.tripLocation}>{destinationLocation}</Text>
        </View>
      </View>
    </View>
  );

  const renderDriverFoundView = () => (
    <View style={styles.driverFoundContainer}>
      <Text style={styles.foundTitle}>Driver Found!</Text>

      {driverData && (
        <View style={styles.driverCard}>
          <View style={styles.driverInfo}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverInitial}>
                {driverData.full_name?.charAt(0) || 'D'}
              </Text>
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{driverData.full_name}</Text>
              <Text style={styles.driverVehicle}>
                {driverData.vehicle_type} • {driverData.vehicle_number}
              </Text>
            </View>
          </View>
        </View>
      )}

      <Text style={styles.redirectText}>Redirecting to ride details...</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapContainer}>
        <EnhancedGoogleMapView
          initialRegion={mapRegion}
          pickupCoords={pickupCoords}
          destinationCoords={destinationCoords}
          availableDrivers={showDriversOnMap ? availableDrivers : []}
          showRoute={true}
          onRouteReady={(result) => {
            if (result.distance > 0 && pickupCoords && destinationCoords) {
              calculateFare();
            }
          }}
          style={styles.map}
          showUserLocation={true}
          followUserLocation={false}
        />
      </View>

      <Animated.View style={[styles.bottomSheet, { height: bottomSheetHeight }]}>
        <View style={styles.dragHandle} />

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {bottomSheetView === 'booking' && renderBookingView()}
          {bottomSheetView === 'driver-search' && renderDriverSearchView()}
          {bottomSheetView === 'driver-found' && renderDriverFoundView()}
        </ScrollView>
      </Animated.View>

      <EnhancedLocationSearchModal
        visible={showPickupModal}
        onClose={() => setShowPickupModal(false)}
        onLocationSelect={(location, coords) => {
          setPickupLocation(location);
          setPickupCoords(coords);
        }}
        placeholder="Search pickup location"
        title="Select Pickup Location"
        currentLocation={currentLocation}
      />

      <EnhancedLocationSearchModal
        visible={showDestinationModal}
        onClose={() => setShowDestinationModal(false)}
        onLocationSelect={(location, coords) => {
          setDestinationLocation(location);
          setDestinationCoords(coords);
        }}
        placeholder="Search destination"
        title="Select Destination"
      />

      <CustomAlert
        visible={customAlert.visible}
        title={customAlert.title}
        message={customAlert.message}
        type={customAlert.type}
        buttons={customAlert.buttons}
        onRequestClose={() => hideCustomAlert()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  scrollView: {
    flex: 1,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  locationInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  locationDots: {
    alignItems: 'center',
    marginRight: 16,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#059669',
    marginBottom: 4,
  },
  routeLine: {
    width: 2,
    height: 40,
    backgroundColor: '#D1D5DB',
    marginVertical: 4,
  },
  destinationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC2626',
    marginTop: 4,
  },
  inputsContainer: {
    flex: 1,
  },
  locationInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  locationInputText: {
    fontSize: 16,
    color: '#1F2937',
  },
  placeholder: {
    color: '#9CA3AF',
  },
  swapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  servicesSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  servicesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  servicesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  serviceButton: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 12,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  vehicleSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  vehiclesContainer: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  selectedVehicleCard: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedVehicleIcon: {
    backgroundColor: '#374151',
  },
  vehicleEmoji: {
    fontSize: 24,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  selectedVehicleName: {
    color: '#FFFFFF',
  },
  vehicleDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  selectedVehicleDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  vehicleDistance: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  vehiclePricing: {
    alignItems: 'flex-end',
  },
  vehiclePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
  selectedVehicleText: {
    color: '#FFFFFF',
  },
  bookingSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  bookButton: {
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  bookButtonGradient: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  driverSearchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  cancelButton: {
    padding: 8,
  },
  animationContainer: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  searchSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 30,
  },
  tripDetails: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  tripDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  tripLocation: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  driverFoundContainer: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
  },
  foundTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 30,
  },
  driverCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 20,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  driverInitial: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  driverDetails: {
    flex: 1,
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
  redirectText: {
    fontSize: 14,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
});
