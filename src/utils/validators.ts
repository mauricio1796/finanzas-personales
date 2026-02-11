export const Validators = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  password: (password: string): { valid: boolean; error?: string } => {
    if (password.length < 6) {
      return { valid: false, error: 'La contraseña debe tener al menos 6 caracteres' };
    }
    return { valid: true };
  },

  amount: (amount: string): { valid: boolean; error?: string } => {
    const num = parseFloat(amount);
    if (isNaN(num)) {
      return { valid: false, error: 'Ingresa un número válido' };
    }
    if (num <= 0) {
      return { valid: false, error: 'El monto debe ser mayor a 0' };
    }
    return { valid: true };
  },

  name: (name: string): { valid: boolean; error?: string } => {
    if (!name.trim()) {
      return { valid: false, error: 'El nombre es requerido' };
    }
    if (name.length < 2) {
      return { valid: false, error: 'El nombre debe tener al menos 2 caracteres' };
    }
    if (name.length > 50) {
      return { valid: false, error: 'El nombre no puede exceder 50 caracteres' };
    }
    return { valid: true };
  },
};