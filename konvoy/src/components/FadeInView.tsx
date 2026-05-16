import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";

interface FadeInViewProps {
	children: React.ReactNode;
	style?: ViewStyle | ViewStyle[];
	duration?: number;
}

export function FadeInView({
	children,
	style,
	duration = 300,
}: FadeInViewProps) {
	const opacity = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.timing(opacity, {
			toValue: 1,
			duration,
			useNativeDriver: true,
		}).start();
	}, [duration, opacity]);

	return <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>;
}
