export interface Ride {
  id: string;
  customer_id: string;
  driver_id?: string;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  destination_address?: string;
  destination_latitude?: number;
  destination_longitude?: number;
  status: string;
  fare_amount: number;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  user_id: string;
  vehicle_id?: string;
  rating?: number;
  total_rides?: number;
}
