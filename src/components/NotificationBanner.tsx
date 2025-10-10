import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Bell, X, Car, MapPin, Clock, CircleCheck as CheckCircle } from 'lucide-react-native';
import { useNotifications } from '../hooks/useNotifications';

const { width } = Dimensions.get('window');

export default function NotificationBanner() {
  const { notifications, markAsRead } = useNotifications();
  const [currentNotification, setCurrentNotification] = useState<any>(null);
  const [shownNotifications, setShownNotifications] = useState<Set<string>>(new Set());
  const [slideAnim] = useState(new Animated.Value(-100));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show notifications that haven't been shown before and aren't manually dismissed
    console.log('🔔 [BANNER_DEBUG] ===== NOTIFICATION BANNER EFFECT =====');
    const bannerSummary = {
      totalNotifications: notifications.length,
      currentlyVisible: visible,
      currentNotification: currentNotification?.id,
      shownNotificationsCount: shownNotifications.size,
      tripCompletedNotifications: notifications.filter(n => n.type === 'trip_completed').length,
      unreadTripCompleted: notifications.filter(n => n.type === 'trip_completed' && n.status === 'unread').length,
    };
    console.log('🔔 [BANNER_DEBUG] Banner summary:', bannerSummary);
    
    const unreadNotifications = notifications.filter(n => {
      // Skip if already shown or not unread
      if (n.status !== 'unread' || 
          (currentNotification && n.id === currentNotification.id) ||
          shownNotifications.has(n.id)) {
        return false;
      }
      
      // NEVER show trip completion notifications in banner - they should only show in full-screen modal
      if (n.type === 'trip_completed') {
        console.log('🚫 [BANNER_DEBUG] ===== BLOCKING TRIP COMPLETION FROM BANNER =====');
        console.log('🚫 [BANNER_DEBUG] Trip completion notification blocked from banner:', {
          id: n.id,
          title: n.title,
          rideId: n.data?.rideId,
          bookingId: n.data?.bookingId,
          fareAmount: n.data?.fareAmount,
          reason: 'Should show in full-screen modal only'
        });
        return false;
      }
      
      // Skip notifications for completed/cancelled rides or old notifications
      if (n.data?.rideId) {
        // Skip cancellation notifications but show all others including OTP
        if (n.type === 'ride_cancelled') {
          markAsRead(n.id);
          return false;
        }
      }
      
      // Skip old notifications (older than 10 minutes) - increased time for OTP
      const notificationAge = Date.now() - new Date(n.created_at).getTime();
      if (notificationAge > 10 * 60 * 1000) {
        markAsRead(n.id);
        return false;
      }
      
      return true;
    });
    
    console.log('📱 [BANNER_DEBUG] ===== BANNER DISPLAY DECISION =====');
    // Only show new notification if none is currently visible
    if (unreadNotifications.length > 0 && !visible && !currentNotification) {
      const latest = unreadNotifications[0];
      setCurrentNotification(latest);
      setShownNotifications(prev => new Set([...prev, latest.id]));
      showNotification();
    }
  }, [notifications, visible]);

  // Clear current notification when it's marked as read
  useEffect(() => {
    if (currentNotification && 
        notifications.find(n => n.id === currentNotification.id)?.status === 'read') {
      setCurrentNotification(null);
      setVisible(false);
    }
  }, [notifications, currentNotification]);

  const showNotification = () => {
    setVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();

    // Auto-hide after 5 seconds
    setTimeout(() => {
      hideNotification();
    }, 5000);
  };

  const hideNotification = () => {
    // Mark notification as read when manually closed
    if (currentNotification) {
      markAsRead(currentNotification.id);
    }
    
    Animated.spring(slideAnim, {
      toValue: -100,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start(() => {
      setVisible(false);
      setCurrentNotification(null);
    });
  };

  const handleNotificationPress = () => {
    if (currentNotification) {
      markAsRead(currentNotification.id);
      
      // Handle notification action based on type
      switch (currentNotification.type) {
        case 'ride_accepted':
        case 'driver_arrived':
        // Navigate to full screen ride completion
          // Navigate to ride tracking screen
          import('expo-router').then(({ router }) => {
            router.push('/(tabs)/rides');
          });
          break;
        case 'trip_completed':
          // For trip completion, don't navigate - the modal will handle it automatically
          console.log('🎉 [BANNER] Trip completion notification tapped - modal should show automatically');
          break;
      }
      
      hideNotification();
    }
  };

  const getNotificationIcon = () => {
    if (!currentNotification) return <Bell size={20} color="#FFFFFF" />;
    
    switch (currentNotification.type) {
      case 'ride_accepted':
        return <Car size={20} color="#FFFFFF" />;
      case 'driver_arrived':
        return <MapPin size={20} color="#FFFFFF" />;
      case 'trip_started':
        return <Clock size={20} color="#FFFFFF" />;
      case 'pickup_otp':
      case 'drop_otp':
        return <Bell size={20} color="#FFFFFF" />;
      case 'trip_completed':
        return <CheckCircle size={20} color="#FFFFFF" />;
      case 'ride_cancelled':
        return <X size={20} color="#FFFFFF" />;
      case 'admin_booking':
        return <Bell size={20} color="#FFFFFF" />;
      default:
        return <Bell size={20} color="#FFFFFF" />;
    }
  };

  const getNotificationColor = () => {
    if (!currentNotification) return '#2563EB';
    
    switch (currentNotification.type) {
      case 'ride_accepted':
        return '#059669';
      case 'driver_arrived':
        return '#2563EB';
      case 'trip_started':
        return '#7C3AED';
      case 'pickup_otp':
        return '#F59E0B';
      case 'trip_completed':
        return '#059669';
      case 'ride_cancelled':
        return '#DC2626';
      case 'admin_booking':
        return '#F59E0B';
      default:
        return '#2563EB';
    }
  };

  if (!visible || !currentNotification) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: getNotificationColor(),
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={handleNotificationPress}
        activeOpacity={0.9}
      >
        <View style={styles.iconContainer}>
          {getNotificationIcon()}
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {currentNotification.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {currentNotification.message}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.closeButton}
          onPress={hideNotification}
        >
          <X size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});