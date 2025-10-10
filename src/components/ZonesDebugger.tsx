import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { supabase } from '../utils/supabase';

export default function ZonesDebugger() {
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllZones = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 [ZONES-DEBUG] Fetching ALL zones from database...');
      
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .order('name');

      console.log('🔍 [ZONES-DEBUG] Query result:', {
        hasError: !!error,
        errorMessage: error?.message,
        errorCode: error?.code,
        errorDetails: error?.details,
        dataCount: data?.length || 0,
        rawData: data
      });

      if (error) {
        setError(error.message);
        console.error('❌ [ZONES-DEBUG] Database error:', error);
        return;
      }

      setZones(data || []);
      
      console.log('✅ [ZONES-DEBUG] Zones found:', {
        total: data?.length || 0,
        activeZones: data?.filter(z => z.is_active).length || 0,
        inactiveZones: data?.filter(z => !z.is_active).length || 0,
        zoneNames: data?.map(z => z.name) || [],
        innerRingExists: data?.some(z => z.name === 'Inner Ring') || false,
        outerRingExists: data?.some(z => z.name === 'Outer Ring') || false,
        allZoneDetails: data?.map(z => ({
          id: z.id,
          name: z.name,
          is_active: z.is_active,
          center: { lat: z.center_latitude, lng: z.center_longitude },
          radius: z.radius_km,
          city: z.city,
          state: z.state
        })) || []
      });

    } catch (exception) {
      console.error('❌ [ZONES-DEBUG] Exception:', exception);
      setError(exception.message);
    } finally {
      setLoading(false);
    }
  };

  const checkSpecificZones = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 [ZONES-DEBUG] Checking for Inner Ring and Outer Ring specifically...');
      
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .in('name', ['Inner Ring', 'Outer Ring'])
        .eq('is_active', true);

      console.log('🔍 [ZONES-DEBUG] Specific zones query result:', {
        hasError: !!error,
        errorMessage: error?.message,
        dataCount: data?.length || 0,
        foundZones: data?.map(z => z.name) || [],
        rawData: data
      });

      if (error) {
        setError(error.message);
        return;
      }

      console.log('🎯 [ZONES-DEBUG] Inner/Outer Ring search result:', {
        innerRingFound: data?.find(z => z.name === 'Inner Ring') ? 'YES' : 'NO',
        outerRingFound: data?.find(z => z.name === 'Outer Ring') ? 'YES' : 'NO',
        totalFound: data?.length || 0
      });

    } catch (exception) {
      console.error('❌ [ZONES-DEBUG] Exception:', exception);
      setError(exception.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllZones();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Zones Database Debugger</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={fetchAllZones}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Loading...' : 'Fetch All Zones'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.button}
          onPress={checkSpecificZones}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            Check Inner/Outer Ring
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}

      <ScrollView style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>
          Database Results ({zones.length} zones found):
        </Text>
        
        {zones.length === 0 && !loading && (
          <Text style={styles.noDataText}>
            No zones found in database. The zones table might be empty.
          </Text>
        )}
        
        {zones.map((zone, index) => (
          <View key={zone.id} style={styles.zoneCard}>
            <Text style={styles.zoneName}>
              {index + 1}. {zone.name}
            </Text>
            <Text style={styles.zoneDetail}>
              ID: {zone.id}
            </Text>
            <Text style={styles.zoneDetail}>
              Active: {zone.is_active ? 'YES' : 'NO'}
            </Text>
            <Text style={styles.zoneDetail}>
              Center: {zone.center_latitude}, {zone.center_longitude}
            </Text>
            <Text style={styles.zoneDetail}>
              Radius: {zone.radius_km} km
            </Text>
            <Text style={styles.zoneDetail}>
              City: {zone.city}, {zone.state}
            </Text>
            {zone.coordinates && (
              <Text style={styles.zoneDetail}>
                Has Polygon: YES
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  resultsContainer: {
    flex: 1,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  noDataText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  zoneCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  zoneName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  zoneDetail: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
});