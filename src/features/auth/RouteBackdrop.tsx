import { Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '@/theme';

const route = 'M -20 650 C 72 620 108 585 114 518 S 141 437 214 410 S 264 350 286 285 S 367 185 440 130';
const routeLength = 780;
const AnimatedPath = Animated.createAnimatedComponent(Path);

export function RouteBackdrop({ progress }: { progress?: Animated.Value }) {
  return (
    <Svg
      accessible={false}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 420 800"
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        <LinearGradient id="route-ink" x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.22} />
          <Stop offset="100%" stopColor={colors.primary} stopOpacity={0.85} />
        </LinearGradient>
      </Defs>
      <Path d={route} fill="none" stroke={colors.primary} strokeWidth={34} opacity={0.045} />
      <Path d={route} fill="none" stroke={colors.primary} strokeWidth={2} opacity={0.18} />
      {progress && (
        <AnimatedPath
          d={route}
          fill="none"
          stroke="url(#route-ink)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={[routeLength, routeLength]}
          strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [routeLength, 0] })}
        />
      )}
      <Circle cx={286} cy={285} r={5} fill={colors.surface} stroke={colors.primary} opacity={0.45} />
    </Svg>
  );
}
