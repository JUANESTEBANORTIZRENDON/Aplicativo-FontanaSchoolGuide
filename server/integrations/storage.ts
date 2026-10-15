// Interfaz de almacenamiento de archivos (certificados en PDF, evidencias). Sin implementación todavía:
// se definirá cuando se apruebe el diseño de certificados y el proveedor de almacenamiento.
export interface FileStorage {
  put(key: string, content: Buffer, contentType: string): Promise<{ url: string }>;
  getUrl(key: string): Promise<string | null>;
}
