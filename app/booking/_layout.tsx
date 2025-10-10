import { Stack } from 'expo-router';

export default function BookingLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="rental" 
        options={{ 
          title: 'Rental Booking',
          headerBackTitle: 'Back',
        }} 
      />
      <Stack.Screen 
        name="outstation" 
        options={{ 
          title: 'Outstation Booking',
          headerBackTitle: 'Back',
        }} 
      />
      <Stack.Screen 
        name="airport" 
        options={{ 
          title: 'Airport Booking',
          headerBackTitle: 'Back',
        }} 
      />
      <Stack.Screen 
      name="driver-search" 
      options={{ 
        title: 'Finding Driver',
        headerBackTitle: 'Back',
        headerShown: false,
      }} 
    />
    </Stack>
  );
}