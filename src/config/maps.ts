// Primary API key from environment variables
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Validate API key is available
if (!GOOGLE_MAPS_API_KEY) {
  console.warn('⚠️ Google Maps API key not found in environment variables. Please check your .env file.');
}

// Default region for fallback only
export const DEFAULT_REGION = {
  latitude: 12.7402, // Correct Hosur coordinates
  longitude: 77.8240,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export const HOSUR_COORDINATES = {
  latitude: 12.7402,
  longitude: 77.8240,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export const HOSUR_LANDMARKS = [
  {
    name: 'Hosur Bus Stand',
    coordinates: { latitude: 12.7402, longitude: 77.8240 },
  },
  {
    name: 'Chandira Choodeswarar Temple',
    coordinates: { latitude: 12.7350, longitude: 77.8200 },
  },
  {
    name: 'Hosur Railway Station',
    coordinates: { latitude: 12.7450, longitude: 77.8300 },
  },
  {
    name: 'Kelavarapalli Dam',
    coordinates: { latitude: 12.7500, longitude: 77.8100 },
  },
  {
    name: 'Hosur Clock Tower',
    coordinates: { latitude: 12.7400, longitude: 77.8250 },
  },
];