import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Navigation, ArrowUpDown, Menu, Clock, Plane } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter } from 'expo-router';
import EnhancedGoogleMapView from '../../src/components/EnhancedGoogleMapView';
import EnhancedLocationSearchModal from '../../src/components/EnhancedLocationSearchModal';
import CustomAlert from '../../src/components/CustomAlert';
import { fareCalculator, FareBreakdown, FareConfig } from '../../src/services/fareCalculator';
import { enhancedLocationService } from '../../src/services/enhancedLocationService';
import { rideService } from '../../src/services/rideService';
import { zoneService } from '../../src/services/zoneService';
import { isPointInAnyActiveZone } from '../../src/utils/zoneHelpers';
import { DEFAULT_REGION } from '../../src/config/maps';
import { useRideNotifications } from '../../src/hooks/useRideNotifications';
import { driverLocationService, AvailableDriver } from '../../src/services/driverLocationService';
import { supabase } from '../../src/utils/supabase';

const { width, height } = Dimensions.get('window');

type VehicleType = 'sedan' | 'suv' | 'hatchback' | 'hatchback_ac' | 'sedan_ac' | 'suv_ac';


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
  const { unreadCount } = useRideNotifications();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [pickupLocation, setPickupLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('sedan');
  const [fareBreakdown, setFareBreakdown] = useState<FareBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showDestinationModal, setShowDestinationModal] = useState(false);
  const [mapRegion, setMapRegion] = useState(DEFAULT_REGION);
  const [vehicles, setVehicles] = useState<Array<{
    type: VehicleType;
    name: string;
    description: string;
    eta: string;
    config: FareConfig;
  }>>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [activeZones, setActiveZones] = useState<any[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);
  const [driverPollingInterval, setDriverPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [showDriversOnMap, setShowDriversOnMap] = useState(true);
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
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [{ text: 'OK' }],
  });
  const [isCalculatingFare, setIsCalculatingFare] = useState(false);
  const [allVehicleFares, setAllVehicleFares] = useState<{ [key in VehicleType]?: number }>({});

  useEffect(() => {
    getCurrentLocation();
    loadVehicleTypes();
    loadActiveZones();
    
    // Cleanup polling on unmount
    return () => {
      stopDriverLocationPolling();
    };
  }, []);

  // Start driver polling as soon as we have current location
  useEffect(() => {
    if (currentLocation) {
      console.log('🚗 [HOME] ===== STARTING IMMEDIATE DRIVER DISPLAY =====');
      console.log('🚗 [HOME] Current location available, showing drivers immediately');
      console.log('🚗 [HOME] Location details:', {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy
      });
      console.log('🚗 [HOME] Showing ALL vehicle types (no filter applied)');
      console.log('🚗 [HOME] Should show drivers on map:', showDriversOnMap);
      startDriverLocationPolling();
    }
  }, [currentLocation]);

  // Only hide drivers when both pickup and destination are selected (show route instead)
  useEffect(() => {
    if (pickupCoords && destinationCoords) {
      console.log('🗺️ [HOME] ===== HIDING DRIVERS FOR ROUTE DISPLAY =====');
      console.log('🗺️ [HOME] Both pickup and destination selected, hiding drivers to show route');
      setShowDriversOnMap(false);
      stopDriverLocationPolling();
    } else if (currentLocation && (!pickupCoords || !destinationCoords)) {
      console.log('🚗 [HOME] ===== SHOWING DRIVERS AGAIN =====');
      console.log('🚗 [HOME] Not both locations selected, showing drivers on map');
      console.log('🚗 [HOME] Pickup coords:', !!pickupCoords, 'Destination coords:', !!destinationCoords);
      setShowDriversOnMap(true);
      startDriverLocationPolling();
    }
  }, [pickupCoords, destinationCoords]);

  useEffect(() => {
    // Request location permission immediately when component mounts on Android
    if (Platform.OS === 'android') {
      requestLocationPermissionOnMount();
    }
  }, []);

  const startDriverLocationPolling = () => {
    if (!currentLocation) {
      console.log('🚗 [HOME] No current location available for driver polling');
      return;
    }
    
    console.log('🔄 [HOME] Starting driver location polling with:', {
      currentLocation: {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      },
      vehicleType: selectedVehicle,
      radius: 10
    });
    
    // Clear existing polling
    stopDriverLocationPolling();
    
    // Start new polling
    driverLocationService.startPolling(
      currentLocation.coords.latitude,
      currentLocation.coords.longitude,
      (drivers) => {
        console.log('📍 [HOME] Received driver locations update:', drivers.length, 'drivers');
        setAvailableDrivers(drivers);
      },
      undefined, // Don't filter by vehicle type
      10000 // Poll every 10 seconds for more frequent updates
    );
  };

  // Add effect to monitor availableDrivers state changes
  useEffect(() => {
    console.log('📊 [HOME] ===== AVAILABLE DRIVERS STATE CHANGED =====');
    console.log('📊 [HOME] availableDrivers state update:', {
      count: availableDrivers.length,
      showDriversOnMap,
      driversPassedToMap: showDriversOnMap ? availableDrivers.length : 0,
      drivers: availableDrivers.map(d => ({
        id: d.driver_id,
        vehicle_type: d.vehicle_type,
        distance: d.distance?.toFixed(2) + 'km',
        coordinates: { lat: d.latitude, lng: d.longitude },
        heading: d.heading,
        rating: d.rating
      }))
    });
    
    // Debug what's being passed to the map
    if (showDriversOnMap && availableDrivers.length > 0) {
      console.log('🗺️ [HOME] ===== DRIVERS BEING PASSED TO MAP =====');
      console.log('🗺️ [HOME] Map will receive', availableDrivers.length, 'drivers:');
      availableDrivers.forEach((driver, index) => {
        console.log(`🗺️ [HOME] Driver ${index + 1} for map:`, {
          driver_id: driver.driver_id,
          user_id: driver.user_id,
          vehicle_type: driver.vehicle_type,
          coordinates: { lat: driver.latitude, lng: driver.longitude },
          distance: driver.distance?.toFixed(4) + 'km',
          rating: driver.rating,
          heading: driver.heading,
          updated_at: driver.updated_at
        });
      });
    } else if (showDriversOnMap && availableDrivers.length === 0) {
      console.log('🗺️ [HOME] No drivers to pass to map (availableDrivers is empty)');
    } else if (!showDriversOnMap) {
      console.log('🗺️ [HOME] Not showing drivers on map (showDriversOnMap is false)');
    }
  }, [availableDrivers]);

  const stopDriverLocationPolling = () => {
    console.log('🛑 [HOME] Stopping driver location polling');
    driverLocationService.stopPolling();
  };

  const requestLocationPermissionOnMount = async () => {
    try {
      console.log('📱 Requesting location permission on app start...');
      const hasPermission = await enhancedLocationService.requestLocationPermission();
      
      if (hasPermission) {
        console.log('✅ Location permission granted on mount');
        // Refresh location after permission granted
        getCurrentLocation();
      } else {
        console.log('❌ Location permission denied on mount');
        showCustomAlert(
          'Location Permission Required',
          'A1 Taxi needs location access to find nearby drivers and provide accurate pickup services. Please enable location access in your device settings.',
          'warning',
          [
            { 
              text: 'Retry', 
              onPress: () => requestLocationPermissionOnMount() 
            },
            { 
              text: 'Continue Without Location', 
              style: 'cancel',
              onPress: () => {
                setPickupLocation('');
                setPickupCoords(null);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission on mount:', error);
    }
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
      
      // Initialize all vehicle fares with minimum fares
      const initialFares: { [key in VehicleType]?: number } = {};
      vehicleTypes.forEach(vehicle => {
        initialFares[vehicle.type] = vehicle.config.minimum_fare;
      });
      setAllVehicleFares(initialFares);
      
      // Set default vehicle if current selection is not available
      if (!vehicleTypes.find(v => v.type === selectedVehicle)) {
        const defaultVehicle = vehicleTypes.find(v => v.type === 'sedan') || vehicleTypes[0];
        if (defaultVehicle) {
          setSelectedVehicle(defaultVehicle.type);
        }
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
      // Use fallback vehicle types if database fetch fails
      const fallbackVehicles = getFallbackVehicles();
      setVehicles(fallbackVehicles);
      
      // Initialize fallback fares
      const fallbackFares: { [key in VehicleType]?: number } = {};
      fallbackVehicles.forEach(vehicle => {
        fallbackFares[vehicle.type] = vehicle.config.minimum_fare;
      });
      setAllVehicleFares(fallbackFares);
    } finally {
      setVehiclesLoading(false);
    }
  };

  const getFallbackVehicles = () => {
    const fallbackConfigs = [
      { vehicle_type: 'hatchback', base_fare: 50, per_km_rate: 12, per_minute_rate: 2, minimum_fare: 80, surge_multiplier: 1.0 },
      { vehicle_type: 'hatchback_ac', base_fare: 60, per_km_rate: 15, per_minute_rate: 2, minimum_fare: 100, surge_multiplier: 1.0 },
      { vehicle_type: 'sedan', base_fare: 60, per_km_rate: 15, per_minute_rate: 2, minimum_fare: 100, surge_multiplier: 1.0 },
      { vehicle_type: 'sedan_ac', base_fare: 70, per_km_rate: 18, per_minute_rate: 2, minimum_fare: 120, surge_multiplier: 1.0 },
      { vehicle_type: 'suv', base_fare: 80, per_km_rate: 18, per_minute_rate: 2, minimum_fare: 120, surge_multiplier: 1.0 },
      { vehicle_type: 'suv_ac', base_fare: 100, per_km_rate: 22, per_minute_rate: 2, minimum_fare: 150, surge_multiplier: 1.0 },
    ];

    return fallbackConfigs.map(config => ({
      type: config.vehicle_type as VehicleType,
      name: formatVehicleName(config.vehicle_type),
      description: getVehicleDescription(config.vehicle_type),
      eta: getVehicleETA(config.vehicle_type),
      config: {
        vehicle_type: config.vehicle_type,
        base_fare: config.base_fare,
        per_km_rate: config.per_km_rate,
        per_minute_rate: config.per_minute_rate,
        minimum_fare: config.minimum_fare,
        surge_multiplier: config.surge_multiplier,
      },
    }));
  };

  const loadActiveZones = async () => {
    try {
      const zones = await zoneService.fetchActiveZones();
      setActiveZones(zones);
      console.log('✅ Loaded active zones:', zones.length);
    } catch (error) {
      console.error('❌ Error loading active zones:', error);
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
    const etaMap: { [key: string]: string } = {
      'hatchback': '2-4 min',
      'hatchback_ac': '2-4 min',
      'sedan': '3-5 min',
      'sedan_ac': '3-5 min',
      'suv': '4-6 min',
      'suv_ac': '4-6 min',
    };
    return etaMap[vehicleType] || '3-5 min';
  };

  const showCustomAlert = (
    title: string, 
    message: string, 
    type: 'error' | 'success' | 'info' | 'warning' = 'info',
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>
  ) => {
    console.log('🚨 [CUSTOM_ALERT] Showing alert:', { title, message, type });
    setCustomAlert({
      visible: true,
      title,
      message,
      type,
      buttons: buttons || [{ text: 'OK' }],
    });
  };

  const hideCustomAlert = (buttonAction?: () => void) => {
    console.log('🚨 [CUSTOM_ALERT] Hiding alert');
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
      
      // Convert to Expo Location format for compatibility
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
        'Unable to get your current location. Please allow location access in your browser and try again.',
        'error',
        [
          { 
            text: 'Retry', 
            onPress: () => getCurrentLocation() 
          },
          { 
            text: 'Use Manual Location', 
            style: 'cancel',
            onPress: () => {
              setPickupLocation('');
              setPickupCoords(null);
            }
          }
        ]
      );
    } finally {
      setLocationLoading(false);
    }
  };

  // Calculate fare when conditions are met
  const calculateFare = async () => {
    if (!pickupCoords || !destinationCoords || isCalculatingFare) return;

    setIsCalculatingFare(true);
    console.log('💰 [HOME] ===== STARTING FARE CALCULATION WITH DEADHEAD =====');
    console.log('💰 [HOME] Calculating fare for Bagalur trip:', {
      pickup: pickupLocation,
      destination: destinationLocation,
      pickupCoords,
      destinationCoords,
      selectedVehicle,
      timestamp: new Date().toISOString(),
      shouldHaveDeadhead: destinationLocation.toLowerCase().includes('bagalur')
    });

    try {
      console.log('💰 [HOME] Calling fareCalculator.calculateFare...');
      const breakdown = await fareCalculator.calculateFare(
        pickupCoords,
        destinationCoords,
        selectedVehicle
      );
      
      console.log('💰 [HOME] ===== FARE CALCULATION RESULT =====');
      if (breakdown) {
        console.log('✅ [HOME] Fare breakdown received:', {
          baseFare: `₹${breakdown.baseFare}`,
          distanceFare: `₹${breakdown.distanceFare}`,
          timeFare: `₹${breakdown.timeFare}`,
          surgeFare: `₹${breakdown.surgeFare}`,
          platformFee: `₹${breakdown.platformFee}`,
          deadheadCharge: `₹${breakdown.deadheadCharge}`,
          deadheadDistance: `${breakdown.deadheadDistance}km`,
          totalFare: `₹${breakdown.totalFare}`,
          distance: `${breakdown.distance}km`,
          duration: `${breakdown.duration}min`,
          hasDeadheadCharge: breakdown.deadheadCharge > 0,
          isBagalurTrip: destinationLocation.toLowerCase().includes('bagalur'),
          expectedDeadhead: destinationLocation.toLowerCase().includes('bagalur') ? 'YES' : 'NO'
        });
        
        if (breakdown.deadheadCharge > 0) {
          console.log('🎯 [HOME] ✅ DEADHEAD CHARGE APPLIED:', {
            destination: destinationLocation,
            deadheadCharge: `₹${breakdown.deadheadCharge}`,
            deadheadDistance: `${breakdown.deadheadDistance}km`,
            reason: 'Destination is between Inner Ring and Outer Ring'
          });
        } else {
          console.log('🎯 [HOME] ❌ NO DEADHEAD CHARGE - THIS IS THE PROBLEM:', {
            destination: destinationLocation,
            reason: 'Destination is within Inner Ring or outside service area',
            expectedForBagalur: 'Should have deadhead charge',
            troubleshoot: 'Check edge function logs or zone data'
          });
        }
        
        // Calculate fares for all vehicle types based on the breakdown
        const newAllVehicleFares: { [key in VehicleType]?: number } = {};
        
        console.log('💰 [HOME] Calculating fares for all vehicle types based on', selectedVehicle, 'calculation');
        
        vehicles.forEach(vehicle => {
          if (vehicle.type === selectedVehicle) {
            // Use exact calculated fare for selected vehicle
            newAllVehicleFares[vehicle.type] = breakdown.totalFare;
            console.log(`💰 [HOME] ${vehicle.type} (selected): ₹${breakdown.totalFare} (exact calculation)`);
          } else {
            // Calculate proportional fare for other vehicles
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
              console.log(`💰 [HOME] ${vehicle.type} (estimated): ₹${newAllVehicleFares[vehicle.type]} (ratio-based from ${selectedVehicle})`);
            }
          }
        });
        
        // Merge with existing fares instead of replacing
        setAllVehicleFares(prev => ({
          ...prev,
          ...newAllVehicleFares
        }));
        console.log('💰 [HOME] All vehicle fares calculated:', newAllVehicleFares);
      } else {
        console.error('❌ [HOME] No fare breakdown received from fareCalculator');
      }
      
      setFareBreakdown(breakdown);
    } catch (error) {
      console.error('❌ [HOME] Error calculating fare:', error);
      setFareBreakdown(null);
      setAllVehicleFares({});
    } finally {
      setIsCalculatingFare(false);
    }
  };

  const calculateAllVehicleFares = async () => {
    if (!pickupCoords || !destinationCoords) {
      console.log('💰 [FARE-CALC] Missing coordinates, clearing fares');
      setCalculatedFares({});
      return;
    }

    const currentCalculationKey = Date.now();
    setCurrentCalculationKey(currentCalculationKey);
    setFareCalculating(true);

    console.log('💰 [FARE-CALC] ===== STARTING COMPREHENSIVE FARE CALCULATION =====');
    console.log('💰 [FARE-CALC] Calculation key:', currentCalculationKey);
    console.log('💰 [FARE-CALC] Coordinates:', {
      pickup: pickupCoords,
      destination: destinationCoords
    });

    try {
      // First, get all vehicle configs to ensure we have data for all types
      console.log('📊 [FARE-CALC] Step 1: Loading ALL vehicle configurations...');
      const allConfigs = await fareCalculator.getAllVehicleConfigs();
      
      if (!allConfigs || allConfigs.length === 0) {
        console.error('❌ [FARE-CALC] CRITICAL: No vehicle configs found in database');
        throw new Error('No vehicle configurations available');
      }
      
      console.log('✅ [FARE-CALC] Loaded configs for vehicle types:', allConfigs.map(c => c.vehicle_type));
      
      const newFares: { [key: string]: number } = {};
      const errors: { [key: string]: string } = {};

      const vehicleTypes = allConfigs.map(config => config.vehicle_type);
      
      console.log('💰 [FARE-CALC] Processing vehicle types:', vehicleTypes);

      // Calculate fare for each vehicle type
      for (const vehicleType of vehicleTypes) {
        try {
          console.log(`💰 [FARE-CALC] ===== CALCULATING FOR ${vehicleType.toUpperCase()} =====`);
          
          // Get specific config for this vehicle type
          const vehicleConfig = allConfigs.find(c => c.vehicle_type === vehicleType);
          if (!vehicleConfig) {
            console.error(`❌ [FARE-CALC] No config found for ${vehicleType}`);
            errors[vehicleType] = 'No configuration found';
            newFares[vehicleType] = 0;
            continue;
          }
          
          console.log(`💰 [FARE-CALC] Using config for ${vehicleType}:`, {
            base_fare: vehicleConfig.base_fare,
            per_km_rate: vehicleConfig.per_km_rate,
            per_minute_rate: vehicleConfig.per_minute_rate,
            minimum_fare: vehicleConfig.minimum_fare,
            surge_multiplier: vehicleConfig.surge_multiplier,
            platform_fee: vehicleConfig.platform_fee
          });
          
          const fareBreakdown = await fareCalculator.calculateFare(
            pickupCoords,
            destinationCoords,
            vehicleType
          );

          if (fareBreakdown && fareBreakdown.totalFare > 0) {
            console.log(`✅ [FARE-CALC] ${vehicleType} calculation successful:`, {
              totalFare: `₹${fareBreakdown.totalFare}`,
              baseFare: `₹${fareBreakdown.baseFare}`,
              distanceFare: `₹${fareBreakdown.distanceFare}`,
              timeFare: `₹${fareBreakdown.timeFare}`,
              surgeFare: `₹${fareBreakdown.surgeFare}`,
              platformFee: `₹${fareBreakdown.platformFee}`,
              deadheadCharge: `₹${fareBreakdown.deadheadCharge || 0}`,
              distance: `${fareBreakdown.distance}km`,
              duration: `${fareBreakdown.duration}min`
            });
            newFares[vehicleType] = fareBreakdown.totalFare;
          } else {
            console.error(`❌ [FARE-CALC] ${vehicleType} calculation failed: no valid breakdown`);
            console.error(`❌ [FARE-CALC] ${vehicleType} fareBreakdown result:`, fareBreakdown);
            
            // Try fallback calculation using the config directly
            console.log(`🔄 [FARE-CALC] Attempting fallback calculation for ${vehicleType}...`);
            const fallbackFare = calculateFallbackFare(vehicleConfig, pickupCoords, destinationCoords);
            
            if (fallbackFare > 0) {
              console.log(`✅ [FARE-CALC] ${vehicleType} fallback calculation successful: ₹${fallbackFare}`);
              newFares[vehicleType] = fallbackFare;
            } else {
              console.error(`❌ [FARE-CALC] ${vehicleType} fallback calculation also failed`);
              errors[vehicleType] = 'Both primary and fallback calculations failed';
              newFares[vehicleType] = vehicleConfig.minimum_fare || 50; // Use minimum fare as last resort
            }
          }
        } catch (vehicleError) {
          console.error(`❌ [FARE-CALC] Exception calculating fare for ${vehicleType}:`, vehicleError);
          errors[vehicleType] = vehicleError.message;
          
          // Try to get minimum fare from config as fallback
          const vehicleConfig = allConfigs.find(c => c.vehicle_type === vehicleType);
          const fallbackFare = vehicleConfig?.minimum_fare || 50;
          console.log(`🔄 [FARE-CALC] Using minimum fare fallback for ${vehicleType}: ₹${fallbackFare}`);
          newFares[vehicleType] = fallbackFare;
        }
      }

      console.log('💰 [FARE-CALC] ===== CALCULATION SUMMARY =====');
      console.log('💰 [FARE-CALC] Final fares:', Object.entries(newFares).map(([type, fare]) => `${type}: ₹${fare}`));
      console.log('💰 [FARE-CALC] Errors:', errors);
      console.log('💰 [FARE-CALC] Non-zero fares:', Object.entries(newFares).filter(([_, fare]) => fare > 0).length);
      console.log('💰 [FARE-CALC] Zero fares:', Object.entries(newFares).filter(([_, fare]) => fare === 0).map(([type, _]) => type));

      // Only update state if this is still the current calculation
      if (currentCalculationKey === currentCalculationKey) {
        setCalculatedFares(newFares);
        setFareErrors(errors);
        
        // Update selected vehicle fare
        if (newFares[selectedVehicle] !== undefined) {
          setCalculatedFare(newFares[selectedVehicle]);
        }
      }
    } catch (error) {
      console.error('❌ [FARE-CALC] Fatal error in calculateAllVehicleFares:', error);
      
      if (currentCalculationKey === currentCalculationKey) {
        setCalculatedFares({});
        setFareErrors({ general: error.message });
        setCalculatedFare(0);
      }
      
      // Emergency fallback - set basic fares for all vehicle types
      const emergencyFares: { [key: string]: number } = {
        hatchback: 80,
        hatchback_ac: 100,
        sedan: 100,
        sedan_ac: 120,
        suv: 120,
        suv_ac: 150,
      };
      
      console.log('🚨 [HOME] Using emergency fallback fares:', emergencyFares);
      setCalculatedFares(emergencyFares);
      setCalculatedFare(emergencyFares[selectedVehicle] || 100);
    } finally {
      setFareCalculating(false);
    }
  };

  // Fallback fare calculation using config values directly
  const calculateFallbackFare = (
    config: any,
    pickup: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): number => {
    try {
      console.log(`🔄 [FALLBACK] Calculating fallback fare using config:`, {
        vehicle_type: config.vehicle_type,
        base_fare: config.base_fare,
        per_km_rate: config.per_km_rate,
        per_minute_rate: config.per_minute_rate,
        minimum_fare: config.minimum_fare
      });
      
      // Calculate simple haversine distance
      const distance = enhancedLocationService.calculateHaversineDistance(
        pickup.latitude,
        pickup.longitude,
        destination.latitude,
        destination.longitude
      );
      
      const duration = (distance / 30) * 60; // Assume 30 km/h average speed
      
      console.log(`🔄 [FALLBACK] Route info:`, {
        distance: distance.toFixed(2) + 'km',
        duration: Math.round(duration) + 'min'
      });
      
      // Calculate fare components using 4km base logic
      const baseFare = Number(config.base_fare) || 50;
      
      let distanceFare = 0;
      const baseKmCovered = 4;
      
      if (distance > baseKmCovered) {
        const additionalDistance = distance - baseKmCovered;
        distanceFare = additionalDistance * (Number(config.per_km_rate) || 15);
      }
      
      const timeFare = duration * (Number(config.per_minute_rate) || 2);
      const surgeFare = (baseFare + distanceFare + timeFare) * ((Number(config.surge_multiplier) || 1) - 1);
      
      let subtotal = baseFare + distanceFare + timeFare + surgeFare;
      subtotal = Math.max(subtotal, Number(config.minimum_fare) || 50);
      
      const platformFee = Number(config.platform_fee) || 0;
      const totalFare = subtotal + platformFee;
      
      console.log(`🔄 [FALLBACK] Calculation result:`, {
        baseFare: `₹${baseFare}`,
        distanceFare: `₹${distanceFare}`,
        timeFare: `₹${timeFare}`,
        surgeFare: `₹${surgeFare}`,
        platformFee: `₹${platformFee}`,
        subtotal: `₹${subtotal}`,
        totalFare: `₹${totalFare}`
      });
      
      return Math.round(totalFare);
    } catch (error) {
      console.error(`❌ [FALLBACK] Error in fallback calculation:`, error);
      return Number(config.minimum_fare) || 50;
    }
  };

  const swapLocations = () => {
    const tempLocation = pickupLocation;
    const tempCoords = pickupCoords;
    
    setPickupLocation(destinationLocation);
    setPickupCoords(destinationCoords);
    setDestinationLocation(tempLocation);
    setDestinationCoords(tempCoords);
    
    // Clear fare when locations change
    setFareBreakdown(null);
  };

  const handleBookRide = async () => {
    if (!user || !pickupLocation || !destinationLocation || !fareBreakdown) {
      showCustomAlert('Error', 'Please select pickup and destination locations', 'error');
      return;
    }

    setLoading(true);

    try {
      console.log('🔍 Starting zone validation before ride creation...');
      console.log('🔍 Active zones loaded:', activeZones.length);
      console.log('🔍 Zone details:', activeZones.map(z => ({ name: z.name, active: z.is_active })));
      
      // Step 1: Geocode pickup location if we don't have coordinates
      let pickupValidationCoords = pickupCoords;
      if (!pickupValidationCoords) {
        console.log('📍 Geocoding pickup location:', pickupLocation);
        try {
          const pickupGeocode = await Location.geocodeAsync(pickupLocation);
          if (pickupGeocode && pickupGeocode.length > 0) {
            pickupValidationCoords = {
              latitude: pickupGeocode[0].latitude,
              longitude: pickupGeocode[0].longitude,
            };
            console.log('✅ Pickup geocoded to:', pickupValidationCoords);
          } else {
            throw new Error('Unable to geocode pickup location');
          }
        } catch (geocodeError) {
          console.error('❌ Pickup geocoding failed:', geocodeError);
          showCustomAlert('Error', 'Unable to validate pickup location. Please try selecting it again.', 'error');
          setLoading(false);
          return;
        }
      }

      // Step 2: Geocode destination location if we don't have coordinates
      let destinationValidationCoords = destinationCoords;
      if (!destinationValidationCoords) {
        console.log('📍 Geocoding destination location:', destinationLocation);
        try {
          const destinationGeocode = await Location.geocodeAsync(destinationLocation);
          if (destinationGeocode && destinationGeocode.length > 0) {
            destinationValidationCoords = {
              latitude: destinationGeocode[0].latitude,
              longitude: destinationGeocode[0].longitude,
            };
            console.log('✅ Destination geocoded to:', destinationValidationCoords);
          } else {
            throw new Error('Unable to geocode destination location');
          }
        } catch (geocodeError) {
          console.error('❌ Destination geocoding failed:', geocodeError);
          showCustomAlert('Error', 'Unable to validate destination location. Please try selecting it again.', 'error');
          setLoading(false);
          return;
        }
      }

      // Step 3: Validate pickup location is within active zones
      console.log('🔍 Validating pickup location against active zones...');
      const isPickupInZone = isPointInAnyActiveZone(pickupValidationCoords, activeZones);
      
      if (!isPickupInZone) {
        console.log('❌ Pickup location is out of zone:', pickupValidationCoords);
        console.log('🚨 [DEBUG] About to show pickup out-of-zone custom alert');
        showCustomAlert('Service Unavailable', 'Sorry! We are not available at this pickup location at the moment.', 'warning');
        console.log('🚨 [DEBUG] Custom alert called for pickup out-of-zone');
        setLoading(false);
        return;
      }
      
      console.log('✅ Pickup location is within active zones');

      // Step 4: Validate destination location is within active zones
      console.log('🔍 Validating destination location against active zones...');
      console.log('🔍 Destination coords for validation:', destinationValidationCoords);
      const isDestinationInZone = isPointInAnyActiveZone(destinationValidationCoords, activeZones);
      
      if (!isDestinationInZone) {
        console.log('❌ Destination location is out of zone:', destinationValidationCoords);
        console.log('🚨 [DEBUG] About to show destination out-of-zone custom alert');
        showCustomAlert(
          'Out of Service Area', 
          'This destination is outside our service area. Please try booking an outstation ride instead.',
          'warning',
          [
            { text: 'Book Outstation', onPress: () => router.push({
              pathname: '/booking/outstation',
              params: {
                prefilledDestination: destinationLocation,
                prefilledDestinationLat: destinationValidationCoords.latitude.toString(),
                prefilledDestinationLng: destinationValidationCoords.longitude.toString(),
              }
            }) },
            { text: 'Choose Different Location', style: 'cancel' }
          ]
        );
        console.log('🚨 [DEBUG] Custom alert called for destination out-of-zone');
        setLoading(false);
        return;
      }
      
      console.log('✅ Destination location is within active zones');
      console.log('✅ Both locations validated successfully, proceeding with ride creation...');

      // Step 5: Ensure we have coordinates for ride creation
      if (!pickupCoords) {
        setPickupCoords(pickupValidationCoords);
      }
      if (!destinationCoords) {
        setDestinationCoords(destinationValidationCoords);
      }

      // Create the ride first
      console.log('🚗 About to create ride with rideService...');
      console.log('🚗 User object:', JSON.stringify(user, null, 2));
      console.log('🚗 User ID being passed as customerId:', user.id);
      console.log('🚗 User ID type:', typeof user.id);

      // FIX: If user.id is not a valid UUID (like "2"), fetch the correct UUID from Customers table
      let actualCustomerId = user.id;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (typeof user.id === 'string' && !uuidRegex.test(user.id)) {
        console.log('⚠️ User ID is not a valid UUID, fetching correct UUID from Customers table...');
        console.log('⚠️ Invalid user.id:', user.id);

        try {
          const { data: customerData, error: customerError } = await supabase
            .from('Customers')
            .select('user_id')
            .eq('id', user.id)
            .maybeSingle();

          if (customerData && customerData.user_id) {
            actualCustomerId = customerData.user_id;
            console.log('✅ Found correct UUID from Customers table:', actualCustomerId);
          } else {
            console.error('❌ Failed to fetch correct UUID:', customerError);
            showCustomAlert('Error', 'Failed to validate user account. Please sign out and sign back in.', 'error');
            setLoading(false);
            return;
          }
        } catch (lookupError) {
          console.error('❌ Exception while fetching UUID:', lookupError);
          showCustomAlert('Error', 'Failed to validate user account. Please sign out and sign back in.', 'error');
          setLoading(false);
          return;
        }
      } else if (typeof user.id === 'number') {
        console.log('⚠️ User ID is a number, converting and fetching correct UUID from Customers table...');
        console.log('⚠️ Numeric user.id:', user.id);

        try {
          const { data: customerData, error: customerError } = await supabase
            .from('Customers')
            .select('user_id')
            .eq('id', user.id)
            .maybeSingle();

          if (customerData && customerData.user_id) {
            actualCustomerId = customerData.user_id;
            console.log('✅ Found correct UUID from Customers table:', actualCustomerId);
          } else {
            console.error('❌ Failed to fetch correct UUID:', customerError);
            showCustomAlert('Error', 'Failed to validate user account. Please sign out and sign back in.', 'error');
            setLoading(false);
            return;
          }
        } catch (lookupError) {
          console.error('❌ Exception while fetching UUID:', lookupError);
          showCustomAlert('Error', 'Failed to validate user account. Please sign out and sign back in.', 'error');
          setLoading(false);
          return;
        }
      }

      console.log('🚗 Using customer ID:', actualCustomerId);
      const { data: ride, error } = await rideService.createRide({
        customerId: actualCustomerId,
        pickupLocation,
        pickupLatitude: pickupValidationCoords.latitude,
        pickupLongitude: pickupValidationCoords.longitude,
        destinationLocation,
        destinationLatitude: destinationValidationCoords.latitude,
        destinationLongitude: destinationValidationCoords.longitude,
        vehicleType: selectedVehicle,
        fareAmount: fareBreakdown.totalFare,
      });

      if (error) {
        console.error('Error creating ride:', error);
        console.error('🚗 Ride creation failed with error:', JSON.stringify(error, null, 2));
        showCustomAlert('Error', 'Failed to create ride. Please try again.', 'error');
        setLoading(false);
        return;
      }

      if (!ride || !ride.id) {
        console.error('🚗 Ride creation returned no data:', ride);
        showCustomAlert('Error', 'Failed to create ride. Please try again.', 'error');
        setLoading(false);
        return;
      }
      console.log('✅ Ride created successfully:', ride.id);

      // Navigate to driver search screen with ride data
      console.log('🚗 Navigating to driver search with params:', {
        rideId: ride.id,
        pickupLocation,
        destinationLocation,
        vehicleType: selectedVehicle,
        fareAmount: fareBreakdown.totalFare,
      });
      
      try {
        console.log('🚗 Attempting navigation to driver search...');
        
        const navigationParams = {
          rideId: ride.id,
          pickupLocation,
          destinationLocation,
          pickupLatitude: String(pickupCoords?.latitude ?? ''),
          pickupLongitude: String(pickupCoords?.longitude ?? ''),
          destinationLatitude: String(destinationCoords?.latitude ?? ''),
          destinationLongitude: String(destinationCoords?.longitude ?? ''),
          vehicleType: selectedVehicle,
          fareAmount: String(fareBreakdown.totalFare ?? ''),
          distance: fareBreakdown.distance.toString(),
          duration: fareBreakdown.duration.toString(),
        };
        
        console.log('🚗 Navigation params prepared:', navigationParams);
        
        // Use replace instead of push to avoid navigation stack issues
        await router.replace({
          pathname: '/booking/driver-search',
          params: navigationParams,
        });
        
        console.log('✅ Navigation completed successfully');
      } catch (navigationError) {
        console.error('❌ Navigation failed:', navigationError);
        console.error('❌ Navigation error details:', JSON.stringify(navigationError, null, 2));
        showCustomAlert('Navigation Error', 'Failed to navigate to driver search. Please try again.', 'error');
        setLoading(false);
        return;
      }
      
    } catch (error) {
      console.error('Error in handleBookRide:', error);
      console.error('🚗 handleBookRide exception details:', JSON.stringify(error, null, 2));
      showCustomAlert('Error', 'Failed to book ride. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle vehicle selection and trigger fare calculation
  const handleVehicleSelect = (vehicleType: VehicleType) => {
    console.log('🚗 [HOME] Vehicle selected:', vehicleType);
    setSelectedVehicle(vehicleType);
    // Don't clear fares - keep existing calculated values
    // Only recalculate if we don't have a fare for this vehicle type
    if (pickupCoords && destinationCoords && !allVehicleFares[vehicleType]) {
      console.log('🔄 [HOME] No fare calculated for', vehicleType, '- triggering calculation');
      calculateFare();
    }
  };

  // Calculate fare only when locations change, not when vehicle changes
  React.useEffect(() => {
    if (pickupCoords && destinationCoords) {
      console.log('🔄 [HOME] Triggering fare calculation due to location/vehicle change');
      calculateFare();
    }
  }, [pickupCoords, destinationCoords]);

  // Calculate fare for any vehicle type consistently
  const calculateVehicleFare = (vehicleConfig: FareConfig, distance: number): number => {
    const baseFare = vehicleConfig.base_fare;
    
    // 4km base fare logic: base fare covers first 4km
    let distanceFare = 0;
    const baseKmCovered = 4;
    
    if (distance > baseKmCovered) {
      const additionalDistance = distance - baseKmCovered;
      distanceFare = additionalDistance * vehicleConfig.per_km_rate;
    }
    
    // Platform fee (flat amount from database)
    const platformFee = vehicleConfig.platform_fee_percent || 0;
    
    const totalFare = baseFare + distanceFare + platformFee;
    
    return Math.round(Math.max(totalFare, vehicleConfig.minimum_fare));
  };

  // Extract zone validation logic into separate function
  const validateDestinationZone = (location: string, coords: { latitude: number; longitude: number }) => {
    console.log('🔍 Validating destination zone for:', { location, coords });
    
    // Validate destination is within active zones
    const isDestinationInZone = isPointInAnyActiveZone(coords, activeZones);
    
    if (!isDestinationInZone) {
      console.log('❌ Destination location is out of zone:', coords);
      showCustomAlert(
        'Out of Service Area', 
        'This destination is outside our service area. Please try booking an outstation ride instead.',
        'warning',
        [
          { text: 'Book Outstation', onPress: () => router.push({
            pathname: '/booking/outstation',
            params: {
              prefilledDestination: location,
              prefilledDestinationLat: coords.latitude.toString(),
              prefilledDestinationLng: coords.longitude.toString(),
            }
          }) },
          { text: 'Choose Different Location', style: 'cancel' }
        ]
      );
      return; // Don't set the destination if it's out of zone
    }
    
    console.log('✅ Destination location is within active zones');
    setDestinationLocation(location);
    setDestinationCoords(coords);
  };

  // Handle destination selection with airport detection
  const handleDestinationSelect = async (location: string, coords: { latitude: number; longitude: number }) => {
    console.log('🔍 Destination location selected, validating zone...');
    console.log('🔍 Selected destination:', { location, coords });
    console.log('🔍 Active zones for validation:', activeZones.length);
    
    // Check if destination is Kempegowda Airport BEFORE zone validation
    const isAirportDestination = location.toLowerCase().includes('kempegowda') && 
                               location.toLowerCase().includes('airport');
    
    if (isAirportDestination) {
      console.log('✈️ Airport destination detected, showing airport booking option');
      showCustomAlert(
        'Airport Transfer Available',
        'You\'ve selected Kempegowda International Airport. We recommend using our specialized Airport Transfer service for better rates and dedicated service.',
        'info',
        [
          { 
            text: 'Use Airport Booking', 
            onPress: () => router.push({
              pathname: '/booking/airport',
              params: {
                serviceType: 'drop',
                prefilledDestination: location,
                prefilledDestinationLat: coords.latitude.toString(),
                prefilledDestinationLng: coords.longitude.toString(),
              }
            })
          },
          { 
            text: 'Continue Regular Ride', 
            style: 'cancel',
            onPress: () => {
              // Proceed with regular zone validation
              validateDestinationZone(location, coords);
            }
          }
        ]
      );
      return; // Don't set destination yet, wait for user choice
    }
    
    // If not airport, proceed with normal zone validation
    validateDestinationZone(location, coords);
  };

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

  return (
    <SafeAreaView style={styles.container}>
      {/* Map Container - Top Half */}
      <View style={styles.mapContainer}>
        <EnhancedGoogleMapView
          initialRegion={mapRegion}
          pickupCoords={pickupCoords}
          destinationCoords={destinationCoords}
          availableDrivers={showDriversOnMap ? availableDrivers : []}
          showRoute={true}
          onRouteReady={(result) => {
            // Calculate fare when route is ready
            if (result.distance > 0 && pickupCoords && destinationCoords) {
              calculateFare();
            }
          }}
          style={styles.map}
          showUserLocation={true}
          followUserLocation={false}
        />
      </View>

      {/* Bottom Sheet - Bottom Half */}
      <View style={styles.bottomSheet}>
        <View style={styles.dragHandle} />
        
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* Location inputs */}
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

          {/* Service Options - Horizontal */}
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

          {/* Vehicle selection */}
          {pickupCoords && destinationCoords && vehicles.length > 0 && (
            <View style={styles.vehicleSection}>
              <Text style={styles.sectionTitle}>Choose a ride</Text>
              
              <View style={styles.vehiclesContainer}>
                {vehicles.map((vehicle) => {
                const isSelected = selectedVehicle === vehicle.type;
                
                // Get fare for this vehicle type
                const vehicleFare = allVehicleFares[vehicle.type] || vehicle.config.minimum_fare;
                const showingCalculated = !!allVehicleFares[vehicle.type];
                
                console.log(`💰 [UI] Displaying fare for ${vehicle.type}:`, {
                  fare: vehicleFare,
                  isSelected,
                  showingCalculated,
                  source: showingCalculated ? 'calculated' : 'minimum_fare'
                });
                
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

          {/* Book ride button */}
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
        </ScrollView>
      </View>

      {/* Location search modals */}
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
        onLocationSelect={handleDestinationSelect}
        placeholder="Search destination"
        title="Select Destination"
      />

      {/* Custom Alert */}
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
    height: height * 0.5, // Top half of screen
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  bottomSheet: {
    flex: 1,
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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
  estimateText: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
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