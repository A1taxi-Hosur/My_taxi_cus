import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plane, MapPin, Navigation, Clock, Users } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/utils/supabase';
import { notificationService } from '../../src/services/notificationService';
import { enhancedLocationService } from '../../src/services/enhancedLocationService';
import { zoneService } from '../../src/services/zoneService';
import { isPointInAnyActiveZone } from '../../src/utils/zoneHelpers';
import { useRouter } from 'expo-router';
import LocationPicker from '../../src/components/LocationPicker';
import DateTimePicker from '../../src/components/DateTimePicker';
import { useLocalSearchParams } from 'expo-router';
import CustomAlert from '../../src/components/CustomAlert';

type VehicleType = 'sedan' | 'suv' | 'hatchback' | 'hatchback_ac' | 'sedan_ac' | 'suv_ac';
type ServiceType = 'pickup' | 'drop';

interface AirportFareConfig {
  id: string;
  vehicle_type: VehicleType;
  hosur_to_airport_fare: number;
  airport_to_hosur_fare: number;
  is_active: boolean;
}

const KEMPEGOWDA_AIRPORT = {
  name: 'Kempegowda International Airport, Bangalore',
  coordinates: { latitude: 13.1986, longitude: 77.7066 },
};

export default function AirportBookingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType>((params.serviceType as ServiceType) || 'pickup');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [fromCoords, setFromCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [toCoords, setToCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('sedan');
  const [pickupDateTime, setPickupDateTime] = useState(new Date());
  const [airportFareConfigs, setAirportFareConfigs] = useState<AirportFareConfig[]>([]);
  const [fixedFares, setFixedFares] = useState<{ [key in VehicleType]?: number }>({});
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [configsLoading, setConfigsLoading] = useState(true);
  const [activeZones, setActiveZones] = useState<any[]>([]);
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

  useEffect(() => {
    getCurrentLocation();
    loadAirportFareConfigs();
    loadActiveZones();
    
    // Handle prefilled destination from regular ride page
    if (params.prefilledDestination && params.prefilledDestinationLat && params.prefilledDestinationLng) {
      console.log('🎯 [AIRPORT] Pre-populating destination from regular ride:', {
        destination: params.prefilledDestination,
        coordinates: {
          lat: params.prefilledDestinationLat,
          lng: params.prefilledDestinationLng
        }
      });
      
      // For airport drop, the destination is already set to airport
      // So we don't need to override it with the prefilled destination
      if (serviceType === 'pickup') {
        setToLocation(params.prefilledDestination as string);
        setToCoords({
          latitude: parseFloat(params.prefilledDestinationLat as string),
          longitude: parseFloat(params.prefilledDestinationLng as string),
        });
      }
    }
  }, []);

  useEffect(() => {
    // Set default locations based on service type
    if (serviceType === 'pickup') {
      // Airport Pickup: From Airport to User's Location
      setFromLocation(KEMPEGOWDA_AIRPORT.name);
      setFromCoords(KEMPEGOWDA_AIRPORT.coordinates);
      // Clear destination - user must select
      setToLocation('');
      setToCoords(null);
    } else {
      // Airport Drop: From User's Location to Airport
      // Clear FROM location first, then set current location
      setFromLocation('');
      setFromCoords(null);
      setToLocation(KEMPEGOWDA_AIRPORT.name);
      setToCoords(KEMPEGOWDA_AIRPORT.coordinates);
      
      // Set current location as FROM location for airport drop
      if (currentLocation) {
        getCurrentLocationAddress();
      }
    }
    
    // Update fixed fares when service type changes
    updateFixedFares();
  }, [serviceType, currentLocation]);

  useEffect(() => {
    // Update fixed fares when configs are loaded
    if (airportFareConfigs.length > 0) {
      updateFixedFares();
    }
  }, [airportFareConfigs, serviceType]);

  const getCurrentLocation = async () => {
    try {
      const locationWithAddress = await enhancedLocationService.getCurrentLocationWithAddress();
      
      if (locationWithAddress) {
        const expoLocation: Location.LocationObject = {
          coords: {
            latitude: locationWithAddress.coords.latitude,
            longitude: locationWithAddress.coords.longitude,
            altitude: locationWithAddress.coords.altitude || null,
            accuracy: locationWithAddress.coords.accuracy || null,
            altitudeAccuracy: null,
            heading: locationWithAddress.coords.heading || null,
            speed: locationWithAddress.coords.speed || null,
          },
          timestamp: locationWithAddress.timestamp,
        };
        
        setCurrentLocation(expoLocation);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Unable to get your current location');
    } finally {
      setLocationLoading(false);
    }
  };

  const getCurrentLocationAddress = async () => {
    if (!currentLocation) return;

    try {
      console.log('🗺️ Getting address for current location:', {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy
      });
      
      let currentAddress = 'Current Location';
      
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        
        console.log('🏠 Reverse geocoding result:', address);
        
        if (address) {
          const addressParts = [
            address.street,
            address.district,
            address.city,
            address.region
          ].filter(Boolean);
          currentAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Current Location';
          console.log('✅ Formatted address:', currentAddress);
        }
      } catch (geocodeError) {
        console.warn('⚠️ Geocoding failed:', geocodeError);
        currentAddress = `Current Location (${currentLocation.coords.latitude.toFixed(4)}, ${currentLocation.coords.longitude.toFixed(4)})`;
      }

      console.log('📍 Setting FROM location to:', currentAddress);
      console.log('📍 Setting FROM coordinates to:', {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      
      setFromLocation(currentAddress);
      setFromCoords({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting current location address:', error);
    }
  };

  const loadAirportFareConfigs = async () => {
    try {
      console.log('🚕 [AIRPORT] ========== LOADING AIRPORT FARES ==========');
      console.log('🚕 [AIRPORT] Fetching from airport_fares table...');

      const { data, error } = await supabase
        .from('airport_fares')
        .select('id, vehicle_type, hosur_to_airport_fare, airport_to_hosur_fare, is_active')
        .eq('is_active', true)
        .order('vehicle_type');

      console.log('🚕 [AIRPORT] Raw database response:', { data, error });

      if (error) {
        console.error('❌ [AIRPORT] Database error:', error);
        throw error;
      }

      if (data && data.length > 0) {
        console.log('✅ [AIRPORT] Successfully loaded', data.length, 'fare configs from database');

        // Convert fare values to numbers (they might be strings from DB)
        const normalizedData = data.map(fare => {
          const normalized = {
            ...fare,
            hosur_to_airport_fare: parseFloat(fare.hosur_to_airport_fare.toString()),
            airport_to_hosur_fare: parseFloat(fare.airport_to_hosur_fare.toString()),
          };
          console.log(`📋 [AIRPORT] ${fare.vehicle_type}:`, {
            hosur_to_airport: normalized.hosur_to_airport_fare,
            airport_to_hosur: normalized.airport_to_hosur_fare
          });
          return normalized;
        });

        console.log('✅ [AIRPORT] All normalized fares:', normalizedData);
        setAirportFareConfigs(normalizedData);
        console.log('✅ [AIRPORT] ========== FARES LOADED SUCCESSFULLY ==========');
      } else {
        console.log('⚠️ [AIRPORT] No fares found in database, using fallback');
        setAirportFareConfigs(getFallbackAirportConfigs());
      }
    } catch (error) {
      console.error('❌ [AIRPORT] Exception loading fares:', error);
      console.log('⚠️ [AIRPORT] Falling back to hardcoded values');
      setAirportFareConfigs(getFallbackAirportConfigs());
    } finally {
      setConfigsLoading(false);
    }
  };

  const getFallbackAirportConfigs = (): AirportFareConfig[] => {
    // Fallback values matching the database
    console.log('⚠️ [AIRPORT] Using fallback airport fare configs');
    return [
      { id: 'fallback1', vehicle_type: 'hatchback', hosur_to_airport_fare: 1850, airport_to_hosur_fare: 1600, is_active: true },
      { id: 'fallback2', vehicle_type: 'hatchback_ac', hosur_to_airport_fare: 1700, airport_to_hosur_fare: 1700, is_active: true },
      { id: 'fallback3', vehicle_type: 'sedan', hosur_to_airport_fare: 1800, airport_to_hosur_fare: 1800, is_active: true },
      { id: 'fallback4', vehicle_type: 'sedan_ac', hosur_to_airport_fare: 1900, airport_to_hosur_fare: 1900, is_active: true },
      { id: 'fallback5', vehicle_type: 'suv', hosur_to_airport_fare: 4000, airport_to_hosur_fare: 4000, is_active: true },
      { id: 'fallback6', vehicle_type: 'suv_ac', hosur_to_airport_fare: 4500, airport_to_hosur_fare: 4500, is_active: true },
    ];
  };

  const updateFixedFares = () => {
    if (airportFareConfigs.length === 0) {
      console.log('⚠️ [AIRPORT] No airport fare configs available to update');
      return;
    }

    console.log('📊 [AIRPORT] Updating fixed fares for service type:', serviceType);
    console.log('📊 [AIRPORT] Available configs:', airportFareConfigs.map(c => ({
      type: c.vehicle_type,
      pickup: c.airport_to_hosur_fare,
      drop: c.hosur_to_airport_fare
    })));

    const newFixedFares: { [key in VehicleType]?: number } = {};

    airportFareConfigs.forEach(config => {
      // Use the appropriate fare based on service type
      // pickup = airport_to_hosur, drop = hosur_to_airport
      const fare = serviceType === 'pickup'
        ? config.airport_to_hosur_fare
        : config.hosur_to_airport_fare;

      newFixedFares[config.vehicle_type] = fare;

      console.log(`✅ [AIRPORT] ${config.vehicle_type} ${serviceType} fare: ₹${fare}`);
    });

    setFixedFares(newFixedFares);
    console.log('✅ [AIRPORT] All fixed fares updated:', newFixedFares);
  };

  const loadActiveZones = async () => {
    try {
      const zones = await zoneService.fetchActiveZones();
      setActiveZones(zones);
      console.log('✅ [AIRPORT] Loaded active zones:', zones.length);
    } catch (error) {
      console.error('❌ [AIRPORT] Error loading active zones:', error);
      setActiveZones([]);
    }
  };

  const showCustomAlert = (
    title: string,
    message: string,
    type: 'error' | 'success' | 'info' | 'warning' = 'info',
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }> = [{ text: 'OK' }]
  ) => {
    setCustomAlert({
      visible: true,
      title,
      message,
      type,
      buttons,
    });
  };

  const hideCustomAlert = () => {
    setCustomAlert({
      visible: false,
      title: '',
      message: '',
      type: 'info',
      buttons: [{ text: 'OK' }],
    });
  };

  const validateLocationInZone = (location: string, coords: { latitude: number; longitude: number }, locationType: 'pickup' | 'destination'): boolean => {
    console.log('🔍 [AIRPORT] Validating location in zone:', {
      location,
      coords,
      locationType,
      serviceType,
      activeZones: activeZones.length
    });

    const isInZone = isPointInAnyActiveZone(coords, activeZones);
    
    console.log('🔍 [AIRPORT] Zone validation result:', {
      isInZone,
      location,
      coords,
      activeZonesCount: activeZones.length,
      shouldShowAlert: !isInZone
    });
    if (!isInZone) {
      console.log('❌ [AIRPORT] Location is out of zone:', coords);
      console.log('🚨 [AIRPORT] About to show alert for out of zone location');
      
      // Use setTimeout to ensure alert shows after state updates
      setTimeout(() => {
        console.log('🚨 [AIRPORT] Showing zone validation alert');
        showCustomAlert(
          'Location Out of Service Area',
          'This location is outside our service area. Please contact A1 Taxi - 04344 221 221',
          'warning',
          [
            { 
              text: 'OK',
              onPress: () => {
                console.log('🚨 [AIRPORT] Zone validation alert dismissed');
              }
            }
          ]
        );
      }, 100);
      
      return false;
    }
    
    console.log('✅ [AIRPORT] Location is within active zones');
    return true;
  };

  const handleFromLocationSelect = (location: string, coords: { latitude: number; longitude: number }) => {
    console.log('📍 [AIRPORT] FROM location selected:', { location, coords, serviceType });
    
    // For airport drop, validate FROM location is in zone
    if (serviceType === 'drop') {
      console.log('🔍 [AIRPORT] Validating FROM location for airport drop');
      if (!validateLocationInZone(location, coords, 'pickup')) {
        console.log('❌ [AIRPORT] FROM location validation failed, not setting location');
        return; // Don't set location if validation fails
      }
    }
    
    console.log('✅ [AIRPORT] Setting FROM location:', location);
    setFromLocation(location);
    setFromCoords(coords);
  };

  const handleToLocationSelect = (location: string, coords: { latitude: number; longitude: number }) => {
    console.log('📍 [AIRPORT] TO location selected:', { location, coords, serviceType });
    
    // For airport pickup, validate TO location is in zone
    if (serviceType === 'pickup') {
      console.log('🔍 [AIRPORT] Validating TO location for airport pickup');
      if (!validateLocationInZone(location, coords, 'destination')) {
        console.log('❌ [AIRPORT] TO location validation failed, not setting location');
        return; // Don't set location if validation fails
      }
    }
    
    console.log('✅ [AIRPORT] Setting TO location:', location);
    setToLocation(location);
    setToCoords(coords);
  };

  // Check if required locations are selected based on service type
  const areRequiredLocationsSelected = () => {
    if (serviceType === 'pickup') {
      // Airport pickup: FROM is fixed (airport), need TO location
      return fromCoords && toCoords;
    } else {
      // Airport drop: TO is fixed (airport), need FROM location  
      return fromCoords && toCoords;
    }
  };

  const shouldShowVehicles = airportFareConfigs.length > 0 && areRequiredLocationsSelected();

  const formatVehicleName = (vehicleType: VehicleType): string => {
    const nameMap: { [key in VehicleType]: string } = {
      'hatchback': 'Hatchback',
      'hatchback_ac': 'Hatchback AC',
      'sedan': 'Sedan',
      'sedan_ac': 'Sedan AC',
      'suv': 'Premium SUV',
      'suv_ac': 'Premium SUV AC',
    };
    return nameMap[vehicleType];
  };

  const getVehicleDescription = (vehicleType: VehicleType): string => {
    const descriptionMap: { [key in VehicleType]: string } = {
      'hatchback': 'Economical choice',
      'hatchback_ac': 'Economical with AC',
      'sedan': 'Comfortable & reliable',
      'sedan_ac': 'Comfortable with AC',
      'suv': 'Spacious & luxurious',
      'suv_ac': 'Luxury with AC',
    };
    return descriptionMap[vehicleType];
  };

  const handleBookAirport = async () => {
    console.log('🎯 [AIRPORT] handleBookAirport called - START');
    console.log('🎯 [AIRPORT] Validation check:', {
      hasUser: !!user,
      hasFromCoords: !!fromCoords,
      hasToCoords: !!toCoords,
      selectedFare: fixedFares[selectedVehicle],
      serviceType,
      fromLocation,
      toLocation
    });
    
    if (!user || !fromCoords || !toCoords) {
      console.log('🎯 [AIRPORT] Validation failed - missing required data');
      Alert.alert('Error', 'Please complete all required fields');
      return;
    }

    const selectedFare = fixedFares[selectedVehicle];
    if (!selectedFare) {
      console.log('🎯 [AIRPORT] Validation failed - no fixed fare available');
      Alert.alert('Error', 'Fare not available. Please try again.');
      return;
    }

    console.log('🎯 [AIRPORT] Starting booking process...');
    setLoading(true);
    
    try {
      console.log('🎯 [AIRPORT] Creating booking via edge function...');

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      const bookingData = {
        customer_id: user.id,
        booking_type: 'airport',
        vehicle_type: selectedVehicle,
        pickup_address: fromLocation,
        pickup_latitude: fromCoords.latitude,
        pickup_longitude: fromCoords.longitude,
        destination_address: toLocation,
        destination_latitude: toCoords.latitude,
        destination_longitude: toCoords.longitude,
        scheduled_time: pickupDateTime.toISOString(),
        estimated_fare: selectedFare,
        special_instructions: `Airport ${serviceType} - ${serviceType === 'pickup' ? 'From' : 'To'} Kempegowda Airport • Pickup time: ${pickupDateTime.toLocaleString()}.`,
        status: 'pending',
      };

      const response = await fetch(`${supabaseUrl}/functions/v1/create-scheduled-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(bookingData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🎯 [AIRPORT] Edge function error:', errorText);
        throw new Error(errorText);
      }

      const result = await response.json();

      if (result.error) {
        console.error('🎯 [AIRPORT] Database error:', result.error);
        throw new Error(result.error);
      }

      const data = result.data;

      console.log('🎯 [AIRPORT] Booking created successfully:', data.id);

      // Send notification to admin for airport booking (admin will assign driver)
      try {
        console.log('📋 Sending admin notification for airport booking...');
        await notificationService.sendAdminBookingNotification({
          id: data.id,
          booking_type: 'airport',
          customer_id: user.id,
          customer_name: user.full_name,
          customer_phone: user.phone_number,
          pickup_address: fromLocation,
          destination_address: toLocation,
          vehicle_type: selectedVehicle,
          fare_amount: selectedFare,
          special_instructions: `Airport ${serviceType} - ${serviceType === 'pickup' ? 'From' : 'To'} Kempegowda Airport • Pickup time: ${pickupDateTime.toLocaleString()}. ADMIN ALLOCATION REQUIRED - Do not send to drivers directly.`,
        });
        console.log('✅ Admin notification sent for airport booking');
      } catch (notificationError) {
        console.warn('⚠️ Admin notification failed (non-blocking):', notificationError);
      }

      console.log('🎯 [AIRPORT] About to navigate to driver search...');
      console.log('🎯 [AIRPORT] Navigation params:', {
        bookingId: data.id,
        bookingType: 'airport',
        pickupLocation: fromLocation,
        destinationLocation: toLocation,
        vehicleType: selectedVehicle,
        pickupLatitude: fromCoords.latitude,
        pickupLongitude: fromCoords.longitude,
        destinationLatitude: toCoords.latitude,
        destinationLongitude: toCoords.longitude,
        fareAmount: selectedFare,
        scheduledTime: pickupDateTime.toISOString(),
      });

      router.push({
        pathname: '/booking/driver-search',
        params: {
          bookingId: data.id,
          bookingType: 'airport',
          pickupLocation: fromLocation,
          destinationLocation: toLocation,
          vehicleType: selectedVehicle,
          pickupLatitude: fromCoords.latitude.toString(),
          pickupLongitude: fromCoords.longitude.toString(),
          destinationLatitude: toCoords.latitude.toString(),
          destinationLongitude: toCoords.longitude.toString(),
          fareAmount: selectedFare.toString(),
          scheduledTime: pickupDateTime.toISOString(),
        },
      });

      console.log('🎯 [AIRPORT] Navigation completed successfully');
    } catch (error) {
      console.error('🎯 [AIRPORT] Booking failed:', error);
      Alert.alert('Error', 'Failed to book airport ride. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (locationLoading || configsLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>
            {locationLoading ? 'Getting your location...' : 'Loading Airport Fares...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#F8FAFC', '#E2E8F0']}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Service Type Selection */}
            <View style={styles.serviceTypeSection}>
              <Text style={styles.sectionTitle}>Service Type</Text>
              <View style={styles.serviceTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.serviceTypeButton,
                    serviceType === 'pickup' && styles.selectedServiceType,
                  ]}
                  onPress={() => setServiceType('pickup')}
                  activeOpacity={0.7}
                >
                  <Plane size={20} color={serviceType === 'pickup' ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[
                    styles.serviceTypeText,
                    serviceType === 'pickup' && styles.selectedServiceTypeText,
                  ]}>
                    Airport Pickup
                  </Text>
                  <Text style={[
                    styles.serviceTypeSubtext,
                    serviceType === 'pickup' && styles.selectedServiceTypeText,
                  ]}>
                    From Airport to Hosur
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.serviceTypeButton,
                    serviceType === 'drop' && styles.selectedServiceType,
                  ]}
                  onPress={() => setServiceType('drop')}
                  activeOpacity={0.7}
                >
                  <Plane size={20} color={serviceType === 'drop' ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[
                    styles.serviceTypeText,
                    serviceType === 'drop' && styles.selectedServiceTypeText,
                  ]}>
                    Airport Drop
                  </Text>
                  <Text style={[
                    styles.serviceTypeSubtext,
                    serviceType === 'drop' && styles.selectedServiceTypeText,
                  ]}>
                    From Hosur to Airport
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Location Selection */}
            <View style={styles.locationSection}>
              <LocationPicker
                label="From"
                value={fromLocation}
                onLocationSelect={handleFromLocationSelect}
                icon={<Navigation size={20} color="#2563EB" />}
                placeholder={serviceType === 'pickup' ? 'Kempegowda Airport (Fixed)' : 'Select pickup location'}
                currentLocation={serviceType === 'drop' ? currentLocation : null}
              />

              <LocationPicker
                label="To"
                value={toLocation}
                onLocationSelect={handleToLocationSelect}
                icon={<MapPin size={20} color="#DC2626" />}
                placeholder={serviceType === 'drop' ? 'Kempegowda Airport (Fixed)' : 'Select destination'}
              />

              <DateTimePicker
                label="Pickup Date & Time"
                value={pickupDateTime}
                onChange={setPickupDateTime}
                minimumDate={new Date()}
              />
            </View>

            {/* Vehicle Selection */}
            {shouldShowVehicles && (
              <View style={styles.vehicleSection}>
                <Text style={styles.sectionTitle}>Select Vehicle Type</Text>
                <View style={styles.vehiclesContainer}>
                  {airportFareConfigs.map((config) => {
                    const isSelected = selectedVehicle === config.vehicle_type;
                    const fare = fixedFares[config.vehicle_type];
                    
                    return (
                      <TouchableOpacity
                        key={config.vehicle_type}
                        style={[
                          styles.vehicleCard,
                          isSelected && styles.selectedVehicleCard,
                        ]}
                        onPress={() => setSelectedVehicle(config.vehicle_type)}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.vehicleIcon,
                          isSelected && styles.selectedVehicleIcon,
                        ]}>
                          <Text style={styles.vehicleEmoji}>🚗</Text>
                        </View>
                        
                        <Text style={[
                          styles.vehicleName,
                          isSelected && styles.selectedVehicleText,
                        ]}>
                          {formatVehicleName(config.vehicle_type)}
                        </Text>
                        
                        <Text style={[
                          styles.vehicleDescription,
                          isSelected && styles.selectedVehicleText,
                        ]}>
                          {serviceType === 'pickup' ? 'Airport to Hosur' : 'Hosur to Airport'}
                        </Text>
                        
                        <Text style={[
                          styles.vehicleFare,
                          isSelected && styles.selectedVehicleText,
                        ]}>
                          ₹{fare || 'N/A'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Book Button */}
            {shouldShowVehicles && (
              <TouchableOpacity
                style={[
                  styles.bookButton,
                  loading && styles.disabledButton
                ]}
                onPress={handleBookAirport}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#EA580C', '#DC2626']}
                  style={styles.bookButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.bookButtonText}>
                      Book Airport {serviceType === 'pickup' ? 'Pickup' : 'Drop'} - ₹{fixedFares[selectedVehicle]}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {/* Custom Alert */}
        <CustomAlert
          visible={customAlert.visible}
          title={customAlert.title}
          message={customAlert.message}
          type={customAlert.type}
          buttons={customAlert.buttons}
          onRequestClose={() => hideCustomAlert()}
        />
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
  content: {
    flex: 1,
    padding: 20,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  serviceTypeSection: {
    marginBottom: 20,
  },
  serviceTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  serviceTypeButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  selectedServiceType: {
    borderColor: '#EA580C',
    backgroundColor: '#EA580C',
  },
  serviceTypeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },
  selectedServiceTypeText: {
    color: '#FFFFFF',
  },
  serviceTypeSubtext: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  locationSection: {
    marginBottom: 20,
  },
  instructionsContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 8,
    textAlign: 'center',
  },
  instructionsText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 20,
  },
  vehicleSection: {
    marginBottom: 20,
  },
  vehiclesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  vehicleCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  selectedVehicleCard: {
    borderColor: '#EA580C',
    backgroundColor: '#EA580C',
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedVehicleIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  vehicleEmoji: {
    fontSize: 24,
  },
  vehicleName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  selectedVehicleText: {
    color: '#FFFFFF',
  },
  vehicleDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  vehicleFare: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
  bookButton: {
    borderRadius: 16,
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
    borderRadius: 16,
    alignItems: 'center',
  },
  bookButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});