import { locationService } from './locationService';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

class ETAService {
  // Calculate ETA between two points
  calculateETA(
    fromLocation: LocationCoords,
    toLocation: LocationCoords,
    averageSpeed: number = 30 // km/h
  ): number {
    const distance = locationService.calculateDistance(
      fromLocation.latitude,
      fromLocation.longitude,
      toLocation.latitude,
      toLocation.longitude
    );
    
    // Calculate ETA in minutes
    const etaMinutes = (distance / averageSpeed) * 60;
    return Math.round(Math.max(etaMinutes, 1)); // Minimum 1 minute
  }

  // Calculate ETA for driver to reach pickup
  calculateDriverToPickupETA(
    driverLocation: LocationCoords,
    pickupLocation: LocationCoords
  ): number {
    return this.calculateETA(driverLocation, pickupLocation, 25); // Slower speed in city
  }

  // Calculate ETA for trip completion
  calculateTripETA(
    currentLocation: LocationCoords,
    destinationLocation: LocationCoords
  ): number {
    return this.calculateETA(currentLocation, destinationLocation, 30); // Normal driving speed
  }

  // Get traffic-adjusted ETA (simplified version)
  getTrafficAdjustedETA(baseETA: number): number {
    const currentHour = new Date().getHours();
    
    // Apply traffic multipliers based on time of day
    if (currentHour >= 8 && currentHour <= 10) {
      return Math.round(baseETA * 1.3); // Morning rush hour
    } else if (currentHour >= 17 && currentHour <= 20) {
      return Math.round(baseETA * 1.4); // Evening rush hour
    } else if (currentHour >= 22 || currentHour <= 6) {
      return Math.round(baseETA * 0.8); // Night time - faster
    }
    
    return baseETA; // Normal hours
  }

  // Format ETA for display
  formatETA(minutes: number): string {
    if (minutes < 1) {
      return 'Arriving now';
    } else if (minutes === 1) {
      return '1 min';
    } else if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours}h`;
      }
      return `${hours}h ${remainingMinutes}m`;
    }
  }
}

export const etaService = new ETAService();