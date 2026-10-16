import type { SimStore } from './state/store';
import type { CallRecord, CustomerView, Dataset, Management, Portfolio } from './types/simulator';

export interface MountOptions {
  /** Ruta base donde se monta el simulador dentro de otra aplicación (reservado para la integración). */
  basePath?: string;
  /** Prefijo de las claves de localStorage (se le agrega la versión). */
  storagePrefix?: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

/** Lo que cada página y componente necesita del simulador. */
export interface SimContext {
  root: HTMLElement;
  store: SimStore;
  dataset: Dataset;
  options: Required<MountOptions>;
  navigate(path: string): void;
  href(path: string): string;
  toast(message: string, kind?: ToastKind): void;
  confirm(options: ConfirmOptions): Promise<boolean>;
  setTitle(view: string, portfolio?: Portfolio): void;
  allManagements(): Management[];
  allCalls(): CallRecord[];
  getViews(portfolioId: string): CustomerView[];
  findView(customerId: string): CustomerView | undefined;
  /** Restablecer práctica con confirmación. */
  requestReset(): Promise<void>;
  /** Salir del simulador. */
  logout(): void;
}
