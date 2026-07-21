/**
 * orcamento.js — Real Pisos
 * Lógica de cálculo automático e bind de preview ao vivo
 */

'use strict';

// ── Estado global ───────────────────────────────────────────
let items = [];
let itemCounter = 0;

// ── Formatação de moeda (BRL) ───────────────────────────────
const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const parseNum = (str) =>
  parseFloat(str.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;

// ── Bind: campos simples → preview ─────────────────────────
const binds = [
  ['orc-numero',    'preview-numero',    (v) => `Nº ${v || 'ORC-001'}`],
  ['cli-nome',      'preview-cli-nome',  (v) => v || '—'],
  ['cli-telefone',  'preview-cli-telefone', (v) => v || '—'],
  ['cli-email',     null,                null],  // sem preview direto
  ['cli-endereco',  'preview-cli-endereco', (v) => v || '—'],
  ['orc-prazo',     'preview-prazo',     (v) => v || '—'],
  ['orc-pagamento', 'preview-pagamento', (v) => v],
];

function bindField(inputId, previewId, transform) {
  const input = document.getElementById(inputId);
  if (!input || !previewId) return;
  input.addEventListener('input', () => {
    const el = document.getElementById(previewId);
    if (el) el.textContent = transform ? transform(input.value) : input.value;
  });
  // Trigger inicial
  const el = document.getElementById(previewId);
  if (el && transform) el.textContent = transform(input.value);
}

function formatDateBR(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

// ── Cálculo de totais ───────────────────────────────────────
function recalculate() {
  let subtotal = 0;
  let totalDesconto = 0;

  items.forEach((item) => {
    const area    = parseNum(item.area);
    const preco   = parseNum(item.preco);
    const descPct = parseNum(item.desconto);

    const bruto     = area * preco;
    const descVal   = bruto * (descPct / 100);
    item.subtotal   = bruto - descVal;

    subtotal      += bruto;
    totalDesconto += descVal;

    // Atualiza célula de subtotal na tabela
    const cell = document.getElementById(`subtotal-${item.id}`);
    if (cell) cell.textContent = fmt(item.subtotal);
  });

  const total = subtotal - totalDesconto;
  document.getElementById('t-subtotal').textContent = fmt(subtotal);
  document.getElementById('t-desconto').textContent = `— ${fmt(totalDesconto)}`;
  document.getElementById('t-total').textContent    = fmt(total);
}

// ── Adicionar linha de item ─────────────────────────────────
function addItem() {
  itemCounter++;
  const id = itemCounter;
  const item = { id, produto: '', area: '', preco: '', desconto: '0', subtotal: 0 };
  items.push(item);

  const tbody = document.getElementById('items-body');
  const tr = document.createElement('tr');
  tr.id = `row-${id}`;
  tr.innerHTML = `
    <td>
      <input type="text" class="form-input" style="border:none;background:transparent;padding:4px 0;font-size:9pt"
        placeholder="Ex: Piso Laminado 8mm Carvalho"
        oninput="updateItem(${id}, 'produto', this.value)"
      />
    </td>
    <td>
      <input type="number" class="form-input" style="border:none;background:transparent;padding:4px 0;font-size:9pt;width:80px"
        placeholder="0,00" min="0" step="0.01"
        oninput="updateItem(${id}, 'area', this.value)"
      />
    </td>
    <td>
      <input type="number" class="form-input" style="border:none;background:transparent;padding:4px 0;font-size:9pt;width:90px"
        placeholder="0,00" min="0" step="0.01"
        oninput="updateItem(${id}, 'preco', this.value)"
      />
    </td>
    <td>
      <input type="number" class="form-input" style="border:none;background:transparent;padding:4px 0;font-size:9pt;width:60px"
        placeholder="0" min="0" max="100" step="1" value="0"
        oninput="updateItem(${id}, 'desconto', this.value)"
      />
      <span style="font-size:8pt;color:#9A9080">%</span>
    </td>
    <td class="text-right" id="subtotal-${id}" style="font-weight:600">R$ 0,00</td>
    <td style="width:30px">
      <button onclick="removeItem(${id})" style="background:none;border:none;cursor:pointer;color:#9A9080;font-size:12pt;line-height:1" title="Remover">×</button>
    </td>
  `;
  tbody.appendChild(tr);
}

function updateItem(id, field, value) {
  const item = items.find((i) => i.id === id);
  if (item) { item[field] = value; recalculate(); }
}

function removeItem(id) {
  items = items.filter((i) => i.id !== id);
  const row = document.getElementById(`row-${id}`);
  if (row) row.remove();
  recalculate();
}

// ── Datas ───────────────────────────────────────────────────
function initDates() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const iso = `${yyyy}-${mm}-${dd}`;

  const dataInput = document.getElementById('orc-data');
  const validInput = document.getElementById('orc-validade');

  dataInput.value = iso;

  const valid = new Date(today);
  valid.setDate(valid.getDate() + 7);
  const vd = String(valid.getDate()).padStart(2, '0');
  const vm = String(valid.getMonth() + 1).padStart(2, '0');
  validInput.value = `${yyyy}-${vm}-${vd}`;

  document.getElementById('preview-data').textContent = formatDateBR(dataInput.value);
  document.getElementById('preview-validade').textContent = formatDateBR(validInput.value);

  dataInput.addEventListener('change', () => {
    document.getElementById('preview-data').textContent = formatDateBR(dataInput.value);
  });
  validInput.addEventListener('change', () => {
    document.getElementById('preview-validade').textContent = formatDateBR(validInput.value);
  });
}

// ── Observações ─────────────────────────────────────────────
function initObs() {
  const obsInput = document.getElementById('orc-obs');
  obsInput.addEventListener('input', () => {
    const wrapper = document.getElementById('preview-obs-wrapper');
    const span    = document.getElementById('preview-obs');
    if (obsInput.value.trim()) {
      wrapper.style.display = 'block';
      span.textContent = obsInput.value;
    } else {
      wrapper.style.display = 'none';
    }
  });
}

// ── Número do orçamento (auto-incremento simples) ───────────
function initNumero() {
  const stored = localStorage.getItem('rp_orc_counter');
  const counter = stored ? parseInt(stored) + 1 : 1;
  localStorage.setItem('rp_orc_counter', counter);
  const numEl = document.getElementById('orc-numero');
  numEl.value = `ORC-${String(counter).padStart(3, '0')}`;
  document.getElementById('preview-numero').textContent = `Nº ${numEl.value}`;
}

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNumero();
  initDates();
  initObs();

  binds.forEach(([inputId, previewId, transform]) => {
    bindField(inputId, previewId, transform);
  });

  // Adiciona um item inicial vazio para facilitar
  addItem();

  // Pagamento via select
  const pagSelect = document.getElementById('orc-pagamento');
  pagSelect.addEventListener('change', () => {
    document.getElementById('preview-pagamento').textContent = pagSelect.value;
  });
});
