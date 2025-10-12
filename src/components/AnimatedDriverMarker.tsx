import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Car } from 'lucide-react-native';

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
            fill="#FFA500"
            fillOpacity="0.3"
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
        <View style={styles.carImageContainer}>
          <Car color="#FFFFFF" size={32} strokeWidth={2} />
        </View>
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
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  carImageContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carImage: {
    width: 60,
    height: 60,
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
