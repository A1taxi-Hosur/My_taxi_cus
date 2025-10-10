import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Search, MapPin, Clock, Star, X, Navigation } from 'lucide-react-native';
import * as Location from 'expo-location';
import { GOOGLE_MAPS_API_KEY, HOSUR_LANDMARKS } from '../config/maps';
import { googleMapsService } from '../services/googleMapsService';
import { enhancedLocationService } from '../services/enhancedLocationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

interface LocationSuggestion {
  place_id: string;
  description: string;
  coordinates: { latitude: number; longitude: number };
  type: 'current' | 'recent' | 'search' | 'landmark';
  distance?: number;
}

interface EnhancedLocationSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: string, coords: { latitude: number; longitude: number }) => void;
  placeholder?: string;
  currentLocation?: Location.LocationObject | null;
  title?: string;
}

export default function EnhancedLocationSearchModal({
  visible,
  onClose,
  onLocationSelect,
  placeholder = "Search for a location",
  currentLocation,
  title = "Select Location",
}: EnhancedLocationSearchModalProps) {
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [searchHistory, setSearchHistory] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const RECENT_SEARCHES_KEY = 'recent_location_searches';
  const MAX_RECENT_SEARCHES = 10;

  useEffect(() => {
    if (visible) {
      loadRecentSearches();
      setSearchText('');
      setSuggestions([]);
    }
  }, [visible]);

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const recentSearches = JSON.parse(stored);
        setSearchHistory(recentSearches);
        console.log('📚 Loaded', recentSearches.length, 'recent searches');
      } else {
        setSearchHistory([]);
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
      setSearchHistory([]);
    }
  };

  const saveToRecentSearches = async (location: LocationSuggestion) => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      let recentSearches: LocationSuggestion[] = stored ? JSON.parse(stored) : [];
      
      // Remove if already exists (to avoid duplicates)
      recentSearches = recentSearches.filter(item => 
        item.place_id !== location.place_id && 
        item.description !== location.description
      );
      
      // Add to beginning
      recentSearches.unshift({
        ...location,
        type: 'recent'
      });
      
      // Keep only the most recent searches
      recentSearches = recentSearches.slice(0, MAX_RECENT_SEARCHES);
      
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
      setSearchHistory(recentSearches);
      
      console.log('💾 Saved location to recent searches:', location.description);
    } catch (error) {
      console.error('Error saving to recent searches:', error);
    }
  };
  const searchLocations = async (text: string) => {
    if (text.length < 2) {
      setSuggestions([]);
      return;
    }

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Debounce search
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        console.log('🔍 Searching for places:', text);
        
        // Use the places-proxy edge function directly
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/places-proxy/autocomplete?input=${encodeURIComponent(text)}&location=12.7402,77.8240&radius=500000&components=country:in`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
            },
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📍 Places API response:', data.status, data.predictions?.length || 0);
        
        if (data.status === 'OK' && data.predictions && data.predictions.length > 0) {
          const suggestions: LocationSuggestion[] = await Promise.all(
            data.predictions.slice(0, 5).map(async (prediction: any) => {
              try {
                // Get place details for coordinates
                const detailsResponse = await fetch(
                  `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/places-proxy/details?place_id=${prediction.place_id}&fields=geometry,formatted_address`,
                  {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
                    },
                  }
                );
                
                const detailsData = await detailsResponse.json();
                const coords = detailsData.result?.geometry?.location;
                
                return {
                  place_id: prediction.place_id,
                  description: prediction.description,
                  coordinates: {
                    latitude: coords?.lat || 12.7402,
                    longitude: coords?.lng || 77.8240,
                  },
                  type: 'search' as const,
                };
              } catch (error) {
                console.error('Error getting place details:', error);
                return {
                  place_id: prediction.place_id,
                  description: prediction.description,
                  coordinates: { latitude: 12.7402, longitude: 77.8240 },
                  type: 'search' as const,
                };
              }
            })
          );
          
          setSuggestions(suggestions);
        } else {
          console.log('⚠️ No search results, using local fallback');
          const localSuggestions = searchLocalPlaces(text);
          setSuggestions(localSuggestions);
        }
      } catch (error) {
        console.error('Error searching locations:', error);
        Alert.alert('Search Error', 'Unable to search locations. Using local suggestions.');
        // Fallback to local search on error
        const localSuggestions = searchLocalPlaces(text);
        setSuggestions(localSuggestions);
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms debounce

    setSearchTimeout(timeout);
  };

  const searchLocalPlaces = (text: string): LocationSuggestion[] => {
    const searchTerm = text.toLowerCase();
    
    // Search through landmarks and popular places
    const allPlaces = [
      ...HOSUR_LANDMARKS.map((landmark, index) => ({
        place_id: `landmark_${index}`,
        description: `${landmark.name}, Hosur`,
        coordinates: landmark.coordinates,
        type: 'landmark' as const,
      })),
      // Add some common city searches
      {
        place_id: 'bangalore',
        description: 'Bangalore, Karnataka',
        coordinates: { latitude: 12.9716, longitude: 77.5946 },
        type: 'search' as const,
      },
      {
        place_id: 'chennai',
        description: 'Chennai, Tamil Nadu',
        coordinates: { latitude: 13.0827, longitude: 80.2707 },
        type: 'search' as const,
      },
      {
        place_id: 'krishnagiri',
        description: 'Krishnagiri, Tamil Nadu',
        coordinates: { latitude: 12.5266, longitude: 78.2140 },
        type: 'search' as const,
      },
    ];
    
    // Filter places that match the search term
    const filtered = allPlaces.filter(place => 
      place.description.toLowerCase().includes(searchTerm)
    );
    
    // If no matches, create generic suggestions
    if (filtered.length === 0) {
      return [
        {
          place_id: `search_${text}_1`,
          description: `${text}, Tamil Nadu`,
          coordinates: { latitude: 12.7402, longitude: 77.8240 },
          type: 'search',
        },
        {
          place_id: `search_${text}_2`,
          description: `${text}, Karnataka`,
          coordinates: { latitude: 12.9716, longitude: 77.5946 },
          type: 'search',
        },
      ];
    }
    
    return filtered;
  };

  const handleLocationSelect = async (suggestion: LocationSuggestion) => {
    console.log('📍 Location selected:', {
      description: suggestion.description,
      coordinates: suggestion.coordinates,
      type: suggestion.type
    });
    
    // Validate coordinates before calling onLocationSelect
    if (!suggestion.coordinates || 
        typeof suggestion.coordinates.latitude !== 'number' ||
        typeof suggestion.coordinates.longitude !== 'number' ||
        isNaN(suggestion.coordinates.latitude) ||
        isNaN(suggestion.coordinates.longitude)) {
      console.error('❌ Invalid coordinates:', suggestion.coordinates);
      Alert.alert('Error', 'Invalid location coordinates. Please try another location.');
      return;
    }

    // Add to search history if it's a search result
    if (suggestion.type === 'search') {
      await saveToRecentSearches(suggestion);
    }
    console.log('✅ Calling onLocationSelect with valid coordinates');
    onLocationSelect(suggestion.description, suggestion.coordinates);
    setSearchText('');
    setSuggestions([]);
    onClose();
  };
  const handleUseCurrentLocation = async () => {
    if (!currentLocation) {
      Alert.alert('Error', 'Current location not available');
      return;
    }

    try {
      setLoading(true);
      
      // Use simple address format to avoid API calls
      let address = 'Current Location';
      
      try {
        // Try to get a readable address
        const [geocoded] = await Location.reverseGeocodeAsync({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        
        if (geocoded) {
          const addressParts = [
            geocoded.street,
            geocoded.district,
            geocoded.city,
            geocoded.region
          ].filter(Boolean);
          address = addressParts.length > 0 ? addressParts.join(', ') : 'Current Location';
        }
      } catch (geocodeError) {
        console.warn('⚠️ Geocoding failed:', geocodeError);
        address = `Current Location (${currentLocation.coords.latitude.toFixed(4)}, ${currentLocation.coords.longitude.toFixed(4)})`;
      }

      console.log('📍 Using current location:', {
        address,
        coordinates: {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        }
      });

      onLocationSelect(address, {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      onClose();
    } catch (error) {
      console.error('Error using current location:', error);
      console.error('Error: Unable to use current location');
    } finally {
      setLoading(false);
    }
  };

  const getLocationIcon = (type: string) => {
    switch (type) {
      case 'current':
        return <Navigation size={20} color="#2563EB" />;
      case 'recent':
        return <Clock size={20} color="#6B7280" />;
      case 'landmark':
        return <Star size={20} color="#F59E0B" />;
      default:
        return <Search size={20} color="#6B7280" />;
    }
  };

  const formatDistance = (distance?: number) => {
    if (!distance) return '';
    if (distance < 1) {
      return ` • ${Math.round(distance * 1000)}m away`;
    }
    return ` • ${distance.toFixed(1)}km away`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search size={20} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={(text) => {
                setSearchText(text);
                searchLocations(text);
              }}
              placeholder={placeholder}
              autoFocus
              placeholderTextColor="#9CA3AF"
              returnKeyType="search"
            />
            {loading && <ActivityIndicator size="small" color="#2563EB" />}
          </View>
        </View>

        <View style={styles.content}>
          {/* Current Location Option */}
          {currentLocation && (
            <TouchableOpacity
              style={styles.currentLocationButton}
              onPress={handleUseCurrentLocation}
              disabled={loading}
            >
              <View style={styles.locationItemLeft}>
                <View style={styles.currentLocationIcon}>
                  <Navigation size={20} color="#2563EB" />
                </View>
                <View style={styles.locationTextContainer}>
                  <Text style={styles.currentLocationText}>Use Current Location</Text>
                  <Text style={styles.currentLocationSubtext}>
                    GPS • {currentLocation.coords.accuracy ? `±${Math.round(currentLocation.coords.accuracy)}m` : 'High accuracy'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Search Results or Recent Locations */}
          <FlatList
            data={searchText.length >= 2 ? suggestions : searchHistory}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleLocationSelect(item)}
              >
                <View style={styles.locationItemLeft}>
                  <View style={styles.suggestionIcon}>
                    {getLocationIcon(item.type)}
                  </View>
                  <View style={styles.locationTextContainer}>
                    <Text style={styles.suggestionText} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <Text style={styles.suggestionSubtext}>
                      {item.type === 'recent' && 'Popular destination'}
                      {item.type === 'search' && 'Search result'}
                      {formatDistance(item.distance)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListHeaderComponent={
              searchText.length < 2 && searchHistory.length > 0 ? (
                <Text style={styles.sectionHeader}>Recent Searches ({searchHistory.length})</Text>
              ) : searchText.length >= 2 && suggestions.length > 0 ? (
                <Text style={styles.sectionHeader}>Search Results</Text>
              ) : null
            }
            ListEmptyComponent={
              searchText.length >= 2 && !loading ? (
                <View style={styles.emptyContainer}>
                  <MapPin size={48} color="#9CA3AF" />
                  <Text style={styles.emptyText}>No locations found</Text>
                  <Text style={styles.emptySubtext}>Try a different search term or check spelling</Text>
                </View>
              ) : searchText.length < 2 && searchHistory.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Clock size={48} color="#9CA3AF" />
                  <Text style={styles.emptyText}>No Recent Searches</Text>
                  <Text style={styles.emptySubtext}>Your recent destination searches will appear here for quick access</Text>
                </View>
              ) : null
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  placeholder: {
    width: 32,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 12,
  },
  content: {
    flex: 1,
  },
  currentLocationButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#F0F9FF',
  },
  locationItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentLocationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  currentLocationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },
  currentLocationSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  suggestionItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionText: {
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 2,
  },
  suggestionSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  fallbackButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  fallbackButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
});