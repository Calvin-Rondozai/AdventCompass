export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
};

export const motion = {
  fast: 180,
  base: 260,
  slow: 400,
  stagger: 60,
  springDefault: { damping: 16, mass: 0.9, stiffness: 160 },
  springSnappy: { damping: 14, mass: 0.6, stiffness: 220 },
};

export const shadow = {
  subtle: {
    shadowColor: '#3B0F6B',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  card: {
    shadowColor: '#3B0F6B',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  floating: {
    shadowColor: '#3B0F6B',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
};
