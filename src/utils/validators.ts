// Validadores reutilizables para inputs de usuario y datos antes de persistir

export const Validators = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  },

  password: (password: string): { valid: boolean; error?: string } => {
    if (password.length < 6) {
      return { valid: false, error: 'La contraseña debe tener al menos 6 caracteres' };
    }
    return { valid: true };
  },

  amount: (amount: string | number): { valid: boolean; error?: string; value?: number } => {
    const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[$.]/g, '').replace(',', '.'));
    if (isNaN(num) || !isFinite(num)) {
      return { valid: false, error: 'Ingresa un número válido' };
    }
    if (num <= 0) {
      return { valid: false, error: 'El monto debe ser mayor a 0' };
    }
    if (num > 1_000_000_000_000) {
      return { valid: false, error: 'El monto es demasiado alto' };
    }
    return { valid: true, value: num };
  },

  name: (name: string): { valid: boolean; error?: string } => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { valid: false, error: 'El nombre es requerido' };
    }
    if (trimmed.length < 2) {
      return { valid: false, error: 'El nombre debe tener al menos 2 caracteres' };
    }
    if (trimmed.length > 100) {
      return { valid: false, error: 'El nombre no puede exceder 100 caracteres' };
    }
    return { valid: true };
  },

  categoryName: (name: string): { valid: boolean; error?: string } => {
    const trimmed = name.trim();
    if (!trimmed) return { valid: false, error: 'El nombre de categoría es requerido' };
    if (trimmed.length > 100) return { valid: false, error: 'Nombre demasiado largo' };
    return { valid: true };
  },

  salary: (salary: number): { valid: boolean; error?: string } => {
    if (typeof salary !== 'number' || !isFinite(salary)) {
      return { valid: false, error: 'Salario inválido' };
    }
    if (salary < 0) {
      return { valid: false, error: 'El salario no puede ser negativo' };
    }
    if (salary > 1_000_000_000) {
      return { valid: false, error: 'El salario ingresado es demasiado alto' };
    }
    return { valid: true };
  },

  date: (date: string): { valid: boolean; error?: string } => {
    if (!date) return { valid: false, error: 'Fecha requerida' };
    const d = new Date(date);
    if (isNaN(d.getTime())) return { valid: false, error: 'Fecha inválida' };
    // No aceptar fechas en el futuro lejano (> 1 año) ni muy antiguas (> 10 años)
    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    if (d.getTime() > now + oneYearMs) return { valid: false, error: 'La fecha no puede estar en el futuro' };
    if (d.getTime() < now - 10 * oneYearMs) return { valid: false, error: 'La fecha es demasiado antigua' };
    return { valid: true };
  },

  transactionType: (type: string): type is 'income' | 'expense' => {
    return type === 'income' || type === 'expense';
  },
};
