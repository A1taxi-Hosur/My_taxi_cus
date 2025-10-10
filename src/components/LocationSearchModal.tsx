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
import { Search, MapPin, Clock, Star, X } from 'lucide-react-native';
import * as Location from 'expo-location';
import { GOOGLE_MAPS_API_KEY, HOSUR_LANDMARKS } from '../config/maps';

interface LocationSuggestion {
  place_id: string;
  description: string;
  coordinates: { latitude: number; longitude: number };
  type: 'current' | 'recent' | 'search';
}

interface LocationSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: string, coords: { latitude: number; longitude: number }) => void;
  placeholder?: string;
  currentLocation?: Location.LocationObject | null;
}

export default function LocationSearchModal({
  visible,
  onClose,
  onLocationSelect,
  placeholder = "Search for a location",
  currentLocation,
}: LocationSearchModalProps) {
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [recentLocations, setRecentLocations] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadRecentLocations();
    }
  }, [visible]);

  const loadRecentLocations = () => {
    const mockRecent: LocationSuggestion[] = HOSUR_LANDMARKS.map((landmark, index) => ({
      place_id: `recent${index + 1}`,
      description: `${landmark.name}, Hosur`,
      coordinates: landmark.coordinates,
      type: 'recent',
    }));
    setRecentLocations(mockRecent);
  };

  const searchLocations = async (text: string) => {
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&location=12.1372,77.8253&radius=50000&key=${GOOGLE_MAPS_API_KEY}`
      );
      
      const data = await response.json();
      
      if (data.predictions) {
        const suggestions: LocationSuggestion[] = await Promise.all(
          data.predictions.slice(0, 5).map(async (prediction: any) => {
            // Get place details for coordinates
            const detailsResponse = await fetch(
              `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`
            );
            const detailsData = await detailsResponse.json();
            
            return {
              place_id: prediction.place_id,
              description: prediction.description,
              coordinates: {
                latitude: detailsData.result?.geometry?.location?.lat || 12.1372,
                longitude: detailsData.result?.geometry?.location?.lng || 77.8253,
              },
              type: 'search' as const,
            };
          })
        );
        setSuggestions(suggestions);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error searching locations:', error);
      // Fallback to local suggestions
      const fallbackSuggestions: LocationSuggestion[] = [
        {
          place_id: `fallback1_${text}`,
          description: `${text} - Hosur, Tamil Nadu`,
          coordinates: { latitude: 12.1372, longitude: 77.8253 },
          type: 'search',
        },
        {
          place_id: `fallback2_${text}`,
          description: `${text} - Krishnagiri District, Tamil Nadu`,
          coordinates: { latitude: 12.1372 + Math.random() * 0.01, longitude: 77.8253 + Math.random() * 0.01 },
          type: 'search',
        },
      ];
      setSuggestions(fallbackSuggestions);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (suggestion: LocationSuggestion) => {
    onLocationSelect(suggestion.description, suggestion.coordinates);
    setSearchText('');
    setSuggestions([]);
    onClose();
  };

  const handleUseCurrentLocation = async () => {
    if (!currentLocation) return;

    try {

      let currentAddress = 'Current Location';
      
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        
        if (address) {
          currentAddress = `${address.street || ''} ${address.city || address.region || ''}`.trim() || 'Current Location';
        }
      } catch (geocodeError) {
        console.warn('Geocoding failed, using coordinates:', geocodeError);
        currentAddress = `Current Location (${currentLocation.coords.latitude.toFixed(4)}, ${currentLocation.coords.longitude.toFixed(4)})`;
      }

      onLocationSelect(currentAddress, {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      onClose();
    } catch (error) {
      console.error('Error getting current location address:', error);
      // Still provide the location even if geocoding fails
      onLocationSelect('Current Location', {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      onClose();
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
          <Text style={styles.headerTitle}>Select Location</Text>
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
            />
          </View>
        </View>

        <View style={styles.content}>
          {currentLocation && (
            <TouchableOpacity
              style={styles.currentLocationButton}
              onPress={handleUseCurrentLocation}
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

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : (
            <FlatList
              data={searchText.length >= 3 ? suggestions : recentLocations}
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
                      <Text style={styles.suggestionText}>{item.description}</Text>
                      {item.type === 'recent' && (
                        <Text style={styles.suggestionSubtext}>Recent</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              ListHeaderComponent={
                searchText.length < 3 && recentLocations.length > 0 ? (
                  <Text style={styles.sectionHeader}>Recent Locations</Text>
                ) : null
              }
              showsVerticalScrollIndicator={false}
            />
          )}
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#6B7280',
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
  },
  suggestionSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
});