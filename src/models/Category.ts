import { Category } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1',  name: 'Mercado',          icon: '🛒', color: '#EF4444' },
  { id: '2',  name: 'Transporte',       icon: '🚌', color: '#3B82F6' },
  { id: '3',  name: 'Arriendo',         icon: '🏡', color: '#92400E' },
  { id: '4',  name: 'Servicios',        icon: '💧', color: '#06B6D4' },
  { id: '5',  name: 'Entretenimiento',  icon: '🎸', color: '#8B5CF6' },
  { id: '6',  name: 'Salud',            icon: '💊', color: '#10B981' },
  { id: '7',  name: 'Educación',        icon: '🎓', color: '#F59E0B' },
  { id: '8',  name: 'Ropa',             icon: '👔', color: '#EC4899' },
  { id: '9',  name: 'Mascotas',         icon: '🐾', color: '#D97706' },
  { id: '10', name: 'Seguros',          icon: '🔐', color: '#6366F1' },
  { id: '11', name: 'Suscripciones',    icon: '🎧', color: '#F97316' },
  { id: '12', name: 'Gimnasio',         icon: '🏋️', color: '#84CC16' },
  { id: '13', name: 'Restaurantes',     icon: '🍜', color: '#FB7185' },
  { id: '14', name: 'Cine / Planes',    icon: '🍿', color: '#38BDF8' },
  { id: '15', name: 'Viajes',           icon: '🌎', color: '#34D399' },
  { id: '16', name: 'Regalos',          icon: '🛍️', color: '#FCD34D' },
  { id: '17', name: 'Cuidado Personal', icon: '🪥', color: '#F9A8D4' },
  { id: '18', name: 'Deudas',           icon: '🏦', color: '#A78BFA' },
  { id: '19', name: 'Ahorros',          icon: '🪙', color: '#22C55E' },
  { id: '20', name: 'Otros',            icon: '🗂️', color: '#94A3B8' },
];

// Subcategorías por defecto mapeadas al NOMBRE de la categoría padre
// (los IDs de categoría pueden variar entre usuarios, por eso usamos el nombre como clave)
const SUB_CATALOG: Record<string, { name: string; icon: string }[]> = {
  'Mercado':          [{ name: 'Frutas y Verduras', icon: 'shopping-bag' }, { name: 'Carnes', icon: 'shopping-cart' }, { name: 'Lácteos', icon: 'package' }, { name: 'Aseo y Limpieza', icon: 'tool' }, { name: 'Bebidas', icon: 'coffee' }],
  'Transporte':       [{ name: 'Bus / Metro', icon: 'navigation' }, { name: 'Taxi / Uber', icon: 'map-pin' }, { name: 'Gasolina', icon: 'tool' }, { name: 'Parqueadero', icon: 'map-pin' }, { name: 'Peajes', icon: 'navigation' }],
  'Arriendo':         [{ name: 'Arriendo', icon: 'home' }, { name: 'Administración', icon: 'briefcase' }, { name: 'Parqueadero', icon: 'map-pin' }],
  'Servicios':        [{ name: 'Luz', icon: 'zap' }, { name: 'Agua', icon: 'package' }, { name: 'Gas', icon: 'tool' }, { name: 'Internet', icon: 'monitor' }, { name: 'Teléfono', icon: 'monitor' }],
  'Entretenimiento':  [{ name: 'Streaming', icon: 'monitor' }, { name: 'Salidas', icon: 'map-pin' }, { name: 'Videojuegos', icon: 'monitor' }, { name: 'Música', icon: 'music' }],
  'Salud':            [{ name: 'Médico', icon: 'user' }, { name: 'Medicamentos', icon: 'package' }, { name: 'Laboratorio', icon: 'activity' }, { name: 'Odontología', icon: 'user' }, { name: 'Optometría', icon: 'user' }],
  'Educación':        [{ name: 'Matrícula', icon: 'book-open' }, { name: 'Libros', icon: 'book-open' }, { name: 'Cursos', icon: 'monitor' }, { name: 'Útiles', icon: 'scissors' }],
  'Ropa':             [{ name: 'Ropa', icon: 'scissors' }, { name: 'Calzado', icon: 'tag' }, { name: 'Accesorios', icon: 'tag' }],
  'Mascotas':         [{ name: 'Comida', icon: 'shopping-cart' }, { name: 'Veterinario', icon: 'heart' }, { name: 'Peluquería', icon: 'scissors' }, { name: 'Accesorios', icon: 'feather' }],
  'Seguros':          [{ name: 'Seguro Médico', icon: 'heart' }, { name: 'Seguro Auto', icon: 'navigation' }, { name: 'Seguro Hogar', icon: 'home' }, { name: 'Seguro Vida', icon: 'shield' }],
  'Suscripciones':    [{ name: 'Netflix', icon: 'monitor' }, { name: 'Spotify', icon: 'headphones' }, { name: 'YouTube', icon: 'film' }, { name: 'Amazon', icon: 'package' }, { name: 'Otras', icon: 'repeat' }],
  'Gimnasio':         [{ name: 'Membresía', icon: 'activity' }, { name: 'Suplementos', icon: 'package' }, { name: 'Ropa Deportiva', icon: 'scissors' }, { name: 'Clases', icon: 'users' }],
  'Restaurantes':     [{ name: 'Almuerzo', icon: 'coffee' }, { name: 'Cena', icon: 'coffee' }, { name: 'Desayuno', icon: 'coffee' }, { name: 'Antojo', icon: 'shopping-bag' }],
  'Cine / Planes':    [{ name: 'Cine', icon: 'film' }, { name: 'Conciertos', icon: 'music' }, { name: 'Museos', icon: 'map-pin' }, { name: 'Parques', icon: 'globe' }],
  'Viajes':           [{ name: 'Tiquetes', icon: 'navigation' }, { name: 'Hotel', icon: 'home' }, { name: 'Alimentación', icon: 'coffee' }, { name: 'Actividades', icon: 'map-pin' }],
  'Regalos':          [{ name: 'Cumpleaños', icon: 'gift' }, { name: 'Navidad', icon: 'gift' }, { name: 'Detalles', icon: 'heart' }, { name: 'Otros', icon: 'tag' }],
  'Cuidado Personal': [{ name: 'Peluquería', icon: 'scissors' }, { name: 'Cosméticos', icon: 'user' }, { name: 'Spa', icon: 'heart' }, { name: 'Productos', icon: 'shopping-bag' }],
  'Deudas':           [{ name: 'Tarjeta de Crédito', icon: 'credit-card' }, { name: 'Préstamo', icon: 'dollar-sign' }, { name: 'Cuotas', icon: 'briefcase' }, { name: 'Otros', icon: 'tag' }],
  'Ahorros':          [{ name: 'Emergencias', icon: 'shield' }, { name: 'Vacaciones', icon: 'globe' }, { name: 'Meta Específica', icon: 'trending-up' }, { name: 'Inversión', icon: 'bar-chart-2' }],
  'Otros':            [{ name: 'Varios', icon: 'more-horizontal' }],
};

/**
 * Dado un array de categorías top-level, genera todas las subcategorías por defecto
 * para aquellas que no tengan ninguna subcategoría aún.
 * Idempotente: no duplica subcategorías existentes.
 */
export function inyectarSubcategoriasDefecto(categories: Category[]): Category[] {
  const result = [...categories];
  const topCats = categories.filter(c => !c.parentCategoryId);

  for (const parent of topCats) {
    const plantillas = SUB_CATALOG[parent.name];
    if (!plantillas) continue;

    plantillas.forEach((sub, i) => {
      const defaultId = `sub_${parent.id}_${i}`;
      const existing  = result.findIndex(c => c.id === defaultId);

      if (existing !== -1) {
        // Actualizar icono si cambió (por migraciones previas con emojis)
        if (result[existing].icon !== sub.icon) {
          result[existing] = { ...result[existing], icon: sub.icon };
        }
      } else {
        result.push({
          id:               defaultId,
          name:             sub.name,
          icon:             sub.icon,
          parentCategoryId: parent.id,
          tipo:             parent.tipo ?? 'gasto',
          isSelected:       true,
          fechaCreacion:    new Date().toISOString(),
        });
      }
    });
  }

  return result;
}
