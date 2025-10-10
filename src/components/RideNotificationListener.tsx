import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRideNotifications } from '../hooks/useRideNotifications';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RideNotificationListener() {
  const { user } = useAuth();
  const { notifications } = useRideNotifications();
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Skip notification listeners on web
      return;
    }

    // Handle notification received while app is in foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Notification received in foreground:', notification);
    });

    // Handle notification tapped
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', response);
      
      const notificationData = response.notification.request.content.data;
      
      // Navigate based on notification type
      if (notificationData?.rideId) {
        switch (notificationData.type) {
          case 'ride_accepted':
          case 'driver_arrived':
          case 'trip_started':
            router.push('/(tabs)/rides');
            break;
          case 'trip_completed':
            // Don't navigate - let the modal handle it
            break;
          case 'ride_cancelled':
            router.push('/(tabs)');
            break;
        }
      }
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  // This component doesn't render anything - it just handles notifications
  return null;
}