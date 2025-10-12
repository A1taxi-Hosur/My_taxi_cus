export const realtimeService = {
  subscribeToRide(rideId: string, callback: (ride: any) => void) {
    return { unsubscribe: () => {} };
  },
  subscribeToBooking(bookingId: string, callback: (booking: any) => void) {
    return { unsubscribe: () => {} };
  },
  subscribeToDriverLocation(driverUserId: string, callback: (location: any) => void) {
    return { unsubscribe: () => {} };
  },
};
