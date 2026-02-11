/**
 * Environment configuration
 */

export const ENV = {
  // Add your environment variables here
  DEBUG: true,
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
};

export default ENV;
