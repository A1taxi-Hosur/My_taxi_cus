import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Platform } from 'react-native';
import { Car } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';

interface AnimatedDriverMarkerProps {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  isMoving?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function AnimatedDriverMarker({
  latitude,
  longitude,
  heading = 0,
  speed = 0,
  isMoving = false,
}: AnimatedDriverMarkerProps) {
  const rotationAnim = useRef(new Animated.Value(heading)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.timing(rotationAnim, {
      toValue: heading,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [heading]);

  useEffect(() => {
    if (isMoving) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.5,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.3,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    }
  }, [isMoving]);

  useEffect(() => {
    if (speed > 0) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [latitude, longitude]);

  const rotation = rotationAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.pulseContainer,
          {
            transform: [{ scale: pulseAnim }],
            opacity: pulseOpacity,
          },
        ]}
      >
        <Svg height="80" width="80" style={styles.pulseSvg}>
          <Circle
            cx="40"
            cy="40"
            r="30"
            fill="#2563EB"
            fillOpacity="0.2"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          styles.markerContainer,
          {
            transform: [{ rotate: rotation }, { scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.carIcon}>
          <Car size={28} color="#FFFFFF" strokeWidth={2.5} />
        </View>

        <View style={styles.directionIndicator} />
      </Animated.View>

      <View style={styles.shadowContainer}>
        <View style={styles.shadow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseSvg: {
    position: 'absolute',
  },
  markerContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  carIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  directionIndicator: {
    position: 'absolute',
    top: -5,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#2563EB',
  },
  shadowContainer: {
    position: 'absolute',
    bottom: -10,
    zIndex: 1,
  },
  shadow: {
    width: 40,
    height: 8,
    borderRadius: 20,
    backgroundColor: '#000000',
    opacity: 0.2,
  },
});
