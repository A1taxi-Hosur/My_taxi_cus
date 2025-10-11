const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface FareCalculationRequest {
  pickup_latitude: number;
  pickup_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
  vehicle_type: string;
  booking_type?: string;
  distance_km?: number;
  duration_minutes?: number;
}

interface FareConfig {
  vehicle_type: string;
  base_fare: number;
  per_km_rate: number;
  per_minute_rate: number;
  minimum_fare: number;
  surge_multiplier: number;
  platform_fee_percent: number;
}

interface Zone {
  id: string;
  name: string;
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  coordinates: any;
  is_active: boolean;
}

interface FareBreakdown {
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
}

const HOSUR_BUS_STAND = {
  latitude: 12.7402,
  longitude: 77.8240
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('npm:@supabase/supabase-js@2.56.1');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'POST') {
      const requestData: FareCalculationRequest = await req.json();
      
      console.log('💰 [FARE-CALC] ===== STARTING FARE CALCULATION WITH ZONE LOGIC =====');
      console.log('💰 [FARE-CALC] Request data:', {
        pickup: { lat: requestData.pickup_latitude, lng: requestData.pickup_longitude },
        destination: { lat: requestData.destination_latitude, lng: requestData.destination_longitude },
        vehicle_type: requestData.vehicle_type,
        booking_type: requestData.booking_type || 'regular'
      });

      const fareConfig = await getFareConfig(supabase, requestData.vehicle_type, requestData.booking_type || 'regular');
      if (!fareConfig) {
        throw new Error(`No fare configuration found for ${requestData.vehicle_type}`);
      }

      console.log('💰 [FARE-CALC] Fare config loaded:', {
        base_fare: fareConfig.base_fare,
        per_km_rate: fareConfig.per_km_rate,
        minimum_fare: fareConfig.minimum_fare,
        surge_multiplier: fareConfig.surge_multiplier
      });

      let distance: number;
      let duration: number;

      if (requestData.distance_km && requestData.duration_minutes) {
        distance = requestData.distance_km;
        duration = requestData.duration_minutes;
        console.log('📏 [FARE-CALC] Using provided distance and duration');
      } else {
        console.log('🗺️ [FARE-CALC] ===== FETCHING ROAD DISTANCE FROM GOOGLE MAPS =====');
        const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');

        if (!googleMapsApiKey) {
          console.warn('⚠️ [FARE-CALC] Google Maps API key not found, using straight-line distance');
          distance = calculateDistance(
            requestData.pickup_latitude,
            requestData.pickup_longitude,
            requestData.destination_latitude,
            requestData.destination_longitude
          );
          duration = (distance / 30) * 60;
        } else {
          try {
            const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${requestData.pickup_latitude},${requestData.pickup_longitude}&destination=${requestData.destination_latitude},${requestData.destination_longitude}&mode=driving&key=${googleMapsApiKey}`;

            console.log('🗺️ [FARE-CALC] Calling Google Directions API...');
            const directionsResponse = await fetch(directionsUrl);
            const directionsData = await directionsResponse.json();

            if (directionsData.status === 'OK' && directionsData.routes && directionsData.routes.length > 0) {
              const route = directionsData.routes[0];
              const leg = route.legs[0];

              distance = leg.distance.value / 1000;
              duration = leg.duration.value / 60;

              console.log('✅ [FARE-CALC] ===== GOOGLE MAPS SUCCESS - USING ROAD DISTANCE =====');
              console.log('✅ [FARE-CALC] Road distance:', {
                text: leg.distance.text,
                kilometers: distance.toFixed(2) + 'km',
                meters: leg.distance.value,
                source: 'Google Directions API (ACTUAL ROAD DISTANCE)'
              });
              console.log('✅ [FARE-CALC] Travel time:', {
                text: leg.duration.text,
                minutes: duration.toFixed(1) + ' min',
                seconds: leg.duration.value,
                source: 'Google Directions API (ACTUAL TRAVEL TIME)'
              });
            } else {
              console.warn('⚠️ [FARE-CALC] Google Directions API failed:', directionsData.status);
              console.warn('⚠️ [FARE-CALC] Falling back to straight-line distance');
              distance = calculateDistance(
                requestData.pickup_latitude,
                requestData.pickup_longitude,
                requestData.destination_latitude,
                requestData.destination_longitude
              );
              duration = (distance / 30) * 60;
            }
          } catch (error) {
            console.error('❌ [FARE-CALC] Error calling Google Directions API:', error);
            console.warn('⚠️ [FARE-CALC] Falling back to straight-line distance');
            distance = calculateDistance(
              requestData.pickup_latitude,
              requestData.pickup_longitude,
              requestData.destination_latitude,
              requestData.destination_longitude
            );
            duration = (distance / 30) * 60;
          }
        }
      }

      console.log('📏 [FARE-CALC] ===== FINAL ROUTE DETAILS =====');
      console.log('📏 [FARE-CALC] Distance for fare calculation:', distance.toFixed(2) + 'km');
      console.log('📏 [FARE-CALC] Duration for fare calculation:', Math.round(duration) + ' min');

      const baseFare = fareConfig.base_fare;
      
      let distanceFare = 0;
      const baseKmCovered = 4;
      
      if (distance > baseKmCovered) {
        const additionalDistance = distance - baseKmCovered;
        distanceFare = additionalDistance * fareConfig.per_km_rate;
      }
      
      const surgeFare = (baseFare + distanceFare) * (fareConfig.surge_multiplier - 1);
      
      let subtotal = baseFare + distanceFare + surgeFare;
      subtotal = Math.max(subtotal, fareConfig.minimum_fare);
      
      console.log('💰 [FARE-CALC] Base fare calculation:', {
        baseFare,
        distanceFare,
        surgeFare,
        subtotal
      });

      let deadheadCharge = 0;
      let deadheadDistance = 0;
      let deadheadInfo = {
        applied: false,
        reason: 'Not calculated',
        deadheadDistance: 0,
        deadheadCharge: 0,
        zoneStatus: 'Unknown'
      };

      if ((requestData.booking_type || 'regular') === 'regular') {
        console.log('🎯 [FARE-CALC] ===== STARTING ZONE ANALYSIS FOR DEADHEAD =====');
        
        const destinationPoint = {
          latitude: requestData.destination_latitude,
          longitude: requestData.destination_longitude
        };
        
        console.log('🎯 [FARE-CALC] Destination point:', destinationPoint);
        console.log('🎯 [FARE-CALC] Hosur Bus Stand (hard-coded):', HOSUR_BUS_STAND);

        const zones = await getZonesFromDatabase(supabase);
        
        if (zones.innerRing && zones.outerRing) {
          console.log('🎯 [FARE-CALC] ===== ZONES FOUND IN DATABASE =====');
          console.log('🎯 [FARE-CALC] Inner Ring:', {
            name: zones.innerRing.name,
            center: { lat: zones.innerRing.center_latitude, lng: zones.innerRing.center_longitude },
            radius: zones.innerRing.radius_km + 'km'
          });
          console.log('🎯 [FARE-CALC] Outer Ring:', {
            name: zones.outerRing.name,
            center: { lat: zones.outerRing.center_latitude, lng: zones.outerRing.center_longitude },
            radius: zones.outerRing.radius_km + 'km'
          });

          const distanceToInnerCenter = calculateDistance(
            destinationPoint.latitude,
            destinationPoint.longitude,
            zones.innerRing.center_latitude,
            zones.innerRing.center_longitude
          );

          const distanceToOuterCenter = calculateDistance(
            destinationPoint.latitude,
            destinationPoint.longitude,
            zones.outerRing.center_latitude,
            zones.outerRing.center_longitude
          );

          console.log('🎯 [FARE-CALC] ===== DISTANCE CALCULATIONS =====');
          console.log('🎯 [FARE-CALC] Distance to Inner Ring center:', distanceToInnerCenter.toFixed(4) + 'km');
          console.log('🎯 [FARE-CALC] Distance to Outer Ring center:', distanceToOuterCenter.toFixed(4) + 'km');
          console.log('🎯 [FARE-CALC] Inner Ring radius:', zones.innerRing.radius_km + 'km');
          console.log('🎯 [FARE-CALC] Outer Ring radius:', zones.outerRing.radius_km + 'km');

          const isWithinInnerRing = distanceToInnerCenter <= zones.innerRing.radius_km;
          const isWithinOuterRing = distanceToOuterCenter <= zones.outerRing.radius_km;

          console.log('🎯 [FARE-CALC] ===== ZONE CLASSIFICATION =====');
          console.log('🎯 [FARE-CALC] Is within Inner Ring?', isWithinInnerRing, `(${distanceToInnerCenter.toFixed(4)}km <= ${zones.innerRing.radius_km}km)`);
          console.log('🎯 [FARE-CALC] Is within Outer Ring?', isWithinOuterRing, `(${distanceToOuterCenter.toFixed(4)}km <= ${zones.outerRing.radius_km}km)`);

          const shouldApplyDeadhead = !isWithinInnerRing && isWithinOuterRing;
          
          console.log('🎯 [FARE-CALC] ===== DEADHEAD DECISION POINT =====');
          console.log('🎯 [FARE-CALC] Deadhead decision variables:', {
            isWithinInnerRing,
            isWithinOuterRing,
            notWithinInner: !isWithinInnerRing,
            withinOuter: isWithinOuterRing,
            shouldApplyDeadhead
          });
          
          if (shouldApplyDeadhead) {
            console.log('🎯 [FARE-CALC] ===== DEADHEAD CHARGE APPLIES =====');
            
            deadheadDistance = calculateDistance(
              destinationPoint.latitude,
              destinationPoint.longitude,
              HOSUR_BUS_STAND.latitude,
              HOSUR_BUS_STAND.longitude
            );
            
            deadheadCharge = (deadheadDistance / 2) * fareConfig.per_km_rate;
            
            console.log('🎯 [FARE-CALC] ===== DEADHEAD CALCULATION COMPLETE =====');
            console.log('🎯 [FARE-CALC] Deadhead details:', {
              dropOffLocation: destinationPoint,
              hosurBusStand: HOSUR_BUS_STAND,
              distanceToHosurBusStand: deadheadDistance.toFixed(4) + 'km',
              perKmRate: '₹' + fareConfig.per_km_rate + '/km',
              calculation: `(${deadheadDistance.toFixed(2)}km ÷ 2) × ₹${fareConfig.per_km_rate} = ₹${deadheadCharge.toFixed(2)}`,
              deadheadCharge: '₹' + deadheadCharge.toFixed(2)
            });
            
            deadheadInfo = {
              applied: true,
              reason: 'Between Inner and Outer Ring',
              deadheadDistance,
              deadheadCharge,
              zoneStatus: 'Between Inner and Outer Ring'
            };
          } else {
            console.log('🎯 [FARE-CALC] ===== NO DEADHEAD CHARGE =====');
            console.log('🎯 [FARE-CALC] Reason:', {
              reason: isWithinInnerRing ? 'Destination within Inner Ring' : 'Destination outside Outer Ring (should be outstation)',
              zoneStatus: isWithinInnerRing ? 'Within Inner Ring' : 'Outside Outer Ring'
            });
            
            deadheadInfo = {
              applied: false,
              reason: isWithinInnerRing ? 'Within Inner Ring' : 'Outside Outer Ring',
              deadheadDistance: 0,
              deadheadCharge: 0,
              zoneStatus: isWithinInnerRing ? 'Within Inner Ring' : 'Outside Outer Ring'
            };
          }
        } else {
          console.warn('⚠️ [FARE-CALC] ===== ZONES NOT FOUND =====');
          console.warn('⚠️ [FARE-CALC] No deadhead charge applied - zones missing from database');
          
          deadheadInfo = {
            applied: false,
            reason: 'Zones not found in database',
            deadheadDistance: 0,
            deadheadCharge: 0,
            zoneStatus: 'Unknown - zones missing'
          };
        }
      } else {
        console.log('🎯 [FARE-CALC] Non-regular booking type - no deadhead charge');
        deadheadInfo = {
          applied: false,
          reason: 'Non-regular booking type',
          deadheadDistance: 0,
          deadheadCharge: 0,
          zoneStatus: 'N/A for ' + (requestData.booking_type || 'regular')
        };
      }

      const totalFare = subtotal + deadheadCharge;
      
      console.log('💰 [FARE-CALC] ===== FINAL FARE BREAKDOWN =====');
      console.log('💰 [FARE-CALC] Components:', {
        baseFare: '₹' + baseFare.toFixed(2),
        distanceFare: '₹' + distanceFare.toFixed(2),
        surgeFare: '₹' + surgeFare.toFixed(2),
        subtotal: '₹' + subtotal.toFixed(2),
        deadheadCharge: '₹' + deadheadCharge.toFixed(2),
        totalFare: '₹' + totalFare.toFixed(2)
      });

      const fareBreakdown: FareBreakdown = {
        baseFare: Math.round(baseFare),
        distanceFare: Math.round(distanceFare),
        timeFare: 0,
        surgeFare: Math.round(surgeFare),
        platformFee: 0,
        deadheadCharge: Math.round(deadheadCharge),
        totalFare: Math.round(totalFare),
        distance: Math.round(distance * 100) / 100,
        duration: Math.round(duration),
        deadheadDistance: Math.round(deadheadDistance * 100) / 100,
      };

      console.log('💰 [FARE-CALC] ===== RETURNING FARE BREAKDOWN =====');
      console.log('💰 [FARE-CALC] Final object:', fareBreakdown);

      return new Response(
        JSON.stringify({
          success: true,
          fareBreakdown,
          config: fareConfig,
          deadheadInfo
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('❌ [FARE-CALC] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});

async function getZonesFromDatabase(supabase: any): Promise<{ innerRing: Zone | null; outerRing: Zone | null }> {
  try {
    console.log('🔍 [FARE-CALC] ===== FETCHING ZONES FROM DATABASE =====');
    
    const { data: zones, error } = await supabase
      .from('zones')
      .select('*')
      .in('name', ['Inner Ring', 'Outer Ring'])
      .eq('is_active', true);

    console.log('🔍 [FARE-CALC] Database query result:', {
      hasError: !!error,
      errorMessage: error?.message,
      errorCode: error?.code,
      zonesFound: zones?.length || 0,
      zoneNames: zones?.map(z => z.name) || []
    });

    if (error) {
      console.error('❌ [FARE-CALC] Database error fetching zones:', error);
      return { innerRing: null, outerRing: null };
    }

    if (!zones || zones.length === 0) {
      console.warn('⚠️ [FARE-CALC] No zones found in database');
      return { innerRing: null, outerRing: null };
    }

    const innerRing = zones.find(z => z.name === 'Inner Ring') || null;
    const outerRing = zones.find(z => z.name === 'Outer Ring') || null;

    console.log('✅ [FARE-CALC] Zones extracted:', {
      innerRingFound: !!innerRing,
      outerRingFound: !!outerRing
    });

    return { innerRing, outerRing };
  } catch (error) {
    console.error('❌ [FARE-CALC] Exception fetching zones:', error);
    return { innerRing: null, outerRing: null };
  }
}

async function getFareConfig(supabase: any, vehicleType: string, bookingType: string): Promise<FareConfig | null> {
  try {
    console.log('💰 [FARE-CALC] Fetching fare config:', { vehicleType, bookingType });
    
    const { data, error } = await supabase
      .from('fare_matrix')
      .select('vehicle_type, base_fare, per_km_rate, minimum_fare, surge_multiplier, platform_fee')
      .eq('vehicle_type', vehicleType)
      .eq('booking_type', bookingType)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.error('❌ [FARE-CALC] Error fetching fare config:', error);
      return null;
    }

    console.log('✅ [FARE-CALC] Fare config loaded:', {
      vehicle_type: data.vehicle_type,
      base_fare: data.base_fare,
      per_km_rate: data.per_km_rate,
      minimum_fare: data.minimum_fare,
      surge_multiplier: data.surge_multiplier
    });

    return {
      vehicle_type: data.vehicle_type,
      base_fare: data.base_fare,
      per_km_rate: data.per_km_rate,
      per_minute_rate: 0,
      minimum_fare: data.minimum_fare,
      surge_multiplier: data.surge_multiplier,
      platform_fee_percent: 0
    };
  } catch (error) {
    console.error('❌ [FARE-CALC] Exception fetching fare config:', error);
    return null;
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}