import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { GOOGLE_MAPS_API_KEY, HOSUR_COORDINATES } from '../config/maps';
import { googleMapsService } from '../services/googleMapsService';
import { enhancedLocationService } from '../services/enhancedLocationService';
import { AvailableDriver } from '../services/driverLocationService';

interface EnhancedGoogleMapViewProps {
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  pickupCoords?: { latitude: number; longitude: number };
  destinationCoords?: { latitude: number; longitude: number };
  driverLocation?: { latitude: number; longitude: number; heading?: number; speed?: number };
  availableDrivers?: AvailableDriver[];
  showRoute?: boolean;
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
  onRouteReady?: (result: { distance: number; duration: number }) => void;
  style?: any;
  showUserLocation?: boolean;
  followUserLocation?: boolean;
}

export interface MapRef {
  fitToCoordinates: (coordinates: any[], options?: any) => void;
  animateToRegion: (region: any, duration?: number) => void;
  getMapBoundaries: () => Promise<any>;
}

const EnhancedGoogleMapView = forwardRef<MapRef, EnhancedGoogleMapViewProps>(({
  initialRegion,
  pickupCoords,
  destinationCoords,
  driverLocation,
  availableDrivers = [],
  showRoute = false,
  onMapPress,
  onRouteReady,
  style,
  showUserLocation = true,
  followUserLocation = false,
}, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const directionsRenderer = useRef<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const previousDriverLocationRef = useRef<{ latitude: number; longitude: number; heading?: number } | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

  useImperativeHandle(ref, () => ({
    fitToCoordinates: (coordinates: any[], options?: any) => {
      if (googleMapRef.current && coordinates.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        coordinates.forEach(coord => {
          bounds.extend(new google.maps.LatLng(coord.latitude, coord.longitude));
        });
        googleMapRef.current.fitBounds(bounds);
      }
    },
    animateToRegion: (region: any, duration: number = 1000) => {
      if (googleMapRef.current) {
        googleMapRef.current.panTo({
          lat: region.latitude,
          lng: region.longitude
        });
        googleMapRef.current.setZoom(15);
      }
    },
    getMapBoundaries: async () => {
      if (googleMapRef.current) {
        const bounds = googleMapRef.current.getBounds();
        return bounds;
      }
      return null;
    },
  }));

  useEffect(() => {
    loadGoogleMapsScript();
  }, []);

  useEffect(() => {
    if (isGoogleMapsLoaded) {
      initializeMap();
    }
  }, [isGoogleMapsLoaded]);

  useEffect(() => {
    if (showUserLocation) {
      getCurrentUserLocation();
    }
  }, [showUserLocation]);

  useEffect(() => {
    if (isMapReady) {
      updateMarkers();
    }
  }, [isMapReady, pickupCoords, destinationCoords, userLocation, availableDrivers]);

  useEffect(() => {
    if (isMapReady && googleMapRef.current && driverLocation) {
      const hasChanged = !previousDriverLocationRef.current ||
        previousDriverLocationRef.current.latitude !== driverLocation.latitude ||
        previousDriverLocationRef.current.longitude !== driverLocation.longitude ||
        previousDriverLocationRef.current.heading !== driverLocation.heading;

      if (hasChanged) {
        console.log('🗺️ Map: Driver location changed!', {
          old: previousDriverLocationRef.current,
          new: driverLocation,
        });
        updateDriverMarker(driverLocation);
        previousDriverLocationRef.current = { ...driverLocation };
      } else {
        console.log('⚠️ Map: driverLocation prop updated but values unchanged');
      }
    }
  }, [isMapReady, driverLocation]);

  useEffect(() => {
    if (isMapReady && showRoute && pickupCoords && destinationCoords) {
      calculateAndDisplayRoute();
    }
  }, [isMapReady, showRoute, pickupCoords, destinationCoords]);

  const loadGoogleMapsScript = () => {
    if (window.google && window.google.maps) {
      setIsGoogleMapsLoaded(true);
      return;
    }

    // Check if Google Maps script is already being loaded or exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      console.log('🗺️ Google Maps script already exists, waiting for load...');
      
      // If script exists but Google Maps isn't loaded yet, wait for it
      const checkGoogleMaps = () => {
        if (window.google && window.google.maps) {
          setIsGoogleMapsLoaded(true);
        } else {
          setTimeout(checkGoogleMaps, 100);
        }
      };
      checkGoogleMaps();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('✅ Google Maps script loaded successfully');
      setIsGoogleMapsLoaded(true);
    };
    script.onerror = (error) => {
      console.error('❌ Error loading Google Maps script:', error);
      setIsGoogleMapsLoaded(false);
    };
    
    document.head.appendChild(script);
  };

  const initializeMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps || !window.google.maps.Map) {
      console.error('Cannot initialize map: missing dependencies');
      return;
    }

    const region = initialRegion || HOSUR_COORDINATES;
    
    try {
      const map = new google.maps.Map(mapRef.current, {
        center: {
          lat: region.latitude,
          lng: region.longitude,
        },
        zoom: 13,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
      });

      googleMapRef.current = map;
      directionsRenderer.current = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#2563EB',
          strokeWeight: 4,
        },
      });
      directionsRenderer.current.setMap(map);

      map.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (onMapPress && event.latLng) {
          onMapPress({
            latitude: event.latLng.lat(),
            longitude: event.latLng.lng(),
          });
        }
      });

      setIsMapReady(true);
      console.log('🗺️ Web map initialized successfully');
    } catch (error) {
      console.error('Error initializing Google Map:', error);
    }
  };

  const getCurrentUserLocation = async () => {
    try {
      const location = await enhancedLocationService.getCurrentLocation();
      if (location) {
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (!pickupCoords && !destinationCoords && googleMapRef.current) {
          googleMapRef.current.panTo({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
          googleMapRef.current.setZoom(15);
        }
      }
    } catch (error) {
      console.error('Error getting user location:', error);
    }
  };

  const createCarIcon = (heading: number = 0) => {
    const rotation = heading;
    const svg = `
      <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(${rotation} 30 30)">
          <!-- Shadow -->
          <ellipse cx="30" cy="52" rx="20" ry="5" fill="rgba(0,0,0,0.3)"/>

          <!-- Yellow Taxi Car Body -->
          <g transform="translate(12, 8)">
            <!-- Main body - Orange/Yellow -->
            <rect x="6" y="12" width="24" height="32" rx="2" fill="#FFA500"/>
            <rect x="7" y="13" width="22" height="30" rx="1.5" fill="#FFB833"/>

            <!-- Roof - Darker Orange -->
            <rect x="8" y="12" width="20" height="10" rx="2" fill="#FF8C00"/>

            <!-- Windshield - Dark Gray -->
            <rect x="10" y="14" width="16" height="6" rx="1" fill="#3D3D3D"/>

            <!-- Rear Window - Dark Gray -->
            <rect x="10" y="36" width="16" height="5" rx="1" fill="#3D3D3D"/>

            <!-- Side Windows - Dark Gray -->
            <rect x="8" y="24" width="3" height="8" rx="0.5" fill="#3D3D3D"/>
            <rect x="25" y="24" width="3" height="8" rx="0.5" fill="#3D3D3D"/>

            <!-- Wheels - Black with Gray Rim -->
            <g>
              <circle cx="10" cy="16" r="3.5" fill="#000000"/>
              <circle cx="10" cy="16" r="1.8" fill="#4B5563"/>

              <circle cx="26" cy="16" r="3.5" fill="#000000"/>
              <circle cx="26" cy="16" r="1.8" fill="#4B5563"/>

              <circle cx="10" cy="40" r="3.5" fill="#000000"/>
              <circle cx="10" cy="40" r="1.8" fill="#4B5563"/>

              <circle cx="26" cy="40" r="3.5" fill="#000000"/>
              <circle cx="26" cy="40" r="1.8" fill="#4B5563"/>
            </g>

            <!-- Headlights - Yellow -->
            <circle cx="14" cy="10" r="1.5" fill="#FFEB3B"/>
            <circle cx="22" cy="10" r="1.5" fill="#FFEB3B"/>

            <!-- Taillights - Red -->
            <rect x="12" y="43" width="3" height="1.5" rx="0.5" fill="#FF4444"/>
            <rect x="21" y="43" width="3" height="1.5" rx="0.5" fill="#FF4444"/>

            <!-- Door Lines -->
            <line x1="18" y1="24" x2="18" y2="36" stroke="#FF8C00" stroke-width="1"/>

            <!-- Black Outline for contrast -->
            <rect x="6" y="12" width="24" height="32" rx="2" fill="none" stroke="#000000" stroke-width="1.5" opacity="0.3"/>
          </g>
        </g>
      </svg>
    `;

    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(60, 60),
      anchor: new google.maps.Point(30, 30),
    };
  };

  const updateDriverMarker = (location: { latitude: number; longitude: number; heading?: number }) => {
    if (!googleMapRef.current || !window.google) return;

    const position = new google.maps.LatLng(location.latitude, location.longitude);
    const heading = location.heading || 0;

    if (driverMarkerRef.current) {
      console.log('🚗 Updating driver marker position:', location);
      driverMarkerRef.current.setPosition(position);
      driverMarkerRef.current.setIcon(createCarIcon(heading));
    } else {
      console.log('🚗 Creating driver marker at:', location);
      const driverMarker = new google.maps.Marker({
        position,
        map: googleMapRef.current,
        title: 'Driver Location',
        icon: createCarIcon(heading),
        optimized: false,
        zIndex: 1000,
      });
      driverMarkerRef.current = driverMarker;
    }
  };

  const updateMarkers = () => {
    if (!googleMapRef.current || !window.google) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add user location marker
    if (userLocation && showUserLocation) {
      const userMarker = new google.maps.Marker({
        position: { lat: userLocation.latitude, lng: userLocation.longitude },
        map: googleMapRef.current,
        title: 'Your Location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#2563EB',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });
      markersRef.current.push(userMarker);
    }

    // Add pickup marker
    if (pickupCoords) {
      const pickupMarker = new google.maps.Marker({
        position: { lat: pickupCoords.latitude, lng: pickupCoords.longitude },
        map: googleMapRef.current,
        title: 'Pickup Location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#059669',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
        },
      });
      markersRef.current.push(pickupMarker);
    }

    // Add destination marker
    if (destinationCoords) {
      const destinationMarker = new google.maps.Marker({
        position: { lat: destinationCoords.latitude, lng: destinationCoords.longitude },
        map: googleMapRef.current,
        title: 'Destination',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#DC2626',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
        },
      });
      markersRef.current.push(destinationMarker);
    }

    // Driver marker is handled separately in updateDriverMarker to enable smooth animation

    // Add available drivers markers
    if (availableDrivers && availableDrivers.length > 0) {
      availableDrivers.forEach((driver, index) => {
        const availableDriverMarker = new google.maps.Marker({
          position: { lat: driver.latitude, lng: driver.longitude },
          map: googleMapRef.current,
          title: `${driver.vehicle_type.charAt(0).toUpperCase() + driver.vehicle_type.slice(1)} Driver`,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="15" fill="white" stroke="#E5E7EB" stroke-width="2"/>
                <text x="16" y="22" text-anchor="middle" font-size="16" fill="${getVehicleColor(driver.vehicle_type)}">🚗</text>
              </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16),
          },
        });
        markersRef.current.push(availableDriverMarker);
      });
    }
  };

  const calculateAndDisplayRoute = async () => {
    if (!pickupCoords || !destinationCoords || !directionsRenderer.current) return;

    try {
      console.log('🗺️ Drawing route on web map between:', pickupCoords, 'and', destinationCoords);
      
      // Skip route calculation if no valid API key
      if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY.includes('placeholder')) {
        console.warn('⚠️ No valid Google Maps API key, using fallback route');
        drawFallbackRoute();
        return;
      }

      // Use direct Google Directions Service with error handling
      const directionsService = new google.maps.DirectionsService();
      
      const request = {
        origin: { lat: pickupCoords.latitude, lng: pickupCoords.longitude },
        destination: { lat: destinationCoords.latitude, lng: destinationCoords.longitude },
        travelMode: google.maps.TravelMode.DRIVING,
      };
      
      directionsService.route(request, (result, status) => {
        try {
          if (status === google.maps.DirectionsStatus.OK && result && directionsRenderer.current) {
            directionsRenderer.current.setDirections(result);
            
            // Extract route info from result
            const route = result.routes[0];
            const leg = route.legs[0];
            
            onRouteReady?.({
              distance: leg.distance?.value ? leg.distance.value / 1000 : 0,
              duration: leg.duration?.value ? leg.duration.value / 60 : 0,
            });
            
            console.log('✅ Route drawn successfully on web map');
          } else {
            console.warn('⚠️ Directions service failed with status:', status, '- using fallback route');
            drawFallbackRoute();
          }
        } catch (directionsError) {
          console.error('❌ Error processing directions result:', directionsError);
          drawFallbackRoute();
        }
      });
    } catch (error) {
      console.error('Error calculating route for web:', error);
      drawFallbackRoute();
    }
  };

  const drawFallbackRoute = () => {
    if (!googleMapRef.current || !pickupCoords || !destinationCoords) return;
    
    console.log('🗺️ Drawing fallback straight line route');
    
    // Draw a simple polyline as fallback
    const routePath = new google.maps.Polyline({
      path: [
        { lat: pickupCoords.latitude, lng: pickupCoords.longitude },
        { lat: destinationCoords.latitude, lng: destinationCoords.longitude },
      ],
      geodesic: true,
      strokeColor: '#2563EB',
      strokeOpacity: 0.8,
      strokeWeight: 4,
    });
    
    routePath.setMap(googleMapRef.current);
    
    // Calculate simple distance
    const distance = enhancedLocationService.calculateHaversineDistance(
      pickupCoords.latitude,
      pickupCoords.longitude,
      destinationCoords.latitude,
      destinationCoords.longitude
    );
    
    onRouteReady?.({
      distance,
      duration: (distance / 30) * 60,
    });
  };

  return (
    <View style={[styles.container, style]}>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </View>
  );
});

// Get color for different vehicle types
const getVehicleColor = (vehicleType: string): string => {
  const colorMap: { [key: string]: string } = {
    'hatchback': '#059669',
    'hatchback_ac': '#0891B2',
    'sedan': '#2563EB',
    'sedan_ac': '#7C3AED',
    'suv': '#DC2626',
    'suv_ac': '#EA580C',
  };
  return colorMap[vehicleType] || '#6B7280';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default EnhancedGoogleMapView;