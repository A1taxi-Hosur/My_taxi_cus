import { Ride } from '../types/database';

interface BillData {
  ride: Ride & {
    drivers?: {
      users: { full_name: string; phone_number: string };
      vehicles: { make: string; model: string; registration_number: string; color: string };
    };
  };
  fareBreakdown: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    surgeFare: number;
    totalFare: number;
    distance: number;
    duration: number;
  };
}

class BillService {
  generateBillHTML(billData: BillData): string {
    const { ride, fareBreakdown } = billData;
    const currentDate = new Date().toLocaleDateString('en-IN');
    const rideDate = new Date(ride.created_at).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>TaxiBook - Ride Bill #${ride.ride_code}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8fafc;
            color: #1f2937;
        }
        .bill-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .tagline {
            font-size: 14px;
            opacity: 0.9;
        }
        .bill-info {
            padding: 30px;
        }
        .bill-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
        }
        .bill-title {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
        }
        .bill-code {
            font-size: 18px;
            font-weight: 600;
            color: #2563eb;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f3f4f6;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            padding: 8px 0;
        }
        .info-label {
            color: #6b7280;
            font-weight: 500;
        }
        .info-value {
            color: #1f2937;
            font-weight: 600;
        }
        .location-item {
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
            border-left: 4px solid #2563eb;
        }
        .location-label {
            font-size: 12px;
            color: #6b7280;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .location-text {
            color: #1f2937;
            font-weight: 500;
        }
        .fare-breakdown {
            background: #f0f9ff;
            border-radius: 8px;
            padding: 20px;
            border: 1px solid #e0f2fe;
        }
        .fare-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 5px 0;
        }
        .fare-total {
            border-top: 2px solid #2563eb;
            padding-top: 15px;
            margin-top: 15px;
            font-size: 18px;
            font-weight: bold;
        }
        .fare-total .fare-value {
            color: #059669;
            font-size: 20px;
        }
        .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .status-completed {
            background: #d1fae5;
            color: #059669;
        }
        .status-cancelled {
            background: #fee2e2;
            color: #dc2626;
        }
        .footer {
            background: #f9fafb;
            padding: 20px 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }
        .footer-text {
            color: #6b7280;
            font-size: 14px;
            margin-bottom: 5px;
        }
        .company-info {
            color: #9ca3af;
            font-size: 12px;
        }
        @media print {
            body { background: white; }
            .bill-container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="bill-container">
        <div class="header">
            <div class="logo">🚗 TaxiBook</div>
            <div class="tagline">Your Trusted Ride Partner</div>
        </div>
        
        <div class="bill-info">
            <div class="bill-header">
                <div class="bill-title">Ride Bill</div>
                <div class="bill-code">#${ride.ride_code}</div>
            </div>
            
            <div class="section">
                <div class="section-title">Trip Information</div>
                <div class="info-row">
                    <span class="info-label">Date & Time:</span>
                    <span class="info-value">${rideDate}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Booking Type:</span>
                    <span class="info-value">${ride.booking_type.charAt(0).toUpperCase() + ride.booking_type.slice(1)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Vehicle Type:</span>
                    <span class="info-value">${ride.vehicle_type.charAt(0).toUpperCase() + ride.vehicle_type.slice(1)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Status:</span>
                    <span class="status-badge status-${ride.status}">${ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}</span>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Trip Details</div>
                <div class="location-item">
                    <div class="location-label">PICKUP LOCATION</div>
                    <div class="location-text">${ride.pickup_address}</div>
                </div>
                ${ride.destination_address ? `
                <div class="location-item">
                    <div class="location-label">DESTINATION</div>
                    <div class="location-text">${ride.destination_address}</div>
                </div>
                ` : ''}
                ${fareBreakdown.distance > 0 ? `
                <div class="info-row">
                    <span class="info-label">Distance:</span>
                    <span class="info-value">${fareBreakdown.distance.toFixed(1)} km</span>
                </div>
                ` : ''}
                ${fareBreakdown.duration > 0 ? `
                <div class="info-row">
                    <span class="info-label">Duration:</span>
                    <span class="info-value">${Math.round(fareBreakdown.duration)} minutes</span>
                </div>
                ` : ''}
            </div>
            
            ${ride.drivers ? `
            <div class="section">
                <div class="section-title">Driver Information</div>
                <div class="info-row">
                    <span class="info-label">Driver Name:</span>
                    <span class="info-value">${ride.drivers.users.full_name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Phone:</span>
                    <span class="info-value">${ride.drivers.users.phone_number || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Vehicle:</span>
                    <span class="info-value">${ride.drivers.vehicles.make} ${ride.drivers.vehicles.model}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Registration:</span>
                    <span class="info-value">${ride.drivers.vehicles.registration_number}</span>
                </div>
            </div>
            ` : ''}
            
            <div class="section">
                <div class="section-title">Fare Breakdown</div>
                <div class="fare-breakdown">
                    <div class="fare-row">
                        <span>Base Fare:</span>
                        <span>₹${fareBreakdown.baseFare}</span>
                    </div>
                    ${fareBreakdown.distanceFare > 0 ? `
                    <div class="fare-row">
                        <span>Distance Fare (${fareBreakdown.distance > 4 ? `${(fareBreakdown.distance - 4).toFixed(1)} km beyond base 4km` : `${fareBreakdown.distance.toFixed(1)} km covered by base fare`}):</span>
                        <span>₹${fareBreakdown.distanceFare}</span>
                    </div>
                    ` : ''}
                    ${fareBreakdown.timeFare > 0 ? `
                    <div class="fare-row">
                        <span>Time Fare (${Math.round(fareBreakdown.duration)} min):</span>
                        <span>₹${fareBreakdown.timeFare}</span>
                    </div>
                    ` : ''}
                    ${fareBreakdown.surgeFare > 0 ? `
                    <div class="fare-row">
                        <span>Surge Charges:</span>
                        <span>₹${fareBreakdown.surgeFare}</span>
                    </div>
                    ` : ''}
                    <div class="fare-row fare-total">
                        <span>Total Amount:</span>
                        <span class="fare-value">₹${fareBreakdown.totalFare}</span>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">Payment Information</div>
                <div class="info-row">
                    <span class="info-label">Payment Method:</span>
                    <span class="info-value">${ride.payment_method?.charAt(0).toUpperCase() + ride.payment_method?.slice(1) || 'Cash'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Payment Status:</span>
                    <span class="info-value">${ride.payment_status?.charAt(0).toUpperCase() + ride.payment_status?.slice(1) || 'Pending'}</span>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-text">Thank you for choosing TaxiBook!</div>
            <div class="company-info">Generated on ${currentDate} | TaxiBook Customer Service</div>
        </div>
    </div>
</body>
</html>`;
  }

  calculateFareBreakdown(ride: any): {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    surgeFare: number;
    totalFare: number;
    distance: number;
    duration: number;
  } {
    // If we have actual fare breakdown data, use it
    if (ride.fare_breakdown) {
      return ride.fare_breakdown;
    }

    // Otherwise, estimate breakdown from total fare
    const totalFare = ride.fare_amount || 0;
    const distance = ride.distance_km || 0;
    const duration = ride.duration_minutes || 0;

    console.log('📄 Calculating fare breakdown for bill from stored ride data:', {
      totalFare,
      distance,
      duration,
      vehicle_type: ride.vehicle_type,
      booking_type: ride.booking_type
    });

    // If we have actual distance and duration from database, calculate more accurately
    if (distance > 0 && duration > 0) {
      // Use proportional breakdown based on stored values
      const baseFarePercent = 0.3; // 30% base fare
      const distanceFarePercent = 0.5; // 50% distance fare
      const timeFarePercent = 0.15; // 15% time fare
      const surgeFarePercent = 0.05; // 5% surge/other charges
      
      const estimatedBaseFare = totalFare * baseFarePercent;
      const estimatedDistanceFare = totalFare * distanceFarePercent;
      const estimatedTimeFare = totalFare * timeFarePercent;
      const estimatedSurgeFare = totalFare * surgeFarePercent;
      
      console.log('📄 Using proportional breakdown for bill based on stored data');
      
      return {
        baseFare: Math.round(estimatedBaseFare),
        distanceFare: Math.round(estimatedDistanceFare),
        timeFare: Math.round(estimatedTimeFare),
        surgeFare: Math.round(estimatedSurgeFare),
        totalFare: totalFare,
        distance: distance,
        duration: duration,
      };
    }

    // Fallback estimation if no distance/duration data
    console.log('⚠️ No distance/duration data for bill, using estimation fallback');
    
    // Get base rates for estimation (these should match fare_matrix table defaults)
    let baseFare = 50;
    let perKmRate = 15;
    let perMinRate = 2;

    // Estimate based on vehicle type (should match fare_matrix defaults)
    switch (ride.vehicle_type) {
      case 'hatchback':
        baseFare = 50;
        perKmRate = 12;
        break;
      case 'hatchback_ac':
        baseFare = 60;
        perKmRate = 15;
        break;
      case 'sedan':
        baseFare = 60;
        perKmRate = 15;
        break;
      case 'sedan_ac':
        baseFare = 70;
        perKmRate = 18;
        break;
      case 'suv':
        baseFare = 80;
        perKmRate = 18;
        break;
      case 'suv_ac':
        baseFare = 100;
        perKmRate = 22;
        break;
    }

    // Adjust for booking type
    if (ride.booking_type === 'airport') {
      baseFare *= 3;
      perKmRate *= 1.8;
    } else if (ride.booking_type === 'outstation') {
      baseFare *= 2;
      perKmRate *= 1.5;
    }

    // If we have distance but no breakdown, estimate
    const estimatedDistanceFare = distance > 0 ? distance * perKmRate : totalFare * 0.5;
    const estimatedTimeFare = duration > 0 ? duration * perMinRate : totalFare * 0.15;
    const estimatedBaseFare = Math.min(baseFare, totalFare * 0.3);
    const estimatedSurgeFare = Math.max(0, totalFare - estimatedBaseFare - estimatedDistanceFare - estimatedTimeFare);

    return {
      baseFare: Math.round(estimatedBaseFare),
      distanceFare: Math.round(estimatedDistanceFare),
      timeFare: Math.round(estimatedTimeFare),
      surgeFare: Math.round(estimatedSurgeFare),
      totalFare: totalFare,
      distance: distance,
      duration: duration,
    };
  }

  async downloadBill(ride: any): Promise<void> {
    try {
      console.log('📄 Generating bill for ride:', ride.ride_code);
      
      const fareBreakdown = this.calculateFareBreakdown(ride);
      const billData: BillData = { ride, fareBreakdown };
      
      const htmlContent = this.generateBillHTML(billData);
      
      // Create blob and download
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `TaxiBook_Bill_${ride.ride_code}_${new Date().toISOString().split('T')[0]}.html`;
      link.download = `A1Taxi_Bill_${ride.ride_code}_${new Date().toISOString().split('T')[0]}.html`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      console.log('✅ Bill downloaded successfully');
    } catch (error) {
      console.error('❌ Error downloading bill:', error);
      throw error;
    }
  }

  async printBill(ride: any): Promise<void> {
    try {
      console.log('🖨️ Opening print dialog for ride:', ride.ride_code);
      
      const fareBreakdown = this.calculateFareBreakdown(ride);
      const billData: BillData = { ride, fareBreakdown };
      
      const htmlContent = this.generateBillHTML(billData);
      
      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        
        // Wait for content to load then print
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
      
      console.log('✅ Print dialog opened successfully');
    } catch (error) {
      console.error('❌ Error printing bill:', error);
      throw error;
    }
  }
}

export const billService = new BillService();