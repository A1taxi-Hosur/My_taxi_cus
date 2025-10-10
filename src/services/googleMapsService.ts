import { GOOGLE_MAPS_API_KEY } from '../config/maps';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../utils/supabase';

interface PlaceDetails {
  place_id: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  name: string;
  types: string[];
}

interface DirectionsResult {
  distance: {
    text: string;
    value: number; // in meters
  };
  duration: {
    text: string;
    value: number; // in seconds
  };
  polyline: {
    points: string;
  };
}

class GoogleMapsService {
  private readonly proxyBaseUrl = `${SUPABASE_URL}/functions/v1/places-proxy`;

  // Test API connectivity through proxy
  async testApiConnectivity(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🧪 Testing Google Maps API connectivity through proxy...');
      
      // Test with a simple geocoding request
      const params = new URLSearchParams({
        address: 'Hosur, Tamil Nadu, India',
      });

      const data = await this.makeProxyRequest('/geocode', params);
      
      if (data.status === 'OK') {
        console.log('✅ API connectivity test successful');
        return { success: true };
      } else {
        console.error('❌ API connectivity test failed:', data.status, data.error_message);
        return { success: false, error: `${data.status}: ${data.error_message}` };
      }
    } catch (error) {
      console.error('❌ API connectivity test error:', error);
      return { success: false, error: error.message };
    }
  }

  private async makeProxyRequest(endpoint: string, params: URLSearchParams): Promise<any> {
    try {
      const url = `${this.proxyBaseUrl}${endpoint}?${params.toString()}`;
      console.log('🌐 Making proxy request to:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Proxy request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Proxy response received:', data.status || 'success');
      return data;
    } catch (error) {
      console.error('❌ Proxy request error:', error);
      throw error;
    }
  }

  // Get place details from place_id
  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    try {
      console.log('🔍 Getting place details for:', placeId);
      
      const params = new URLSearchParams({
        place_id: placeId,
        fields: 'geometry,formatted_address,name',
      });

      const data = await this.makeProxyRequest('/details', params);
      
      if (data.status === 'OK' && data.result) {
        console.log('✅ Place details retrieved:', data.result.formatted_address);
        return data.result;
      }
      
      console.error('❌ Place details error:', data.status, data.error_message);
      return null;
    } catch (error) {
      console.error('❌ Error fetching place details:', error);
      return null;
    }
  }

  // Search places with autocomplete
  async searchPlaces(input: string, location?: { lat: number; lng: number }, radius: number = 50000): Promise<any[]> {
    try {
      console.log('🔍 Searching places for:', input);
      
      const params = new URLSearchParams({
        input: input,
        components: 'country:in',
      });

      if (location) {
        params.append('location', `${location.lat},${location.lng}`);
        params.append('radius', radius.toString());
      }

      const data = await this.makeProxyRequest('/autocomplete', params);
      
      if (data.status === 'OK' && data.predictions) {
        console.log('✅ Found', data.predictions.length, 'place suggestions');
        return data.predictions;
      }
      
      console.error('❌ Places search error:', data.status, data.error_message);
      return [];
    } catch (error) {
      console.error('❌ Error searching places:', error);
      return [];
    }
  }

  // Get directions between two points
  async getDirections(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    mode: 'driving' | 'walking' | 'transit' = 'driving'
  ): Promise<DirectionsResult | null> {
    try {
      console.log('🗺️ [GOOGLE-MAPS] Getting directions from', origin, 'to', destination);
      
      const params = new URLSearchParams({
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: mode,
      });

      const data = await this.makeProxyRequest('/directions', params);
      
      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        console.log('✅ [GOOGLE-MAPS] Directions retrieved:', {
          distance: leg.distance.text,
          duration: leg.duration.text,
          distance_km: (leg.distance.value / 1000).toFixed(2),
          duration_min: (leg.duration.value / 60).toFixed(1),
          source: 'Google Directions API'
        });
        
        return {
          distance: leg.distance,
          duration: leg.duration,
          polyline: route.overview_polyline,
        };
      }
      
      console.error('❌ [GOOGLE-MAPS] Directions error:', data.status, data.error_message);
      return null;
    } catch (error) {
      console.error('❌ [GOOGLE-MAPS] Error getting directions:', error);
      return null;
    }
  }

  // Reverse geocode coordinates to address
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      console.log('🏠 Reverse geocoding:', { lat, lng });
      
      const params = new URLSearchParams({
        latlng: `${lat},${lng}`,
      });

      const data = await this.makeProxyRequest('/geocode', params);
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const address = data.results[0].formatted_address;
        console.log('✅ Geocoded address:', address);
        return address;
      }
      
      console.error('❌ Reverse geocoding error:', data.status, data.error_message);
      return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    } catch (error) {
      console.error('❌ Error reverse geocoding:', error);
      return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  }

  // Calculate distance between two points using Google Distance Matrix
  async calculateDistance(
    origins: { lat: number; lng: number }[],
    destinations: { lat: number; lng: number }[]
  ): Promise<{ distance: number; duration: number } | null> {
    try {
      console.log('📏 Calculating distance matrix');
      
      const originsStr = origins.map(o => `${o.lat},${o.lng}`).join('|');
      const destinationsStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');
      
      const params = new URLSearchParams({
        origins: originsStr,
        destinations: destinationsStr,
        units: 'metric',
        mode: 'driving',
      });

      const data = await this.makeProxyRequest('/distancematrix', params);
      
      if (data.status === 'OK' && data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
        const element = data.rows[0].elements[0];
        
        if (element.status === 'OK') {
          console.log('✅ Distance calculated:', {
            distance: element.distance.text,
            duration: element.duration.text,
          });
          
          return {
            distance: element.distance.value / 1000, // Convert to km
            duration: element.duration.value / 60, // Convert to minutes
          };
        }
      }
      
      console.error('❌ Distance matrix error:', data.status, data.error_message);
      return null;
    } catch (error) {
      console.error('❌ Error calculating distance:', error);
      return null;
    }
  }

  // Decode polyline for route display
  decodePolyline(encoded: string) {
    const poly = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      poly.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }
    return poly;
  }

}

export const googleMapsService = new GoogleMapsService();