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
import { Search, MapPin, Clock, X } from 'lucide-react-native';
import * as Location from 'expo-location';
import { GOOGLE_MAPS_API_KEY, HOSUR_LANDMARKS } from '../config/maps';

// Get Supabase URL and key from the client
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

interface LocationSuggestion {
  place_id: string;
  description: string;
  coordinates: { latitude: number; longitude: number };
  type: 'current' | 'recent' | 'search';
}

interface LocationPickerProps {
  label: string;
  value: string;
  onLocationSelect: (location: string, coords: { latitude: number; longitude: number }) => void;
  icon?: React.ReactNode;
  placeholder?: string;
  currentLocation?: Location.LocationObject | null;
}

export default function LocationPicker({
  label,
  value,
  onLocationSelect,
  icon,
  placeholder = "Enter location",
  currentLocation,
}: LocationPickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [recentLocations, setRecentLocations] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (modalVisible) {
      loadRecentLocations();
      setSearchText('');
      setSuggestions([]);
    }
  }, [modalVisible]);

  const loadRecentLocations = () => {
    setRecentLocations([]);
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
        console.log('🔍 Searching for locations:', text);
        
        // Try edge function first, fallback to local search on any error
        try {
          // Use the places-proxy edge function
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
                  
                  if (!detailsResponse.ok) {
                    throw new Error(`Details API failed: ${detailsResponse.status}`);
                  }
                  
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
                  console.warn('⚠️ Error getting place details, using fallback coordinates:', error.message);
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
            throw new Error('No predictions from API');
          }
        } catch (apiError) {
          console.warn('⚠️ Places API unavailable, using local fallback:', apiError.message);
          const fallbackSuggestions = createFallbackSuggestions(text);
          setSuggestions(fallbackSuggestions);
        }
      } catch (error) {
        console.warn('⚠️ Search error, using local fallback:', error.message);
        const fallbackSuggestions = createFallbackSuggestions(text);
        setSuggestions(fallbackSuggestions);
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms debounce

    setSearchTimeout(timeout);
  };

  const createFallbackSuggestions = (text: string): LocationSuggestion[] => {
    return [
      {
        place_id: `fallback1_${text}`,
        description: `${text}, Tamil Nadu, India`,
        coordinates: { latitude: 12.7402, longitude: 77.8240 },
        type: 'search',
      },
      {
        place_id: `fallback2_${text}`,
        description: `${text}, Karnataka, India`,
        coordinates: { latitude: 12.9716, longitude: 77.5946 },
        type: 'search',
      },
      {
        place_id: `fallback3_${text}`,
        description: `${text}, Hosur, Tamil Nadu`,
        coordinates: { latitude: 12.7402 + Math.random() * 0.01, longitude: 77.8240 + Math.random() * 0.01 },
        type: 'search',
      },
    ];
  };

  const handleLocationSelect = (suggestion: LocationSuggestion) => {
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

    console.log('✅ Calling onLocationSelect with valid coordinates');
    onLocationSelect(suggestion.description, suggestion.coordinates);
    setModalVisible(false);
    setSearchText('');
    setSuggestions([]);
  };

  const handleUseCurrentLocation = async () => {
    if (!currentLocation) {
      Alert.alert('Error', 'Current location not available');
      return;
    }

    try {
      setLoading(true);
      
      let currentAddress = 'Current Location';
      
      try {
        // Try to get a readable address
        const [address] = await Location.reverseGeocodeAsync({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        
        if (address) {
          const addressParts = [
            address.street,
            address.district,
            address.city,
            address.region
          ].filter(Boolean);
          currentAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Current Location';
        }
      } catch (geocodeError) {
        console.warn('⚠️ Geocoding failed, using coordinates:', geocodeError);
        currentAddress = `Current Location (${currentLocation.coords.latitude.toFixed(4)}, ${currentLocation.coords.longitude.toFixed(4)})`;
      }

      console.log('📍 Using current location:', {
        address: currentAddress,
        coordinates: {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        }
      });

      onLocationSelect(currentAddress, {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      setModalVisible(false);
    } catch (error) {
      console.error('❌ Error using current location:', error);
      console.error('Error: Unable to use current location');
    } finally {
      setLoading(false);
    }
  };

  const getLocationIcon = (type: string) => {
    switch (type) {
      case 'current':
        return <MapPin size={20} color="#2563EB" />;
      case 'recent':
        return <Clock size={20} color="#6B7280" />;
      default:
        return <Search size={20} color="#6B7280" />;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.inputContainer}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text style={[styles.input, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
        <MapPin size={20} color="#9CA3AF" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setModalVisible(false)}
            >
              <X size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select {label}</Text>
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
            {currentLocation && label.toLowerCase().includes('pickup') && (
              <TouchableOpacity
                style={styles.currentLocationButton}
                onPress={handleUseCurrentLocation}
                disabled={loading}
              >
                <View style={styles.locationItemLeft}>
                  <View style={styles.currentLocationIcon}>
                    <MapPin size={20} color="#2563EB" />
                  </View>
                  <View style={styles.locationTextContainer}>
                    <Text style={styles.currentLocationText}>Use Current Location</Text>
                    <Text style={styles.currentLocationSubtext}>GPS location</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            <FlatList
              data={searchText.length >= 2 ? suggestions : recentLocations}
              keyExtractor={(item) => item.place_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => {
                    console.log('🎯 Suggestion item pressed:', item);
                    handleLocationSelect(item);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.locationItemLeft}>
                    <View style={styles.suggestionIcon}>
                      {getLocationIcon(item.type)}
                    </View>
                    <View style={styles.locationTextContainer}>
                      <Text style={styles.suggestionText} numberOfLines={2}>
                        {item.description}
                      </Text>
                      {item.type === 'recent' && (
                        <Text style={styles.suggestionSubtext}>Popular destination</Text>
                      )}
                      {item.type === 'search' && (
                        <Text style={styles.suggestionSubtext}>
                          Lat: {item.coordinates.latitude.toFixed(4)}, Lng: {item.coordinates.longitude.toFixed(4)}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              ListHeaderComponent={
                searchText.length >= 2 && suggestions.length > 0 ? (
                  <Text style={styles.sectionHeader}>Search Results</Text>
                ) : null
              }
              ListEmptyComponent={
                searchText.length >= 2 && !loading ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No locations found</Text>
                    <Text style={styles.emptySubtext}>Try a different search term</Text>
                    <TouchableOpacity
                      style={styles.fallbackButton}
                      onPress={() => {
                        const fallbackLocation = {
                          place_id: `manual_${searchText}`,
                          description: `${searchText}, Tamil Nadu`,
                          coordinates: { latitude: 12.7402, longitude: 77.8240 },
                          type: 'search' as const,
                        };
                        handleLocationSelect(fallbackLocation);
                      }}
                    >
                      <Text style={styles.fallbackButtonText}>Use "{searchText}" anyway</Text>
                    </TouchableOpacity>
                  </View>
                ) : null
              }
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  iconContainer: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  placeholder: {
    color: '#9CA3AF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalCloseButton: {
    padding: 4,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
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
  },
});