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
import { Clock, MapPin, Navigation, Users } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/utils/supabase';
import { notificationService } from '../../src/services/notificationService';
import { enhancedLocationService } from '../../src/services/enhancedLocationService';
import { useRouter } from 'expo-router';
import LocationPicker from '../../src/components/LocationPicker';
import DateTimePicker from '../../src/components/DateTimePicker';

type VehicleType = 'sedan' | 'auto' | 'bike' | 'suv' | 'hatchback' | 'hatchback_ac' | 'sedan_ac' | 'suv_ac';

interface RentalPackageSlot {
  hours: number;
  freeKms: number;
  baseFare?: number;
  extraKmRate?: number;
  extraMinRate?: number;
}

interface RentalFareFromDB {
  id: string;
  vehicle_type: VehicleType;
  package_name: string;
  duration_hours: number;
  km_included: number;
  base_fare: number;
  extra_km_rate: number;
  extra_minute_rate: number;
  is_popular: boolean;
  discount_percent: number;
  is_active: boolean;
}

// Predefined package slots based on the table
const RENTAL_PACKAGE_SLOTS: RentalPackageSlot[] = [
  { hours: 1, freeKms: 10 },
  { hours: 1, freeKms: 15 },
  { hours: 2, freeKms: 20 },
  { hours: 2, freeKms: 25 },
  { hours: 3, freeKms: 30 },
  { hours: 4, freeKms: 40 },
  { hours: 5, freeKms: 50 },
  { hours: 6, freeKms: 60 },
  { hours: 7, freeKms: 70 },
  { hours: 8, freeKms: 80 },
  { hours: 9, freeKms: 90 },
  { hours: 10, freeKms: 100 },
  { hours: 11, freeKms: 100 },
  { hours: 11, freeKms: 110 },
  { hours: 12, freeKms: 100 },
  { hours: 12, freeKms: 120 },
];

const generateRideCode = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `R${timestamp}${random}`.toUpperCase();
};

const getVehicleSeatingCapacity = (vehicleType: VehicleType): number => {
  const capacityMap: { [key in VehicleType]: number } = {
    hatchback: 4,
    hatchback_ac: 4,
    sedan: 4,
    sedan_ac: 4,
    suv: 7,
    suv_ac: 7,
    auto: 3,
    bike: 2,
  };
  return capacityMap[vehicleType] || 4;
};

const formatVehicleName = (vehicleType: VehicleType): string => {
  const nameMap: { [key in VehicleType]: string } = {
    hatchback: 'Hatchback',
    hatchback_ac: 'Hatchback AC',
    sedan: 'Sedan',
    sedan_ac: 'Sedan AC',
    suv: 'SUV',
    suv_ac: 'SUV AC',
    auto: 'Auto',
    bike: 'Bike',
  };
  return nameMap[vehicleType] || vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1);
};

export default function RentalBookingScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('sedan');
  const [selectedPackage, setSelectedPackage] = useState<RentalPackageSlot>(RENTAL_PACKAGE_SLOTS[5]); // Default to 4 hours, 40km package
  const [pickupDateTime, setPickupDateTime] = useState(new Date());
  const [rentalFares, setRentalFares] = useState<RentalFareFromDB[]>([]);
  const [vehicleFares, setVehicleFares] = useState<{ [key in VehicleType]?: number }>({});
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [rentalConfigs, setRentalConfigs] = useState<any[]>([]);
  const [configsLoading, setConfigsLoading] = useState(true);
  const [calculatedFare, setCalculatedFare] = useState(0);
  const [RENTAL_PACKAGES, setRENTAL_PACKAGES] = useState<any[]>([]);

  useEffect(() => {
    getCurrentLocation();
    loadRentalConfigs();
  }, []);

  useEffect(() => {
    if (rentalFares.length > 0) {
      // Update packages when vehicle type changes
      const packages = RENTAL_PACKAGE_SLOTS.map(slot => {
        const fareData = rentalFares.find(fare =>
          fare.duration_hours === slot.hours &&
          fare.km_included === slot.freeKms &&
          fare.vehicle_type === selectedVehicle
        );

        return {
          ...slot,
          baseFare: fareData?.base_fare || 500,
          extraKmRate: fareData?.extra_km_rate || 8,
          extraMinRate: fareData?.extra_minute_rate || 2,
        };
      });

      setRENTAL_PACKAGES(packages);
      calculateRentalFare();
    }
  }, [selectedVehicle, selectedPackage, pickupDateTime, rentalFares]);

  const getCurrentLocation = async () => {
    try {
      const locationWithAddress = await enhancedLocationService.getCurrentLocationWithAddress();
      
      if (!locationWithAddress) {
        Alert.alert('Error', 'Unable to get your current location');
        return;
      }

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
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Unable to get your current location');
    } finally {
      setLocationLoading(false);
    }
  };

  const loadRentalFares = async () => {
    try {
      console.log('📊 Loading rental fares via edge function...');

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/get-rental-fares`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error loading rental fares:', errorText);
        setRentalFares([]);
        return;
      }

      const result = await response.json();
      const data = result.data;

      if (data && data.length > 0) {
        console.log('✅ Loaded rental fares from edge function:', data.length);
        setRentalFares(data);

        // Create RENTAL_PACKAGES from the database data
        const packages = RENTAL_PACKAGE_SLOTS.map(slot => {
          const fareData = data.find(fare =>
            fare.duration_hours === slot.hours &&
            fare.km_included === slot.freeKms &&
            fare.vehicle_type === selectedVehicle
          );

          return {
            ...slot,
            baseFare: fareData?.base_fare || 500,
            extraKmRate: fareData?.extra_km_rate || 8,
            extraMinRate: fareData?.extra_minute_rate || 2,
          };
        });

        setRENTAL_PACKAGES(packages);
      } else {
        console.log('⚠️ No rental fares found');
        setRentalFares([]);
      }
    } catch (error) {
      console.error('Error loading rental fares:', error);
      setRentalFares([]);
    }
  };

  const loadRentalConfigs = async () => {
    try {
      console.log('📊 Loading rental configurations...');
      await loadRentalFares();
    } catch (error) {
      console.error('Error loading rental configs:', error);
      setRentalFares([]);
    } finally {
      setConfigsLoading(false);
    }
  };

  // Get available packages for the selected vehicle type
  const getAvailablePackages = (): RentalPackageSlot[] => {
    const vehicleFares = rentalFares.filter(fare => fare.vehicle_type === selectedVehicle);
    
    if (vehicleFares.length === 0) {
      return RENTAL_PACKAGE_SLOTS;
    }
    
    return vehicleFares.map(fare => ({
      hours: fare.duration_hours,
      freeKms: fare.km_included,
      baseFare: fare.base_fare,
      extraKmRate: fare.extra_km_rate,
      extraMinRate: fare.extra_minute_rate,
    }));
  };

  // Get available vehicle types from database
  const getAvailableVehicleTypes = (): VehicleType[] => {
    const uniqueTypes = [...new Set(rentalFares.map(fare => fare.vehicle_type))];
    return uniqueTypes.length > 0 ? uniqueTypes as VehicleType[] : ['hatchback', 'sedan', 'suv'];
  };

  const calculateRentalFare = () => {
    console.log('💰 Calculating rental fare from database:', {
      vehicle: selectedVehicle,
      selectedPackage: {
        hours: selectedPackage.hours,
        freeKms: selectedPackage.freeKms,
      }
    });

    // Find the matching fare from database
    const matchingFare = rentalFares.find(fare => 
      fare.vehicle_type === selectedVehicle &&
      fare.duration_hours === selectedPackage.hours &&
      fare.km_included === selectedPackage.freeKms
    );

    if (!matchingFare) {
      console.warn('⚠️ No matching fare found in database, using fallback');
      setCalculatedFare(500);
      return;
    }

    console.log('✅ Found matching fare in database:', {
      vehicle_type: matchingFare.vehicle_type,
      package_name: matchingFare.package_name,
      duration_hours: matchingFare.duration_hours,
      km_included: matchingFare.km_included,
      base_fare: matchingFare.base_fare,
      discount_percent: matchingFare.discount_percent,
      is_popular: matchingFare.is_popular
    });

    // Use the base fare directly as total amount with no additional charges
    const totalFare = matchingFare.base_fare;
    setCalculatedFare(totalFare);
    
    console.log('✅ Using base fare as total amount:', {
      databaseBaseFare: matchingFare.base_fare,
      totalFare: totalFare,
      freeKmsIncluded: selectedPackage.freeKms,
      extraKmRate: matchingFare.extra_km_rate,
      extraMinRate: matchingFare.extra_minute_rate
    });
  };

  const handleBookRental = async () => {
    console.log('🎯 [RENTAL] handleBookRental called - START');
    console.log('🎯 [RENTAL] Validation check:', {
      hasUser: !!user,
      hasPickupCoords: !!pickupCoords,
      hasPickupLocation: !!pickupLocation,
      userId: user?.id,
      pickupLocation,
      pickupCoords
    });
    
    if (!user || !pickupCoords || !pickupLocation) {
      console.log('🎯 [RENTAL] Validation failed - missing required data');
      Alert.alert('Error', 'Please complete all fields');
      return;
    }

    console.log('🎯 [RENTAL] Starting booking process...');
    setLoading(true);
    
    try {
      console.log('🎯 [RENTAL] Creating booking via edge function...');

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      const bookingData = {
        customer_id: user.id,
        booking_type: 'rental',
        vehicle_type: selectedVehicle,
        pickup_address: pickupLocation,
        pickup_latitude: pickupCoords.latitude,
        pickup_longitude: pickupCoords.longitude,
        destination_address: pickupLocation,
        destination_latitude: pickupCoords.latitude,
        destination_longitude: pickupCoords.longitude,
        scheduled_time: pickupDateTime.toISOString(),
        rental_hours: selectedPackage.hours,
        estimated_fare: calculatedFare,
        special_instructions: `Rental booking for ${selectedPackage.hours} hours with ${selectedPackage.freeKms}km included. Extra charges: ₹${selectedPackage.extraKmRate}/km & ₹${selectedPackage.extraMinRate}/min. Pickup time: ${pickupDateTime.toLocaleString()}. ADMIN ALLOCATION REQUIRED - Do not send to drivers directly.`,
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
        console.error('🎯 [RENTAL] Edge function error:', errorText);
        throw new Error(errorText);
      }

      const result = await response.json();

      if (result.error) {
        console.error('🎯 [RENTAL] Database error:', result.error);
        throw new Error(result.error);
      }

      const data = result.data;

      console.log('🎯 [RENTAL] Booking created successfully:', data.id);

      // Send notification to admin for rental booking (admin will assign driver)
      try {
        console.log('📋 Sending admin notification for rental booking...');
        await notificationService.sendAdminBookingNotification({
          id: data.id,
          booking_type: 'rental',
          customer_id: user.id,
          customer_name: user.full_name,
          customer_phone: user.phone_number,
          pickup_address: pickupLocation,
          destination_address: pickupLocation,
          vehicle_type: selectedVehicle,
          fare_amount: calculatedFare,
          special_instructions: `Rental booking for ${selectedPackage.hours} hours with ${selectedPackage.freeKms}km included. Extra charges: ₹${selectedPackage.extraKmRate}/km & ₹${selectedPackage.extraMinRate}/min. Pickup time: ${pickupDateTime.toLocaleString()}. ADMIN ALLOCATION REQUIRED - Do not send to drivers directly.`,
        });
        console.log('✅ Admin notification sent for rental booking');
      } catch (notificationError) {
        console.warn('⚠️ Admin notification failed (non-blocking):', notificationError);
      }

      console.log('🎯 [RENTAL] About to show success alert...');
      
      // Navigate immediately without alert
      console.log('🎯 [RENTAL] Navigating to driver search immediately...');
      console.log('🎯 [RENTAL] Navigation params:', {
        bookingId: data.id,
        bookingType: 'rental',
        pickupLocation,
        vehicleType: selectedVehicle,
        fareAmount: calculatedFare,
        scheduledTime: pickupDateTime.toISOString(),
        rentalHours: selectedPackage.hours
      });
      
      router.push({
        pathname: '/booking/driver-search',
        params: {
          bookingId: data.id,
          bookingType: 'rental',
          pickupLocation,
          destinationLocation: pickupLocation,
          pickupLatitude: pickupCoords.latitude.toString(),
          pickupLongitude: pickupCoords.longitude.toString(),
          destinationLatitude: pickupCoords.latitude.toString(),
          destinationLongitude: pickupCoords.longitude.toString(),
          vehicleType: selectedVehicle,
          fareAmount: calculatedFare.toString(),
          scheduledTime: pickupDateTime.toISOString(),
          rentalHours: selectedPackage.hours.toString(),
        },
      });
      
      console.log('🎯 [RENTAL] Navigation call completed');
      
      // Show success message after navigation
      Alert.alert(
        'Rental Booked Successfully!',
        `Your rental booking for ${selectedPackage.hours} hours with ${selectedPackage.freeKms}km included has been submitted. We're finding a driver for you.`
      );
      
    } catch (error) {
      console.error('🎯 [RENTAL] Booking error:', error);
      console.error('Error booking rental:', error);
      Alert.alert('Error', 'Failed to book the rental. Please try again.');
    } finally {
      console.log('🎯 [RENTAL] handleBookRental - END');
      setLoading(false);
    }
  };

  if (locationLoading || configsLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>
            {locationLoading ? 'Getting your location...' : 'Loading rental configurations...'}
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
            <View style={styles.packageSection}>
              <Text style={styles.sectionTitle}>Select Package</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.packagesScrollContainer}
                decelerationRate="fast"
              >
                {getAvailablePackages().map((pkg, index) => {
                  const isSelected = selectedPackage.hours === pkg.hours && 
                                   selectedPackage.freeKms === pkg.freeKms && 
                                   selectedPackage.baseFare === pkg.baseFare;
                  
                  return (
                    <TouchableOpacity
                      key={`${pkg.hours}-${pkg.freeKms}-${index}`}
                      style={[
                        styles.packageButton,
                        isSelected && styles.selectedPackageButton,
                      ]}
                      onPress={() => setSelectedPackage(pkg)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.packageHeader}>
                        <Clock
                          size={16}
                          color={isSelected ? '#FFFFFF' : '#059669'}
                        />
                        <Text style={[
                          styles.packageHours,
                          isSelected && styles.selectedPackageText,
                        ]}>
                          {pkg.hours}hr
                        </Text>
                      </View>
                      <Text style={[
                        styles.packageKms,
                        isSelected && styles.selectedPackageText,
                      ]}>
                        {pkg.freeKms}km
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

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

              <DateTimePicker
                label="Pickup Date & Time"
                value={pickupDateTime}
                onChange={setPickupDateTime}
                minimumDate={new Date()}
              />
            </View>

            <View style={styles.vehicleSection}>
              <Text style={styles.sectionTitle}>Select Vehicle Type</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.vehiclesScrollContainer}
                decelerationRate="fast"
                snapToInterval={120}
                snapToAlignment="start"
              >
                {getAvailableVehicleTypes().map((vehicleType) => {
                  const isSelected = selectedVehicle === vehicleType;
                  const seatingCapacity = getVehicleSeatingCapacity(vehicleType);
                  
                  // Get fare for current package and vehicle type
                  const vehicleFare = rentalFares.find(fare => 
                    fare.vehicle_type === vehicleType &&
                    fare.duration_hours === selectedPackage.hours &&
                    fare.km_included === selectedPackage.freeKms
                  );
                  
                  return (
                    <TouchableOpacity
                      key={vehicleType}
                      style={[
                        styles.vehicleCard,
                        isSelected && styles.selectedVehicleCard,
                      ]}
                      onPress={() => setSelectedVehicle(vehicleType)}
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
                        {formatVehicleName(vehicleType)}
                      </Text>
                      <View style={styles.capacityContainer}>
                        <Users 
                          size={14} 
                          color={isSelected ? '#FFFFFF' : '#6B7280'} 
                        />
                        <Text style={[
                          styles.capacityText,
                          isSelected && styles.selectedVehicleText,
                        ]}>
                          {seatingCapacity} seats
                        </Text>
                      </View>
                      <Text style={[
                        styles.vehicleFare,
                        isSelected && styles.selectedVehicleText,
                      ]}>
                        ₹{vehicleFare ? vehicleFare.base_fare : 'N/A'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {calculatedFare > 0 && (
              <View style={styles.fareContainer}>
                <Text style={styles.fareLabel}>Total Amount</Text>
                <Text style={styles.fareAmount}>₹{calculatedFare}</Text>
                <Text style={styles.fareNote}>
                  {selectedPackage.hours} hours • {selectedPackage.freeKms}km included • {formatVehicleName(selectedVehicle)}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.bookButton,
                (!pickupCoords || loading || calculatedFare === 0) && styles.disabledButton
              ]}
              onPress={() => {
                console.log('🎯 [RENTAL] Book button pressed - START');
                console.log('🎯 [RENTAL] Button state check:', {
                  hasPickupCoords: !!pickupCoords,
                  loading,
                  calculatedFare,
                  isDisabled: (!pickupCoords || loading || calculatedFare === 0)
                });
                
                if (!pickupCoords || loading || calculatedFare === 0) {
                  console.log('🎯 [RENTAL] Button disabled - not calling handler');
                  return;
                }
                
                console.log('🎯 [RENTAL] Calling handleBookRental');
                handleBookRental();
              }}
              disabled={!pickupCoords || loading || calculatedFare === 0}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#059669', '#047857']}
                style={styles.bookButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.bookButtonText}>Book Rental</Text>
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
  packageSection: {
    marginBottom: 20,
  },
  packagesScrollContainer: {
    paddingHorizontal: 10,
    paddingRight: 30,
  },
  packageButton: {
    width: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    alignItems: 'center',
  },
  selectedPackageButton: {
    borderColor: '#059669',
    backgroundColor: '#059669',
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  packageHours: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 4,
  },
  packageKms: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  packageFare: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 4,
  },
  packageFare: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 2,
  },
  packageExtra: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  selectedPackageText: {
    color: '#FFFFFF',
  },
  selectedPackageSubtext: {
    color: '#FFFFFF',
    opacity: 0.8,
  },
  locationSection: {
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
    width: 100,
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
    marginRight: 12,
  },
  selectedVehicleCard: {
    borderColor: '#2563EB',
    backgroundColor: '#2563EB',
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
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  selectedVehicleText: {
    color: '#FFFFFF',
  },
  capacityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  capacityText: {
    fontSize: 10,
    color: '#6B7280',
    marginLeft: 4,
  },
  ratesContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  rateText: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 2,
  },
  vehicleFare: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 4,
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
  fareNote: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
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