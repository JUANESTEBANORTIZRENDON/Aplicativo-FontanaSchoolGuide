import type { Portfolio } from '../types/simulator';

/** Campañas (carteras) de práctica. Imitan el aspecto de las tarjetas de Control Next; los clientes son ficticios. */
export const PORTFOLIOS: Portfolio[] = [
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Campaña principal de la práctica: clientes con mora temprana. Ideal para tus primeras gestiones.',
    accent: '#111827',
    logo: 'palabra',
    practiceStatus: 'Recomendada para iniciar',
    products: ['Crédito de consumo', 'Tarjeta de crédito'],
  },
  {
    id: 'marketing-propia',
    name: 'Marketing Propia',
    description: 'Cartera propia: compras a plazos y seguimiento de promesas de pago.',
    accent: '#111827',
    logo: 'propia',
    practiceStatus: 'Nivel intermedio',
    products: ['Compra a plazos', 'Tarjeta de crédito'],
  },
  {
    id: 'orion',
    name: 'Orión',
    description: 'Créditos con mora avanzada y casos escalados.',
    accent: '#1e3a8a',
    logo: 'constelacion',
    practiceStatus: 'Nivel avanzado',
    products: ['Crédito de libranza', 'Crédito de consumo'],
  },
];

export function findPortfolio(id: string | null | undefined): Portfolio | undefined {
  return PORTFOLIOS.find((p) => p.id === id);
}
