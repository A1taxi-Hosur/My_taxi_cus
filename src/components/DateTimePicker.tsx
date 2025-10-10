import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Calendar, Clock, ChevronDown, X } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

interface DateTimePickerProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
}

export default function DateTimePicker({ 
  label, 
  value, 
  onChange, 
  minimumDate 
}: DateTimePickerProps) {
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(value);
  const [selectedHour, setSelectedHour] = useState(value.getHours() % 12 || 12);
  const [selectedMinute, setSelectedMinute] = useState(Math.floor(value.getMinutes() / 15) * 15);
  const [selectedPeriod, setSelectedPeriod] = useState(value.getHours() >= 12 ? 'PM' : 'AM');

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (isSameDay(date, today)) {
      return 'Today';
    } else if (isSameDay(date, tomorrow)) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const generateDateOptions = () => {
    const options = [];
    const startDate = minimumDate || new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      options.push(date);
    }
    
    return options;
  };

  const generateHours = () => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  };

  const generateMinutes = () => {
    return [0, 15, 30, 45];
  };

  const handleConfirm = () => {
    const newDate = new Date(selectedDate);
    let hour = selectedHour;
    
    if (selectedPeriod === 'PM' && hour !== 12) {
      hour += 12;
    } else if (selectedPeriod === 'AM' && hour === 12) {
      hour = 0;
    }
    
    newDate.setHours(hour, selectedMinute, 0, 0);
    onChange(newDate);
    setShowDateTimePicker(false);
  };

  const openPicker = () => {
    // Initialize picker with current value
    setSelectedDate(value);
    setSelectedHour(value.getHours() % 12 || 12);
    setSelectedMinute(Math.floor(value.getMinutes() / 15) * 15);
    setSelectedPeriod(value.getHours() >= 12 ? 'PM' : 'AM');
    setShowDateTimePicker(true);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          style={styles.inputContainer}
          onPress={openPicker}
          activeOpacity={0.7}
        >
          <Calendar size={20} color="#6B7280" />
          <View style={styles.dateTimeDisplay}>
            <Text style={styles.dateText}>{formatDate(value)}</Text>
            <Text style={styles.timeText}>{formatTime(value)}</Text>
          </View>
          <ChevronDown size={16} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Custom Wheel Picker Modal */}
        <Modal
          visible={showDateTimePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDateTimePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowDateTimePicker(false)}
                >
                  <X size={24} color="#1F2937" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                  <Text style={styles.modalTitle}>Schedule one-way ride</Text>
                  <Text style={styles.modalSubtitle}>
                    Ride can be scheduled up to 10 Days in Advance
                  </Text>
                </View>
                <View style={styles.placeholder} />
              </View>
              
              <View style={styles.wheelContainer}>
                {/* Date Wheel */}
                <View style={styles.wheelSection}>
                  <ScrollView 
                    style={styles.wheel}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={60}
                    decelerationRate="fast"
                    contentContainerStyle={styles.wheelContent}
                  >
                    {generateDateOptions().map((date, index) => {
                      const isSelected = isSameDay(date, selectedDate);
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.wheelItem,
                            isSelected && styles.selectedWheelItem
                          ]}
                          onPress={() => setSelectedDate(date)}
                        >
                          <Text style={[
                            styles.wheelItemText,
                            isSelected && styles.selectedWheelText
                          ]}>
                            {date.getDate().toString().padStart(2, '0')}
                          </Text>
                          <Text style={[
                            styles.wheelItemText,
                            isSelected && styles.selectedWheelText
                          ]}>
                            {date.toLocaleDateString('en-US', { month: 'short' })}
                          </Text>
                          <Text style={[
                            styles.wheelItemText,
                            isSelected && styles.selectedWheelText
                          ]}>
                            {date.getFullYear()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Hour Wheel */}
                <View style={styles.wheelSection}>
                  <ScrollView 
                    style={styles.wheel}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={60}
                    decelerationRate="fast"
                    contentContainerStyle={styles.wheelContent}
                  >
                    {generateHours().map((hour) => {
                      const isSelected = hour === selectedHour;
                      return (
                        <TouchableOpacity
                          key={hour}
                          style={[
                            styles.wheelItem,
                            isSelected && styles.selectedWheelItem
                          ]}
                          onPress={() => setSelectedHour(hour)}
                        >
                          <Text style={[
                            styles.wheelItemText,
                            isSelected && styles.selectedWheelText
                          ]}>
                            {hour.toString().padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Minute Wheel */}
                <View style={styles.wheelSection}>
                  <ScrollView 
                    style={styles.wheel}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={60}
                    decelerationRate="fast"
                    contentContainerStyle={styles.wheelContent}
                  >
                    {generateMinutes().map((minute) => {
                      const isSelected = minute === selectedMinute;
                      return (
                        <TouchableOpacity
                          key={minute}
                          style={[
                            styles.wheelItem,
                            isSelected && styles.selectedWheelItem
                          ]}
                          onPress={() => setSelectedMinute(minute)}
                        >
                          <Text style={[
                            styles.wheelItemText,
                            isSelected && styles.selectedWheelText
                          ]}>
                            {minute.toString().padStart(2, '0')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* AM/PM Wheel */}
                <View style={styles.wheelSection}>
                  <ScrollView 
                    style={styles.wheel}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={60}
                    decelerationRate="fast"
                    contentContainerStyle={styles.wheelContent}
                  >
                    {['AM', 'PM'].map((period) => {
                      const isSelected = period === selectedPeriod;
                      return (
                        <TouchableOpacity
                          key={period}
                          style={[
                            styles.wheelItem,
                            isSelected && styles.selectedWheelItem
                          ]}
                          onPress={() => setSelectedPeriod(period)}
                        >
                          <Text style={[
                            styles.wheelItemText,
                            isSelected && styles.selectedWheelText
                          ]}>
                            {period}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              {/* Confirm Button */}
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Mobile platform - use the wheel picker for all platforms
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      
      <TouchableOpacity
        style={styles.inputContainer}
        onPress={openPicker}
        activeOpacity={0.7}
      >
        <Calendar size={20} color="#6B7280" />
        <View style={styles.dateTimeDisplay}>
          <Text style={styles.dateText}>{formatDate(value)}</Text>
          <Text style={styles.timeText}>{formatTime(value)}</Text>
        </View>
        <ChevronDown size={16} color="#9CA3AF" />
      </TouchableOpacity>

      {/* Wheel Picker Modal */}
      <Modal
        visible={showDateTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDateTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowDateTimePicker(false)}
              >
                <X size={24} color="#1F2937" />
              </TouchableOpacity>
              <View style={styles.headerContent}>
                <Text style={styles.modalTitle}>Schedule one-way ride</Text>
                <Text style={styles.modalSubtitle}>
                  Ride can be scheduled up to 10 Days in Advance
                </Text>
              </View>
              <View style={styles.placeholder} />
            </View>
            
            <View style={styles.wheelContainer}>
              {/* Date Wheel */}
              <View style={styles.wheelSection}>
                <ScrollView 
                  style={styles.wheel}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={60}
                  decelerationRate="fast"
                  contentContainerStyle={styles.wheelContent}
                >
                  {generateDateOptions().map((date, index) => {
                    const isSelected = isSameDay(date, selectedDate);
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.wheelItem,
                          isSelected && styles.selectedWheelItem
                        ]}
                        onPress={() => setSelectedDate(date)}
                      >
                        <Text style={[
                          styles.wheelItemText,
                          isSelected && styles.selectedWheelText
                        ]}>
                          {date.getDate().toString().padStart(2, '0')}
                        </Text>
                        <Text style={[
                          styles.wheelItemText,
                          isSelected && styles.selectedWheelText
                        ]}>
                          {date.toLocaleDateString('en-US', { month: 'short' })}
                        </Text>
                        <Text style={[
                          styles.wheelItemText,
                          isSelected && styles.selectedWheelText
                        ]}>
                          {date.getFullYear()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Hour Wheel */}
              <View style={styles.wheelSection}>
                <ScrollView 
                  style={styles.wheel}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={60}
                  decelerationRate="fast"
                  contentContainerStyle={styles.wheelContent}
                >
                  {generateHours().map((hour) => {
                    const isSelected = hour === selectedHour;
                    return (
                      <TouchableOpacity
                        key={hour}
                        style={[
                          styles.wheelItem,
                          isSelected && styles.selectedWheelItem
                        ]}
                        onPress={() => setSelectedHour(hour)}
                      >
                        <Text style={[
                          styles.wheelItemText,
                          isSelected && styles.selectedWheelText
                        ]}>
                          {hour.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Minute Wheel */}
              <View style={styles.wheelSection}>
                <ScrollView 
                  style={styles.wheel}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={60}
                  decelerationRate="fast"
                  contentContainerStyle={styles.wheelContent}
                >
                  {generateMinutes().map((minute) => {
                    const isSelected = minute === selectedMinute;
                    return (
                      <TouchableOpacity
                        key={minute}
                        style={[
                          styles.wheelItem,
                          isSelected && styles.selectedWheelItem
                        ]}
                        onPress={() => setSelectedMinute(minute)}
                      >
                        <Text style={[
                          styles.wheelItemText,
                          isSelected && styles.selectedWheelText
                        ]}>
                          {minute.toString().padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* AM/PM Wheel */}
              <View style={styles.wheelSection}>
                <ScrollView 
                  style={styles.wheel}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={60}
                  decelerationRate="fast"
                  contentContainerStyle={styles.wheelContent}
                >
                  {['AM', 'PM'].map((period) => {
                    const isSelected = period === selectedPeriod;
                    return (
                      <TouchableOpacity
                        key={period}
                        style={[
                          styles.wheelItem,
                          isSelected && styles.selectedWheelItem
                        ]}
                        onPress={() => setSelectedPeriod(period)}
                      >
                        <Text style={[
                          styles.wheelItemText,
                          isSelected && styles.selectedWheelText
                        ]}>
                          {period}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Confirm Button */}
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  dateTimeDisplay: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  dateText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  timeText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  placeholder: {
    width: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  wheelContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 40,
    justifyContent: 'space-between',
    minHeight: 300,
  },
  wheelSection: {
    flex: 1,
    marginHorizontal: 8,
  },
  wheel: {
    height: 240,
  },
  wheelContent: {
    paddingVertical: 90,
  },
  wheelItem: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  selectedWheelItem: {
    backgroundColor: 'transparent',
  },
  wheelItemText: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
  },
  selectedWheelText: {
    color: '#1F2937',
    fontWeight: 'bold',
    fontSize: 20,
  },
  confirmButton: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 18,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});