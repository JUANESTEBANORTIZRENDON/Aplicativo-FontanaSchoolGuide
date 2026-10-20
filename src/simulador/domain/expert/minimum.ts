// Lo mínimo que debe tener toda tipificación. Lo usan la página del módulo Tipifica y la prueba del clon,
// para que el criterio sea uno solo.

export interface MinimumItem {
  title: string;
  text: string;
}

export const TYPIFICATION_MINIMUM: MinimumItem[] = [
  { title: 'Acción', text: '«Hacer Llamada» si tú marcaste; «Recibir Llamada» si el cliente te llamó.' },
  { title: 'Contacto', text: 'Directo si hablaste con el titular (TT); Indirecto si contestó un tercero; Sin Contacto si nadie atendió o el número no es del titular.' },
  { title: 'Canal', text: 'Por dónde fue la gestión: Telefonico, Whatsapp o Correo.' },
  { title: 'Perfil', text: 'El resultado real de la llamada: acuerdo de pago (total o abono), volver a llamar, no hubo acuerdo, paz y salvo…' },
  { title: 'Motivo No Pago', text: 'Por qué no ha pagado o qué queda por confirmar: no cuenta con el dinero, confirmar pago, con recibo, tercero encargado…' },
  { title: 'Teléfono', text: 'El número al que llamaste o desde el que te llamaron.' },
  { title: 'Gestión escrita', text: 'Empieza con «teléfono //», dice quién contestó (TT o el tercero y su parentesco), qué se habló y cómo quedó: fecha y valor del acuerdo o cuándo volver a llamar.' },
  { title: 'Con un tercero', text: 'Nunca se le dan valores ni se negocia la deuda: solo se deja el mensaje para que el titular se comunique.' },
];
