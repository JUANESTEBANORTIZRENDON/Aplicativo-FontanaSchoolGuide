import { evaluateFormula, type CellValue } from '../../server/domain/excel-formula';
import type { SheetColumn, SheetRow } from './api';

// Mini hoja accesible para la práctica: filtro por columna, búsqueda, ordenamiento y celdas editables
// en los pasos que lo piden. No es un clon de Excel. Solo muestra y recoge lo que el asesor hace; la
// calificación la hace el servidor.

export type CellEditor =
  | { kind: 'text' | 'number' | 'date' | 'time' | 'formula' }
  | { kind: 'select'; options: string[] };

export type MiniSheetOptions = {
  caption: string;
  columns: SheetColumn[];
  rows: SheetRow[];
  filterable?: string[];
  sortable?: boolean;
  searchable?: boolean;
  selectable?: boolean;
  editor?: (row: SheetRow, column: SheetColumn) => CellEditor | null;
  onChange?: () => void;
};

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export function formatDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value;
}

export class MiniSheet {
  private rows: SheetRow[];
  private sort: { key: string; dir: 'asc' | 'desc' } | null = null;
  private filters = new Map<string, string>();
  private search = '';
  private selected: string | null = null;
  private edits = new Map<string, string>();
  private currency = false;
  private readonly table: HTMLTableElement;
  private readonly body: HTMLTableSectionElement;
  private readonly status: HTMLElement;

  constructor(host: HTMLElement, private readonly options: MiniSheetOptions) {
    this.rows = options.rows.map((row) => ({ ...row }));
    const tools = document.createElement('div');
    tools.className = 'sheet-tools';
    if (options.searchable) {
      const label = document.createElement('label');
      label.textContent = 'Buscar ';
      const input = document.createElement('input');
      input.type = 'search';
      input.autocomplete = 'off';
      input.placeholder = 'Escribe para buscar';
      input.addEventListener('input', () => { this.search = input.value.trim().toLowerCase(); this.renderBody(); });
      label.append(input);
      tools.append(label);
    }
    this.status = document.createElement('p');
    this.status.className = 'sheet-status';
    this.status.setAttribute('role', 'status');
    tools.append(this.status);

    const wrapper = document.createElement('div');
    wrapper.className = 'sheet-scroll';
    this.table = document.createElement('table');
    this.table.className = 'sheet-table';
    const caption = document.createElement('caption');
    caption.textContent = options.caption;
    this.table.append(caption);
    this.table.append(this.renderHead());
    this.body = document.createElement('tbody');
    this.table.append(this.body);
    wrapper.append(this.table);
    host.replaceChildren(tools, wrapper);
    this.renderBody();
  }

  // ---- Estado visible para quien usa la hoja ----
  getVisibleIds(): string[] { return this.visibleRows().map((row) => row.id); }
  getFilter(key: string): string { return this.filters.get(key) ?? ''; }
  getSelectedId(): string | null { return this.selected; }
  getRow(id: string): SheetRow | undefined { return this.rows.find((row) => row.id === id); }
  getEdit(rowId: string, key: string): string { return this.edits.get(`${rowId}:${key}`) ?? ''; }
  getSort(): { key: string; dir: 'asc' | 'desc' } | null { return this.sort; }
  hasRow(id: string): boolean { return this.rows.some((row) => row.id === id); }

  addRow(row: SheetRow): void {
    if (this.hasRow(row.id)) this.rows = this.rows.map((item) => (item.id === row.id ? { ...row } : item));
    else this.rows.push({ ...row });
    this.renderBody();
    this.options.onChange?.();
  }

  setCurrency(on: boolean): void {
    this.currency = on;
    this.renderBody();
  }

  // Valor calculado de una celda con fórmula; las referencias usan el orden original de la hoja.
  computed(rowId: string, key: string): string {
    const text = this.getEdit(rowId, key);
    if (!text.startsWith('=')) return text;
    const result = evaluateFormula(text, (column, row) => this.readCell(column, row));
    return result.ok ? String(result.value) : `Error: ${result.error}`;
  }

  evaluate(formula: string): string {
    const result = evaluateFormula(formula, (column, row) => this.readCell(column, row));
    return result.ok ? String(result.value) : `Error: ${result.error}`;
  }

  private readCell(column: number, row: number): CellValue {
    const key = this.options.columns[column - 1]?.key;
    if (row === 1) return this.options.columns[column - 1]?.label;
    const record = this.rows[row - 2];
    if (!key || !record) return null;
    const edited = this.edits.get(`${record.id}:${key}`);
    return edited !== undefined && !edited.startsWith('=') ? edited : (record[key] as CellValue);
  }

  // ---- Dibujo ----
  private visibleRows(): SheetRow[] {
    let result = this.rows.filter((row) => [...this.filters.entries()].every(([key, value]) => !value || String(row[key] ?? '') === value));
    if (this.search) result = result.filter((row) => this.options.columns.some((column) => String(row[column.key] ?? '').toLowerCase().includes(this.search)));
    if (this.sort) {
      const { key, dir } = this.sort;
      const type = this.options.columns.find((column) => column.key === key)?.type;
      result = [...result].sort((a, b) => {
        const left = a[key] ?? '';
        const right = b[key] ?? '';
        const order = type === 'number' || type === 'currency' ? Number(left) - Number(right) : String(left).localeCompare(String(right), 'es-CO');
        return dir === 'asc' ? order : -order;
      });
    }
    return result;
  }

  private renderHead(): HTMLTableSectionElement {
    const head = document.createElement('thead');
    const tr = document.createElement('tr');
    const index = document.createElement('th');
    index.scope = 'col';
    index.className = 'sheet-index';
    index.textContent = '';
    tr.append(index);
    this.options.columns.forEach((column, position) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.dataset.key = column.key;
      const letter = String.fromCharCode(65 + position);
      const title = document.createElement('span');
      title.className = 'sheet-colname';
      title.textContent = `${letter} · ${column.label}`;
      th.append(title);
      if (this.options.sortable !== false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sheet-sort';
        button.textContent = '↕';
        button.setAttribute('aria-label', `Ordenar por ${column.label}`);
        button.addEventListener('click', () => {
          const dir = this.sort?.key === column.key && this.sort.dir === 'asc' ? 'desc' : 'asc';
          this.sort = { key: column.key, dir };
          this.updateSortIndicators();
          this.renderBody();
          this.options.onChange?.();
        });
        th.append(button);
      }
      if (this.options.filterable?.includes(column.key)) {
        const select = document.createElement('select');
        select.className = 'sheet-filter';
        select.setAttribute('aria-label', `Filtrar ${column.label}`);
        const all = document.createElement('option');
        all.value = '';
        all.textContent = 'Todos';
        select.append(all);
        const values = [...new Set(this.rows.map((row) => String(row[column.key] ?? '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es-CO'));
        for (const value of values) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          select.append(option);
        }
        select.addEventListener('change', () => {
          if (select.value) this.filters.set(column.key, select.value); else this.filters.delete(column.key);
          this.renderBody();
          this.options.onChange?.();
        });
        th.append(select);
      }
      tr.append(th);
    });
    head.append(tr);
    return head;
  }

  private updateSortIndicators(): void {
    this.table.querySelectorAll<HTMLTableCellElement>('thead th[data-key]').forEach((th) => {
      const active = this.sort?.key === th.dataset.key;
      th.setAttribute('aria-sort', active ? (this.sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none');
      const button = th.querySelector<HTMLButtonElement>('.sheet-sort');
      if (button) button.textContent = active ? (this.sort!.dir === 'asc' ? '↑' : '↓') : '↕';
    });
  }

  private display(column: SheetColumn, value: string | number | undefined): string {
    if (value === undefined || value === '') return '';
    if (column.type === 'currency' && typeof value === 'number' && this.currency) return money.format(value);
    if (column.type === 'date') return formatDate(String(value));
    return String(value);
  }

  private renderBody(): void {
    const rows = this.visibleRows();
    this.body.replaceChildren();
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.dataset.id = row.id;
      if (this.options.selectable) {
        tr.tabIndex = 0;
        tr.classList.toggle('is-selected', this.selected === row.id);
        tr.setAttribute('aria-selected', String(this.selected === row.id));
        const select = () => { this.selected = row.id; this.renderBody(); this.options.onChange?.(); };
        tr.addEventListener('click', select);
        tr.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
      }
      const number = document.createElement('th');
      number.scope = 'row';
      number.className = 'sheet-index';
      number.textContent = String(this.rows.indexOf(row) + 2);
      tr.append(number);
      for (const column of this.options.columns) {
        const td = document.createElement('td');
        td.dataset.type = column.type;
        const editor = this.options.editor?.(row, column) ?? null;
        if (editor) td.append(this.renderEditor(row, column, editor));
        else td.textContent = this.display(column, row[column.key]);
        tr.append(td);
      }
      this.body.append(tr);
    });
    this.status.textContent = `${rows.length} de ${this.rows.length} filas`;
    this.updateSortIndicators();
  }

  private renderEditor(row: SheetRow, column: SheetColumn, editor: CellEditor): HTMLElement {
    const id = `${row.id}:${column.key}`;
    const label = `${column.label} de ${row.cliente ?? row.id}`;
    const stop = (event: Event) => event.stopPropagation();
    if (editor.kind === 'select') {
      const select = document.createElement('select');
      select.className = 'sheet-input';
      select.setAttribute('aria-label', label);
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = 'Elige…';
      select.append(blank);
      for (const value of editor.options) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.append(option);
      }
      select.value = this.edits.get(id) ?? '';
      select.addEventListener('click', stop);
      select.addEventListener('change', () => { this.edits.set(id, select.value); this.options.onChange?.(); });
      return select;
    }
    const wrapper = document.createElement('span');
    wrapper.className = 'sheet-cell-edit';
    const input = document.createElement('input');
    input.className = 'sheet-input';
    input.setAttribute('aria-label', editor.kind === 'formula' ? `${label} (escribe una fórmula que empiece con =)` : label);
    input.type = editor.kind === 'formula' || editor.kind === 'text' ? 'text' : editor.kind;
    input.autocomplete = 'off';
    input.spellcheck = false;
    if (editor.kind === 'number') input.inputMode = 'numeric';
    if (editor.kind === 'formula') input.placeholder = '=…';
    input.value = this.edits.get(id) ?? '';
    input.addEventListener('click', stop);
    input.addEventListener('keydown', (event) => event.stopPropagation());
    wrapper.append(input);
    if (editor.kind === 'formula') {
      const value = document.createElement('output');
      value.className = 'sheet-formula-value';
      value.textContent = this.edits.get(id) ? this.computed(row.id, column.key) : '';
      wrapper.append(value);
      input.addEventListener('input', () => { this.edits.set(id, input.value); value.textContent = input.value ? this.computed(row.id, column.key) : ''; this.options.onChange?.(); });
    } else {
      input.addEventListener('input', () => { this.edits.set(id, input.value); this.options.onChange?.(); });
    }
    return wrapper;
  }
}
