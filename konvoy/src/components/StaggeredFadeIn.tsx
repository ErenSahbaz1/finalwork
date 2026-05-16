import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";

interface StaggeredFadeInProps {
	children: React.ReactNode;
	index: number;
	style?: ViewStyle | ViewStyle[];
	duration?: number;
	delayStep?: number;
}

export function StaggeredFadeIn({
	children,
	index,
	style,
	duration = 250,
	delayStep = 50,
}: StaggeredFadeInProps) {
	const opacity = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.timing(opacity, {
			toValue: 1,
			duration,
			delay: index * delayStep,
			useNativeDriver: true,
		}).start();
	}, [delayStep, duration, index, opacity]);

	return <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>;
}
