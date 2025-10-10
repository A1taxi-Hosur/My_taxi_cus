import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { notificationService } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  status: 'unread' | 'read' | 'cancelled';
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // Initialize notifications for this user (mobile only)
      if (Platform.OS !== 'web') {
        notificationService.initialize(user.id);
      }
      
      // Fetch existing notifications
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await notificationService.getNotifications(user.id);
      if (error) {
        console.warn('Could not fetch notifications - this is expected if Supabase is not configured:', error);
        return;
      }
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => n.status === 'unread').length);
      }
    } catch (error) {
      console.warn('Could not fetch notifications - this is expected if Supabase is not configured:', error);
    }
    setLoading(false);
  };

  const markAsRead = async (notificationId: string) => {
    await notificationService.markAsRead(notificationId);
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId 
          ? { ...n, status: 'read' as const }
          : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => n.status === 'unread');
    
    for (const notification of unreadNotifications) {
      await notificationService.markAsRead(notification.id);
    }
    
    setNotifications(prev => 
      prev.map(n => ({ ...n, status: 'read' as const }))
    );
    setUnreadCount(0);
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