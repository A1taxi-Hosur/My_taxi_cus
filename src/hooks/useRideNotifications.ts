import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthContext';
import { realtimeService } from '../services/realtimeService';

export interface RideNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  status: 'unread' | 'read' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export function useRideNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<RideNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Subscribe to new notifications
      const subscription = realtimeService.subscribeToNotifications(user.id, (newNotification) => {
        setNotifications(prev => {
          // Check if notification already exists
          const exists = prev.find(n => n.id === newNotification.id);
          if (exists) {
            return prev.map(n => n.id === newNotification.id ? newNotification : n);
          }
          
          return [newNotification, ...prev];
        });
        
        // Update unread count
        if (newNotification.status === 'unread') {
          setUnreadCount(prev => prev + 1);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    console.log('🔍 [NOTIFICATIONS] ===== FETCHING NOTIFICATIONS =====');
    console.log('🔍 [NOTIFICATIONS] User ID:', user.id);
    console.log('🔍 [NOTIFICATIONS] Timestamp:', new Date().toISOString());

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      console.log('🔍 [NOTIFICATIONS] ===== DATABASE QUERY RESULT =====');
      console.log('🔍 [NOTIFICATIONS] Query result:', {
        hasError: !!error,
        errorMessage: error?.message,
        errorCode: error?.code,
        errorDetails: error?.details,
        dataCount: data?.length || 0,
        tripCompletedCount: data?.filter(n => n.type === 'trip_completed').length || 0,
        unreadTripCompletedCount: data?.filter(n => n.type === 'trip_completed' && n.status === 'unread').length || 0,
        allTypes: data ? [...new Set(data.map(n => n.type))] : [],
        recentNotifications: data?.slice(0, 5).map(n => ({
          id: n.id,
          type: n.type,
          status: n.status,
          title: n.title,
          created_at: n.created_at,
          age_seconds: Math.round((Date.now() - new Date(n.created_at).getTime()) / 1000)
        })) || []
      });

      if (error) {
        console.error('❌ [NOTIFICATIONS] Error fetching notifications:', error);
        console.error('❌ [NOTIFICATIONS] Full error object:', JSON.stringify(error, null, 2));
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      if (data) {
        console.log('✅ [NOTIFICATIONS] ===== SETTING NOTIFICATIONS IN STATE =====');
        console.log('✅ [NOTIFICATIONS] Notifications to set:', {
          total: data.length,
          tripCompleted: data.filter(n => n.type === 'trip_completed').length,
          unreadTripCompleted: data.filter(n => n.type === 'trip_completed' && n.status === 'unread').length,
          allNotificationIds: data.map(n => n.id),
          tripCompletedNotificationIds: data.filter(n => n.type === 'trip_completed').map(n => n.id),
          unreadTripCompletedNotificationIds: data.filter(n => n.type === 'trip_completed' && n.status === 'unread').map(n => n.id)
        });
        
        setNotifications(data);
        setUnreadCount(data.filter(n => n.status === 'unread').length);
        
        console.log('✅ [NOTIFICATIONS] ===== CHECKING FOR IMMEDIATE TRIP COMPLETION =====');
        const immediateCompletion = data.find(n => n.type === 'trip_completed' && n.status === 'unread');
        if (immediateCompletion) {
          console.log('🏁 [NOTIFICATIONS] ===== FOUND IMMEDIATE TRIP COMPLETION =====');
          console.log('🏁 [NOTIFICATIONS] Notification details:', {
            id: immediateCompletion.id,
            title: immediateCompletion.title,
            message: immediateCompletion.message,
            created_at: immediateCompletion.created_at,
            data_keys: Object.keys(immediateCompletion.data || {}),
            has_fare_breakdown: !!immediateCompletion.data?.driverAppFareBreakdown,
            ride_id: immediateCompletion.data?.rideId,
            booking_id: immediateCompletion.data?.bookingId
          });
        } else {
          console.log('❌ [NOTIFICATIONS] No immediate trip completion notifications found');
          console.log('❌ [NOTIFICATIONS] Available notification types:', data.map(n => n.type));
          console.log('❌ [NOTIFICATIONS] Trip completed notifications (all statuses):', 
            data.filter(n => n.type === 'trip_completed').map(n => ({
              id: n.id,
              status: n.status,
              created_at: n.created_at
            }))
          );
        }
      } else {
        console.log('⚠️ [NOTIFICATIONS] No data returned from query');
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] Exception fetching notifications:', error);
      console.error('❌ [NOTIFICATIONS] Exception details:', JSON.stringify(error, null, 2));
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          status: 'read',
          updated_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) {
        return;
      }

      // Update local state immediately
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, status: 'read' as const }
            : n
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => n.status === 'unread');
    
    for (const notification of unreadNotifications) {
      await markAsRead(notification.id);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}