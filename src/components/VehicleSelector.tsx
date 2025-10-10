import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Car, Truck, Bike, Car as Suv } from 'lucide-react-native';

type VehicleType = 'sedan' | 'auto' | 'bike' | 'suv' | 'hatchback' | 'hatchback_ac' | 'sedan_ac' | 'suv_ac';

interface VehicleSelectorProps {
  selectedVehicle: VehicleType;
  onVehicleSelect: (vehicle: VehicleType) => void;
}

const vehicles = [
  {
    type: 'hatchback' as VehicleType,
    name: 'Hatchback',
    icon: Car,
    description: 'Compact & comfortable',
    baseRate: '₹15/km',
  },
  {
    type: 'hatchback_ac' as VehicleType,
    name: 'Hatchback AC',
    icon: Car,
    description: 'Compact with AC',
    baseRate: '₹18/km',
  },
  {
    type: 'sedan' as VehicleType,
    name: 'Sedan',
    icon: Car,
    description: 'Comfortable for all trips',
    baseRate: '₹18/km',
  },
  {
    type: 'sedan_ac' as VehicleType,
    name: 'Sedan AC',
    icon: Car,
    description: 'Comfortable with AC',
    baseRate: '₹22/km',
  },
  {
    type: 'suv' as VehicleType,
    name: 'SUV',
    icon: Suv,
    description: 'Spacious & premium',
    baseRate: '₹22/km',
  },
  {
    type: 'suv_ac' as VehicleType,
    name: 'SUV AC',
    icon: Suv,
    description: 'Premium with AC',
    baseRate: '₹28/km',
  },
];

export default function VehicleSelector({ selectedVehicle, onVehicleSelect }: VehicleSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Vehicle Type</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {vehicles.map((vehicle) => {
          const isSelected = selectedVehicle === vehicle.type;
          return (
            <TouchableOpacity
              key={vehicle.type}
              style={[
                styles.vehicleCard,
                isSelected && styles.selectedVehicleCard,
              ]}
              onPress={() => onVehicleSelect(vehicle.type)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconContainer,
                isSelected && styles.selectedIconContainer,
              ]}>
                <vehicle.icon 
                  size={24} 
                  color={isSelected ? '#FFFFFF' : '#6B7280'} 
                />
              </View>
              <Text style={[
                styles.vehicleName,
                isSelected && styles.selectedVehicleName,
              ]}>
                {vehicle.name}
              </Text>
              <Text style={[
                styles.vehicleDescription,
                isSelected && styles.selectedVehicleDescription,
              ]}>
                {vehicle.description}
              </Text>
              <Text style={[
                styles.vehicleRate,
                isSelected && styles.selectedVehicleRate,
              ]}>
                {vehicle.baseRate}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  scrollContainer: {
    paddingHorizontal: 0,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 120,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  selectedVehicleCard: {
    borderColor: '#2563EB',
    backgroundColor: '#2563EB',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  vehicleName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  selectedVehicleName: {
    color: '#FFFFFF',
  },
  vehicleDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  selectedVehicleDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  vehicleRate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  selectedVehicleRate: {
    color: '#FFFFFF',
  },
});