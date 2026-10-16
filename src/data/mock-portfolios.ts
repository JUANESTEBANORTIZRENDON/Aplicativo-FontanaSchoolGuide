import type { Portfolio } from '../types/simulator';

/** Carteras ficticias de práctica. */
export const PORTFOLIOS: Portfolio[] = [
  {
    id: 'horizonte',
    name: 'Horizonte Financiero',
    description: 'Créditos de consumo y tarjetas con mora temprana. Ideal para tus primeras gestiones.',
    accent: '#2563eb',
    logo: 'circulos',
    practiceStatus: 'Recomendada para iniciar',
    products: ['Crédito de consumo', 'Tarjeta de crédito'],
  },
  {
    id: 'valle',
    name: 'Servicios del Valle',
    description: 'Servicios residenciales con facturas vencidas y clientes de contacto frecuente.',
    accent: '#0f8a6a',
    logo: 'triangulos',
    practiceStatus: 'Disponible',
    products: ['Servicio residencial'],
  },
  {
    id: 'andina',
    name: 'Comercial Andina',
    description: 'Compras a plazos en almacenes. Practica acuerdos de pago y seguimiento de promesas.',
    accent: '#c2410c',
    logo: 'barras',
    practiceStatus: 'Nivel intermedio',
    products: ['Compra a plazos', 'Tarjeta de crédito'],
  },
  {
    id: 'solidaria',
    name: 'Libranza Solidaria',
    description: 'Créditos de libranza con mora avanzada y casos escalados.',
    accent: '#7c3aed',
    logo: 'rombo',
    practiceStatus: 'Nivel avanzado',
    products: ['Crédito de libranza', 'Crédito de consumo'],
  },
];

export function findPortfolio(id: string | null | undefined): Portfolio | undefined {
  return PORTFOLIOS.find((p) => p.id === id);
}
