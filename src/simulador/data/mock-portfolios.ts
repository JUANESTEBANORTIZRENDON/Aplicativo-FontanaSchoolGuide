import type { Portfolio } from '../types/simulator';

/**
 * Campañas (carteras) de práctica con nombres FICTICIOS: imitan el aspecto de las tarjetas de Control Next, pero no
 * muestran las empresas reales de la operación. Los clientes también son ficticios.
 */
export const PORTFOLIOS: Portfolio[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Campaña principal de la práctica: clientes con mora temprana. Ideal para tus primeras gestiones.',
    accent: '#111827',
    logo: 'palabra',
    practiceStatus: 'Recomendada para iniciar',
    products: ['Crédito de consumo', 'Tarjeta de crédito'],
  },
  {
    id: 'aurora-propia',
    name: 'Aurora Propia',
    description: 'Cartera propia: compras a plazos y seguimiento de promesas de pago.',
    accent: '#111827',
    logo: 'propia',
    practiceStatus: 'Nivel intermedio',
    products: ['Compra a plazos', 'Tarjeta de crédito'],
  },
  {
    id: 'andes',
    name: 'Andes',
    description: 'Créditos con mora avanzada y casos escalados.',
    accent: '#1e3a8a',
    logo: 'imagen',
    practiceStatus: 'Nivel avanzado',
    products: ['Crédito de libranza', 'Crédito de consumo'],
  },
];

export function findPortfolio(id: string | null | undefined): Portfolio | undefined {
  return PORTFOLIOS.find((p) => p.id === id);
}
