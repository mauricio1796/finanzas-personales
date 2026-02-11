/**
 * Utility functions for formatting data
 */

export const Formatters = {
  /**
   * Format a number as currency
   * @param amount - The amount to format
   * @param currency - Currency code (default: USD)
   * @returns Formatted currency string
   */
  currency: (amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  },

  /**
   * Format a date to long format
   * @param date - The date to format
   * @returns Formatted date string
   */
  date: (date: Date): string => {
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  },

  /**
   * Format a date to short format
   * @param date - The date to format
   * @returns Formatted short date string
   */
  shortDate: (date: Date): string => {
    return new Intl.DateTimeFormat('es-ES', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  },

  /**
   * Format a number as percentage
   * @param value - The value to format
   * @param decimals - Number of decimal places
   * @returns Formatted percentage string
   */
  percentage: (value: number, decimals: number = 2): string => {
    return `${value.toFixed(decimals)}%`;
  },

  /**
   * Format a date to time format
   * @param date - The date to format
   * @returns Formatted time string
   */
  time: (date: Date): string => {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  },
};