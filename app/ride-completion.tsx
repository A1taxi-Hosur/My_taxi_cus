import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CircleCheck as CheckCircle, Star, MapPin, Navigation, Car, User, Clock, Download, Chrome as Home, RotateCcw } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../src/utils/supabase';
import { billService } from '../src/services/billService';
import { useAuth } from '../src/contexts/AuthContext';

export default function RideCompletionScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const rideId = params.rideId as string;

  useEffect(() => {
    if (rideId) {
      fetchRideDetails();
    }
  }, [rideId]);

  const fetchRideDetails = async () => {
    try {
      console.log('🎉 Fetching completed ride details for:', rideId);
      
      const { data: rideData, error } = await supabase
        .from('rides')
        .select(`
          *,
          drivers!rides_driver_id_fkey (
            id,
            user_id,
            license_number,
            rating,
            total_rides,
            users!drivers_user_id_fkey (
              full_name,
              phone_number
            ),
            vehicles!fk_drivers_vehicle (
              make,
              model,
              registration_number,
              color,
              vehicle_type
            )
          )
        `)
        .eq('id', rideId)
        .single();

      if (error) {
        console.error('Error fetching ride details:', error);
        Alert.alert('Error', 'Unable to load ride details');
        return;
      }

      console.log('✅ Ride completion details loaded:', {
        id: rideData.id,
        status: rideData.status,
        fare_amount: rideData.fare_amount,
        distance_km: rideData.distance_km,
        duration_minutes: rideData.duration_minutes,
        driver_name: rideData.drivers?.users?.full_name
      });

      setRide(rideData);
    } catch (error) {
      console.error('Error in fetchRideDetails:', error);
      Alert.alert('Error', 'Failed to load ride details');
    } finally {
      setLoading(false);
    }
  };

  const handleRating = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting');
      return;
    }

    setSubmittingRating(true);
    try {
      const { error } = await supabase
        .from('rides')
        .update({
          rating: rating,
          feedback: feedback.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rideId);

      if (error) {
        console.error('Error submitting rating:', error);
        Alert.alert('Error', 'Failed to submit rating');
        return;
      }

      console.log('✅ Rating submitted successfully:', { rating, feedback });
      Alert.alert('Thank You!', 'Your rating has been submitted successfully');
      
      // Update local ride data
      setRide(prev => ({ ...prev, rating, feedback }));
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating');
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleDownloadBill = async () => {
    try {
      console.log('📄 Download bill requested for completed ride:', ride.ride_code);
      await billService.downloadBill(ride);
      
      if (Platform.OS !== 'web') {
        Alert.alert('Success', 'Bill downloaded successfully!');
      }
    } catch (error) {
      console.error('Error downloading bill:', error);
      Alert.alert('Error', 'Failed to download bill. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateFareBreakdown = () => {
    if (!ride) return null;

    const totalFare = ride.fare_amount || 0;
    const distance = ride.distance_km || 0;
    const duration = ride.duration_minutes || 0;

    console.log('💰 Calculating fare breakdown from stored ride data:', {
      totalFare,
      distance,
      duration,
      vehicle_type: ride.vehicle_type,
      booking_type: ride.booking_type
    });

    // If we have actual distance and duration from database, calculate more accurately
    if (distance > 0 && duration > 0) {
      // Use proportional breakdown based on stored values
      const baseFarePercent = 0.3; // 30% base fare
      const distanceFarePercent = 0.5; // 50% distance fare
      const timeFarePercent = 0.15; // 15% time fare
      const surgeFarePercent = 0.05; // 5% surge/other charges
      
      const estimatedBaseFare = totalFare * baseFarePercent;
      const estimatedDistanceFare = totalFare * distanceFarePercent;
      const estimatedTimeFare = totalFare * timeFarePercent;
      const estimatedSurgeFare = totalFare * surgeFarePercent;
      
      console.log('💰 Using proportional breakdown based on stored data');
      
      return {
        baseFare: Math.round(estimatedBaseFare),
        distanceFare: Math.round(estimatedDistanceFare),
        timeFare: Math.round(estimatedTimeFare),
        surgeFare: Math.round(estimatedSurgeFare),
        totalFare: totalFare,
        distance: distance,
        duration: duration,
      };
    }

    // Fallback to estimation if no distance/duration data
    console.log('⚠️ No distance/duration data, using estimation fallback');
    
    // Get base rates for estimation (these should match fare_matrix table)
    let baseFare = 50;
    let perKmRate = 15;
    let perMinRate = 2;

    // Estimate based on vehicle type (should match fare_matrix defaults)
    switch (ride.vehicle_type) {
      case 'hatchback':
        baseFare = 50;
        perKmRate = 12;
        break;
      case 'hatchback_ac':
        baseFare = 60;
        perKmRate = 15;
        break;
      case 'sedan':
        baseFare = 60;
        perKmRate = 15;
        break;
      case 'sedan_ac':
        baseFare = 70;
        perKmRate = 18;
        break;
      case 'suv':
        baseFare = 80;
        perKmRate = 18;
        break;
      case 'suv_ac':
        baseFare = 100;
        perKmRate = 22;
        break;
    }

    // Adjust for booking type
    if (ride.booking_type === 'airport') {
      baseFare *= 3;
      perKmRate *= 1.8;
    } else if (ride.booking_type === 'outstation') {
      baseFare *= 2;
      perKmRate *= 1.5;
    }

    // If we have distance but no breakdown, estimate
    const estimatedDistanceFare = distance > 0 ? distance * perKmRate : totalFare * 0.5;
    const estimatedTimeFare = duration > 0 ? duration * perMinRate : totalFare * 0.15;
    const estimatedBaseFare = Math.min(baseFare, totalFare * 0.3);
    const estimatedSurgeFare = Math.max(0, totalFare - estimatedBaseFare - estimatedDistanceFare - estimatedTimeFare);

    return {
      baseFare: Math.round(estimatedBaseFare),
      distanceFare: Math.round(estimatedDistanceFare),
      timeFare: Math.round(estimatedTimeFare),
      surgeFare: Math.round(estimatedSurgeFare),
      totalFare: totalFare,
      distance: distance,
      duration: duration,
    };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>Loading trip details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Ride details not found</Text>
          <TouchableOpacity
            style={styles.goHomeButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.goHomeButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const fareBreakdown = calculateFareBreakdown();

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#F0F9FF', '#E0F2FE']}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Success Header */}
          <View style={styles.successHeader}>
            <View style={styles.successIcon}>
              <CheckCircle size={48} color="#FFFFFF" />
            </View>
            <Text style={styles.successTitle}>Trip Completed!</Text>
            <Text style={styles.successSubtitle}>
              Thank you for choosing A1 Taxi
            </Text>
          </View>

          {/* Ride Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.rideCode}>#{ride.ride_code}</Text>
              <Text style={styles.completionTime}>
                {formatDate(ride.updated_at)}
              </Text>
            </View>

            {/* Trip Details */}
            <View style={styles.tripDetailsSection}>
              <Text style={styles.sectionTitle}>Trip Details</Text>
              
              <View style={styles.locationContainer}>
                <View style={styles.locationItem}>
                  <Navigation size={18} color="#059669" />
                  <View style={styles.locationDetails}>
                    <Text style={styles.locationLabel}>Pickup</Text>
                    <Text style={styles.locationText}>{ride.pickup_address}</Text>
                  </View>
                </View>
                
                {ride.destination_address && (
                  <View style={styles.locationItem}>
                    <MapPin size={18} color="#DC2626" />
                    <View style={styles.locationDetails}>
                      <Text style={styles.locationLabel}>Destination</Text>
                      <Text style={styles.locationText}>{ride.destination_address}</Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.tripStatsContainer}>
                <View style={styles.tripStat}>
                  <Text style={styles.tripStatValue}>
                    {ride.distance_km ? `${ride.distance_km.toFixed(1)} km` : 'N/A'}
                  </Text>
                  <Text style={styles.tripStatLabel}>Distance</Text>
                </View>
                <View style={styles.tripStat}>
                  <Text style={styles.tripStatValue}>
                    {ride.duration_minutes ? `${Math.round(ride.duration_minutes)} min` : 'N/A'}
                  </Text>
                  <Text style={styles.tripStatLabel}>Duration</Text>
                </View>
                <View style={styles.tripStat}>
                  <Text style={styles.tripStatValue}>
                    {ride.booking_type.charAt(0).toUpperCase() + ride.booking_type.slice(1)}
                  </Text>
                  <Text style={styles.tripStatLabel}>Type</Text>
                </View>
              </View>
            </View>

            {/* Driver Information */}
            {ride.drivers && (
              <View style={styles.driverSection}>
                <Text style={styles.sectionTitle}>Driver Information</Text>
                <View style={styles.driverCard}>
                  <View style={styles.driverHeader}>
                    <View style={styles.driverAvatar}>
                      <User size={24} color="#FFFFFF" />
                    </View>
                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName}>
                        {ride.drivers.users?.full_name || 'Driver'}
                      </Text>
                      <View style={styles.driverRating}>
                        <Star size={14} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.driverRatingText}>
                          {ride.drivers.rating || '5.0'} ({ride.drivers.total_rides || 0} trips)
                        </Text>
                      </View>
                    </View>
                  </View>

                  {ride.drivers.vehicles && (
                    <View style={styles.vehicleInfo}>
                      <Car size={16} color="#6B7280" />
                      <Text style={styles.vehicleText}>
                        {`${ride.drivers.vehicles.make || ''} ${ride.drivers.vehicles.model || ''} • ${ride.drivers.vehicles.color || ''}`}
                      </Text>
                      <View style={styles.plateContainer}>
                        <Text style={styles.plateText}>
                          {ride.drivers.vehicles.registration_number || 'N/A'}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Fare Breakdown */}
            {fareBreakdown && (
              <View style={styles.fareSection}>
                <Text style={styles.sectionTitle}>Fare Breakdown</Text>
                <View style={styles.fareCard}>
                  <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Base Fare</Text>
                    <Text style={styles.fareValue}>₹{fareBreakdown.baseFare}</Text>
                  </View>
                  
                  {fareBreakdown.distanceFare > 0 && (
                    <View style={styles.fareRow}>
                      <Text style={styles.fareLabel}>
                        Distance Fare ({fareBreakdown.distance.toFixed(1)} km)
                      </Text>
                      <Text style={styles.fareValue}>₹{fareBreakdown.distanceFare}</Text>
                    </View>
                  )}
                  
                  {fareBreakdown.timeFare > 0 && (
                    <View style={styles.fareRow}>
                      <Text style={styles.fareLabel}>
                        Time Fare ({Math.round(fareBreakdown.duration)} min)
                      </Text>
                      <Text style={styles.fareValue}>₹{fareBreakdown.timeFare}</Text>
                    </View>
                  )}
                  
                  {fareBreakdown.surgeFare > 0 && (
                    <View style={styles.fareRow}>
                      <Text style={styles.fareLabel}>Surge Charges</Text>
                      <Text style={styles.fareValue}>₹{fareBreakdown.surgeFare}</Text>
                    </View>
                  )}
                  
                  <View style={[styles.fareRow, styles.totalFareRow]}>
                    <Text style={styles.totalFareLabel}>Total Amount</Text>
                    <Text style={styles.totalFareValue}>₹{ride.fare_amount}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Payment Information */}
            <View style={styles.paymentSection}>
              <Text style={styles.sectionTitle}>Payment</Text>
              <View style={styles.paymentCard}>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Method</Text>
                  <Text style={styles.paymentValue}>
                    {ride.payment_method?.charAt(0).toUpperCase() + ride.payment_method?.slice(1) || 'Cash'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Rating Section */}
            {!ride.rating && (
              <View style={styles.ratingSection}>
                <Text style={styles.sectionTitle}>Rate Your Experience</Text>
                <View style={styles.ratingCard}>
                  <Text style={styles.ratingPrompt}>How was your ride?</Text>
                  
                  <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setRating(star)}
                        style={styles.starButton}
                      >
                        <Star
                          size={32}
                          color="#F59E0B"
                          fill={star <= rating ? "#F59E0B" : "transparent"}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.submitRatingButton,
                      rating === 0 && styles.disabledButton
                    ]}
                    onPress={handleRating}
                    disabled={rating === 0 || submittingRating}
                  >
                    {submittingRating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitRatingText}>Submit Rating</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Bill Actions */}
            <View style={styles.billSection}>
              <Text style={styles.sectionTitle}>Bill & Receipt</Text>
              <View style={styles.billActionsContainer}>
                <TouchableOpacity
                  style={styles.billActionButton}
                  onPress={handleDownloadBill}
                  activeOpacity={0.7}
                >
                  <Download size={20} color="#2563EB" />
                  <Text style={styles.billActionText}>Download Bill</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.bookAnotherButton}
              onPress={() => router.replace('/(tabs)')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#2563EB', '#1D4ED8']}
                style={styles.bookAnotherGradient}
              >
                <RotateCcw size={20} color="#FFFFFF" />
                <Text style={styles.bookAnotherText}>Book Another Ride</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.goHomeButton}
              onPress={() => router.replace('/(tabs)')}
              activeOpacity={0.8}
            >
              <Home size={20} color="#374151" />
              <Text style={styles.goHomeText}>Go to Home</Text>
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
    backgroundColor: '#F0F9FF',
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#DC2626',
    marginBottom: 20,
    textAlign: 'center',
  },
  successHeader: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    margin: 20,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rideCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  completionTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  tripDetailsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  locationContainer: {
    marginBottom: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  locationDetails: {
    marginLeft: 12,
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 22,
  },
  tripStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  tripStat: {
    alignItems: 'center',
  },
  tripStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  tripStatLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  driverSection: {
    marginBottom: 24,
  },
  driverCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverRatingText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  vehicleText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  plateContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  plateText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400E',
  },
  fareSection: {
    marginBottom: 24,
  },
  fareCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fareLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  fareValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  totalFareRow: {
    borderTopWidth: 2,
    borderTopColor: '#2563EB',
    paddingTop: 16,
    marginTop: 8,
    marginBottom: 0,
  },
  totalFareLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  totalFareValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
  },
  paymentSection: {
    marginBottom: 24,
  },
  paymentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  paymentStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ratingSection: {
    marginBottom: 24,
  },
  ratingCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  ratingPrompt: {
    fontSize: 16,
    color: '#92400E',
    marginBottom: 16,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  starButton: {
    padding: 8,
  },
  submitRatingButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitRatingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  billSection: {
    marginBottom: 24,
  },
  billActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  billActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flex: 0.45,
    justifyContent: 'center',
  },
  billActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  bookAnotherButton: {
    borderRadius: 16,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  bookAnotherGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
  },
  bookAnotherText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  goHomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 18,
  },
  goHomeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  goHomeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});