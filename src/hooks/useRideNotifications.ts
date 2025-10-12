import { useState } from 'react';

export function useRideNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);

  const markAsRead = (notificationId: string) => {};

  return { notifications, markAsRead };
}
