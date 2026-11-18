export const darkColors = {
  background: '#101816',
  surface: '#19231F',
  surfaceElevated: '#222E28',
  primary: '#B8F36B',
  routeGuide: '#9BCBFF',
  textPrimary: '#F4F7F2',
  textSecondary: '#929D95',
  border: '#303C35',
  error: '#FF6868',
  success: '#79D69A',
} as const;

export type Palette = { [Key in keyof typeof darkColors]: string };

export const lightColors: Palette = {
  background: '#F5F8F2',
  surface: '#FFFFFF',
  surfaceElevated: '#E7EFE3',
  primary: '#316220',
  routeGuide: '#225B91',
  textPrimary: '#18251A',
  textSecondary: '#4D6050',
  border: '#C9D8C7',
  error: '#A3292C',
  success: '#286747',
};
