import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Platform, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, MapPin, Navigation, Car, User, Star, Clock, Plane, ArrowUpDown, Download, Printer, RefreshCw, Filter } from 'lucide-react-native';
import { supabase } from '../../src/utils/supabase';
import { useAuth } from '../../src/contexts/AuthContext';
import { Ride } from '../../src/types/database';
import { billService } from '../../src/services/billService';

interface RideHistoryFilters {
  status: 'all' | 'completed' | 'cancelled';
  bookingType: 'all' | 'regular' | 'rental' | 'outstation' | 'airport';
  dateRange: 'all' | 'week' | 'month' | 'year';
}

interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalRides: number;
  hasMore: boolean;
}

const RIDES_PER_PAGE = 20;

export default function HistoryScreen() {
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [allRides, setAllRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<RideHistoryFilters>({
    status: 'all',
    bookingType: 'all',
    dateRange: 'all',
  });
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    totalRides: 0,
    hasMore: false,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  useEffect(() => {
    if (user) {
      fetchRideHistory();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCompleteRideHistory();
    setRefreshing(false);
  };

  const fetchCompleteRideHistory = async () => {
    if (!user) return;

    console.log('📚 [HISTORY] Starting comprehensive ride history fetch for user:', user.id);
    console.log('📚 [HISTORY] Fetch parameters:', {
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      timestamp: new Date().toISOString()
    });

    try {
      // Fetch all historical rides with complete details via edge function
      console.log('📚 [HISTORY] Fetching complete ride history via edge function...');

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/ride-api/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [HISTORY] Error from edge function:', errorText);
        throw new Error(errorText);
      }

      const result = await response.json();

      if (result.error) {
        console.error('❌ [HISTORY] Edge function returned error:', result.error);
        throw result.error;
      }

      const historicalRides = result.data;
      const totalCount = historicalRides?.length || 0;

      console.log('✅ [HISTORY] Historical rides fetched successfully:', {
        totalRides: historicalRides?.length || 0,
        totalCount: totalCount,
        ridesBreakdown: historicalRides?.reduce((acc, ride) => {
          acc[ride.status] = (acc[ride.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        bookingTypesBreakdown: historicalRides?.reduce((acc, ride) => {
          acc[ride.booking_type] = (acc[ride.booking_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        dateRange: historicalRides?.length > 0 ? {
          oldest: historicalRides[historicalRides.length - 1]?.created_at,
          newest: historicalRides[0]?.created_at
        } : null
      });

      // Step 3: Store all rides and update pagination
      const ridesData = historicalRides || [];
      setAllRides(ridesData);
      
      // Update pagination state
      const totalPages = Math.ceil((totalCount || 0) / RIDES_PER_PAGE);
      setPagination({
        currentPage: 1,
        totalPages,
        totalRides: totalCount || 0,
        hasMore: (totalCount || 0) > RIDES_PER_PAGE,
      });

      // Step 4: Apply current filters to show filtered results
      applyFiltersToRides(ridesData);
      
      // Update last fetch time
      setLastFetchTime(new Date());
      
      console.log('✅ [HISTORY] Complete ride history loaded and cached:', {
        totalRidesInMemory: ridesData.length,
        paginationState: {
          currentPage: 1,
          totalPages,
          totalRides: totalCount || 0,
          hasMore: (totalCount || 0) > RIDES_PER_PAGE
        }
      });

    } catch (error) {
      console.error('❌ [HISTORY] Final error in fetchCompleteRideHistory:', error);
      
      // Show user-friendly error message
      Alert.alert(
        'Error Loading History',
        'Unable to load your ride history. Please check your connection and try again.',
        [
          { text: 'Retry', onPress: fetchCompleteRideHistory },
          { text: 'OK' }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    console.log('🔍 [HISTORY] Applying filters:', filters);
    applyFiltersToRides(allRides);
  };

  const applyFiltersToRides = (ridesToFilter: Ride[]) => {
    let filteredRides = [...ridesToFilter];

    // Filter by status
    if (filters.status !== 'all') {
      filteredRides = filteredRides.filter(ride => ride.status === filters.status);
    }

    // Filter by booking type
    if (filters.bookingType !== 'all') {
      filteredRides = filteredRides.filter(ride => ride.booking_type === filters.bookingType);
    }

    // Filter by date range
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let cutoffDate: Date;

      switch (filters.dateRange) {
        case 'week':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }

      filteredRides = filteredRides.filter(ride => 
        new Date(ride.created_at) >= cutoffDate
      );
    }

    console.log('🔍 [HISTORY] Filter results:', {
      originalCount: ridesToFilter.length,
      filteredCount: filteredRides.length,
      appliedFilters: filters
    });

    setRides(filteredRides);
  };

  const loadMoreRides = async () => {
    if (loadingMore || !pagination.hasMore) return;

    console.log('📚 [HISTORY] Loading more rides - page:', pagination.currentPage + 1);
    setLoadingMore(true);

    try {
      const offset = pagination.currentPage * RIDES_PER_PAGE;
      
      const { data: moreRides, error } = await supabase
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
        .eq('customer_id', user.id)
        .in('status', ['completed', 'cancelled', 'no_drivers_available'])
        .order('created_at', { ascending: false })
        .range(offset, offset + RIDES_PER_PAGE - 1);

      if (error) {
        console.error('❌ [HISTORY] Error loading more rides:', error);
        throw error;
      }
      
      if (moreRides && moreRides.length > 0) {
        console.log('✅ [HISTORY] Loaded', moreRides.length, 'more rides');
        
        const updatedAllRides = [...allRides, ...moreRides];
        setAllRides(updatedAllRides);
        
        // Update pagination
        const newPage = pagination.currentPage + 1;
        setPagination(prev => ({
          ...prev,
          currentPage: newPage,
          hasMore: newPage < prev.totalPages,
        }));
        
        // Reapply filters with new data
        applyFiltersToRides(updatedAllRides);
      } else {
        console.log('📚 [HISTORY] No more rides to load');
        setPagination(prev => ({ ...prev, hasMore: false }));
      }
    } catch (error) {
      console.error('❌ [HISTORY] Error loading more rides:', error);
      Alert.alert('Error', 'Failed to load more rides. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  const resetFilters = () => {
    console.log('🔄 [HISTORY] Resetting all filters');
    setFilters({
      status: 'all',
      bookingType: 'all',
      dateRange: 'all',
    });
  };

  const getFilteredRideStats = () => {
    const stats = {
      total: allRides.length,
      completed: allRides.filter(r => r.status === 'completed').length,
      cancelled: allRides.filter(r => r.status === 'cancelled').length,
      noDrivers: allRides.filter(r => r.status === 'no_drivers_available').length,
      totalFare: allRides
        .filter(r => r.status === 'completed' && r.fare_amount)
        .reduce((sum, r) => sum + (r.fare_amount || 0), 0),
      bookingTypes: allRides.reduce((acc, ride) => {
        acc[ride.booking_type] = (acc[ride.booking_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    console.log('📊 [HISTORY] Ride statistics:', stats);
    return stats;
  };

  const handleFilterChange = (filterType: keyof RideHistoryFilters, value: string) => {
    console.log('🔍 [HISTORY] Filter changed:', filterType, '=', value);
    setFilters(prev => ({
      ...prev,
      [filterType]: value,
    }));
  };

  // Legacy method for backward compatibility
  const fetchRideHistory = async () => {
    console.log('🔄 [HISTORY] Legacy fetchRideHistory called, redirecting to comprehensive fetch');
    return fetchCompleteRideHistory();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#059669';
      case 'cancelled':
        return '#DC2626';
      case 'no_drivers_available':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'no_drivers_available':
        return 'No Drivers';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const getBookingTypeIcon = (bookingType: string) => {
    switch (bookingType) {
      case 'rental':
        return <Clock size={16} color="#059669" />;
      case 'outstation':
        return <ArrowUpDown size={16} color="#DC2626" />;
      case 'airport':
        return <Plane size={16} color="#EA580C" />;
      default:
        return <Car size={16} color="#2563EB" />;
    }
  };

  const getBookingTypeColor = (bookingType: string) => {
    switch (bookingType) {
      case 'rental':
        return '#059669';
      case 'outstation':
        return '#DC2626';
      case 'airport':
        return '#EA580C';
      default:
        return '#2563EB';
    }
  };

  const handleDownloadBill = async (ride: any) => {
    try {
      console.log('📄 Download bill requested for ride:', ride.ride_code);
      await billService.downloadBill(ride);
      
      if (Platform.OS !== 'web') {
        Alert.alert('Success', 'Bill downloaded successfully!');
      }
    } catch (error) {
      console.error('Error downloading bill:', error);
      Alert.alert('Error', 'Failed to download bill. Please try again.');
    }
  };

  const handlePrintBill = async (ride: any) => {
    try {
      console.log('🖨️ Print bill requested for ride:', ride.ride_code);
      await billService.printBill(ride);
    } catch (error) {
      console.error('Error printing bill:', error);
      Alert.alert('Error', 'Failed to print bill. Please try again.');
    }
  };

  const renderRideCard = (ride: any) => (
    <View key={ride.id} style={styles.rideCard}>
      <View style={styles.rideHeader}>
        <View style={styles.statusContainer}>
          <View style={[
            styles.statusDot,
            { backgroundColor: getStatusColor(ride.status) }
          ]} />
          <Text style={[
            styles.statusText,
            { color: getStatusColor(ride.status) }
          ]}>
            {getStatusText(ride.status)}
          </Text>
        </View>
        
        <View style={styles.bookingTypeContainer}>
          {getBookingTypeIcon(ride.booking_type)}
          <Text style={[
            styles.bookingTypeText,
            { color: getBookingTypeColor(ride.booking_type) }
          ]}>
            {ride.booking_type.charAt(0).toUpperCase() + ride.booking_type.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.rideCodeContainer}>
        <Text style={styles.rideCode}>#{ride.ride_code}</Text>
        <Text style={styles.rideDate}>{formatDate(ride.created_at)}</Text>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationItem}>
          <Navigation size={16} color="#059669" />
          <View style={styles.locationDetails}>
            <Text style={styles.locationLabel}>Pickup</Text>
            <Text style={styles.locationText} numberOfLines={2}>
              {ride.pickup_address}
            </Text>
          </View>
        </View>
        
        {ride.destination_address && ride.booking_type !== 'rental' && (
          <View style={styles.locationItem}>
            <MapPin size={16} color="#DC2626" />
            <View style={styles.locationDetails}>
              <Text style={styles.locationLabel}>Destination</Text>
              <Text style={styles.locationText} numberOfLines={2}>
                {ride.destination_address}
              </Text>
            </View>
          </View>
        )}
      </View>

      {ride.drivers && (
        <View style={styles.driverContainer}>
          <View style={styles.driverInfo}>
            <User size={14} color="#6B7280" />
            <Text style={styles.driverText}>{ride.drivers.users.full_name}</Text>
            {ride.drivers.rating && (
              <View style={styles.ratingContainer}>
                <Star size={12} color="#F59E0B" fill="#F59E0B" />
                <Text style={styles.ratingText}>{ride.drivers.rating}</Text>
              </View>
            )}
          </View>
          
          {ride.drivers.vehicles && (
            <View style={styles.vehicleInfo}>
              <Car size={14} color="#6B7280" />
              <Text style={styles.vehicleText}>
                {ride.drivers.vehicles.make} {ride.drivers.vehicles.model}
              </Text>
              <Text style={styles.plateText}>
                {ride.drivers.vehicles.registration_number}
              </Text>
            </View>
          )}
        </View>
      )}

      {ride.fare_amount && (
        <View style={styles.fareContainer}>
          <Text style={styles.fareAmount}>₹{ride.fare_amount}</Text>
          {ride.payment_status && (
            <Text style={[
              styles.paymentStatus,
              { color: ride.payment_status === 'completed' ? '#059669' : '#F59E0B' }
            ]}>
              {ride.payment_status.charAt(0).toUpperCase() + ride.payment_status.slice(1)}
            </Text>
          )}
        </View>
      )}

      {ride.rating && (
        <View style={styles.ratingSection}>
          <Text style={styles.ratingLabel}>Your Rating:</Text>
          <View style={styles.userRatingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={16}
                color="#F59E0B"
                fill={star <= ride.rating ? "#F59E0B" : "transparent"}
              />
            ))}
          </View>
        </View>
      )}

      {ride.feedback && (
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackText}>"{ride.feedback}"</Text>
        </View>
      )}

      {ride.status === 'completed' && (
        <View style={styles.billActionsContainer}>
          <TouchableOpacity
            style={styles.billActionButton}
            onPress={() => handleDownloadBill(ride)}
            activeOpacity={0.7}
          >
            <Download size={16} color="#2563EB" />
            <Text style={styles.billActionText}>Download Bill</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading history...</Text>
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
        <View style={styles.header}>
          <Text style={styles.title}>Ride History</Text>
          
          {/* Expandable Filter Panel */}
          {showFilters && (
            <View style={styles.filtersPanel}>
              {/* Status Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Status</Text>
                <View style={styles.filterOptions}>
                  {(['all', 'completed', 'cancelled'] as const).map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.filterOption,
                        filters.status === status && styles.activeFilterOption,
                      ]}
                      onPress={() => handleFilterChange('status', status)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.status === status && styles.activeFilterOptionText,
                      ]}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Booking Type Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Booking Type</Text>
                <View style={styles.filterOptions}>
                  {(['all', 'regular', 'rental', 'outstation', 'airport'] as const).map((bookingType) => (
                    <TouchableOpacity
                      key={bookingType}
                      style={[
                        styles.filterOption,
                        filters.bookingType === bookingType && styles.activeFilterOption,
                      ]}
                      onPress={() => handleFilterChange('bookingType', bookingType)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.bookingType === bookingType && styles.activeFilterOptionText,
                      ]}>
                        {bookingType.charAt(0).toUpperCase() + bookingType.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Date Range Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Date Range</Text>
                <View style={styles.filterOptions}>
                  {(['all', 'week', 'month', 'year'] as const).map((dateRange) => (
                    <TouchableOpacity
                      key={dateRange}
                      style={[
                        styles.filterOption,
                        filters.dateRange === dateRange && styles.activeFilterOption,
                      ]}
                      onPress={() => handleFilterChange('dateRange', dateRange)}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        filters.dateRange === dateRange && styles.activeFilterOptionText,
                      ]}>
                        {dateRange === 'all' ? 'All Time' : 
                         dateRange === 'week' ? 'Last Week' :
                         dateRange === 'month' ? 'Last Month' : 'Last Year'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Results Summary */}
          {allRides.length > 0 && (
            <View style={styles.resultsSummary}>
              <Text style={styles.resultsText}>
                Showing {rides.length} of {allRides.length} rides
                {lastFetchTime && (
                  <Text style={styles.lastUpdateText}>
                    {' • Updated ' + formatTime(lastFetchTime.toISOString())}
                  </Text>
                )}
              </Text>
            </View>
          )}
        </View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2563EB']}
              tintColor="#2563EB"
            />
          }
        >
          {rides.length > 0 ? (
            <>
              {rides.map((ride) => renderRideCard(ride))}
              
              {/* Load More Button */}
              {pagination.hasMore && (
                <View style={styles.loadMoreContainer}>
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={loadMoreRides}
                    disabled={loadingMore}
                    activeOpacity={0.8}
                  >
                    {loadingMore ? (
                      <ActivityIndicator size="small" color="#2563EB" />
                    ) : (
                      <>
                        <RefreshCw size={16} color="#2563EB" />
                        <Text style={styles.loadMoreText}>
                          Load More ({pagination.totalRides - allRides.length} remaining)
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noHistoryContainer}>
              <Text style={styles.noHistoryTitle}>
                {filters.status === 'all' && filters.bookingType === 'all' && filters.dateRange === 'all' 
                  ? 'No Ride History' 
                  : 'No rides match your filters'}
              </Text>
              <Text style={styles.noHistoryText}>
                {filters.status === 'all' && filters.bookingType === 'all' && filters.dateRange === 'all'
                  ? 'Your completed and cancelled rides will appear here.'
                  : 'Try adjusting your filters or refresh to see more rides.'
                }
              </Text>
              
              <View style={styles.noHistoryActions}>
                {(filters.status !== 'all' || filters.bookingType !== 'all' || filters.dateRange !== 'all') && (
                  <TouchableOpacity
                    style={styles.resetFiltersButton}
                    onPress={resetFilters}
                    activeOpacity={0.8}
                  >
                    <RefreshCw size={16} color="#DC2626" />
                    <Text style={styles.resetFiltersText}>Reset Filters</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={onRefresh}
                  activeOpacity={0.8}
                >
                  <RefreshCw size={16} color="#2563EB" />
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeFilterButton: {
    backgroundColor: '#2563EB',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeFilterButtonText: {
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filterToggleText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
    fontWeight: '600',
  },
  resetFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetFiltersText: {
    fontSize: 14,
    color: '#DC2626',
    marginLeft: 6,
    fontWeight: '600',
  },
  filtersPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeFilterOption: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterOptionText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  activeFilterOptionText: {
    color: '#FFFFFF',
  },
  resultsSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  resultsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bookingTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bookingTypeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  rideCodeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rideCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  rideDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  locationContainer: {
    marginBottom: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  locationDetails: {
    marginLeft: 12,
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  driverContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  driverText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 12,
    color: '#92400E',
    marginLeft: 2,
    fontWeight: '600',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  plateText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fareContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fareAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  paymentStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
  },
  userRatingContainer: {
    flexDirection: 'row',
  },
  feedbackContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  feedbackText: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
  },
  billActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  billActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  billActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 6,
  },
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
    marginLeft: 8,
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
  noHistoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  noHistoryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 10,
    textAlign: 'center',
  },
  noHistoryText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  noHistoryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});