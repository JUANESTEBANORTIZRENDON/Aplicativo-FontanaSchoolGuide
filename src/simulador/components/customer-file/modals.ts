// Ventanas de la ficha: Referencias, Demográficos y Pagos.

import type { SimContext } from '../../context';
import { stableHash } from '../../domain/control-next';
import type { CustomerView } from '../../types/simulator';
import { esc, formatDateTime } from '../../utils/format';
import { openModal } from '../Modal';
import { money } from './templates';

export function showReferences(ctx: SimContext, v: CustomerView): void {
  const h = stableHash(v.id);
  void openModal(ctx.root, {
    title: 'Referencias',
    body: `<table class="sim-table sim-table--compact"><thead><tr><th>Tipo</th><th>Nombre</th><th>Teléfono</th></tr></thead><tbody>
      <tr><td>Familiar</td><td>REFERENCIA FAMILIAR ${(h % 90) + 10}</td><td>31${h % 10} 555 0${String((h % 900) + 100)}</td></tr>
      <tr><td>Personal</td><td>REFERENCIA PERSONAL ${((h >> 3) % 90) + 10}</td><td>30${(h >> 2) % 10} 555 0${String(((h >> 4) % 900) + 100)}</td></tr>
    </tbody></table><p class="sim-help">Datos ficticios. Las referencias se usan para ubicar al titular, nunca para cobrarle a un tercero.</p>`,
    wide: true,
  });
}

export function showDemographics(ctx: SimContext, v: CustomerView): void {
  const h = stableHash(v.document);
  void openModal(ctx.root, {
    title: 'Demográficos',
    body: `<dl class="sim-dl">
      <div><dt>Nombre</dt><dd>${esc(v.name.toUpperCase())}</dd></div>
      <div><dt>Identificación</dt><dd>C.C. ${esc(v.document)}</dd></div>
      <div><dt>Teléfono principal</dt><dd>${esc(v.phone)}</dd></div>
      <div><dt>Email</dt><dd>${esc(v.email)}</dd></div>
      <div><dt>Ciudad</dt><dd>${esc(v.city)}</dd></div>
      <div><dt>Dirección</dt><dd>CALLE ${(h % 150) + 1} # ${(h % 80) + 2} - ${(h % 60) + 10}</dd></div>
      <div><dt>Codeudor</dt><dd>Sin codeudor registrado</dd></div>
    </dl><p class="sim-help">Aquí actualizas los datos de contacto cuando el titular te da un número o correo nuevo.</p>`,
  });
}

export function showPayments(ctx: SimContext, v: CustomerView): void {
  const pays = ctx.dataset.payments.filter((p) => p.customerId === v.id).sort((a, b) => b.date.localeCompare(a.date));
  void openModal(ctx.root, {
    title: 'Pagos',
    body: pays.length
      ? `<table class="sim-table sim-table--compact"><thead><tr><th>Fecha</th><th>Valor</th></tr></thead><tbody>${pays
          .map((p) => `<tr><td>${esc(formatDateTime(p.date))}</td><td>${esc(money(p.amount))}</td></tr>`)
          .join('')}</tbody></table>`
      : '<p>El cliente no registra pagos aplicados. Antes de negociar, revisa siempre esta ventana para no cobrar algo que ya pagó.</p>',
  });
}
