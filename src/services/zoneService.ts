import { supabase } from '../utils/supabase';

export interface Zone {
  id: string;
  name: string;
  city: string;
  state: string;
  coordinates: any; // GeoJSON polygon coordinates
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  is_active: boolean;
}

class ZoneService {
  private zonesCache: Zone[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async fetchActiveZones(): Promise<Zone[]> {
    try {
      // Check cache first
      if (this.zonesCache && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION) {
        console.log('🗺️ Using cached zones data');
        return this.zonesCache;
      }

      console.log('🗺️ Fetching active zones from database...');
      
      const { data: zones, error } = await supabase
        .from('zones')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('❌ Error fetching zones:', error);
        throw error;
      }

      console.log('✅ Fetched zones from database:', {
        count: zones?.length || 0,
        zones: zones?.map(z => ({ name: z.name, city: z.city, radius: z.radius_km }))
      });

      // Cache the results
      this.zonesCache = zones || [];
      this.cacheTimestamp = Date.now();

      return zones || [];
    } catch (error) {
      console.error('❌ Error fetching active zones:', error);
      // Return empty array on error to prevent app crashes
      return [];
    }
  }

  // Clear cache to force refresh
  clearCache() {
    this.zonesCache = null;
    this.cacheTimestamp = 0;
  }
}

export const zoneService = new ZoneService();