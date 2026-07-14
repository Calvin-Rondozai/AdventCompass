import React, { ComponentType, useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

type IconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;

type Props = {
  Icon: IconComponent;
  focused: boolean;
  color: string;
  dotColor: string;
};

export function AnimatedTabIcon({ Icon, focused, color, dotColor }: Props) {
  const scale = useSharedValue(1);
  const dotOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.14 : 1, { damping: 12, stiffness: 220 });
    dotOpacity.value = withTiming(focused ? 1 : 0, { duration: 180 });
  }, [focused, scale, dotOpacity]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <Animated.View style={iconStyle}>
        <Icon size={24} color={color} strokeWidth={focused ? 2.4 : 2} fill={focused ? color : 'transparent'} />
      </Animated.View>
      <Animated.View
        style={[{ width: 4, height: 4, borderRadius: 2, backgroundColor: dotColor }, dotStyle]}
      />
    </View>
  );
}
