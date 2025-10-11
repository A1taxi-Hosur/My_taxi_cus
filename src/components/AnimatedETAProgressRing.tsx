import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Clock } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

interface AnimatedETAProgressRingProps {
  etaMinutes: number;
  maxETA?: number;
  size?: number;
  strokeWidth?: number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function AnimatedETAProgressRing({
  etaMinutes,
  maxETA = 30,
  size = 120,
  strokeWidth = 8,
}: AnimatedETAProgressRingProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  useEffect(() => {
    fadeAnim.setValue(0);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1.1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    });
  }, [etaMinutes]);

  useEffect(() => {
    const progress = Math.max(0, Math.min(1, 1 - etaMinutes / maxETA));

    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [etaMinutes, maxETA]);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const getColorByETA = () => {
    if (etaMinutes <= 2) return ['#10B981', '#059669'];
    if (etaMinutes <= 5) return ['#F59E0B', '#D97706'];
    return ['#2563EB', '#1D4ED8'];
  };

  const colors = getColorByETA();
  const textColor = etaMinutes <= 2 ? '#059669' : etaMinutes <= 5 ? '#D97706' : '#2563EB';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: scaleAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.svgContainer}>
        <Svg width={size} height={size} style={styles.svg}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
            fill="none"
          />

          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors[0]}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>

        <View style={styles.contentContainer}>
          <LinearGradient
            colors={colors}
            style={styles.iconContainer}
          >
            <Clock size={20} color="#FFFFFF" strokeWidth={2.5} />
          </LinearGradient>

          <Text style={[styles.etaNumber, { color: textColor }]}>
            {etaMinutes}
          </Text>
          <Text style={styles.etaLabel}>min</Text>
        </View>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {etaMinutes <= 1 ? 'Almost there!' :
           etaMinutes <= 3 ? 'Arriving soon' :
           'On the way'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    transform: [{ rotate: '0deg' }],
  },
  contentContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  etaNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  etaLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: -2,
  },
  statusContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});
