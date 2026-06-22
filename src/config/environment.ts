export const ENV = {
  DEBUG: process.env.NODE_ENV !== 'production',
  API_URL: process.env.EXPO_PUBLIC_API_URL ?? '',
};

export default ENV;
