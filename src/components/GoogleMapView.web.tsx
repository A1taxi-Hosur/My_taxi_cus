import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { GOOGLE_MAPS_API_KEY, HOSUR_COORDINATES } from '../config/maps';

interface GoogleMapViewProps {
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  pickupCoords?: { latitude: number; longitude: number };
  destinationCoords?: { latitude: number; longitude: number };
  driverLocation?: { latitude: number; longitude: number };
  showRoute?: boolean;
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
  style?: any;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

export default function GoogleMapView({
  initialRegion,
  pickupCoords,
  destinationCoords,
  driverLocation,
  showRoute = false,
  onMapPress,
  style,
}: GoogleMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeRef = useRef<any>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

  const region = initialRegion || HOSUR_COORDINATES;

  useEffect(() => {
    loadGoogleMapsScript();
  }, []);

  useEffect(() => {
    if (isGoogleMapsLoaded && !mapInstanceRef.current) {
      initializeMap();
    }
  }, [isGoogleMapsLoaded]);

  useEffect(() => {
    if (mapInstanceRef.current) {
      updateMarkers();
    }
  }, [pickupCoords, destinationCoords, driverLocation]);

  useEffect(() => {
    if (mapInstanceRef.current && showRoute && pickupCoords && destinationCoords) {
      drawRoute();
    }
  }, [showRoute, pickupCoords, destinationCoords]);

  const loadGoogleMapsScript = () => {
    if (window.google && window.google.maps) {
      setIsGoogleMapsLoaded(true);
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
      console.error('❌ Error loading Google Maps script. Please check your API key and network connection.');
      setIsGoogleMapsLoaded(false);
    };
    
    document.head.appendChild(script);
  };

  const initializeMap = () => {
    if (!mapRef.current || !window.google) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: region.latitude, lng: region.longitude },
      zoom: 15,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    mapInstanceRef.current = map;

    // Add click listener
    if (onMapPress) {
      map.addListener('click', (event: any) => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        onMapPress({ latitude: lat, longitude: lng });
      });
    }

    updateMarkers();
  };

  const updateMarkers = () => {
    if (!mapInstanceRef.current || !window.google) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add pickup marker
    if (pickupCoords) {
      const pickupMarker = new window.google.maps.Marker({
        position: { lat: pickupCoords.latitude, lng: pickupCoords.longitude },
        map: mapInstanceRef.current,
        title: 'Pickup Location',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#059669',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });
      markersRef.current.push(pickupMarker);
    }

    // Add destination marker
    if (destinationCoords) {
      const destinationMarker = new window.google.maps.Marker({
        position: { lat: destinationCoords.latitude, lng: destinationCoords.longitude },
        map: mapInstanceRef.current,
        title: 'Destination',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#DC2626',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });
      markersRef.current.push(destinationMarker);
    }

    // Add driver marker
    if (driverLocation) {
      const driverMarker = new window.google.maps.Marker({
        position: { lat: driverLocation.latitude, lng: driverLocation.longitude },
        map: mapInstanceRef.current,
        title: 'Driver Location',
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#2563EB',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });
      markersRef.current.push(driverMarker);
    }

    // Fit map to show all markers
    if (markersRef.current.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();
      markersRef.current.forEach(marker => {
        bounds.extend(marker.getPosition());
      });
      mapInstanceRef.current.fitBounds(bounds, { padding: 50 });
    }
  };

  const drawRoute = async () => {
    if (!mapInstanceRef.current || !window.google || !pickupCoords || !destinationCoords) return;

    // Clear existing route
    if (routeRef.current) {
      routeRef.current.setMap(null);
    }

    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#2563EB',
        strokeWeight: 4,
        strokeOpacity: 0.8,
      },
    });

    try {
      const result = await directionsService.route({
        origin: { lat: pickupCoords.latitude, lng: pickupCoords.longitude },
        destination: { lat: destinationCoords.latitude, lng: destinationCoords.longitude },
        travelMode: window.google.maps.TravelMode.DRIVING,
      });

      directionsRenderer.setDirections(result);
      directionsRenderer.setMap(mapInstanceRef.current);
      routeRef.current = directionsRenderer;
    } catch (error) {
      console.error('Error drawing route:', error);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 12,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
});