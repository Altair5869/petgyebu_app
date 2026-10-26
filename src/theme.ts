// Shared warm palette. Pet status gauges and social login brands keep their own colors.
export const colors = {
  background: '#FBF8F3',
  surface: '#FFFFFF',
  primary: '#765344',
  text: '#382D28',
  muted: '#786B63',
  secondary: '#F7E6D8',
  border: '#E7DCD3',
  disabled: '#C8BBB1',
  danger: '#B64236',
} as const;

export const contentWidth = {
  width: '100%',
  maxWidth: 560,
  alignSelf: 'center',
} as const;

// Explicit faces avoid platform-dependent synthetic weights.
export const fonts = {
  regular: 'LINESeedKR-Regular',
  bold: 'LINESeedKR-Bold',
} as const;
