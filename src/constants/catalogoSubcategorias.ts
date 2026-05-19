// Subcategorías predefinidas por categoría padre
// Cada entrada mapea el nombre de la categoría padre → lista de subcategorías sugeridas

export interface SubcategoriaItem {
  nombre: string;
  icono: string; // Feather icon name
  descripcion: string;
}

export const CATALOGO_SUBCATEGORIAS: Record<string, SubcategoriaItem[]> = {
  Servicios: [
    { nombre: 'Gas',        icono: 'thermometer', descripcion: 'Recibo de gas natural' },
    { nombre: 'Agua',       icono: 'droplet',     descripcion: 'Factura de acueducto y alcantarillado' },
    { nombre: 'Luz',        icono: 'zap',         descripcion: 'Factura de energía eléctrica' },
    { nombre: 'Internet',   icono: 'wifi',        descripcion: 'Plan de internet hogar' },
    { nombre: 'Teléfono',   icono: 'phone',       descripcion: 'Plan de telefonía fija o celular' },
    { nombre: 'Aseo',       icono: 'trash-2',     descripcion: 'Servicio de recolección de basuras' },
    { nombre: 'Cable / TV', icono: 'tv',          descripcion: 'Televisión por cable o satélite' },
  ],

  Alimentación: [
    { nombre: 'Mercado',    icono: 'shopping-cart', descripcion: 'Supermercado y víveres' },
    { nombre: 'Restaurante',icono: 'coffee',        descripcion: 'Comer en restaurante' },
    { nombre: 'Domicilios', icono: 'truck',         descripcion: 'Rappi, iFood, delivery' },
    { nombre: 'Panadería',  icono: 'package',       descripcion: 'Pan, pasteles, galletería' },
    { nombre: 'Frutas',     icono: 'sun',           descripcion: 'Frutas y verduras' },
    { nombre: 'Cafetería',  icono: 'coffee',        descripcion: 'Café, jugos, bebidas' },
  ],

  Transporte: [
    { nombre: 'TransMilenio / Metro', icono: 'map-pin',   descripcion: 'Transporte masivo' },
    { nombre: 'Taxi / Uber',          icono: 'navigation', descripcion: 'Taxis y plataformas digitales' },
    { nombre: 'Gasolina',             icono: 'droplet',    descripcion: 'Combustible para vehículo' },
    { nombre: 'Parqueadero',          icono: 'square',     descripcion: 'Parqueaderos y estacionamientos' },
    { nombre: 'Mantenimiento',        icono: 'tool',       descripcion: 'Servicio y reparaciones del vehículo' },
    { nombre: 'SOAT / Seguros',       icono: 'shield',     descripcion: 'SOAT y seguros del vehículo' },
  ],

  Vivienda: [
    { nombre: 'Arriendo',       icono: 'home',        descripcion: 'Canon de arrendamiento' },
    { nombre: 'Administración', icono: 'users',       descripcion: 'Cuota de administración' },
    { nombre: 'Cuota hipotecaria', icono: 'credit-card', descripcion: 'Cuota del crédito hipotecario' },
    { nombre: 'Reparaciones',   icono: 'tool',        descripcion: 'Arreglos y mantenimiento del hogar' },
    { nombre: 'Amoblado',       icono: 'layers',      descripcion: 'Muebles y decoración' },
    { nombre: 'Seguro hogar',   icono: 'shield',      descripcion: 'Póliza de hogar' },
  ],

  Salud: [
    { nombre: 'Médico',         icono: 'activity',    descripcion: 'Consultas médicas' },
    { nombre: 'Medicamentos',   icono: 'package',     descripcion: 'Fármacos y medicinas' },
    { nombre: 'Odontología',    icono: 'smile',       descripcion: 'Consultas y tratamientos dentales' },
    { nombre: 'Psicología',     icono: 'heart',       descripcion: 'Terapia y salud mental' },
    { nombre: 'Laboratorio',    icono: 'clipboard',   descripcion: 'Exámenes y análisis clínicos' },
    { nombre: 'EPS / Plan',     icono: 'shield',      descripcion: 'Cuota de plan de salud o medicina prepagada' },
  ],

  Educación: [
    { nombre: 'Matrícula',      icono: 'book-open',   descripcion: 'Matrícula académica' },
    { nombre: 'Útiles',         icono: 'edit',        descripcion: 'Materiales y útiles escolares' },
    { nombre: 'Cursos online',  icono: 'monitor',     descripcion: 'Udemy, Coursera, plataformas digitales' },
    { nombre: 'Libros',         icono: 'book',        descripcion: 'Libros y material de lectura' },
    { nombre: 'Transporte escolar', icono: 'map-pin', descripcion: 'Transporte al colegio o universidad' },
    { nombre: 'Clases particulares', icono: 'users',  descripcion: 'Tutorías y clases extra' },
  ],

  Entretenimiento: [
    { nombre: 'Streaming',      icono: 'tv',          descripcion: 'Netflix, Disney+, Prime Video' },
    { nombre: 'Cine',           icono: 'film',        descripcion: 'Entradas al cine' },
    { nombre: 'Videojuegos',    icono: 'monitor',     descripcion: 'Juegos y consolas' },
    { nombre: 'Conciertos',     icono: 'music',       descripcion: 'Eventos y espectáculos' },
    { nombre: 'Salidas',        icono: 'map-pin',     descripcion: 'Bares, clubes, ocio nocturno' },
    { nombre: 'Libros / Revistas', icono: 'book',     descripcion: 'Lectura y suscripciones de revistas' },
  ],

  Suscripciones: [
    { nombre: 'Spotify',        icono: 'music',       descripcion: 'Música en streaming' },
    { nombre: 'Netflix',        icono: 'tv',          descripcion: 'Video en streaming' },
    { nombre: 'YouTube Premium',icono: 'youtube',     descripcion: 'YouTube sin anuncios' },
    { nombre: 'iCloud / Drive', icono: 'cloud',       descripcion: 'Almacenamiento en la nube' },
    { nombre: 'Antivirus',      icono: 'shield',      descripcion: 'Seguridad informática' },
    { nombre: 'Apps / Software',icono: 'cpu',         descripcion: 'Suscripciones a aplicaciones' },
  ],

  Hogar: [
    { nombre: 'Electrodomésticos', icono: 'zap',      descripcion: 'Nevera, lavadora, electrodomésticos' },
    { nombre: 'Muebles',           icono: 'layers',   descripcion: 'Sofás, camas, escritorios' },
    { nombre: 'Decoración',        icono: 'image',    descripcion: 'Cuadros, plantas, accesorios' },
    { nombre: 'Limpieza',          icono: 'trash-2',  descripcion: 'Productos de aseo del hogar' },
    { nombre: 'Herramientas',      icono: 'tool',     descripcion: 'Herramientas y bricolaje' },
  ],

  Ropa: [
    { nombre: 'Ropa casual',    icono: 'shopping-bag', descripcion: 'Prendas de vestir diarias' },
    { nombre: 'Zapatos',        icono: 'navigation',   descripcion: 'Calzado' },
    { nombre: 'Ropa deportiva', icono: 'activity',     descripcion: 'Ropa para ejercicio' },
    { nombre: 'Accesorios',     icono: 'watch',        descripcion: 'Bolsos, cinturones, joyería' },
    { nombre: 'Ropa de trabajo',icono: 'briefcase',    descripcion: 'Uniformes y ropa formal' },
  ],

  Mascotas: [
    { nombre: 'Alimentación',   icono: 'package',     descripcion: 'Comida para mascotas' },
    { nombre: 'Veterinario',    icono: 'heart',       descripcion: 'Consultas y tratamientos veterinarios' },
    { nombre: 'Medicamentos',   icono: 'activity',    descripcion: 'Vacunas y medicamentos para mascotas' },
    { nombre: 'Accesorios',     icono: 'feather',     descripcion: 'Correas, juguetes, camas' },
    { nombre: 'Peluquería',     icono: 'scissors',    descripcion: 'Baño y corte para mascotas' },
  ],

  Belleza: [
    { nombre: 'Peluquería',     icono: 'scissors',    descripcion: 'Corte y color de cabello' },
    { nombre: 'Manicure',       icono: 'edit',        descripcion: 'Uñas y pedicure' },
    { nombre: 'Spa / Masajes',  icono: 'sun',         descripcion: 'Tratamientos y relajación' },
    { nombre: 'Cosméticos',     icono: 'package',     descripcion: 'Maquillaje y productos de belleza' },
    { nombre: 'Perfumes',       icono: 'wind',        descripcion: 'Fragancias y perfumes' },
  ],

  Tecnología: [
    { nombre: 'Celular',        icono: 'smartphone',  descripcion: 'Teléfonos y accesorios' },
    { nombre: 'Computador',     icono: 'monitor',     descripcion: 'Laptops, PCs y accesorios' },
    { nombre: 'Periféricos',    icono: 'cpu',         descripcion: 'Teclados, mouse, auriculares' },
    { nombre: 'Cargadores',     icono: 'battery',     descripcion: 'Cables y cargadores' },
    { nombre: 'Smartwatch',     icono: 'watch',       descripcion: 'Relojes inteligentes' },
  ],

  Deudas: [
    { nombre: 'Tarjeta crédito',icono: 'credit-card', descripcion: 'Pago mínimo o total de tarjeta' },
    { nombre: 'Crédito personal',icono: 'dollar-sign',descripcion: 'Cuota de crédito personal' },
    { nombre: 'Crédito vehículo',icono: 'navigation', descripcion: 'Cuota del crédito de carro' },
    { nombre: 'Crédito hipotecario', icono: 'home',   descripcion: 'Crédito de vivienda' },
    { nombre: 'Préstamo familiar',   icono: 'users',  descripcion: 'Deuda con familiar o amigo' },
  ],

  Viajes: [
    { nombre: 'Tiquetes',       icono: 'navigation',  descripcion: 'Vuelos y pasajes' },
    { nombre: 'Hotel',          icono: 'home',        descripcion: 'Hospedaje y alojamiento' },
    { nombre: 'Alimentación',   icono: 'coffee',      descripcion: 'Comida en viajes' },
    { nombre: 'Tours',          icono: 'map-pin',     descripcion: 'Excursiones y actividades turísticas' },
    { nombre: 'Transporte local',icono: 'map-pin',    descripcion: 'Movilidad en destino' },
    { nombre: 'Pasaporte / Visa',icono: 'file-text',  descripcion: 'Documentos de viaje' },
  ],

  Niños: [
    { nombre: 'Colegio',        icono: 'book-open',   descripcion: 'Pensión y costos educativos' },
    { nombre: 'Ropa',           icono: 'shopping-bag', descripcion: 'Ropa y calzado para niños' },
    { nombre: 'Juguetes',       icono: 'package',     descripcion: 'Juguetes y entretenimiento' },
    { nombre: 'Actividades',    icono: 'activity',    descripcion: 'Clases de música, deportes, etc.' },
    { nombre: 'Salud',          icono: 'heart',       descripcion: 'Médico, vacunas, pediatra' },
  ],

  Seguros: [
    { nombre: 'Seguro vida',    icono: 'heart',       descripcion: 'Póliza de vida' },
    { nombre: 'Seguro salud',   icono: 'activity',    descripcion: 'Medicina prepagada o seguro de salud' },
    { nombre: 'Seguro vehículo',icono: 'navigation',  descripcion: 'Póliza del vehículo' },
    { nombre: 'Seguro hogar',   icono: 'home',        descripcion: 'Póliza del hogar' },
  ],

  'Gym / Sport': [
    { nombre: 'Membresía gym',  icono: 'activity',    descripcion: 'Cuota mensual del gimnasio' },
    { nombre: 'Ropa deportiva', icono: 'shopping-bag', descripcion: 'Indumentaria para ejercicio' },
    { nombre: 'Suplementos',    icono: 'package',     descripcion: 'Proteínas, vitaminas, suplementos' },
    { nombre: 'Clases grupales',icono: 'users',       descripcion: 'Yoga, spinning, crossfit, etc.' },
    { nombre: 'Equipamiento',   icono: 'tool',        descripcion: 'Pesas, colchonetas, accesorios' },
  ],

  Freelance: [
    { nombre: 'Proyecto web',   icono: 'code',        descripcion: 'Desarrollo web y apps' },
    { nombre: 'Diseño',         icono: 'pen-tool',    descripcion: 'Diseño gráfico y UX/UI' },
    { nombre: 'Consultoría',    icono: 'briefcase',   descripcion: 'Asesoría profesional' },
    { nombre: 'Redacción',      icono: 'edit',        descripcion: 'Escritura y copywriting' },
    { nombre: 'Fotografía',     icono: 'camera',      descripcion: 'Fotografía y video' },
  ],

  Inversiones: [
    { nombre: 'CDT / Fondo',    icono: 'trending-up', descripcion: 'Certificados y fondos de inversión' },
    { nombre: 'Acciones',       icono: 'bar-chart-2', descripcion: 'Bolsa de valores' },
    { nombre: 'Cripto',         icono: 'cpu',         descripcion: 'Criptomonedas' },
    { nombre: 'Finca raíz',     icono: 'home',        descripcion: 'Inversión en propiedad raíz' },
    { nombre: 'Dividendos',     icono: 'dollar-sign', descripcion: 'Rendimientos recibidos' },
  ],

  Regalos: [
    { nombre: 'Cumpleaños',     icono: 'gift',        descripcion: 'Regalos de cumpleaños' },
    { nombre: 'Navidad',        icono: 'star',        descripcion: 'Regalos navideños' },
    { nombre: 'Boda / Grado',   icono: 'heart',       descripcion: 'Regalos de eventos especiales' },
    { nombre: 'Donaciones',     icono: 'heart',       descripcion: 'Donaciones y caridad' },
  ],

  Restaurantes: [
    { nombre: 'Almuerzo',       icono: 'coffee',      descripcion: 'Almuerzo fuera de casa' },
    { nombre: 'Cena',           icono: 'moon',        descripcion: 'Cenas en restaurante' },
    { nombre: 'Desayuno',       icono: 'sun',         descripcion: 'Desayunos y brunch' },
    { nombre: 'Antojitos',      icono: 'package',     descripcion: 'Snacks, helados, postres' },
  ],

  Delivery: [
    { nombre: 'Rappi',          icono: 'truck',       descripcion: 'Pedidos por Rappi' },
    { nombre: 'iFood',          icono: 'truck',       descripcion: 'Pedidos por iFood' },
    { nombre: 'Domicilios.com', icono: 'truck',       descripcion: 'Pedidos por Domicilios.com' },
    { nombre: 'Mercado',        icono: 'shopping-cart', descripcion: 'Mercado a domicilio' },
  ],
};

/** Retorna las subcategorías sugeridas para una categoría padre por nombre */
export function getSubcategoriasParaCategoria(nombreCategoria: string): SubcategoriaItem[] {
  return CATALOGO_SUBCATEGORIAS[nombreCategoria] ?? [];
}
