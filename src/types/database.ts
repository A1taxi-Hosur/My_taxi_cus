export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone_number: string | null;
          role: 'admin' | 'customer' | 'driver' | 'vendor';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          phone_number?: string | null;
          role?: 'admin' | 'customer' | 'driver' | 'vendor';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          phone_number?: string | null;
          role?: 'admin' | 'customer' | 'driver' | 'vendor';
          updated_at?: string;
        };
      };
      drivers: {
        Row: {
          id: string;
          user_id: string;
          vehicle_id: string | null;
          license_number: string;
          is_online: boolean;
          is_available: boolean;
          rating: number;
          total_rides: number;
          created_at: string;
          updated_at: string;
        };
      };
      vehicles: {
        Row: {
          id: string;
          make: string;
          model: string;
          year: number;
          license_plate: string;
          vehicle_type: 'sedan' | 'auto' | 'bike' | 'suv' | 'hatchback';
          color: string;
          created_at: string;
        };
      };
      rides: {
        Row: {
          id: string;
          ride_code: string;
          customer_id: string;
          driver_id: string | null;
          pickup_address: string;
          pickup_latitude: number;
          pickup_longitude: number;
          destination_address: string | null;
          destination_latitude: number | null;
          destination_longitude: number | null;
          status: 'requested' | 'accepted' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_drivers_available';
          fare_amount: number | null;
          distance_km: number | null;
          duration_minutes: number | null;
          vehicle_type: 'sedan' | 'auto' | 'bike' | 'suv' | 'hatchback';
          booking_type: 'regular' | 'rental' | 'outstation' | 'airport';
          rental_duration_hours: number | null;
          flight_details: any | null;
          admin_allocation_required: boolean;
          admin_allocated_by: string | null;
          special_instructions: string | null;
          cancelled_by: string | null;
          cancellation_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ride_code?: string;
          customer_id: string;
          driver_id?: string | null;
          pickup_address: string;
          pickup_latitude: number;
          pickup_longitude: number;
          destination_address?: string | null;
          destination_latitude?: number | null;
          destination_longitude?: number | null;
          status?: 'requested' | 'accepted' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_drivers_available';
          fare_amount?: number | null;
          distance_km?: number | null;
          duration_minutes?: number | null;
          vehicle_type: 'sedan' | 'auto' | 'bike' | 'suv' | 'hatchback';
          booking_type?: 'regular' | 'rental' | 'outstation' | 'airport';
          rental_duration_hours?: number | null;
          flight_details?: any | null;
          admin_allocation_required?: boolean;
          admin_allocated_by?: string | null;
          special_instructions?: string | null;
          cancelled_by?: string | null;
          cancellation_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      live_locations: {
        Row: {
          id: string;
          driver_id: string;
          latitude: number;
          longitude: number;
          heading: number | null;
          speed: number | null;
          updated_at: string;
        };
      };
      payments: {
        Row: {
          id: string;
          ride_id: string;
          amount: number;
          payment_method: string;
          status: 'pending' | 'completed' | 'failed' | 'refunded';
          created_at: string;
        };
      };
      rental_packages: {
        Row: {
          id: string;
          duration_hours: number;
          base_price: number;
          vehicle_type: 'sedan' | 'suv' | 'hatchback';
          created_at: string;
        };
      };
      outstation_zones: {
        Row: {
          id: string;
          zone_name: string;
          base_rate_per_km: number;
          minimum_fare: number;
          created_at: string;
        };
      };
      airport_config: {
        Row: {
          id: string;
          airport_name: string;
          pickup_rate: number;
          drop_rate: number;
          terminal_info: any;
          created_at: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          data: any;
          status: 'unread' | 'read' | 'cancelled';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          data?: any;
          status?: 'unread' | 'read' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
      };
      user_push_tokens: {
        Row: {
          id: string;
          user_id: string;
          push_token: string;
          device_info: any;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          push_token: string;
          device_info?: any;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      outstation_packages: {
        Row: {
          id: string;
          vehicle_type: 'hatchback' | 'hatchback_ac' | 'sedan' | 'sedan_ac' | 'suv' | 'suv_ac';
          slab_10km: number | null;
          slab_20km: number;
          slab_30km: number | null;
          slab_40km: number;
          slab_50km: number | null;
          slab_60km: number;
          slab_70km: number | null;
          slab_80km: number;
          slab_90km: number | null;
          slab_100km: number;
          slab_110km: number | null;
          slab_120km: number;
          slab_130km: number | null;
          slab_140km: number;
          slab_150km: number | null;
          extra_km_rate: number;
          driver_allowance_per_day: number;
          night_charge_percent: number;
          toll_charges_included: boolean;
          cancellation_fee: number;
          advance_booking_discount: number;
          use_slab_system: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      outstation_fares: {
        Row: {
          id: string;
          vehicle_type: 'hatchback' | 'hatchback_ac' | 'sedan' | 'sedan_ac' | 'suv' | 'suv_ac';
          base_fare: number;
          per_km_rate: number;
          driver_allowance_per_day: number;
          daily_km_limit: number;
          minimum_distance_km: number;
          toll_charges_included: boolean;
          cancellation_fee: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
}

export type User = Database['public']['Tables']['users']['Row'];
export type Driver = Database['public']['Tables']['drivers']['Row'];
export type Vehicle = Database['public']['Tables']['vehicles']['Row'];
export type Ride = Database['public']['Tables']['rides']['Row'];
export type LiveLocation = Database['public']['Tables']['live_locations']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type RentalPackage = Database['public']['Tables']['rental_packages']['Row'];
export type OutstationZone = Database['public']['Tables']['outstation_zones']['Row'];
export type AirportConfig = Database['public']['Tables']['airport_config']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type UserPushToken = Database['public']['Tables']['user_push_tokens']['Row'];
export type OutstationPackage = Database['public']['Tables']['outstation_packages']['Row'];
export type OutstationFare = Database['public']['Tables']['outstation_fares']['Row'];

// Extended types with proper numeric conversion
export interface OutstationPackageConfig extends OutstationPackage {
  slab_10km: number | null;
  slab_20km: number;
  slab_30km: number | null;
  slab_40km: number;
  slab_50km: number | null;
  slab_60km: number;
  slab_70km: number | null;
  slab_80km: number;
  slab_90km: number | null;
  slab_100km: number;
  slab_110km: number | null;
  slab_120km: number;
  slab_130km: number | null;
  slab_140km: number;
  slab_150km: number | null;
  extra_km_rate: number;
  driver_allowance_per_day: number;
  night_charge_percent: number;
  cancellation_fee: number;
  advance_booking_discount: number;
  use_slab_system: boolean;
}

export interface OutstationPerKmConfig extends OutstationFare {
  base_fare: number;
  per_km_rate: number;
  driver_allowance_per_day: number;
  daily_km_limit: number;
  minimum_distance_km: number;
  cancellation_fee: number;
}