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
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Navigation, Calendar, ArrowLeftRight } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/utils/supabase';
import { fareCalculator } from '../../src/services/fareCalculator';
import { enhancedLocationService } from '../../src/services/enhancedLocationService';
import { googleMapsService } from '../../src/services/googleMapsService';
import { useRouter } from 'expo-router';
import LocationPicker from '../../src/components/LocationPicker';
import VehicleSelector from '../../src/components/VehicleSelector';
import DateTimePicker from '../../src/components/DateTimePicker';
import { notificationService } from '../../src/services/notificationService';
import { useLocalSearchParams } from 'expo-router';

type VehicleType = 'sedan' | 'auto' | 'bike' | 'suv' | 'hatchback' | 'hatchback_ac' | 'sedan_ac' | 'suv_ac';

const generateRideCode = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `O${timestamp}${random}`.toUpperCase();
};

export default function OutstationBookingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [pickupLocation, setPickupLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('sedan');
  const [departureDate, setDepartureDate] = useState(new Date());
  const [returnDate, setReturnDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [fareBreakdown, setFareBreakdown] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [configsLoading, setConfigsLoading] = useState(true);
  const [outstationConfigs, setOutstationConfigs] = useState<any[]>([]);
  const [calculatedFares, setCalculatedFares] = useState<{ [key: string]: number }>({});
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [numberOfDays, setNumberOfDays] = useState(1);
  const [fareDisplayKey, setFareDisplayKey] = useState(0); // Force UI refresh
  const [fareCalculating, setFareCalculating] = useState(false);

  useEffect(() => {
    getCurrentLocation();
    loadOutstationConfigs();
    
    // Pre-populate destination if passed from regular ride page
    if (params.prefilledDestination && params.prefilledDestinationLat && params.prefilledDestinationLng) {
      console.log('🎯 [OUTSTATION] Pre-populating destination from regular ride:', {
        destination: params.prefilledDestination,
        coordinates: {
          lat: params.prefilledDestinationLat,
          lng: params.prefilledDestinationLng
        }
      });
      
      setDestinationLocation(params.prefilledDestination as string);
      setDestinationCoords({
        latitude: parseFloat(params.prefilledDestinationLat as string),
        longitude: parseFloat(params.prefilledDestinationLng as string),
      });
    }
  }, []);

  // Calculate number of days whenever dates or round trip status changes
  useEffect(() => {
    console.log('🔄 [DAYS-EFFECT] Date/trip change detected, recalculating...');

    if (isRoundTrip) {
      const startDate = new Date(departureDate);
      const endDate = new Date(returnDate);

      // Calculate difference in days
      const timeDifference = endDate.getTime() - startDate.getTime();
      const daysDifference = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
      const calculatedDays = Math.max(1, daysDifference);

      console.log('📅 [DAYS-EFFECT] Round trip days calculation:', {
        departure: startDate.toDateString(),
        return: endDate.toDateString(),
        time_difference_ms: timeDifference,
        days_difference: daysDifference,
        final_days: calculatedDays,
        current_numberOfDays: numberOfDays
      });

      if (calculatedDays !== numberOfDays) {
        console.log('🔄 [DAYS-EFFECT] Days changed from', numberOfDays, 'to', calculatedDays);
        setNumberOfDays(calculatedDays);
      }
    } else {
      // Single trip - always 1 day
      if (numberOfDays !== 1) {
        console.log('🔄 [DAYS-EFFECT] Single trip - setting to 1 day');
        setNumberOfDays(1);
      }
    }

    // ALWAYS recalculate fares when dates change
    if (pickupCoords && destinationCoords) {
      console.log('🔄 [DAYS-EFFECT] Triggering fare recalculation due to date change');
      setTimeout(() => calculateAllOutstationFares(), 200);
    }
  }, [departureDate, returnDate, isRoundTrip]);

  const calculateNumberOfDays = (): number => {
    if (isRoundTrip) {
      const startDate = new Date(departureDate);
      const endDate = new Date(returnDate);
      const timeDifference = endDate.getTime() - startDate.getTime();
      const daysDifference = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
      return Math.max(1, daysDifference);
    } else {
      return 1;
    }
  };

  useEffect(() => {
    if (pickupCoords && destinationCoords && !fareCalculating) {
      calculateAllOutstationFares();
    }
  }, [pickupCoords, destinationCoords, isRoundTrip, numberOfDays]);

  const loadOutstationConfigs = async () => {
    try {
      console.log('📊 Loading outstation configs from database...');
      
      // Get both outstation package configs and per-km configs
      const [packageConfigs, perKmConfigs] = await Promise.all([
        supabase.from('outstation_packages').select('*').eq('is_active', true),
        supabase.from('outstation_fares').select('*').eq('is_active', true)
      ]);
      
      console.log('📊 Raw config query results:', {
        packageConfigs: packageConfigs.data?.length || 0,
        perKmConfigs: perKmConfigs.data?.length || 0,
        packageVehicleTypes: packageConfigs.data?.map(c => c.vehicle_type) || [],
        perKmVehicleTypes: perKmConfigs.data?.map(c => c.vehicle_type) || []
      });
      
      // Combine configs from both tables
      const configs: any[] = [];
      
      // Get unique vehicle types from both tables
      const packageVehicleTypes = packageConfigs.data?.map(c => c.vehicle_type) || [];
      const perKmVehicleTypes = perKmConfigs.data?.map(c => c.vehicle_type) || [];
      const allVehicleTypes = [...new Set([...packageVehicleTypes, ...perKmVehicleTypes])];
      
      console.log('📊 All vehicle types found:', allVehicleTypes);
      
      for (const vehicleType of allVehicleTypes) {
        const packageConfig = packageConfigs.data?.find(c => c.vehicle_type === vehicleType);
        const perKmConfig = perKmConfigs.data?.find(c => c.vehicle_type === vehicleType);
        
        configs.push({
          vehicle_type: vehicleType,
          hasSlabSystem: !!packageConfig?.use_slab_system,
          per_km_rate: perKmConfig?.per_km_rate || 14,
          driver_allowance_per_day: perKmConfig?.driver_allowance_per_day || packageConfig?.driver_allowance_per_day || 300,
          packageConfig,
          perKmConfig
        });
      }
      
      console.log('📊 Loaded outstation configs:', configs.length);
      console.log('📊 Vehicle types available:', configs.map(c => c.vehicle_type));
      setOutstationConfigs(configs);
    } catch (error) {
      console.error('Error loading outstation configs:', error);
      
      // Fallback to default vehicle types if database fails
      const fallbackConfigs = [
        { vehicle_type: 'hatchback', per_km_rate: 10, driver_allowance_per_day: 300 },
        { vehicle_type: 'hatchback_ac', per_km_rate: 12, driver_allowance_per_day: 300 },
        { vehicle_type: 'sedan', per_km_rate: 14, driver_allowance_per_day: 300 },
        { vehicle_type: 'sedan_ac', per_km_rate: 16, driver_allowance_per_day: 300 },
        { vehicle_type: 'suv', per_km_rate: 18, driver_allowance_per_day: 300 },
        { vehicle_type: 'suv_ac', per_km_rate: 20, driver_allowance_per_day: 300 },
      ];
      
      console.log('📊 Using fallback configs:', fallbackConfigs.length);
      setOutstationConfigs(fallbackConfigs);
    } finally {
      setConfigsLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const locationWithAddress = await enhancedLocationService.getCurrentLocationWithAddress();
      
      if (!locationWithAddress) {
        Alert.alert('Error', 'Unable to get your current location');
        return;
      }

      // Convert to Expo Location format
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
      setPickupLocation(locationWithAddress.address);
      setPickupCoords({
        latitude: locationWithAddress.coords.latitude,
        longitude: locationWithAddress.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Unable to get your current location');
    } finally {
      setLocationLoading(false);
    }
  };

  const calculateAllOutstationFares = async () => {
    if (!pickupCoords || !destinationCoords) {
      setCalculatedFares({});
      setRouteInfo(null);
      return;
    }

    setFareCalculating(true);
    
    try {
      // Calculate days FRESH every time - no caching
      let currentNumberOfDays = 1;
      let isSameDayTrip = true;

      if (isRoundTrip) {
        const startDate = new Date(departureDate);
        const endDate = new Date(returnDate);
        const timeDifference = endDate.getTime() - startDate.getTime();
        const daysDifference = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
        currentNumberOfDays = Math.max(1, daysDifference);

        // Check if it's same-day by comparing dates (ignoring time)
        const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        isSameDayTrip = startDateOnly.getTime() === endDateOnly.getTime();

        console.log('📅 [SAME-DAY-CHECK] Date comparison details:', {
          departureDate: departureDate.toISOString(),
          returnDate: returnDate.toISOString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          startDateOnly: startDateOnly.toISOString(),
          endDateOnly: endDateOnly.toISOString(),
          startDateOnlyTime: startDateOnly.getTime(),
          endDateOnlyTime: endDateOnly.getTime(),
          timeDifferenceMs: timeDifference,
          daysDifference,
          currentNumberOfDays,
          isSameDayTrip,
          areEqual: startDateOnly.getTime() === endDateOnly.getTime()
        });
      } else {
        console.log('📅 [SAME-DAY-CHECK] Single trip (not round trip) - isSameDayTrip=true by default');
      }

      console.log('💰 [OUTSTATION-CALC] ===== STARTING NEW SLAB/PER-KM FARE CALCULATION =====');
      console.log('💰 [OUTSTATION-CALC] Current state:', {
        isRoundTrip,
        numberOfDays: currentNumberOfDays,
        isSameDayTrip,
        departureDate: departureDate.toISOString(),
        returnDate: returnDate.toISOString(),
        selectedVehicle,
        pickup: pickupCoords,
        destination: destinationCoords,
        freshDaysCalculation: currentNumberOfDays,
        newLogic: 'Slab model for same-day trips ≤ 150km one-way, per-km for others'
      });

      // Update numberOfDays state with fresh calculation
      if (numberOfDays !== currentNumberOfDays) {
        console.log('🔄 [OUTSTATION-CALC] Updating numberOfDays from', numberOfDays, 'to', currentNumberOfDays);
        setNumberOfDays(currentNumberOfDays);
      }
      
      // Get combined outstation configs (both slab and per-km)
      console.log('🔍 [OUTSTATION-CALC] Fetching combined outstation configs...');
      const allConfigs = await fareCalculator.getAllOutstationFareConfigs();
      
      if (!allConfigs || allConfigs.length === 0) {
        console.warn('⚠️ [OUTSTATION-CALC] No outstation configs found, using fallback');
        throw new Error('No outstation configurations found');
      }
      
      console.log('✅ [OUTSTATION-CALC] Loaded combined outstation configs:', {
        count: allConfigs.length,
        vehicle_types: allConfigs.map(c => c.vehicle_type),
        configs_summary: allConfigs.map(c => ({
          vehicle_type: c.vehicle_type,
          hasSlabSystem: c.hasSlabSystem,
          per_km_rate: c.per_km_rate,
          driver_allowance_per_day: c.driver_allowance_per_day
        }))
      });
      
      const fares: { [key: string]: number } = {};
      
      // Calculate fares for each vehicle type using the new logic
      for (const config of allConfigs) {
        console.log(`💰 [OUTSTATION-CALC] ===== CALCULATING FOR ${config.vehicle_type.toUpperCase()} =====`);
        
        try {
          const fareBreakdown = await fareCalculator.calculateOutstationFare(
            pickupCoords,
            destinationCoords,
            config.vehicle_type,
            isRoundTrip,
            currentNumberOfDays,
            isSameDayTrip
          );
          
          if (fareBreakdown) {
            const finalFare = fareBreakdown.totalFare;
            fares[config.vehicle_type] = finalFare;

            console.log(`💰 [OUTSTATION-CALC] ${config.vehicle_type} calculation completed:`, {
              final_fare: `₹${finalFare}`,
              calculation_method: (fareBreakdown as any).calculationMethod || 'unknown',
              distance: fareBreakdown.distance + 'km',
              trip_type: isRoundTrip ? 'Round Trip' : 'Single Day',
              days: currentNumberOfDays,
              isSameDayTrip,
              breakdown_summary: {
                baseFare: fareBreakdown.baseFare,
                distanceFare: fareBreakdown.distanceFare,
                timeFare: fareBreakdown.timeFare,
                surgeFare: fareBreakdown.surgeFare,
                platformFee: fareBreakdown.platformFee,
                deadheadCharge: fareBreakdown.deadheadCharge,
                totalFare: fareBreakdown.totalFare
              }
            });
            
            // Set route info from the first successful calculation
            if (!routeInfo) {
              setRouteInfo({ 
                distance: fareBreakdown.distance, 
                duration: fareBreakdown.duration 
              });
            }
          } else {
            console.error(`❌ [OUTSTATION-CALC] Failed to calculate fare for ${config.vehicle_type}`);
            // Use fallback calculation
            const fallbackFare = 500 + (currentNumberOfDays * 300 * config.per_km_rate) + (currentNumberOfDays * config.driver_allowance_per_day);
            fares[config.vehicle_type] = Math.round(fallbackFare);
          }
        } catch (vehicleError) {
          console.error(`❌ [OUTSTATION-CALC] Error calculating fare for ${config.vehicle_type}:`, vehicleError);
          // Use fallback calculation
          const fallbackFare = 500 + (currentNumberOfDays * 300 * config.per_km_rate) + (currentNumberOfDays * config.driver_allowance_per_day);
          fares[config.vehicle_type] = Math.round(fallbackFare);
        }
      }
      
      console.log(`📊 [OUTSTATION-CALC] ===== ALL CALCULATED FARES =====`);
      console.log(`📊 [OUTSTATION-CALC] Final fares for state:`, fares);
      console.log(`📊 [OUTSTATION-CALC] Fares breakdown:`, Object.entries(fares).map(([type, fare]) => `${type}: ₹${fare}`));
      console.log(`📊 [OUTSTATION-CALC] Used new slab/per-km logic with days:`, currentNumberOfDays);
      
      setCalculatedFares(fares);
      setFareDisplayKey(prev => prev + 1); // Force UI refresh
      console.log(`✅ [OUTSTATION-CALC] Fares updated in state for ${Object.keys(fares).length} vehicle types`);
      
    } catch (error) {
      console.error('Error calculating all outstation fares:', error);
      
      // Use fallback calculation
      const fallbackFares = calculateFallbackFares();
      setCalculatedFares(fallbackFares);
      setFareDisplayKey(prev => prev + 1); // Force UI refresh
      setRouteInfo({ distance: 50, duration: 60 }); // Default values
    } finally {
      setFareCalculating(false);
    }
  };

  const calculateFallbackFares = (): { [key: string]: number } => {
    const fallbackConfigs = {
      hatchback: { per_km_rate: 14 },
      hatchback_ac: { per_km_rate: 16 },
      sedan: { per_km_rate: 18 },
      sedan_ac: { per_km_rate: 20 },
      suv: { per_km_rate: 22 },
      suv_ac: { per_km_rate: 25 },
    };
    
    const fares: { [key: string]: number } = {};
    
    Object.entries(fallbackConfigs).forEach(([vehicleType, config]) => {
      // Simple fallback calculation
      const totalFare = 500 + (300 * numberOfDays * config.per_km_rate) + (300 * numberOfDays);
      
      fares[vehicleType] = Math.round(totalFare);
    });
    
    return fares;
  };

  const handleBookOutstation = async () => {
    console.log('🎯 [OUTSTATION] handleBookOutstation called - START');
    console.log('🎯 [OUTSTATION] Validation check:', {
      hasUser: !!user,
      hasPickupCoords: !!pickupCoords,
      hasDestinationCoords: !!destinationCoords,
      selectedVehicleFare: calculatedFares[selectedVehicle]
    });
    
    if (!user) {
      console.log('🎯 [OUTSTATION] Validation failed - no user');
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    if (!pickupCoords || !destinationCoords) {
      console.log('🎯 [OUTSTATION] Validation failed - missing coordinates');
      Alert.alert('Error', 'Please select both pickup and destination locations');
      return;
    }

    if (!calculatedFares[selectedVehicle]) {
      console.log('🎯 [OUTSTATION] Validation failed - no calculated fare');
      Alert.alert('Error', 'Fare not calculated. Please try again.');
      return;
    }
    console.log('🎯 [OUTSTATION] Starting booking process...');
    setLoading(true);
    
    try {
      console.log('🎯 [OUTSTATION] Inserting booking into database...');
      const { data, error } = await supabase
        .from('scheduled_bookings')
        .insert({
          customer_id: user.id,
          booking_type: 'outstation',
          vehicle_type: selectedVehicle,
          pickup_address: pickupLocation,
          pickup_latitude: pickupCoords.latitude,
          pickup_longitude: pickupCoords.longitude,
          destination_address: destinationLocation,
          destination_latitude: destinationCoords.latitude,
          destination_longitude: destinationCoords.longitude,
          scheduled_time: departureDate.toISOString(),
          estimated_fare: calculatedFares[selectedVehicle] || 0,
          special_instructions: `Outstation trip - ${isRoundTrip ? 'Round trip' : 'One way'}. Departure: ${departureDate.toLocaleString()}.`,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.error('🎯 [OUTSTATION] Database error:', error);
        throw error;
      }

      console.log('🎯 [OUTSTATION] Booking created successfully:', data.id);


      // Send notification to admin for outstation booking (admin will assign driver)
      try {
        console.log('📋 Sending admin notification for outstation booking...');
        await notificationService.sendAdminBookingNotification({
          id: data.id,
          booking_type: 'outstation',
          customer_id: user.id,
          customer_name: user.full_name,
          customer_phone: user.phone_number,
          pickup_address: pickupLocation,
          destination_address: destinationLocation,
          vehicle_type: selectedVehicle,
          fare_amount: calculatedFares[selectedVehicle] || 0,
          special_instructions: `Outstation trip - ${isRoundTrip ? 'Round trip' : 'One way'}. Departure: ${departureDate.toLocaleString()}. ADMIN ALLOCATION REQUIRED - Do not send to drivers directly.`,
        });
        console.log('✅ Admin notification sent for outstation booking');
      } catch (notificationError) {
        console.warn('⚠️ Admin notification failed (non-blocking):', notificationError);
      }

      console.log('🎯 [OUTSTATION] About to navigate to driver search...');
      console.log('🎯 [OUTSTATION] Navigation params:', {
        bookingId: data.id,
        bookingType: 'outstation',
        pickupLocation,
        destinationLocation,
        vehicleType: selectedVehicle,
        fareAmount: calculatedFares[selectedVehicle] || 0,
        scheduledTime: departureDate.toISOString(),
        isRoundTrip: isRoundTrip.toString(),
      });
      
      // Navigate to driver search
      await router.push({
        pathname: '/booking/driver-search',
        params: {
          bookingId: data.id,
          bookingType: 'outstation',
          pickupLocation,
          destinationLocation,
          pickupLatitude: pickupCoords.latitude.toString(),
          pickupLongitude: pickupCoords.longitude.toString(),
          destinationLatitude: destinationCoords.latitude.toString(),
          destinationLongitude: destinationCoords.longitude.toString(),
          vehicleType: selectedVehicle,
          fareAmount: (calculatedFares[selectedVehicle] || 0).toString(),
          scheduledTime: departureDate.toISOString(),
          isRoundTrip: isRoundTrip.toString(),
        },
      });
      
      console.log('🎯 [OUTSTATION] Navigation call completed');
      
    } catch (error) {
      console.error('🎯 [OUTSTATION] Booking error:', error);
      Alert.alert('Error', 'Failed to book the trip. Please try again.');
    } finally {
      console.log('🎯 [OUTSTATION] handleBookOutstation - END');
      setLoading(false);
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
      'hatchback': 'Economical choice',
      'hatchback_ac': 'Economical with AC',
      'sedan': 'Comfortable & reliable',
      'sedan_ac': 'Comfortable with AC',
      'suv': 'Spacious & premium',
      'suv_ac': 'Premium with AC',
    };
    return descriptionMap[vehicleType] || 'Standard vehicle';
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#F8FAFC', '#E2E8F0']}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.locationSection}>
              <LocationPicker
                label="Pickup Location"
                value={pickupLocation}
                onLocationSelect={(location, coords) => {
                  setPickupLocation(location);
                  setPickupCoords(coords);
                }}
                icon={<Navigation size={20} color="#2563EB" />}
                currentLocation={currentLocation}
              />

              <LocationPicker
                label="Destination"
                value={destinationLocation}
                onLocationSelect={(location, coords) => {
                  setDestinationLocation(location);
                  setDestinationCoords(coords);
                }}
                icon={<MapPin size={20} color="#DC2626" />}
                placeholder="Enter destination"
              />
            </View>

            <View style={styles.optionsSection}>
              <Text style={styles.sectionTitle}>Trip Options</Text>
              
              <View style={styles.optionRow}>
                <View style={styles.optionInfo}>
                  <ArrowLeftRight size={20} color="#6B7280" />
                  <Text style={styles.optionLabel}>Round Trip</Text>
                </View>
                <Switch
                  value={isRoundTrip}
                  onValueChange={(value) => {
                    console.log('🔄 [OUTSTATION-DEBUG] Round trip toggle changed to:', value);
                    setIsRoundTrip(value);
                  }}
                  trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                  thumbColor={isRoundTrip ? '#2563EB' : '#F3F4F6'}
                />
              </View>

            </View>

            <View style={styles.dateSection}>
              <DateTimePicker
                label="Departure Date & Time"
                value={departureDate}
                onChange={(date) => {
                  console.log('📅 [OUTSTATION-DEBUG] Departure date changed to:', date.toISOString());
                  setDepartureDate(date);
                }}
                minimumDate={new Date()}
              />

              {isRoundTrip && (
                <DateTimePicker
                  label="Return Date & Time"
                  value={returnDate}
                  onChange={(date) => {
                    console.log('📅 [OUTSTATION-DEBUG] Return date changed to:', date.toISOString());
                    setReturnDate(date);
                  }}
                  minimumDate={departureDate}
                />
              )}
            </View>

            <View style={styles.vehicleSection}>
              <Text style={styles.sectionTitle}>Select Vehicle Type</Text>
              
              {outstationConfigs.length > 0 ? (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.vehiclesScrollContainer}
                  decelerationRate="fast"
                  snapToInterval={140}
                  snapToAlignment="start"
                >
                  {outstationConfigs.map((config) => {
                    const isSelected = selectedVehicle === config.vehicle_type;
                    const vehicleFare = calculatedFares[config.vehicle_type];
                    
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
                          {getVehicleDescription(config.vehicle_type)}
                        </Text>
                        
                        {vehicleFare && (
                          <Text style={[
                            styles.vehicleFare,
                            isSelected && styles.selectedVehicleText,
                          ]}>
                            ₹{vehicleFare.toLocaleString('en-IN')}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.loadingVehiclesContainer}>
                  <ActivityIndicator size="small" color="#DC2626" />
                  <Text style={styles.loadingVehiclesText}>Loading vehicle options...</Text>
                </View>
              )}
            </View>

            {(fareCalculating || calculatedFares[selectedVehicle]) && (
              <View style={styles.fareContainer}>
                <Text style={styles.fareLabel}>Estimated Fare</Text>

                {fareCalculating ? (
                  <View style={styles.calculatingContainer}>
                    <ActivityIndicator size="small" color="#DC2626" />
                    <Text style={styles.calculatingText}>Calculating...</Text>
                  </View>
                ) : (
                  <Text style={styles.fareAmount}>
                    ₹{calculatedFares[selectedVehicle]?.toLocaleString('en-IN')}
                  </Text>
                )}
                <Text style={styles.fareNote}>
                  {routeInfo && routeInfo.distance > 0 && `${Math.round(routeInfo.distance)}km one-way`}
                  {isRoundTrip && ` • ${numberOfDays} day${numberOfDays > 1 ? 's' : ''}`}
                  {routeInfo && routeInfo.distance <= 150 && numberOfDays === 1 && ` • Slab pricing (no driver allowance)`}
                  {routeInfo && (routeInfo.distance > 150 || numberOfDays > 1) && ` • Per-km + driver allowance`}
                  {isRoundTrip && numberOfDays > 1 && ` (300km/day limit)`}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.bookButton,
                (!pickupCoords || !destinationCoords || loading || !calculatedFares[selectedVehicle]) && styles.disabledButton
              ]}
              onPress={() => {
                console.log('🎯 [OUTSTATION] Book button pressed - START');
                console.log('🎯 [OUTSTATION] Button state check:', {
                  hasPickupCoords: !!pickupCoords,
                  hasDestinationCoords: !!destinationCoords,
                  loading,
                  selectedVehicleFare: calculatedFares[selectedVehicle],
                  isDisabled: (!pickupCoords || !destinationCoords || loading || !calculatedFares[selectedVehicle])
                });
                
                if (!pickupCoords || !destinationCoords || loading || !calculatedFares[selectedVehicle]) {
                  console.log('🎯 [OUTSTATION] Button disabled - not calling handler');
                  return;
                }
                
                console.log('🎯 [OUTSTATION] Button enabled - calling handler');
                handleBookOutstation();
              }}
              disabled={!pickupCoords || !destinationCoords || loading || !calculatedFares[selectedVehicle]}
            >
              <LinearGradient
                colors={['#DC2626', '#B91C1C']}
                style={styles.bookButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.bookButtonText}>
                    Book Outstation Trip - ₹{calculatedFares[selectedVehicle]?.toLocaleString('en-IN') || '0'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
  locationSection: {
    marginBottom: 20,
  },
  destinationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  destinationCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  selectedDestinationCard: {
    borderColor: '#DC2626',
    backgroundColor: '#DC2626',
  },
  destinationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  destinationDistance: {
    fontSize: 12,
    color: '#6B7280',
  },
  selectedDestinationText: {
    color: '#FFFFFF',
  },
  optionsSection: {
    marginBottom: 20,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  dateSection: {
    marginBottom: 20,
  },
  vehicleSection: {
    marginBottom: 20,
  },
  vehiclesScrollContainer: {
    paddingHorizontal: 10,
    paddingRight: 30,
  },
  vehicleCard: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  selectedVehicleCard: {
    borderColor: '#DC2626',
    backgroundColor: '#DC2626',
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedVehicleIcon: {
    backgroundColor: '#374151',
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
  selectedVehicleName: {
    color: '#FFFFFF',
  },
  selectedVehicleText: {
    color: '#FFFFFF',
  },
  vehicleDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  selectedVehicleDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  vehicleFare: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 4,
  },
  loadingVehiclesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingVehiclesText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  fareContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  fareLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  fareAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 4,
  },
  daysInfo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
    marginBottom: 8,
  },
  fareNote: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  calculatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  calculatingText: {
    fontSize: 16,
    color: '#DC2626',
    marginLeft: 8,
    fontWeight: '600',
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