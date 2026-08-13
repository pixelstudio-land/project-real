#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 * generate-pdfs.js — Real Pisos
 * Gerador de PDFs prontos para gráfica via Puppeteer
 *
 * Uso:
 *   node generate-pdfs.js                     → gera todos
 *   node generate-pdfs.js --file folder.html  → gera um específico
 *   node generate-pdfs.js --no-marks          → sem marcas de corte
 *
 * Output: ./output-pdfs/<nome>.pdf
 *
 * Especificação:
 *   • Sangria: 3mm em cada lado (página PDF = trim + 6mm total)
 *   • Marcas de corte: 5mm de comprimento, 1mm de gap
 *   • Resolução: 2× device scale factor (equivalente a 192dpi no viewport)
 *   • Fontes: Google Fonts aguardadas antes do render
 *   • Cores: -webkit-print-color-adjust: exact em todos os elementos
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

const puppeteer        = require('puppeteer');
const path             = require('path');
const fs               = require('fs');
const { pathToFileURL } = require('url');

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────
const BLEED_MM  = 3;   // sangria em mm por lado
const MARK_LEN  = 5;   // comprimento das marcas de corte (mm)
const MARK_GAP  = 1;   // espaço entre borda de sangria e início da marca (mm)

const HTML_DIR   = __dirname;
const OUTPUT_DIR = path.join(__dirname, 'output-pdfs');

// ─────────────────────────────────────────────────────────────
// DEFINIÇÃO DOS MATERIAIS
//   w / h  = tamanho final de corte em mm (sem sangria)
//   O script adiciona 3mm em cada lado automaticamente.
// ─────────────────────────────────────────────────────────────
const MATERIALS = [
  // ── Documentos digitais ──────────────────────────────────
  {
    file : 'orcamento.html',
    name : 'orcamento',
    label: 'Orçamento A4',
    w: 210, h: 297,
  },
  {
    file : 'timbrado.html',
    name : 'timbrado',
    label: 'Papel Timbrado A4',
    w: 210, h: 297,
  },
  {
    file : 'cracha.html',
    name : 'cracha',
    label: 'Crachá 54 × 86 mm',
    w: 54, h: 86,
  },

  // ── Material para gráfica ────────────────────────────────
  {
    file : 'folder.html',
    name : 'folder',
    label: 'Folder A4 dobrado (Frente + Verso)',
    w: 210, h: 297,
  },
  {
    file : 'catalogo.html',
    name : 'catalogo',
    label: 'Catálogo 8 páginas A4',
    w: 210, h: 297,
  },
  {
    file : 'bloco.html',
    name : 'bloco',
    label: 'Bloco A5 — Capa + Contracapa',
    w: 148, h: 210,
  },

  // ── A criar (descomente após criar os HTMLs) ─────────────
  {
    file : 'panfleto.html',
    name : 'panfleto',
    label: 'Panfleto A5 (Frente + Verso)',
    w: 148, h: 210,
  },
  {
    file : 'portfolio.html',
    name : 'portfolio',
    label: 'Portfólio 8 páginas A4',
    w: 210, h: 297,
  },
  {
    file : 'pasta.html',
    name : 'pasta',
    label: 'Pasta A4 com orelha',
    w: 210, h: 297,
  },
  {
    file : 'cartao-cortesia.html',
    name : 'cartao-cortesia',
    label: 'Cartão Cortesia 100 × 150 mm',
    w: 100, h: 150,
  },
  {
    file : 'cartao-real-experience.html',
    name : 'cartao-real-experience',
    label: 'Real Experience Collection 100 × 150 mm',
    w: 100, h: 150,
  },
];

// ─────────────────────────────────────────────────────────────
// CSS INJETADO — sobrescreve o @page com dimensões + sangria
// ─────────────────────────────────────────────────────────────
function buildPrintCSS(w, h) {
  const pw = w + BLEED_MM * 2; // largura total com sangria
  const ph = h + BLEED_MM * 2; // altura total com sangria

  return `
    /* ── @page com sangria ───────────────────────── */
    @page {
      size: ${pw}mm ${ph}mm;
      margin: 0;
      bleed: 3mm;
      marks: crop;
    }

    /* ── Impressão exata de cores e fundos ──────── */
    *,
    *::before,
    *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust:         exact !important;
    }

    /* ── Ocultar elementos de UI ─────────────────── */
    .toolbar,
    .sheet-label,
    .page-label,
    .sidebar,
    .back-link,
    .preview-panel > h2,
    .hub-header,
    .hub-footer,
    .btn-print,
    #btn-print,
    .btn-add-item,
    #btn-add-item,
    .print-hint,
    [onclick="window.print()"] {
      display: none !important;
    }

    /* ── Reset corpo e layout ─────────────────────── */
    html,
    body {
      width:      ${pw}mm !important;
      margin:     0       !important;
      padding:    0       !important;
      background: white   !important;
    }

    /* ── Containers de layout ─────────────────────── */
    .page-wrapper {
      display: block !important;
      width:   ${pw}mm !important;
    }
    .preview-panel {
      display:    block   !important;
      width:      ${pw}mm !important;
      padding:    0       !important;
      background: white   !important;
      overflow:   visible !important;
    }

    /* ── Documentos orcamento / timbrado ─────────── */
    #doc-orcamento,
    #doc-timbrado {
      width:            ${pw}mm !important;
      min-height:       ${ph}mm !important;
      box-shadow:       none    !important;
      margin:           0       !important;
      page-break-after: always  !important;
    }

    /* ── Páginas do catálogo / folder / bloco ─────── */
    /* Cada .page / .sheet = 1 página física no PDF    */
    .page,
    .sheet {
      width:            ${pw}mm !important;
      height:           ${ph}mm !important;
      min-height:       ${ph}mm !important;
      box-shadow:       none    !important;
      margin:           0       !important;
      page-break-after: always  !important;
      overflow:         hidden  !important;
      position:         relative !important;
    }

    /* ── Crachá ───────────────────────────────────── */
    /* O card é posicionado no canto sup-esq do bleed  */
    .cracha-preview-area,
    .badge-scale-wrapper {
      display:         flex          !important;
      justify-content: flex-start    !important;
      align-items:     flex-start    !important;
      padding:         ${BLEED_MM}mm !important;
      background:      white         !important;
    }
    .badge-scale {
      transform: none !important;
      margin:    0    !important;
    }
    #cracha-card {
      width:         ${w}mm !important;
      height:        ${h}mm !important;
      border-radius: 0      !important;
      box-shadow:    none   !important;
    }
  `;
}

// ─────────────────────────────────────────────────────────────
// MARCAS DE CORTE (SVG injetado no DOM)
//   Aparecem em TODAS as páginas por usar position: fixed.
//   Posicionadas nos 4 cantos da borda de corte (trim line).
// ─────────────────────────────────────────────────────────────
function buildCropMarksSVG(w, h) {
  const b = BLEED_MM; // sangria
  const g = MARK_GAP; // gap
  const l = MARK_LEN; // comprimento
  const W = w + b * 2;
  const H = h + b * 2;

  // Helper: linha SVG em coordenadas mm dentro do viewBox
  const ln = (x1, y1, x2, y2) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;

  const marks = [
    // ── Canto superior esquerdo
    ln(b - g - l, b,       b - g,     b      ), // horizontal
    ln(b,         b-g-l,   b,         b - g  ), // vertical

    // ── Canto superior direito
    ln(b+w+g,     b,       b+w+g+l,   b      ),
    ln(b+w,       b-g-l,   b+w,       b - g  ),

    // ── Canto inferior esquerdo
    ln(b-g-l,     b+h,     b-g,       b+h    ),
    ln(b,         b+h+g,   b,         b+h+g+l),

    // ── Canto inferior direito
    ln(b+w+g,     b+h,     b+w+g+l,  b+h    ),
    ln(b+w,       b+h+g,   b+w,       b+h+g+l),
  ].join('');

  return `
    <div id="rp-crop-marks" style="
      position:       fixed;
      top:            0;
      left:           0;
      width:          ${W}mm;
      height:         ${H}mm;
      pointer-events: none;
      z-index:        999999;
      overflow:       visible;
    ">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${W}mm"
        height="${H}mm"
        viewBox="0 0 ${W} ${H}"
        style="overflow: visible;"
      >
        <g
          stroke="#000000"
          stroke-width="0.1"
          stroke-linecap="square"
          fill="none"
        >
          ${marks}
        </g>
      </svg>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// GERAÇÃO DE PDF — processa um material
// ─────────────────────────────────────────────────────────────
async function generatePDF(browser, material, withMarks) {
  const { file, name, label, w, h } = material;
  const filePath   = path.join(HTML_DIR, file);
  const outputPath = path.join(OUTPUT_DIR, `${name}.pdf`);
  const fileUrl    = pathToFileURL(filePath).href;

  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠  Não encontrado: ${file} — pulando.\n`);
    return;
  }

  console.log(`  ▶  ${label}`);

  const page = await browser.newPage();

  try {
    // Viewport = tamanho com sangria a 96dpi × 2 (HiDPI)
    const PX_PER_MM  = 96 / 25.4;
    const vpWidth    = Math.round((w + BLEED_MM * 2) * PX_PER_MM);
    const vpHeight   = Math.round((h + BLEED_MM * 2) * PX_PER_MM);

    await page.setViewport({
      width:             vpWidth,
      height:            vpHeight,
      deviceScaleFactor: 2,
    });

    // Força media print antes de carregar a página
    await page.emulateMediaType('print');

    // Navega para o arquivo local e aguarda rede quieta
    await page.goto(fileUrl, {
      waitUntil: 'networkidle0',
      timeout:   45_000,
    });

    // Aguarda todas as fontes (Google Fonts, etc.) estarem prontas
    await page.evaluate(() => document.fonts.ready);

    // Injeta CSS com @page de sangria + esconde UI
    await page.addStyleTag({ content: buildPrintCSS(w, h) });

    // Injeta marcas de corte (opcional)
    if (withMarks) {
      await page.evaluate((html) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper.firstElementChild);
      }, buildCropMarksSVG(w, h));
    }

    // Pequena pausa para recálculo de layout pós-injeção
    await new Promise(r => setTimeout(r, 300));

    // Exporta PDF
    await page.pdf({
      path:            outputPath,
      width:           `${w + BLEED_MM * 2}mm`,
      height:          `${h + BLEED_MM * 2}mm`,
      printBackground: true,
      margin:          { top: '0', right: '0', bottom: '0', left: '0' },
    });

    const kb = Math.round(fs.statSync(outputPath).size / 1024);
    console.log(`     ✅  output-pdfs/${name}.pdf  (${kb} KB)\n`);

  } catch (err) {
    console.error(`     ❌  Erro em "${file}": ${err.message}\n`);
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  const args       = process.argv.slice(2);
  const fileArg    = args.includes('--file')     ? args[args.indexOf('--file') + 1] : null;
  const noMarks    = args.includes('--no-marks');

  // Filtra materiais se --file foi passado
  const targets = fileArg
    ? MATERIALS.filter(m => m.file === fileArg)
    : MATERIALS.filter(m => fs.existsSync(path.join(HTML_DIR, m.file)));

  if (fileArg && targets.length === 0) {
    console.error(`\n❌  Arquivo "${fileArg}" não encontrado na lista de materiais.\n`);
    process.exit(1);
  }

  // Cria pasta de saída
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  Real Pisos — Gerador de PDFs para Gráfica  ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Sangria:       ${BLEED_MM}mm por lado`);
  console.log(`  Marcas corte:  ${noMarks ? 'desativadas (--no-marks)' : `${MARK_LEN}mm, gap ${MARK_GAP}mm`}`);
  console.log(`  Materiais:     ${targets.length} arquivo(s)`);
  console.log(`  Output:        ./output-pdfs/\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none', // renderização de fontes mais limpa
    ],
  });

  for (const material of targets) {
    await generatePDF(browser, material, !noMarks);
  }

  await browser.close();

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Concluído! PDFs em ./output-pdfs/          ║');
  console.log('╚══════════════════════════════════════════════╝\n');
}

main().catch(err => {
  console.error('\nErro fatal:', err.message);
  process.exit(1);
});
