import { supabase } from '../utils/supabase';
import { googleMapsService } from './googleMapsService';
import { enhancedLocationService } from './enhancedLocationService';

export interface FareBreakdown {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeFare: number;
  platformFee: number;
  deadheadCharge: number;
  totalFare: number;
  distance: number;
  duration: number;
  deadheadDistance: number;
  calculationMethod?: 'slab' | 'per_km';
}

export interface FareConfig {
  vehicle_type: string;
  base_fare: number;
  per_km_rate: number;
  per_minute_rate: number;
  minimum_fare: number;
  surge_multiplier: number;
  platform_fee_percent: number;
}

class FareCalculator {
  private fareConfigCache = new Map<string, { config: FareConfig; timestamp: number }>();
  private routeCache = new Map<string, { route: any; timestamp: number }>();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  async getFareConfig(vehicleType: string): Promise<FareConfig | null> {
    try {
      // Always fetch fresh data from database to ensure accuracy
      console.log('🔄 Fetching FRESH fare config from database for vehicle_type:', vehicleType);
      console.log('🔍 Query parameters:', {
        vehicle_type: vehicleType,
        booking_type: 'regular',
        is_active: true
      });

      // Fetch from database
      const { data, error } = await supabase
        .from('fare_matrix')
        .select('vehicle_type, base_fare, per_km_rate, minimum_fare, surge_multiplier')
        .eq('vehicle_type', vehicleType)
        .eq('booking_type', 'regular')
        .eq('is_active', true)
        .single();

      console.log('📊 Database query result:', {
        hasData: !!data,
        error: error?.message,
        rawData: data
      });

      if (error || !data) {
        console.error(`❌ Database error or no data for ${vehicleType}:`, {
          error: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          data: data
        });
        console.log('🔄 Using fallback configuration');
        return this.getFallbackConfig(vehicleType);
      }

      console.log('✅ ACTUAL DATABASE VALUES for', vehicleType, ':', {
        vehicle_type: data.vehicle_type,
        base_fare: data.base_fare,
        per_km_rate: data.per_km_rate,
        minimum_fare: data.minimum_fare,
        surge_multiplier: data.surge_multiplier
      });

      const config: FareConfig = {
        vehicle_type: data.vehicle_type,
        base_fare: Number(data.base_fare),
        per_km_rate: Number(data.per_km_rate),
        minimum_fare: Number(data.minimum_fare),
        surge_multiplier: Number(data.surge_multiplier),
      };

      console.log('🔢 Converted to numbers:', {
        base_fare: config.base_fare,
        per_km_rate: config.per_km_rate,
        minimum_fare: config.minimum_fare,
        surge_multiplier: config.surge_multiplier
      });

      return config;
    } catch (error) {
      console.error('Error fetching fare config:', error);
      return this.getFallbackConfig(vehicleType);
    }
  }

  // Get all vehicle types with their configs
  async getAllVehicleConfigs(): Promise<FareConfig[]> {
    try {
      console.log('📊 Loading all vehicle configs from fare_matrix table for booking_type=regular');
      
      const { data, error } = await supabase
        .from('fare_matrix')
        .select('vehicle_type, base_fare, per_km_rate, minimum_fare, surge_multiplier')
        .eq('booking_type', 'regular')
        .eq('is_active', true)
        .order('vehicle_type');

      if (error || !data || data.length === 0) {
        console.warn('❌ No fare configs found in fare_matrix table for booking_type=regular:', error);
        console.log('🔄 Using fallback configurations');
        return this.getAllFallbackConfigs();
      }

      console.log('✅ Loaded', data.length, 'fare configs from fare_matrix table:', 
        data.map(c => ({ vehicle_type: c.vehicle_type, base_fare: c.base_fare, per_km_rate: c.per_km_rate }))
      );

      // Cache all configs
      data.forEach(config => {
        this.fareConfigCache.set(config.vehicle_type, {
          config: {
            vehicle_type: config.vehicle_type,
            base_fare: config.base_fare,
            per_km_rate: config.per_km_rate,
            minimum_fare: config.minimum_fare,
            surge_multiplier: config.surge_multiplier,
          },
          timestamp: Date.now(),
        });
      });

      return data.map(config => ({
        vehicle_type: config.vehicle_type,
        base_fare: config.base_fare,
        per_km_rate: config.per_km_rate,
        minimum_fare: config.minimum_fare,
        surge_multiplier: config.surge_multiplier,
      }));
    } catch (error) {
      console.error('Error fetching all fare configs:', error);
      return this.getAllFallbackConfigs();
    }
  }

  // Calculate fare for a trip
  async calculateFare(
    pickupCoords: { latitude: number; longitude: number },
    destinationCoords: { latitude: number; longitude: number },
    vehicleType: string
  ): Promise<FareBreakdown | null> {
    try {
      console.log('💰 [FARE-CALC] Input parameters:', {
        vehicleType,
        pickup: pickupCoords,
        destination: destinationCoords,
        timestamp: new Date().toISOString(),
        supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
        supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING'
      });
      
      // ALWAYS use edge function for deadhead calculation with zone logic
      console.log('🎯 [FARE-CALC] Using edge function for deadhead calculation...');
      
      // Validate Supabase URL before making request
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      console.log('🔍 [FARE-CALC] Environment validation:', {
        supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
        supabaseKey: supabaseKey ? 'SET' : 'MISSING',
        urlValid: supabaseUrl && !supabaseUrl.includes('placeholder'),
        keyValid: supabaseKey && !supabaseKey.includes('placeholder')
      });
      
      if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
        console.error('❌ [FARE-CALC] Invalid or missing SUPABASE_URL, using fallback calculation');
        throw new Error('Supabase URL not configured');
      }
      
      if (!supabaseKey || supabaseKey.includes('placeholder')) {
        console.error('❌ [FARE-CALC] Invalid or missing SUPABASE_ANON_KEY, using fallback calculation');
        throw new Error('Supabase key not configured');
      }
      
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/fare-calculation`;
      console.log('🎯 [FARE-CALC] Edge function URL:', edgeFunctionUrl);
      
      try {
        console.log('📡 [FARE-CALC] Making request to edge function...');
        const requestBody = {
          pickup_latitude: pickupCoords.latitude,
          pickup_longitude: pickupCoords.longitude,
          destination_latitude: destinationCoords.latitude,
          destination_longitude: destinationCoords.longitude,
          vehicle_type: vehicleType,
          booking_type: 'regular',
        };
        
        console.log('📡 [FARE-CALC] Request body:', requestBody);
        
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        console.log('📡 [FARE-CALC] Edge function response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ [FARE-CALC] Edge function HTTP error:', response.status, response.statusText, errorText);
          throw new Error(`Edge function failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('📊 [FARE-CALC] Edge function raw result for Bagalur:', result);
        
        if (!result.success) {
          console.error('❌ [FARE-CALC] Edge function returned error:', result.error);
          throw new Error(`Edge function error: ${result.error}`);
        }

        // Validate that fareBreakdown exists and has required properties
        if (!result.fareBreakdown || typeof result.fareBreakdown !== 'object') {
          console.error('❌ [FARE-CALC] Edge function returned invalid fareBreakdown for', vehicleType, ':', result.fareBreakdown);
          throw new Error(`Edge function returned invalid fareBreakdown for ${vehicleType}`);
        }

        // Validate required fareBreakdown properties
        const requiredProps = ['baseFare', 'distanceFare', 'deadheadCharge', 'totalFare'];
        const missingProps = requiredProps.filter(prop => typeof result.fareBreakdown[prop] !== 'number');
        
        if (missingProps.length > 0) {
          console.error('❌ [FARE-CALC] Edge function fareBreakdown missing required properties for', vehicleType, ':', missingProps);
          throw new Error(`Edge function fareBreakdown missing properties for ${vehicleType}: ${missingProps.join(', ')}`);
        }
        console.log('✅ [FARE-CALC] ===== EDGE FUNCTION SUCCESS WITH DEADHEAD FOR BAGALUR =====');
        console.log('✅ [FARE-CALC] Complete fare breakdown:', {
          baseFare: `₹${result.fareBreakdown.baseFare}`,
          distanceFare: `₹${result.fareBreakdown.distanceFare}`,
          timeFare: `₹${result.fareBreakdown.timeFare}`,
          surgeFare: `₹${result.fareBreakdown.surgeFare}`,
          platformFee: `₹${result.fareBreakdown.platformFee}`,
          deadheadCharge: `₹${result.fareBreakdown.deadheadCharge}`,
          deadheadDistance: `${result.fareBreakdown.deadheadDistance}km`,
          totalFare: `₹${result.fareBreakdown.totalFare}`,
          deadheadInfo: result.deadheadInfo,
          formula: `₹${result.fareBreakdown.baseFare} + ₹${result.fareBreakdown.distanceFare} + ₹${result.fareBreakdown.timeFare} + ₹${result.fareBreakdown.surgeFare} + ₹${result.fareBreakdown.platformFee} + ₹${result.fareBreakdown.deadheadCharge} = ₹${result.fareBreakdown.totalFare}`,
          bagalurSpecific: 'This should show deadhead charges for Bagalur destination'
        });

        console.log('✅ [FARE-CALC] Deadhead analysis for Bagalur:', {
          destination: destinationCoords,
          deadheadApplied: result.fareBreakdown.deadheadCharge > 0,
          deadheadReason: result.deadheadInfo?.reason || 'Unknown',
          zoneStatus: result.deadheadInfo?.applied ? 'Between Inner and Outer Ring' : 'Within Inner Ring or Outside Service Area',
          expectedForBagalur: 'Should be between Inner and Outer Ring with deadhead charge'
        });
        
        return result.fareBreakdown;
      } catch (edgeError) {
        console.error('❌ [FARE-CALC] Edge function failed completely for', vehicleType, ':', edgeError.message);
        console.error('❌ [FARE-CALC] This means deadhead charges will NOT be applied');
        console.warn('⚠️ [FARE-CALC] Using fallback calculation without deadhead charges');
        return this.calculateFareFallback(pickupCoords, destinationCoords, vehicleType);
      }
    } catch (error) {
      console.error('❌ [FARE-CALC] Fatal error in calculateFare:', error);
      return null;
    }
  }

  // Fallback calculation without deadhead charges (if edge function fails)
  private async calculateFareFallback(
    pickupCoords: { latitude: number; longitude: number },
    destinationCoords: { latitude: number; longitude: number },
    vehicleType: string
  ): Promise<FareBreakdown | null> {
    try {
      console.log('🔄 Using fallback fare calculation with deadhead charges');
      
      // Get route information
      const routeInfo = await this.getRouteInfo(pickupCoords, destinationCoords);
      if (!routeInfo) {
        console.error('Failed to get route information');
        return null;
      }

      // Get fare configuration
      const fareConfig = await this.getFareConfig(vehicleType);
      if (!fareConfig) {
        console.error('Failed to get fare configuration');
        return null;
      }

      // Calculate deadhead charges for fallback
      const deadheadResult = await this.calculateDeadheadCharges(destinationCoords, fareConfig.per_km_rate);
      
      // Calculate fare components using 4km base logic
      const baseFare = Number(fareConfig.base_fare);
      
      let distanceFare = 0;
      const baseKmCovered = 4;
      
      if (routeInfo.distance > baseKmCovered) {
        const additionalDistance = routeInfo.distance - baseKmCovered;
        distanceFare = additionalDistance * Number(fareConfig.per_km_rate);
      }
      
      const surgeFare = (baseFare + distanceFare) * (Number(fareConfig.surge_multiplier) - 1);
      
      let subtotal = baseFare + distanceFare + surgeFare;
      subtotal = Math.max(subtotal, fareConfig.minimum_fare);
      
      const totalFare = subtotal + deadheadResult.charge;
      
      console.log('💰 [FARE-CALC] Fallback calculation with deadhead:', {
        baseFare,
        distanceFare,
        surgeFare,
        deadheadCharge: deadheadResult.charge,
        deadheadDistance: deadheadResult.distance,
        subtotal,
        totalFare,
        formula: `₹${baseFare} + ₹${distanceFare} + ₹${surgeFare} + ₹${deadheadResult.charge} = ₹${totalFare}`
      });

      return {
        baseFare: Math.round(baseFare),
        distanceFare: Math.round(distanceFare),
        timeFare: 0,
        surgeFare: Math.round(surgeFare),
        platformFee: 0,
        deadheadCharge: Math.round(deadheadResult.charge),
        totalFare: Math.round(totalFare),
        distance: Math.round(routeInfo.distance * 100) / 100,
        duration: Math.round(routeInfo.duration),
        deadheadDistance: Math.round(deadheadResult.distance * 100) / 100,
      };
    } catch (error) {
      console.error('Error in fallback fare calculation:', error);
      // Return emergency fallback instead of null
      console.log('🚨 [FARE-CALC] Fallback failed, using emergency calculation');
      return this.getEmergencyFallbackFare(vehicleType, pickupCoords, destinationCoords);
    }
  }

  // Calculate fare for specific booking type
  async calculateFareForBookingType(
    pickupCoords: { latitude: number; longitude: number },
    destinationCoords: { latitude: number; longitude: number },
    vehicleType: string,
    bookingType: string
  ): Promise<FareBreakdown | null> {
    try {
      // Get route information
      const routeInfo = await this.getRouteInfo(pickupCoords, destinationCoords);
      if (!routeInfo) {
        console.error('Failed to get route information');
        return null;
      }

      // Get fare configuration for specific booking type
      const fareConfig = await this.getFareConfigForBookingType(vehicleType, bookingType);
      if (!fareConfig) {
        console.error('Failed to get fare configuration for booking type:', bookingType);
        return null;
      }

      // Calculate fare components
      const baseFare = fareConfig.base_fare;
      const distanceFare = routeInfo.distance * fareConfig.per_km_rate;
      const surgeFare = (baseFare + distanceFare) * (fareConfig.surge_multiplier - 1);
      
      let totalFare = baseFare + distanceFare + surgeFare;
      totalFare = Math.max(totalFare, fareConfig.minimum_fare);

      return {
        baseFare: Math.round(baseFare),
        distanceFare: Math.round(distanceFare),
        timeFare: 0,
        surgeFare: Math.round(surgeFare),
        platformFee: 0,
        totalFare: Math.round(totalFare),
        distance: Math.round(routeInfo.distance * 100) / 100,
        duration: Math.round(routeInfo.duration),
      };
    } catch (error) {
      console.error('Error calculating fare for booking type:', error);
      return null;
    }
  }

  // Get fare configuration for specific booking type
  async getFareConfigForBookingType(vehicleType: string, bookingType: string): Promise<FareConfig | null> {
    try {
      // Check cache first
      const cacheKey = `${vehicleType}_${bookingType}`;
      const cached = this.fareConfigCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        return cached.config;
      }

      // Fetch from database
      const { data, error } = await supabase
        .from('fare_matrix')
        .select('*')
        .eq('vehicle_type', vehicleType)
        .eq('booking_type', bookingType)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        console.warn(`No fare config found for ${vehicleType} with booking type ${bookingType}, using fallback`);
        return this.getFallbackConfigForBookingType(vehicleType, bookingType);
      }

      const config: FareConfig = {
        vehicle_type: data.vehicle_type,
        base_fare: data.base_fare,
        per_km_rate: data.per_km_rate,
        per_minute_rate: data.per_minute_rate,
        minimum_fare: data.minimum_fare,
        surge_multiplier: data.surge_multiplier,
        platform_fee_percent: data.platform_fee_percent,
      };

      // Cache the result
      this.fareConfigCache.set(cacheKey, {
        config,
        timestamp: Date.now(),
      });

      return config;
    } catch (error) {
      console.error('Error fetching fare config for booking type:', error);
      return this.getFallbackConfigForBookingType(vehicleType, bookingType);
    }
  }

  // Get all vehicle configs for specific booking type
  async getAllVehicleConfigsForBookingType(bookingType: string): Promise<FareConfig[]> {
    try {
      const { data, error } = await supabase
        .from('fare_matrix')
        .select('*')
        .eq('booking_type', bookingType)
        .eq('is_active', true)
        .order('vehicle_type');

      if (error || !data || data.length === 0) {
        console.warn(`No fare configs found for booking type ${bookingType}, using fallback`);
        return this.getAllFallbackConfigsForBookingType(bookingType);
      }

      // Cache all configs
      data.forEach(config => {
        const cacheKey = `${config.vehicle_type}_${bookingType}`;
        this.fareConfigCache.set(cacheKey, {
          config: {
            vehicle_type: config.vehicle_type,
            base_fare: config.base_fare,
            per_km_rate: config.per_km_rate,
            per_minute_rate: config.per_minute_rate,
            minimum_fare: config.minimum_fare,
            surge_multiplier: config.surge_multiplier,
            platform_fee_percent: config.platform_fee_percent,
          },
          timestamp: Date.now(),
        });
      });

      return data.map(config => ({
        vehicle_type: config.vehicle_type,
        base_fare: config.base_fare,
        per_km_rate: config.per_km_rate,
        per_minute_rate: config.per_minute_rate,
        minimum_fare: config.minimum_fare,
        surge_multiplier: config.surge_multiplier,
        platform_fee_percent: config.platform_fee_percent,
      }));
    } catch (error) {
      console.error('Error fetching all fare configs for booking type:', error);
      return this.getAllFallbackConfigsForBookingType(bookingType);
    }
  }

  // Get outstation fare configuration for vehicle type
  async getOutstationFareConfig(vehicleType: string): Promise<any | null> {
    try {
      console.log('🔍 Fetching outstation fare config for vehicle type:', vehicleType);

      // Check cache first
      const cacheKey = `outstation_${vehicleType}`;
      const cached = this.fareConfigCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        console.log('✅ Using cached outstation config for', vehicleType, ':', cached.config);
        return cached.config;
      }

      // Fetch from outstation_fares table
      const { data, error } = await supabase
        .from('outstation_fares')
        .select('*')
        .eq('vehicle_type', vehicleType)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        console.warn(`❌ No outstation fare config found for ${vehicleType} in database:`, error);
        console.log('🔄 Using fallback outstation config');
        return this.getFallbackOutstationConfig(vehicleType);
      }

      console.log('✅ Loaded outstation config from database for', vehicleType, ':', {
        base_fare: data.base_fare,
        per_km_rate: data.per_km_rate,
        driver_allowance: data.driver_allowance_per_day,
        night_charge_percent: data.night_charge_percent,
        minimum_distance: data.minimum_distance_km
      });

      // Cache the result
      this.fareConfigCache.set(cacheKey, {
        config: data,
        timestamp: Date.now(),
      });

      return data;
    } catch (error) {
      console.error('Error fetching outstation fare config:', error);
      return this.getFallbackOutstationConfig(vehicleType);
    }
  }

  // Get outstation package configuration (slab-based)
  async getOutstationPackageConfig(vehicleType: string): Promise<any | null> {
    try {
      console.log('🔍 Fetching outstation package config for vehicle type:', vehicleType);

      const cacheKey = `outstation_package_${vehicleType}`;
      const cached = this.fareConfigCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        console.log('✅ Using cached outstation package config for', vehicleType);
        return cached.config;
      }

      const { data, error } = await supabase
        .from('outstation_packages')
        .select('*')
        .eq('vehicle_type', vehicleType)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        console.warn(`❌ No outstation package config found for ${vehicleType}:`, error);
        return null;
      }

      console.log('✅ Loaded outstation package config from database for', vehicleType);

      this.fareConfigCache.set(cacheKey, {
        config: data,
        timestamp: Date.now(),
      });

      return data;
    } catch (error) {
      console.error('Error fetching outstation package config:', error);
      return null;
    }
  }

  // Get outstation per-km configuration
  async getOutstationPerKmConfig(vehicleType: string): Promise<any | null> {
    try {
      console.log('🔍 Fetching outstation per-km config for vehicle type:', vehicleType);

      const cacheKey = `outstation_perkm_${vehicleType}`;
      const cached = this.fareConfigCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        console.log('✅ Using cached outstation per-km config for', vehicleType);
        return cached.config;
      }

      const { data, error } = await supabase
        .from('outstation_fares')
        .select('*')
        .eq('vehicle_type', vehicleType)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        console.warn(`❌ No outstation per-km config found for ${vehicleType}:`, error);
        return this.getFallbackOutstationConfig(vehicleType);
      }

      console.log('✅ Loaded outstation per-km config from database for', vehicleType);

      this.fareConfigCache.set(cacheKey, {
        config: data,
        timestamp: Date.now(),
      });

      return data;
    } catch (error) {
      console.error('Error fetching outstation per-km config:', error);
      return this.getFallbackOutstationConfig(vehicleType);
    }
  }

  // Calculate outstation fare using slab or per-km logic
  async calculateOutstationFare(
    pickupCoords: { latitude: number; longitude: number },
    destinationCoords: { latitude: number; longitude: number },
    vehicleType: string,
    isRoundTrip: boolean = false,
    numberOfDays: number = 1,
    isSameDay: boolean = true
  ): Promise<FareBreakdown | null> {
    try {
      console.log('💰 [OUTSTATION] ===== NEW SLAB/PER-KM CALCULATION START =====');
      console.log('💰 [OUTSTATION] Input parameters:', {
        vehicleType,
        isRoundTrip,
        numberOfDays,
        isSameDay,
        pickup: pickupCoords,
        destination: destinationCoords
      });

      // Get route information to calculate one-way distance
      const routeInfo = await this.getRouteInfo(pickupCoords, destinationCoords);
      if (!routeInfo) {
        console.error('❌ [OUTSTATION] Failed to get route information');
        return null;
      }

      const oneWayDistance = routeInfo.distance;
      console.log('🗺️ [OUTSTATION] One-way distance:', oneWayDistance.toFixed(2) + 'km');

      // Fetch both package config (slab) and per-km config
      const outstationPackageConfig = await this.getOutstationPackageConfig(vehicleType);
      const outstationPerKmConfig = await this.getOutstationPerKmConfig(vehicleType);

      if (!outstationPerKmConfig) {
        console.error('❌ [OUTSTATION] Failed to get per-km configuration');
        return null;
      }

      // Calculate total km travelled
      // For slab calculation, one-way distance is ALWAYS multiplied by 2
      const totalKmTravelled = oneWayDistance * 2;

      console.log('📊 [OUTSTATION] Trip details:', {
        oneWayDistance: oneWayDistance.toFixed(2) + 'km',
        totalKmTravelled: totalKmTravelled.toFixed(2) + 'km',
        isRoundTrip,
        numberOfDays,
        isSameDay,
        hasSlabConfig: !!outstationPackageConfig?.use_slab_system,
        note: 'For slab calculation, one-way distance × 2 is used'
      });

      let totalFare = 0;
      let calculationMethod: 'slab' | 'per_km' = 'per_km';
      let driverAllowance = 0;

      // DECISION LOGIC: Slab model (no driver allowance) for trips ≤ 150km one-way AND return on same day
      // Per-km model (with driver allowance) for trips > 150km one-way OR multi-day trips
      const shouldUseSlabPricing = oneWayDistance <= 150 && isSameDay && outstationPackageConfig?.use_slab_system;

      if (shouldUseSlabPricing) {
        console.log('✅ [OUTSTATION] Using SLAB MODEL (≤ 150km one-way AND same-day return)');
        calculationMethod = 'slab';

        // Find the appropriate slab
        const slabs = [
          { distance: 10, fare: outstationPackageConfig.slab_10km },
          { distance: 20, fare: outstationPackageConfig.slab_20km },
          { distance: 30, fare: outstationPackageConfig.slab_30km },
          { distance: 40, fare: outstationPackageConfig.slab_40km },
          { distance: 50, fare: outstationPackageConfig.slab_50km },
          { distance: 60, fare: outstationPackageConfig.slab_60km },
          { distance: 70, fare: outstationPackageConfig.slab_70km },
          { distance: 80, fare: outstationPackageConfig.slab_80km },
          { distance: 90, fare: outstationPackageConfig.slab_90km },
          { distance: 100, fare: outstationPackageConfig.slab_100km },
          { distance: 110, fare: outstationPackageConfig.slab_110km },
          { distance: 120, fare: outstationPackageConfig.slab_120km },
          { distance: 130, fare: outstationPackageConfig.slab_130km },
          { distance: 140, fare: outstationPackageConfig.slab_140km },
          { distance: 150, fare: outstationPackageConfig.slab_150km },
        ].filter(s => s.fare !== null);

        let selectedSlab = slabs.find(s => totalKmTravelled <= s.distance);

        if (selectedSlab) {
          // SLAB FARE ONLY - NO DRIVER ALLOWANCE (≤ 300km total)
          const slabFare = Number(selectedSlab.fare);
          totalFare = slabFare;
          driverAllowance = 0;

          console.log('💰 [OUTSTATION] Slab found (NO driver allowance for same-day trips ≤ 150km one-way):', {
            oneWayDistance: oneWayDistance.toFixed(2) + 'km',
            totalKmTravelled: totalKmTravelled.toFixed(2) + 'km',
            selectedSlab: selectedSlab.distance + 'km',
            slabFare: '₹' + slabFare,
            driverAllowance: '₹0 (not added for same-day trips ≤ 150km one-way)',
            totalFare: '₹' + totalFare,
            formula: `₹${slabFare} (slab only) = ₹${totalFare}`
          });
        } else {
          // Exceeds largest slab but ≤ 150km one-way same-day - fallback to per-km WITHOUT driver allowance
          console.warn('⚠️ [OUTSTATION] Distance exceeds largest slab, using per-km fallback (still ≤ 150km one-way same-day)');
          const perKmRate = Number(outstationPerKmConfig.per_km_rate);

          totalFare = totalKmTravelled * perKmRate;
          driverAllowance = 0;
          calculationMethod = 'per_km';

          console.log('💰 [OUTSTATION] Per-km fallback for slab overflow (NO driver allowance for same-day trips ≤ 150km one-way):', {
            oneWayDistance: oneWayDistance.toFixed(2) + 'km',
            totalKmTravelled: totalKmTravelled.toFixed(2) + 'km',
            perKmRate: '₹' + perKmRate,
            distanceFare: '₹' + (totalKmTravelled * perKmRate),
            driverAllowance: '₹0 (not added for same-day trips ≤ 150km one-way)',
            totalFare: '₹' + totalFare,
            formula: `${totalKmTravelled.toFixed(2)}km × ₹${perKmRate}/km = ₹${totalFare}`
          });
        }
      } else {
        console.log('✅ [OUTSTATION] Using PER-KM MODEL (> 150km one-way OR multi-day trip)');
        console.log('📋 [OUTSTATION] Reason:', {
          oneWayDistance: oneWayDistance.toFixed(2) + 'km',
          exceedsDistanceLimit: oneWayDistance > 150 ? 'Exceeds 150km one-way limit' : 'Within 150km',
          isSameDay: isSameDay ? 'Same day' : 'Multi-day trip',
          numberOfDays,
          isRoundTrip,
          totalKmTravelled: totalKmTravelled.toFixed(2) + 'km',
          hasSlabSystem: outstationPackageConfig?.use_slab_system ? 'Yes' : 'No'
        });

        const perKmRate = Number(outstationPerKmConfig.per_km_rate);
        const driverAllowancePerDay = Number(outstationPerKmConfig.driver_allowance_per_day);
        const dailyKmLimit = Number(outstationPerKmConfig.daily_km_limit) || 300;

        if (isRoundTrip) {
          // ROUND TRIP: Calculate based on days and daily km allowance
          const totalKmAllowance = dailyKmLimit * numberOfDays;

          if (totalKmTravelled <= totalKmAllowance) {
            // Within daily km allowance: 300km × days × rate + driver allowance × days
            totalFare = (dailyKmLimit * numberOfDays * perKmRate) + (driverAllowancePerDay * numberOfDays);
            driverAllowance = driverAllowancePerDay * numberOfDays;

            console.log('💰 [OUTSTATION] Round trip within daily km allowance:', {
              formula: `(${dailyKmLimit}km/day × ${numberOfDays} days × ₹${perKmRate}/km) + (₹${driverAllowancePerDay}/day × ${numberOfDays} days)`,
              calculation: `(${dailyKmLimit * numberOfDays}km × ₹${perKmRate}/km) + ₹${driverAllowance} = ₹${totalFare}`,
              totalKmTravelled: totalKmTravelled.toFixed(2) + 'km',
              dailyAllowance: totalKmAllowance + 'km',
              driverAllowance: '₹' + driverAllowance,
              totalFare: '₹' + totalFare
            });
          } else {
            // Exceeds daily km allowance: 300km × days × rate + driver allowance × days + extra km × rate
            const extraKm = totalKmTravelled - totalKmAllowance;
            const baseKmFare = dailyKmLimit * numberOfDays * perKmRate;
            const extraKmFare = extraKm * perKmRate;
            const driverAllowanceFee = driverAllowancePerDay * numberOfDays;

            totalFare = baseKmFare + driverAllowanceFee + extraKmFare;
            driverAllowance = driverAllowanceFee;

            console.log('💰 [OUTSTATION] Round trip exceeds daily km allowance:', {
              formula: `(${dailyKmLimit}km/day × ${numberOfDays} days × ₹${perKmRate}/km) + (₹${driverAllowancePerDay}/day × ${numberOfDays} days) + (${extraKm.toFixed(2)}km extra × ₹${perKmRate}/km)`,
              calculation: `₹${baseKmFare} + ₹${driverAllowanceFee} + ₹${extraKmFare.toFixed(2)} = ₹${totalFare}`,
              totalKmTravelled: totalKmTravelled.toFixed(2) + 'km',
              dailyAllowance: totalKmAllowance + 'km',
              extraKm: extraKm.toFixed(2) + 'km',
              driverAllowance: '₹' + driverAllowance,
              totalFare: '₹' + totalFare
            });
          }
        } else {
          // SINGLE TRIP > 300km: per-km rate + driver allowance
          totalFare = (totalKmTravelled * perKmRate) + (driverAllowancePerDay * numberOfDays);
          driverAllowance = driverAllowancePerDay * numberOfDays;

          console.log('💰 [OUTSTATION] Single trip > 300km (per-km + driver allowance):', {
            formula: `(${totalKmTravelled.toFixed(2)}km × ₹${perKmRate}/km) + (₹${driverAllowancePerDay} × ${numberOfDays} day)`,
            totalKmTravelled: totalKmTravelled.toFixed(2) + 'km',
            perKmRate: '₹' + perKmRate,
            distanceFare: '₹' + (totalKmTravelled * perKmRate),
            driverAllowance: '₹' + driverAllowance,
            totalFare: '₹' + totalFare
          });
        }
      }

      const finalBreakdown: FareBreakdown = {
        baseFare: Math.round(totalFare - driverAllowance),
        distanceFare: Math.round(totalFare - driverAllowance),
        timeFare: Math.round(driverAllowance),
        surgeFare: 0,
        platformFee: 0,
        deadheadCharge: 0,
        totalFare: Math.round(totalFare),
        distance: Math.round(oneWayDistance * 100) / 100,
        duration: Math.round(routeInfo.duration),
        deadheadDistance: 0,
        calculationMethod
      };

      console.log('✅ [OUTSTATION] Final fare breakdown:', {
        calculationMethod,
        baseFare: '₹' + finalBreakdown.baseFare,
        driverAllowance: '₹' + finalBreakdown.timeFare,
        totalFare: '₹' + finalBreakdown.totalFare,
        oneWayDistance: finalBreakdown.distance + 'km',
        totalKmTravelled: totalKmTravelled.toFixed(2) + 'km'
      });

      return finalBreakdown;
    } catch (error) {
      console.error('❌ [OUTSTATION] Error calculating outstation fare:', error);
      return null;
    }
  }

  // Get all outstation fare configs (both package and per-km)
  async getAllOutstationFareConfigs(): Promise<any[]> {
    try {
      console.log('📊 [OUTSTATION] Fetching all outstation configs (package + per-km)...');

      // Fetch both package configs and per-km configs
      const [packageResult, perKmResult] = await Promise.all([
        supabase.from('outstation_packages').select('*').eq('is_active', true),
        supabase.from('outstation_fares').select('*').eq('is_active', true)
      ]);

      if ((packageResult.error && perKmResult.error) ||
          (!packageResult.data?.length && !perKmResult.data?.length)) {
        console.warn('⚠️ [OUTSTATION] No outstation configs found, using fallback');
        return this.getAllFallbackOutstationConfigs();
      }

      // Get unique vehicle types from both tables
      const packageVehicleTypes = packageResult.data?.map(c => c.vehicle_type) || [];
      const perKmVehicleTypes = perKmResult.data?.map(c => c.vehicle_type) || [];
      const allVehicleTypes = [...new Set([...packageVehicleTypes, ...perKmVehicleTypes])];

      console.log('✅ [OUTSTATION] Found vehicle types:', allVehicleTypes);

      // Combine configs from both tables
      const configs = allVehicleTypes.map(vehicleType => {
        const packageConfig = packageResult.data?.find(c => c.vehicle_type === vehicleType);
        const perKmConfig = perKmResult.data?.find(c => c.vehicle_type === vehicleType);

        // Cache both configs
        if (packageConfig) {
          this.fareConfigCache.set(`outstation_package_${vehicleType}`, {
            config: packageConfig,
            timestamp: Date.now(),
          });
        }

        if (perKmConfig) {
          this.fareConfigCache.set(`outstation_perkm_${vehicleType}`, {
            config: perKmConfig,
            timestamp: Date.now(),
          });
        }

        return {
          vehicle_type: vehicleType,
          hasSlabSystem: !!packageConfig?.use_slab_system,
          per_km_rate: perKmConfig?.per_km_rate || 14,
          driver_allowance_per_day: perKmConfig?.driver_allowance_per_day || packageConfig?.driver_allowance_per_day || 300,
          packageConfig,
          perKmConfig,
        };
      });

      console.log('✅ [OUTSTATION] Loaded', configs.length, 'combined outstation configs');

      return configs;
    } catch (error) {
      console.error('❌ [OUTSTATION] Error fetching all outstation fare configs:', error);
      return this.getAllFallbackOutstationConfigs();
    }
  }

  // Get route information with caching
  private async getRouteInfo(
    pickup: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): Promise<{ distance: number; duration: number } | null> {
    try {
      // Create cache key
      const cacheKey = `${pickup.latitude.toFixed(4)},${pickup.longitude.toFixed(4)}-${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}`;
      
      // Check cache
      const cached = this.routeCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        console.log('🗺️ Using cached route info for distance calculation');
        return cached.route;
      }

      console.log('🗺️ [ROUTE-INFO] ===== FETCHING ROUTE INFORMATION =====');
      console.log('🗺️ [ROUTE-INFO] Pickup:', pickup);
      console.log('🗺️ [ROUTE-INFO] Destination:', destination);
      console.log('🗺️ [ROUTE-INFO] Attempting Google Maps Directions API...');

      // Try Google Directions API first
      const directions = await googleMapsService.getDirections(
        { lat: pickup.latitude, lng: pickup.longitude },
        { lat: destination.latitude, lng: destination.longitude }
      );

      let routeInfo;
      if (directions) {
        console.log('✅ [ROUTE-INFO] ===== GOOGLE DIRECTIONS API SUCCESS =====');
        console.log('✅ [ROUTE-INFO] Using REAL ROAD DISTANCE from Google Maps');
        console.log('✅ [ROUTE-INFO] Distance:', {
          text: directions.distance.text,
          meters: directions.distance.value,
          kilometers: (directions.distance.value / 1000).toFixed(2) + 'km',
          source: 'Google Directions API (ROAD DISTANCE)'
        });
        console.log('✅ [ROUTE-INFO] Duration:', {
          text: directions.duration.text,
          seconds: directions.duration.value,
          minutes: (directions.duration.value / 60).toFixed(1) + ' min',
          source: 'Google Directions API (ACTUAL TRAVEL TIME)'
        });

        routeInfo = {
          distance: directions.distance.value / 1000, // Convert to km
          duration: directions.duration.value / 60, // Convert to minutes
        };
      } else {
        console.warn('⚠️ [ROUTE-INFO] ===== GOOGLE DIRECTIONS API FAILED =====');
        console.warn('⚠️ [ROUTE-INFO] Falling back to straight-line (Haversine) distance');
        console.warn('⚠️ [ROUTE-INFO] This will be LESS ACCURATE than road distance');

        // Fallback to haversine calculation
        const distance = enhancedLocationService.calculateHaversineDistance(
          pickup.latitude,
          pickup.longitude,
          destination.latitude,
          destination.longitude
        );
        console.log('📏 [ROUTE-INFO] Haversine (straight-line) distance:', distance.toFixed(2) + 'km');
        console.log('📏 [ROUTE-INFO] Note: This is NOT the road distance!');

        routeInfo = {
          distance,
          duration: (distance / 30) * 60, // Assume 30 km/h average speed
        };
      }

      console.log('🗺️ [ROUTE-INFO] ===== FINAL ROUTE INFO =====');
      console.log('🗺️ [ROUTE-INFO] Distance used for fare:', routeInfo.distance.toFixed(2) + 'km');
      console.log('🗺️ [ROUTE-INFO] Duration used for fare:', routeInfo.duration.toFixed(1) + ' min');

      // Cache the result
      this.routeCache.set(cacheKey, {
        route: routeInfo,
        timestamp: Date.now(),
      });

      return routeInfo;
    } catch (error) {
      console.error('Error getting route info:', error);
      console.log('🔄 Using haversine calculation as final fallback');
      
      // Final fallback to haversine calculation
      const distance = enhancedLocationService.calculateHaversineDistance(
        pickup.latitude,
        pickup.longitude,
        destination.latitude,
        destination.longitude
      );
      
      console.log('📏 Final fallback distance:', distance.toFixed(2) + 'km');
      
      return {
        distance,
        duration: (distance / 30) * 60,
      };
    }
  }

  // Fallback configurations
  private getFallbackConfig(vehicleType: string): FareConfig {
    const configs: Record<string, FareConfig> = {
      hatchback: {
        vehicle_type: 'hatchback',
        base_fare: 50,
        per_km_rate: 12,
        per_minute_rate: 2,
        minimum_fare: 80,
        surge_multiplier: 1.0,
        platform_fee_percent: 8.0,
      },
      hatchback_ac: {
        vehicle_type: 'hatchback_ac',
        base_fare: 60,
        per_km_rate: 15,
        per_minute_rate: 2,
        minimum_fare: 100,
        surge_multiplier: 1.0,
        platform_fee_percent: 8.0,
      },
      sedan: {
        vehicle_type: 'sedan',
        base_fare: 60,
        per_km_rate: 15,
        per_minute_rate: 2,
        minimum_fare: 100,
        surge_multiplier: 1.0,
        platform_fee_percent: 8.0,
      },
      sedan_ac: {
        vehicle_type: 'sedan_ac',
        base_fare: 70,
        per_km_rate: 18,
        per_minute_rate: 2,
        minimum_fare: 120,
        surge_multiplier: 1.0,
        platform_fee_percent: 8.0,
      },
      suv: {
        vehicle_type: 'suv',
        base_fare: 80,
        per_km_rate: 18,
        per_minute_rate: 2,
        minimum_fare: 120,
        surge_multiplier: 1.0,
        platform_fee_percent: 8.0,
      },
      suv_ac: {
        vehicle_type: 'suv_ac',
        base_fare: 100,
        per_km_rate: 22,
        per_minute_rate: 2,
        minimum_fare: 150,
        surge_multiplier: 1.0,
        platform_fee_percent: 8.0,
      },
    };

    return configs[vehicleType] || configs.sedan;
  }

  // Emergency fallback fare calculation - never returns null
  private getEmergencyFallbackFare(
    vehicleType: string,
    pickupCoords: { latitude: number; longitude: number },
    destinationCoords: { latitude: number; longitude: number }
  ): FareBreakdown {
    console.log('🚨 [FARE-CALC] Using emergency fallback fare for', vehicleType);
    
    // Calculate basic distance
    const distance = enhancedLocationService.calculateHaversineDistance(
      pickupCoords.latitude,
      pickupCoords.longitude,
      destinationCoords.latitude,
      destinationCoords.longitude
    );
    
    // Get fallback config
    const config = this.getFallbackConfig(vehicleType);
    
    // Simple calculation: base fare + (distance * per km rate)
    const baseFare = config.base_fare;
    const distanceFare = distance * config.per_km_rate;
    const totalFare = Math.max(baseFare + distanceFare, config.minimum_fare);
    
    console.log('🚨 [FARE-CALC] Emergency calculation for', vehicleType, ':', {
      distance: distance.toFixed(2) + 'km',
      baseFare: '₹' + baseFare,
      distanceFare: '₹' + distanceFare.toFixed(2),
      totalFare: '₹' + totalFare.toFixed(2),
      source: 'emergency_fallback'
    });
    
    return {
      baseFare: Math.round(baseFare),
      distanceFare: Math.round(distanceFare),
      timeFare: 0,
      surgeFare: 0,
      platformFee: 0,
      deadheadCharge: 0,
      totalFare: Math.round(totalFare),
      distance: Math.round(distance * 100) / 100,
      duration: Math.round((distance / 30) * 60),
      deadheadDistance: 0,
    };
  }

  private getFallbackOutstationConfig(vehicleType: string): any {
    const configs: Record<string, any> = {
      hatchback: {
        vehicle_type: 'hatchback',
        base_fare: 500,
        per_km_rate: 14, // This should match database
        driver_allowance_per_day: 300,
        night_charge_percent: 20,
        minimum_distance_km: 50,
        advance_booking_discount: 5,
        cancellation_fee: 200,
        toll_charges_included: false,
      },
      hatchback_ac: {
        vehicle_type: 'hatchback_ac',
        base_fare: 600,
        per_km_rate: 16,
        driver_allowance_per_day: 300,
        night_charge_percent: 20,
        minimum_distance_km: 50,
        advance_booking_discount: 5,
        cancellation_fee: 200,
        toll_charges_included: false,
      },
      sedan: {
        vehicle_type: 'sedan',
        base_fare: 700,
        per_km_rate: 18,
        driver_allowance_per_day: 400,
        night_charge_percent: 20,
        minimum_distance_km: 50,
        advance_booking_discount: 5,
        cancellation_fee: 200,
        toll_charges_included: false,
      },
      sedan_ac: {
        vehicle_type: 'sedan_ac',
        base_fare: 800,
        per_km_rate: 20,
        driver_allowance_per_day: 400,
        night_charge_percent: 20,
        minimum_distance_km: 50,
        advance_booking_discount: 5,
        cancellation_fee: 200,
        toll_charges_included: false,
      },
      suv: {
        vehicle_type: 'suv',
        base_fare: 1000,
        per_km_rate: 22,
        driver_allowance_per_day: 500,
        night_charge_percent: 20,
        minimum_distance_km: 50,
        advance_booking_discount: 5,
        cancellation_fee: 200,
        toll_charges_included: false,
      },
      suv_ac: {
        vehicle_type: 'suv_ac',
        base_fare: 1200,
        per_km_rate: 25,
        driver_allowance_per_day: 500,
        night_charge_percent: 20,
        minimum_distance_km: 50,
        advance_booking_discount: 5,
        cancellation_fee: 200,
        toll_charges_included: false,
      },
    };

    return configs[vehicleType] || configs.sedan;
  }

  private getAllFallbackOutstationConfigs(): any[] {
    const vehicleTypes = ['hatchback', 'hatchback_ac', 'sedan', 'sedan_ac', 'suv', 'suv_ac'];
    return vehicleTypes.map(type => this.getFallbackOutstationConfig(type));
  }

  private getAllFallbackConfigs(): FareConfig[] {
    const vehicleTypes = ['hatchback', 'hatchback_ac', 'sedan', 'sedan_ac', 'suv', 'suv_ac'];
    return vehicleTypes.map(type => this.getFallbackConfig(type));
  }

  private getFallbackConfigForBookingType(vehicleType: string, bookingType: string): FareConfig {
    const baseConfigs: Record<string, FareConfig> = {
      hatchback: {
        vehicle_type: 'hatchback',
        base_fare: 50,
        per_km_rate: 12,
        per_minute_rate: 2,
        minimum_fare: 80,
        surge_multiplier: 1.0,
        platform_fee_percent: 8.0,
      },
      hatchback_ac: {
        vehicle_type: 'hatchback_ac',
        base_fare: 60,
        per_km_rate: 15,
        per_minute_rate: 2,
        minimum_fare: 100,
        surge_multiplier: 1.0,
        platform_fee_percent: 8.0,
      },
      sedan: {
        vehicle_type: 'sedan',
        base_fare: 60,
        per_km_rate: 15,
        per_minute_rate: 2,
        minimum_fare: 100,
        surge_multiplier: 1.0,
        platform_fee_percent: 8.0,
      },
      sedan_ac: {
        vehicle_type: 'sedan_ac',
        base_fare: 70,
        per_km_rate: 18,
        per_minute_rate: 2,
        minimum_fare: 120,
        surge_multiplier: 1.0,
        platform_fee_percent: 8.0,
      },
      suv: {
        vehicle_type: 'suv',
        base_fare: 80,
        per_km_rate: 18,
        per_minute_rate: 2,
        minimum_fare: 120,
        surge_multiplier: 1.0,
        platform_fee_percent: 8.0,
      },
      suv_ac: {
        vehicle_type: 'suv_ac',
        base_fare: 100,
        per_km_rate: 22,
        per_minute_rate: 2,
        minimum_fare: 150,
        surge_multiplier: 1.0,
        platform_fee_percent: 8.0,
      },
    };

    // Apply booking type multipliers
    const config = { ...baseConfigs[vehicleType] || baseConfigs.sedan };
    
    if (bookingType === 'outstation') {
      config.base_fare *= 2;
      config.per_km_rate *= 1.5;
      config.minimum_fare *= 3;
    } else if (bookingType === 'airport') {
      config.base_fare *= 3;
      config.per_km_rate *= 1.8;
      config.minimum_fare *= 4;
    }

    return config;
  }

  private getAllFallbackConfigsForBookingType(bookingType: string): FareConfig[] {
    const vehicleTypes = ['hatchback', 'hatchback_ac', 'sedan', 'sedan_ac', 'suv', 'suv_ac'];
    return vehicleTypes.map(type => this.getFallbackConfigForBookingType(type, bookingType));
  }

  // Calculate deadhead charges based on zone logic
  private async calculateDeadheadCharges(
    destinationCoords: { latitude: number; longitude: number },
    perKmRate: number
  ): Promise<{ charge: number; distance: number }> {
    try {
      console.log('🎯 [DEADHEAD-FALLBACK] ===== CALCULATING DEADHEAD CHARGES (FALLBACK) =====');
      console.log('🎯 [DEADHEAD-FALLBACK] Destination coordinates:', destinationCoords);
      console.log('🎯 [DEADHEAD-FALLBACK] Per KM rate:', perKmRate);
      
      // Get Inner Ring and Outer Ring zones
      console.log('🔍 [DEADHEAD-FALLBACK] Querying zones table for Inner Ring and Outer Ring...');
      const { data: zones, error } = await supabase
        .from('zones')
        .select('*')
        .in('name', ['Inner Ring', 'Outer Ring'])
        .eq('is_active', true);

      console.log('🔍 [DEADHEAD-FALLBACK] Zones query result:', {
        hasError: !!error,
        errorMessage: error?.message,
        errorCode: error?.code,
        zonesFound: zones?.length || 0,
        zoneNames: zones?.map(z => z.name) || [],
        allZoneData: zones || []
      });

      if (error || !zones || zones.length === 0) {
        console.warn('⚠️ [DEADHEAD-FALLBACK] No zones found, no deadhead charge applied:', {
          error: error?.message,
          zonesLength: zones?.length,
          queryUsed: "SELECT * FROM zones WHERE name IN ('Inner Ring', 'Outer Ring') AND is_active = true"
        });
        
        // Try to fetch all zones to see what's available
        console.log('🔍 [DEADHEAD-FALLBACK] Checking all available zones in database...');
        const { data: allZones, error: allZonesError } = await supabase
          .from('zones')
          .select('id, name, is_active, center_latitude, center_longitude, radius_km')
          .limit(10);
        
        console.log('🔍 [DEADHEAD-FALLBACK] All zones in database:', {
          hasError: !!allZonesError,
          errorMessage: allZonesError?.message,
          totalZones: allZones?.length || 0,
          zonesList: allZones?.map(z => ({
            id: z.id,
            name: z.name,
            is_active: z.is_active,
            center: { lat: z.center_latitude, lng: z.center_longitude },
            radius: z.radius_km
          })) || []
        });
        
        return { charge: 0, distance: 0 };
      }

      const innerRing = zones.find(z => z.name === 'Inner Ring');
      const outerRing = zones.find(z => z.name === 'Outer Ring');

      if (!innerRing || !outerRing) {
        console.warn('⚠️ [DEADHEAD-FALLBACK] Inner Ring or Outer Ring not found, no deadhead charge applied');
        return { charge: 0, distance: 0 };
      }

      console.log('🎯 [DEADHEAD-FALLBACK] Found zones:', {
        innerRing: { name: innerRing.name, radius: innerRing.radius_km },
        outerRing: { name: outerRing.name, radius: outerRing.radius_km }
      });

      // Calculate distances to zone centers
      const distanceToInnerCenter = this.calculateHaversineDistance(
        destinationCoords.latitude,
        destinationCoords.longitude,
        innerRing.center_latitude,
        innerRing.center_longitude
      );

      const distanceToOuterCenter = this.calculateHaversineDistance(
        destinationCoords.latitude,
        destinationCoords.longitude,
        outerRing.center_latitude,
        outerRing.center_longitude
      );

      // Check zone status
      const isOutsideInnerRing = distanceToInnerCenter > innerRing.radius_km;
      const isInsideOuterRing = distanceToOuterCenter <= outerRing.radius_km;

      console.log('🎯 [DEADHEAD-FALLBACK] ===== DETAILED ZONE ANALYSIS =====');
      console.log('🎯 [DEADHEAD-FALLBACK] Distance calculations:', {
        destination: destinationCoords,
        distanceToInnerCenter: distanceToInnerCenter.toFixed(4) + 'km',
        distanceToOuterCenter: distanceToOuterCenter.toFixed(4) + 'km',
        innerRingRadius: innerRing.radius_km + 'km',
        outerRingRadius: outerRing.radius_km + 'km'
      });
      
      console.log('🎯 [DEADHEAD-FALLBACK] Zone boundary checks:', {
        isOutsideInnerRing: isOutsideInnerRing,
        isOutsideInnerRingCheck: `${distanceToInnerCenter.toFixed(4)}km > ${innerRing.radius_km}km = ${isOutsideInnerRing}`,
        isInsideOuterRing: isInsideOuterRing,
        isInsideOuterRingCheck: `${distanceToOuterCenter.toFixed(4)}km <= ${outerRing.radius_km}km = ${isInsideOuterRing}`,
        deadheadCondition: `${isOutsideInnerRing} && ${isInsideOuterRing} = ${isOutsideInnerRing && isInsideOuterRing}`
      });
      
      console.log('🎯 [DEADHEAD-FALLBACK] Zone classification:', {
        zoneStatus: isOutsideInnerRing && isInsideOuterRing ? 'Between Inner and Outer Ring (DEADHEAD APPLIES)' :
                   !isOutsideInnerRing ? 'Within Inner Ring (NO DEADHEAD)' :
                   !isInsideOuterRing ? 'Outside Outer Ring (OUTSTATION - NO DEADHEAD)' : 'Unknown'
      });

      // Apply deadhead charge only if destination is between inner and outer ring
      if (isOutsideInnerRing && isInsideOuterRing) {
        console.log('🎯 [DEADHEAD-FALLBACK] ===== DEADHEAD CHARGE APPLIES =====');
        console.log('🎯 [DEADHEAD-FALLBACK] Destination is between Inner and Outer Ring - calculating deadhead charge');
        
        // CORRECTED LOGIC: Calculate deadhead distance from drop-off to Hosur Bus Stand
        const hosurBusStand = { latitude: 12.7402, longitude: 77.8240 }; // Hard-coded Hosur Bus Stand coordinates
        
        const deadheadDistance = this.calculateHaversineDistance(
          destinationCoords.latitude,
          destinationCoords.longitude,
          hosurBusStand.latitude,
          hosurBusStand.longitude
        );
        
        // Apply deadhead charge: (distance to Hosur Bus Stand / 2) * per km rate
        const deadheadCharge = (deadheadDistance / 2) * perKmRate;
        
        console.log('🎯 [DEADHEAD-FALLBACK] ===== DEADHEAD CALCULATION COMPLETE =====');
        console.log('🎯 [DEADHEAD-FALLBACK] Deadhead calculation details:', {
          dropOffLocation: destinationCoords,
          hosurBusStand: hosurBusStand,
          distanceToHosurBusStand: deadheadDistance.toFixed(4) + 'km',
          perKmRate: '₹' + perKmRate + '/km',
          calculation: `(${deadheadDistance.toFixed(2)}km to Hosur Bus Stand / 2) × ₹${perKmRate}/km = ₹${deadheadCharge.toFixed(2)}`,
          formula: 'Distance to Hosur Bus Stand ÷ 2 × Per KM Rate'
        });
        
        return { charge: deadheadCharge, distance: deadheadDistance };
      } else {
        console.log('🎯 [DEADHEAD-FALLBACK] ===== NO DEADHEAD CHARGE =====');
        console.log('🎯 [DEADHEAD-FALLBACK] No deadhead charge applied:', {
          reason: !isOutsideInnerRing ? 'Destination within Inner Ring' : 'Destination outside Outer Ring (should be outstation)',
          zoneStatus: !isOutsideInnerRing ? 'Within Inner Ring' : 'Outside Outer Ring'
        });
        return { charge: 0, distance: 0 };
      }
    } catch (error) {
      console.error('❌ [DEADHEAD-FALLBACK] Error calculating deadhead charges:', error);
      return { charge: 0, distance: 0 };
    }
  }

  // Helper method for distance calculation
  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Clear caches
  clearCache() {
    this.fareConfigCache.clear();
    this.routeCache.clear();
  }
}

export const fareCalculator = new FareCalculator();