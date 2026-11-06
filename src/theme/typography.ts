import { fontFamily } from './fonts';

/** Escala tipográfica TRAZA. Encabezados SemiBold/Bold, texto Regular, métricas Bold, etiquetas Medium. */
export const typography = {
  display: { fontFamily: fontFamily.bold, fontSize: 40, lineHeight: 48 },
  title: { fontFamily: fontFamily.semibold, fontSize: 24, lineHeight: 32 },
  subtitle: { fontFamily: fontFamily.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24 },
  bodySmall: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  metricLarge: { fontFamily: fontFamily.bold, fontSize: 32, lineHeight: 40 },
  metricMedium: { fontFamily: fontFamily.bold, fontSize: 24, lineHeight: 32 },
  button: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 24 },
} as const;