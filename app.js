const SCALE_NAMES = [
  "Opmærksomhed",
  "Hukommelse",
  "Leg og aktiviteter",
  "Sprog og kommunikative kompetencer",
  "Sociale kompetencer",
  "Selvregulering",
  "Grovmotorik",
  "Finmotorik",
  "Færdigheder i dagligdagen"
];

const SCORE_TO_MONTHS = {
  1: 0, 2: 3, 3: 6, 4: 9, 5: 12, 6: 15, 7: 18,
  8: 24, 9: 30, 10: 36, 11: 42, 12: 48, 13: 60, 14: 72
};

const COLORS = ["#2563eb", "#dc2626", "#059669", "#7c3aed", "#d97706", "#0891b2", "#be185d", "#334155"];
const COLOR_CLASS = COLORS.map((_, idx) => `series-color-${idx}`);
const DEFAULT_DPU = 2;
const PDF_RENDER_WIDTH = 1160;
const LEGACY_STORAGE_KEYS = ["dpu_client_only_state_v1", "dpu_state", "dpu_data"];
const CI_LEVEL = 0.8;
const CI_LABEL = `${Math.round(CI_LEVEL * 100)}% CI`;
const EXAMPLE_ROWS = [
  {
    DPU: "DPU1",
    Alder_år: 3,
    Alder_mdr: 0,
    "Opmærksomhed": 9.8,
    "Hukommelse": 7.5,
    "Leg og aktiviteter": 7.9,
    "Sprog og kommunikative kompetencer": 7.8,
    "Sociale kompetencer": 7.5,
    "Selvregulering": 8.0,
    "Grovmotorik": 9.5,
    "Finmotorik": 9.5,
    "Færdigheder i dagligdagen": 9.5
  },
  {
    DPU: "DPU2",
    Alder_år: 3,
    Alder_mdr: 7,
    "Opmærksomhed": 10.5,
    "Hukommelse": 8.6,
    "Leg og aktiviteter": 8.2,
    "Sprog og kommunikative kompetencer": 8.5,
    "Sociale kompetencer": 8.2,
    "Selvregulering": 8.7,
    "Grovmotorik": 10.5,
    "Finmotorik": 10.5,
    "Færdigheder i dagligdagen": 9.7
  },
  {
    DPU: "DPU3",
    Alder_år: 4,
    Alder_mdr: 2,
    "Opmærksomhed": 11.26,
    "Hukommelse": 9.52,
    "Leg og aktiviteter": 9.68,
    "Sprog og kommunikative kompetencer": 9.71,
    "Sociale kompetencer": 9.57,
    "Selvregulering": 10,
    "Grovmotorik": 12,
    "Finmotorik": 11.9,
    "Færdigheder i dagligdagen": 11.75
  },
  {
    DPU: "DPU4",
    Alder_år: 4,
    Alder_mdr: 7,
    "Opmærksomhed": 11.5,
    "Hukommelse": 10.5,
    "Leg og aktiviteter": 10.95,
    "Sprog og kommunikative kompetencer": 9.95,
    "Sociale kompetencer": 10.2,
    "Selvregulering": 9.6,
    "Grovmotorik": 12.5,
    "Finmotorik": 12.7,
    "Færdigheder i dagligdagen": 11.8
  },
  {
    DPU: "DPU5",
    Alder_år: 5,
    Alder_mdr: 5,
    "Opmærksomhed": 11.9,
    "Hukommelse": 12.5,
    "Leg og aktiviteter": 12.2,
    "Sprog og kommunikative kompetencer": 12.2,
    "Sociale kompetencer": 12,
    "Selvregulering": 11.5,
    "Grovmotorik": 12.8,
    "Finmotorik": 12.8,
    "Færdigheder i dagligdagen": 12.3
  }
];
let chartRenderWidthOverride = null;

let state = { numDpu: DEFAULT_DPU, rows: makeDefaultRows(DEFAULT_DPU) };

clearLegacyBrowserStorage();

const numDpuEl = document.getElementById("numDpu");
const inputTableEl = document.getElementById("inputTable");
const computedTableEl = document.getElementById("computedTable");
const importCsvEl = document.getElementById("importCsv");
const exportCsvEl = document.getElementById("exportCsv");
const exportPdfEl = document.getElementById("exportPdf");
const resetBtnEl = document.getElementById("resetBtn");
const exampleBtnEl = document.getElementById("exampleBtn");

numDpuEl.value = String(state.numDpu);
numDpuEl.setAttribute("autocomplete", "off");

window.addEventListener("pageshow", () => {
  resetState();
});

numDpuEl.addEventListener("change", () => {
  const value = Math.max(DEFAULT_DPU, parseInt(numDpuEl.value, 10) || DEFAULT_DPU);
  state.numDpu = value;
  state.rows = normalizeRows(state.rows, value);
  rerender();
});

resetBtnEl.addEventListener("click", () => {
  const value = Math.max(DEFAULT_DPU, Number(numDpuEl.value) || DEFAULT_DPU);
  state = { numDpu: value, rows: makeDefaultRows(value) };
  rerender();
});

exampleBtnEl.addEventListener("click", () => {
  state.numDpu = EXAMPLE_ROWS.length;
  state.rows = normalizeRows(EXAMPLE_ROWS, EXAMPLE_ROWS.length);
  rerender();
});

importCsvEl.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const importInfo = getImportLineInfo(text);
  const importedCount = Math.max(DEFAULT_DPU, importInfo.dataLineCount);

  state.numDpu = importedCount;
  numDpuEl.value = String(importedCount);

  const parsed = parseCsv(text);
  if (!parsed.rows.length) {
    state.rows = normalizeRows([], importedCount);
    rerender();
    importCsvEl.value = "";
    return;
  }

  const rows = normalizeRows([], importedCount);
  parsed.rows.slice(0, importedCount).forEach((src, idx) => {
    const row = rows[idx];
    row.DPU = String(src.DPU || row.DPU);
    row.Alder_år = clampInt(parseLocaleNumber(src.Alder_år, row.Alder_år), 0, 18);
    if (parsed.hasMonthColumn && src.Alder_mdr !== undefined) {
      row.Alder_mdr = clampInt(parseLocaleNumber(src.Alder_mdr, row.Alder_mdr), 0, 11);
    }
    SCALE_NAMES.forEach((scale) => {
      row[scale] = clamp(parseLocaleNumber(src[scale], row[scale]), 1, 14);
    });
  });

  state.rows = rows;
  rerender();
  importCsvEl.value = "";
});

exportCsvEl.addEventListener("click", () => {
  const rows = normalizeRows(state.rows, state.numDpu);
  const headers = ["DPU", "Alder_år", "Alder_mdr", ...SCALE_NAMES];
  const lines = [headers.join(";")];
  rows.forEach((row) => {
    const cells = headers.map((h) => {
      const value = row[h] ?? "";
      if (typeof value === "number") return String(value).replace(".", ",");
      return String(value);
    });
    lines.push(cells.join(";"));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dpu_scorer.csv";
  a.click();
  URL.revokeObjectURL(url);
});

exportPdfEl.addEventListener("click", async () => {
  await exportReportPdf();
});

async function exportReportPdf() {
  const JsPdfCtor = window.jspdf?.jsPDF;
  if (typeof JsPdfCtor !== "function" || typeof window.html2canvas !== "function") {
    window.alert("PDF-biblioteker kunne ikke indlæses. Prøv at genindlæse siden.");
    return;
  }

  const source = document.querySelector("main.container");
  if (!source) return;

  const originalLabel = exportPdfEl.textContent;
  exportPdfEl.disabled = true;
  exportPdfEl.textContent = "Genererer rapport...";

  chartRenderWidthOverride = PDF_RENDER_WIDTH;
  rerender();
  await new Promise((resolve) => window.requestAnimationFrame(resolve));

  const renderHost = document.createElement("div");
  renderHost.className = "pdf-render-host";

  const clone = source.cloneNode(true);
  clone.classList.add("pdf-render-root");
  clone.style.width = `${PDF_RENDER_WIDTH}px`;
  clone.querySelectorAll(".no-print").forEach((el) => el.remove());
  renderHost.appendChild(clone);
  document.body.appendChild(renderHost);

  try {
    const pdf = new JsPdfCtor({
      orientation: "p",
      unit: "pt",
      format: "a4",
      compress: true
    });

    const marginLeft = 24;
    const marginRight = 24;
    const marginTop = 28;
    const marginBottom = 28;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - marginLeft - marginRight;
    let cursorY = marginTop;

    const ensureSpace = (requiredHeight) => {
      if (cursorY + requiredHeight <= pageHeight - marginBottom) return;
      pdf.addPage();
      cursorY = marginTop;
    };

    const drawParagraph = (text, fontSize = 10, extraGap = 2) => {
      if (!text) return;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(fontSize);
      const lines = pdf.splitTextToSize(text, contentWidth);
      const textHeight = lines.length * (fontSize + 1.8);
      ensureSpace(textHeight + extraGap);
      pdf.text(lines, marginLeft, cursorY);
      cursorY += textHeight + extraGap;
    };

    const addHeadingTopGap = (gap) => {
      if (gap <= 0) return;
      if (cursorY <= marginTop + 1) return;
      ensureSpace(gap);
      cursorY += gap;
    };

    const isInsideNoPrint = (el) => Boolean(el.closest(".no-print"));

    const blocks = [];
    const elements = clone.querySelectorAll("h1, h2, h3, p.notice, p.small, .chart, .chart-shell, table");
    elements.forEach((el) => {
      if (isInsideNoPrint(el)) return;
      if (el.matches(".chart-shell") && el.closest(".chart")) return;
      if ((el.matches("h1, h2, h3, p.notice, p.small")) && (el.closest(".chart") || el.closest(".chart-shell"))) return;

      if (el.matches("table")) {
        blocks.push({ type: "table", el });
        return;
      }
      if (el.matches(".chart, .chart-shell")) {
        blocks.push({ type: "chart", el });
        return;
      }
      const text = (el.textContent || "").trim();
      if (!text) return;
      blocks.push({ type: "text", tag: el.tagName.toLowerCase(), text });
    });

    for (const block of blocks) {
      if (block.type === "text") {
        if (block.tag === "h1") {
          addHeadingTopGap(8);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(17);
          const lines = pdf.splitTextToSize(block.text, contentWidth);
          const h = lines.length * 20;
          ensureSpace(h + 4);
          pdf.text(lines, marginLeft, cursorY);
          cursorY += h;
          continue;
        }
        if (block.tag === "h2") {
          addHeadingTopGap(12);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(13);
          const lines = pdf.splitTextToSize(block.text, contentWidth);
          const h = lines.length * 15;
          ensureSpace(h + 2);
          pdf.text(lines, marginLeft, cursorY);
          cursorY += h;
          continue;
        }
        if (block.tag === "h3") {
          addHeadingTopGap(9);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11.5);
          const lines = pdf.splitTextToSize(block.text, contentWidth);
          const h = lines.length * 13.5;
          ensureSpace(h + 2);
          pdf.text(lines, marginLeft, cursorY);
          cursorY += h;
          continue;
        }
        drawParagraph(block.text, 9.6, 3);
        continue;
      }

      if (block.type === "table") {
        if (typeof pdf.autoTable !== "function") {
          drawParagraph("(Tabel kunne ikke renderes: AutoTable mangler)", 9.2, 4);
          continue;
        }

        pdf.autoTable({
          html: block.el,
          startY: cursorY,
          margin: { left: marginLeft, right: marginRight },
          styles: { font: "helvetica", fontSize: 7.9, cellPadding: 2.2, overflow: "linebreak" },
          headStyles: { fillColor: [248, 250, 253], textColor: [49, 51, 63], fontStyle: "bold" },
          theme: "grid",
          pageBreak: "auto",
          rowPageBreak: "avoid"
        });

        cursorY = (pdf.lastAutoTable?.finalY || cursorY) + 8;
        continue;
      }

      if (block.type === "chart") {
        const canvas = await window.html2canvas(block.el, {
          scale: 1.5,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: PDF_RENDER_WIDTH
        });
        const imgWidth = contentWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        ensureSpace(imgHeight + 6);
        const imgData = canvas.toDataURL("image/png", 0.95);
        pdf.addImage(imgData, "PNG", marginLeft, cursorY, imgWidth, imgHeight, undefined, "FAST");
        cursorY += imgHeight + 6;
      }
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    pdf.save(`dpu_rapport_${timestamp}.pdf`);
  } finally {
    chartRenderWidthOverride = null;
    rerender();
    renderHost.remove();
    exportPdfEl.disabled = false;
    exportPdfEl.textContent = originalLabel;
  }
}

function makeDefaultRows(count) {
  return Array.from({ length: count }, (_, i) => {
    const row = { DPU: `DPU${i + 1}`, Alder_år: 0, Alder_mdr: 0 };
    SCALE_NAMES.forEach((scale) => {
      row[scale] = 8.0;
    });
    return row;
  });
}

function clearLegacyBrowserStorage() {
  try {
    LEGACY_STORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    Object.keys(localStorage)
      .filter((key) => key.toLowerCase().startsWith("dpu_"))
      .forEach((key) => localStorage.removeItem(key));

    Object.keys(sessionStorage)
      .filter((key) => key.toLowerCase().startsWith("dpu_"))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
  }
}

function resetState() {
  state = { numDpu: DEFAULT_DPU, rows: makeDefaultRows(DEFAULT_DPU) };
  numDpuEl.value = String(DEFAULT_DPU);
  pasteAreaEl.value = "";
  rerender();
}

function normalizeRows(rows, count) {
  const base = makeDefaultRows(count);
  return base.map((defaultRow, idx) => {
    const src = rows[idx] || {};
    const row = {
      DPU: String(src.DPU || defaultRow.DPU),
      Alder_år: clampInt(parseLocaleNumber(src.Alder_år, defaultRow.Alder_år), 0, 18),
      Alder_mdr: clampInt(parseLocaleNumber(src.Alder_mdr, defaultRow.Alder_mdr), 0, 11)
    };
    SCALE_NAMES.forEach((scale) => {
      row[scale] = clamp(parseLocaleNumber(src[scale], defaultRow[scale]), 1, 14);
    });
    return row;
  });
}

function parseLocaleNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampInt(value, min, max) {
  return Math.round(clamp(value, min, max));
}

function interpolateDevMonths(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return NaN;
  const keys = Object.keys(SCORE_TO_MONTHS).map(Number).sort((a, b) => a - b);
  if (s <= keys[0]) return SCORE_TO_MONTHS[keys[0]];
  if (s >= keys[keys.length - 1]) return SCORE_TO_MONTHS[keys[keys.length - 1]];

  for (let i = 0; i < keys.length - 1; i += 1) {
    const left = keys[i];
    const right = keys[i + 1];
    if (s >= left && s <= right) {
      const leftMonths = SCORE_TO_MONTHS[left];
      const rightMonths = SCORE_TO_MONTHS[right];
      const ratio = (s - left) / (right - left);
      return leftMonths + ratio * (rightMonths - leftMonths);
    }
  }
  return NaN;
}

function calculateData() {
  const rows = normalizeRows(state.rows, state.numDpu);
  return rows.map((row) => {
    const result = { ...row };
    result.Krono_mdr = row.Alder_år * 12 + row.Alder_mdr;

    const diffs = [];
    const devs = [];
    SCALE_NAMES.forEach((scale) => {
      const devCol = `Udviklingsalder_mdr_${scale}`;
      const diffCol = `Afvigelse_mdr_${scale}`;
      const dev = round1(interpolateDevMonths(row[scale]));
      const diff = round1(dev - result.Krono_mdr);
      result[devCol] = dev;
      result[diffCol] = diff;
      devs.push(dev);
      diffs.push(diff);
    });

    result.Udviklingsalder_mdr_gns = round1(mean(devs));
    result.Afvigelse_mdr_gns = round1(mean(diffs));
    return result;
  });
}

function mean(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length) return NaN;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

function std(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) return NaN;
  const m = mean(clean);
  const variance = clean.reduce((sum, v) => sum + ((v - m) ** 2), 0) / (clean.length - 1);
  return Math.sqrt(variance);
}

function tCritical(df, confidence = CI_LEVEL) {
  if (df <= 0) return NaN;

  const table95 = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.16, 14: 2.145, 15: 2.131, 16: 2.12, 17: 2.11, 18: 2.101, 19: 2.093, 20: 2.086, 21: 2.08, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.06, 26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042 };
  const table80 = { 1: 3.078, 2: 1.886, 3: 1.638, 4: 1.533, 5: 1.476, 6: 1.44, 7: 1.415, 8: 1.397, 9: 1.383, 10: 1.372, 11: 1.363, 12: 1.356, 13: 1.35, 14: 1.345, 15: 1.341, 16: 1.337, 17: 1.333, 18: 1.33, 19: 1.328, 20: 1.325, 21: 1.323, 22: 1.321, 23: 1.319, 24: 1.318, 25: 1.316, 26: 1.315, 27: 1.314, 28: 1.313, 29: 1.311, 30: 1.31 };

  const table = confidence <= 0.8 ? table80 : table95;
  if (table[df]) return table[df];
  return confidence <= 0.8 ? 1.282 : 1.96;
}

function meanCi(values, confidence = CI_LEVEL) {
  const clean = values.filter((v) => Number.isFinite(v));
  const n = clean.length;
  if (!n) return { n: 0, mean: NaN, low: NaN, high: NaN };
  const m = mean(clean);
  if (n < 2) return { n, mean: m, low: NaN, high: NaN };
  const s = std(clean);
  const se = s / Math.sqrt(n);
  const margin = tCritical(n - 1, confidence) * se;
  return { n, mean: m, low: m - margin, high: m + margin };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function renderInputTable() {
  const rows = normalizeRows(state.rows, state.numDpu);
  state.rows = rows;
  const headers = ["DPU", "Alder_år", "Alder_mdr", ...SCALE_NAMES];
  const scaleShortHeaders = [
    "Opmærks.",
    "Hukomm.",
    "Leg og akt.",
    "Sprog og kom.",
    "Soc. komp.",
    "Selvreg.",
    "Grovmot.",
    "Finmot.",
    "Færdigh. daglig."
  ];
  const displayHeaders = ["DPU", "Alder_år", "Alder_mdr", ...scaleShortHeaders];

  const table = document.createElement("table");
  table.className = "input-spreadsheet";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((h, idx) => {
    const th = document.createElement("th");
    th.textContent = displayHeaders[idx] || h;
    th.setAttribute("aria-label", h);
    if (displayHeaders[idx] && displayHeaders[idx] !== h) {
      th.title = h;
    }
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const updateCellState = (rowIndex, header, rawValue) => {
    if (!state.rows[rowIndex]) return;
    const value = String(rawValue ?? "").trim();
    if (header === "DPU") {
      state.rows[rowIndex][header] = value || `DPU_${rowIndex + 1}`;
      return;
    }
    if (header === "Alder_år") {
      state.rows[rowIndex][header] = clampInt(parseLocaleNumber(value, state.rows[rowIndex][header]), 0, 18);
      return;
    }
    if (header === "Alder_mdr") {
      state.rows[rowIndex][header] = clampInt(parseLocaleNumber(value, state.rows[rowIndex][header]), 0, 11);
      return;
    }
    state.rows[rowIndex][header] = clamp(parseLocaleNumber(value, state.rows[rowIndex][header]), 1, 14);
  };

  const focusCell = (rowIndex, colIndex) => {
    const selector = `td[data-row='${rowIndex}'][data-col='${colIndex}']`;
    const target = tbody.querySelector(selector);
    if (!target) return;
    target.focus();
    const range = document.createRange();
    range.selectNodeContents(target);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  rows.forEach((row, rIdx) => {
    const tr = document.createElement("tr");
    headers.forEach((h, cIdx) => {
      const td = document.createElement("td");
      td.contentEditable = "true";
      td.spellcheck = false;
      td.setAttribute("role", "gridcell");
      td.setAttribute("aria-label", `${headers[cIdx]} række ${rIdx + 1}`);
      td.dataset.row = String(rIdx);
      td.dataset.col = String(cIdx);
      const value = row[h];
      td.textContent = typeof value === "number" ? String(value).replace(".", ",") : String(value);

      td.addEventListener("focus", () => {
        const range = document.createRange();
        range.selectNodeContents(td);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      });

      td.addEventListener("blur", () => {
        updateCellState(rIdx, h, td.textContent);
        rerenderDataViews();
      });

      td.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          updateCellState(rIdx, h, td.textContent);
          rerenderDataViews();
          focusCell(Math.min(rows.length - 1, rIdx + 1), cIdx);
        }
      });

      td.addEventListener("paste", (event) => {
        const pastedText = event.clipboardData?.getData("text/plain") || "";
        if (!pastedText) return;
        event.preventDefault();
        const pastedRows = pastedText
          .replace(/\r/g, "")
          .split("\n")
          .filter((line, idx, arr) => !(idx === arr.length - 1 && line === ""))
          .map((line) => line.split("\t"));

        const requiredRows = rIdx + pastedRows.length;
        if (requiredRows > state.numDpu) {
          state.numDpu = requiredRows;
          state.rows = normalizeRows(state.rows, requiredRows);
        }

        pastedRows.forEach((pastedRow, rowOffset) => {
          const targetRow = rIdx + rowOffset;
          if (targetRow >= state.rows.length) return;
          pastedRow.forEach((cellValue, colOffset) => {
            const targetCol = cIdx + colOffset;
            if (targetCol >= headers.length) return;
            updateCellState(targetRow, headers[targetCol], cellValue);
          });
        });

        rerender();
      });

      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  inputTableEl.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.appendChild(table);
  inputTableEl.appendChild(wrap);
}

function renderComputedTable(data) {
  const headers = ["DPU", "Krono_mdr", "Udviklingsalder_mdr_gns", "Afvigelse_mdr_gns", "n", "80% CI lav", "80% CI høj"];
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const htr = document.createElement("tr");
  headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    htr.appendChild(th);
  });
  thead.appendChild(htr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  data.forEach((row) => {
    const values = SCALE_NAMES.map((scale) => row[`Afvigelse_mdr_${scale}`]);
    const ci = meanCi(values);
    const mergedRow = {
      DPU: row.DPU,
      Krono_mdr: row.Krono_mdr,
      Udviklingsalder_mdr_gns: row.Udviklingsalder_mdr_gns,
      Afvigelse_mdr_gns: row.Afvigelse_mdr_gns,
      n: ci.n,
      "80% CI lav": ci.low,
      "80% CI høj": ci.high
    };

    const tr = document.createElement("tr");
    headers.forEach((h) => {
      const td = document.createElement("td");
      const value = mergedRow[h];
      if (!Number.isFinite(value)) {
        td.textContent = String(value ?? "-");
      } else if (h === "n") {
        td.textContent = String(Math.round(value));
      } else {
        td.textContent = String(value).replace(".", ",");
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  computedTableEl.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.appendChild(table);
  computedTableEl.appendChild(wrap);
}

function renderCharts(data) {
  const combinedSeries = [];
  const latestKrono = data.length ? Math.max(...data.map((row) => row.Krono_mdr)) : NaN;
  data.forEach((row, idx) => {
    combinedSeries.push({
      name: `${row.DPU} - DPU-alder`,
      values: SCALE_NAMES.map((s) => row[`Udviklingsalder_mdr_${s}`]),
      colorClass: COLOR_CLASS[idx % COLORS.length]
    });
    combinedSeries.push({
      name: `${row.DPU} - Kronologisk`,
      values: SCALE_NAMES.map(() => row.Krono_mdr),
      colorClass: COLOR_CLASS[idx % COLORS.length],
      dashed: true,
      initiallyVisible: row.Krono_mdr === latestKrono
    });
  });
  renderLineChart(document.getElementById("chartCombinedProfile"), SCALE_NAMES, combinedSeries, "Alder (mdr)", { height: 615 });

  const diffSeries = data.map((row, idx) => ({
    name: row.DPU,
    values: SCALE_NAMES.map((s) => row[`Afvigelse_mdr_${s}`]),
    colorClass: COLOR_CLASS[idx % COLORS.length]
  }));
  renderLineChart(document.getElementById("chartCombinedDiff"), SCALE_NAMES, diffSeries, "Afvigelse (mdr)", { zeroLine: 0, height: 585 });

  const dataByAge = [...data].sort((a, b) => a.Krono_mdr - b.Krono_mdr);
  renderLineChart(
    document.getElementById("chartDeviationVsChrono"),
    dataByAge.map((row) => row.DPU),
    [
      {
        name: "Afvigelse gns (mdr)",
        values: dataByAge.map((row) => row.Afvigelse_mdr_gns),
        colorClass: "series-color-1"
      }
    ],
    "Afvigelse (mdr)",
    {
      zeroLine: 0,
      height: 360,
      xValues: dataByAge.map((row) => row.Krono_mdr)
    }
  );

  const crossContainer = document.getElementById("crossCharts");
  crossContainer.innerHTML = "";
  SCALE_NAMES.forEach((scale) => {
    const box = document.createElement("div");
    box.className = "chart";
    const title = document.createElement("div");
    title.textContent = scale;
    title.className = "scale-chart-title";
    box.appendChild(title);

    const host = document.createElement("div");
    box.appendChild(host);

    renderLineChart(
      host,
      dataByAge.map((r) => r.DPU),
      [
        { name: "DPU-alder", values: dataByAge.map((r) => r[`Udviklingsalder_mdr_${scale}`]), colorClass: "series-color-0" },
        { name: "Kronologisk", values: dataByAge.map((r) => r.Krono_mdr), colorClass: "series-color-muted", dashed: true }
      ],
      "Alder (mdr)",
      { height: 280, xValues: dataByAge.map((r) => r.Krono_mdr) }
    );

    crossContainer.appendChild(box);
  });
}

function renderLineChart(container, labels, series, yLabel, options = {}) {
  const zeroLine = Object.prototype.hasOwnProperty.call(options, "zeroLine") ? options.zeroLine : null;
  const ciBandOption = options.ciBand;
  const hasCiBand = Boolean(ciBandOption
    && Array.isArray(ciBandOption.lowValues)
    && Array.isArray(ciBandOption.highValues)
    && ciBandOption.lowValues.length === labels.length
    && ciBandOption.highValues.length === labels.length);
  const ciBandInitiallyVisible = hasCiBand ? ciBandOption.initiallyVisible !== false : false;
  const hasNumericXValues = Array.isArray(options.xValues)
    && options.xValues.length === labels.length
    && options.xValues.every((value) => Number.isFinite(value));
  const xValues = hasNumericXValues ? options.xValues : labels.map((_, idx) => idx);
  const width = Math.max(360, chartRenderWidthOverride || container.clientWidth || container.parentElement?.clientWidth || 900);
  const height = options.height || 300;
  const maxLabelLength = labels.reduce((maxLen, label) => Math.max(maxLen, String(label).length), 0);
  const hasLongLabels = labels.some((label) => String(label).length > 14);
  const xLabelFontSize = 11;
  const longLabelBottom = Math.min(180, 106 + Math.max(0, Math.round((maxLabelLength - 14) * 2.1)));
  const margin = { top: 18, right: 28, bottom: hasLongLabels ? longLabelBottom : 58, left: 84 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const values = [
    ...series.flatMap((s) => s.values),
    ...(hasCiBand ? [...ciBandOption.lowValues, ...ciBandOption.highValues] : [])
  ].filter((v) => Number.isFinite(v));
  if (!values.length) {
    container.innerHTML = "<p class='small'>Ingen data</p>";
    return;
  }

  let minY = Math.min(...values);
  let maxY = Math.max(...values);
  if (zeroLine !== null) {
    minY = Math.min(minY, zeroLine);
    maxY = Math.max(maxY, zeroLine);
  }
  const pad = Math.max(2, Math.round((maxY - minY) * 0.08));
  minY -= pad;
  maxY += pad;
  if (minY === maxY) maxY = minY + 1;

  let minX = Math.min(...xValues);
  let maxX = Math.max(...xValues);
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    minX = 0;
    maxX = Math.max(labels.length - 1, 1);
  }
  if (minX === maxX) {
    minX -= 0.5;
    maxX += 0.5;
  }
  const xEdgeInset = hasLongLabels ? Math.min(56, 24 + Math.round((maxLabelLength - 14) * 0.9)) : 0;
  const innerPlotW = Math.max(1, plotW - xEdgeInset * 2);
  const xPos = (i) => margin.left + xEdgeInset + ((xValues[i] - minX) / (maxX - minX)) * innerPlotW;
  const yPos = (v) => margin.top + ((maxY - v) / (maxY - minY)) * plotH;

  const ticks = 5;
  const gradId = `g${Math.random().toString(36).slice(2, 9)}`;
  let svg = `<svg class='chart-svg' viewBox='0 0 ${width} ${height}' width='100%' height='${height}' preserveAspectRatio='xMidYMid meet'>`;
  svg += `<defs><linearGradient id='${gradId}' x1='0%' y1='0%' x2='0%' y2='100%'><stop offset='0%' stop-color='#f8fbff'/><stop offset='100%' stop-color='#ffffff'/></linearGradient></defs>`;
  svg += `<rect x='${margin.left}' y='${margin.top}' width='${plotW}' height='${plotH}' fill='url(#${gradId})' stroke='#eef2f8'/>`;
  svg += `<line x1='${margin.left}' y1='${margin.top}' x2='${margin.left}' y2='${margin.top + plotH}' stroke='#9ca3af'/>`;
  svg += `<line x1='${margin.left}' y1='${margin.top + plotH}' x2='${margin.left + plotW}' y2='${margin.top + plotH}' stroke='#9ca3af'/>`;

  for (let t = 0; t <= ticks; t += 1) {
    const yVal = minY + ((maxY - minY) * t) / ticks;
    const y = yPos(yVal);
    svg += `<line x1='${margin.left}' y1='${y}' x2='${margin.left + plotW}' y2='${y}' stroke='#ecf1f7'/>`;
    svg += `<text x='${margin.left - 8}' y='${y + 4}' text-anchor='end' font-size='10' fill='#6b7280'>${yVal.toFixed(1).replace('.', ',')}</text>`;
  }

  labels.forEach((label, i) => {
    const x = xPos(i);
    const y = margin.top + plotH + (hasLongLabels ? 34 : 16);
    if (hasLongLabels) {
      svg += `<text x='${x}' y='${y}' text-anchor='end' transform='rotate(-30 ${x} ${y})' font-size='${xLabelFontSize}' fill='#6b7280'>${escapeXml(label)}</text>`;
    } else {
      svg += `<text x='${x}' y='${y}' text-anchor='middle' font-size='${xLabelFontSize}' fill='#6b7280'>${escapeXml(label)}</text>`;
    }
  });

  if (zeroLine !== null) {
    const y = yPos(zeroLine);
    svg += `<line x1='${margin.left}' y1='${y}' x2='${margin.left + plotW}' y2='${y}' stroke='#64748b' stroke-dasharray='5 4'/>`;
  }

  if (hasCiBand) {
    const segments = [];
    let currentSegment = [];
    for (let i = 0; i < labels.length; i += 1) {
      const low = ciBandOption.lowValues[i];
      const high = ciBandOption.highValues[i];
      if (Number.isFinite(low) && Number.isFinite(high)) {
        currentSegment.push(i);
      } else if (currentSegment.length) {
        segments.push(currentSegment);
        currentSegment = [];
      }
    }
    if (currentSegment.length) {
      segments.push(currentSegment);
    }

    const bandColor = ciBandOption.color || "#6b7280";
    const bandOpacity = Number.isFinite(ciBandOption.opacity) ? ciBandOption.opacity : 0.2;
    const visibilityAttr = ciBandInitiallyVisible ? "" : " style='display:none'";
    segments.forEach((segment) => {
      if (segment.length === 1) {
        const idx = segment[0];
        const x = xPos(idx);
        const yLow = yPos(ciBandOption.lowValues[idx]);
        const yHigh = yPos(ciBandOption.highValues[idx]);
        svg += `<line data-ci-band='true' x1='${x}' y1='${yLow}' x2='${x}' y2='${yHigh}' stroke='${bandColor}' stroke-opacity='${Math.min(1, bandOpacity + 0.25)}' stroke-width='6'${visibilityAttr} />`;
        return;
      }

      const lowPath = segment.map((idx) => `${xPos(idx)},${yPos(ciBandOption.lowValues[idx])}`);
      const highPath = [...segment].reverse().map((idx) => `${xPos(idx)},${yPos(ciBandOption.highValues[idx])}`);
      svg += `<polygon data-ci-band='true' points='${[...lowPath, ...highPath].join(" ")}' fill='${bandColor}' fill-opacity='${bandOpacity}' stroke='none'${visibilityAttr} />`;
    });
  }

  series.forEach((s, seriesIdx) => {
    const visible = s.initiallyVisible !== false;
    const visibilityAttr = visible ? "" : " style='display:none'";
    const pts = s.values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(" ");
    const lineClass = `series-line ${s.colorClass || "series-color-0"}${s.dashed ? " dashed" : ""}`;
    svg += `<polyline class='${lineClass}' data-series-index='${seriesIdx}' points='${pts}' fill='none' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'${visibilityAttr} />`;
    s.values.forEach((v, i) => {
      const tip = `${s.name} | ${labels[i]}: ${Number(v).toFixed(1).replace('.', ',')}`;
      const pointClass = `series-point ${s.colorClass || "series-color-0"}`;
      svg += `<circle class='${pointClass}' data-series-index='${seriesIdx}' cx='${xPos(i)}' cy='${yPos(v)}' r='3.2'${visibilityAttr}><title>${escapeXml(tip)}</title></circle>`;
    });
  });

  svg += `<text x='14' y='${margin.top + plotH / 2}' transform='rotate(-90, 14, ${margin.top + plotH / 2})' font-size='10' fill='#6b7280'>${escapeXml(yLabel)}</text>`;
  svg += "</svg>";

  const legend = series
    .map((s, idx) => {
      const visible = s.initiallyVisible !== false;
      const lineClass = `legend-line ${s.colorClass || "series-color-0"}${s.dashed ? " dashed" : ""}`;
      const itemClass = `legend-item legend-toggle${visible ? "" : " is-off"}`;
      return `<span class='${itemClass}' role='button' tabindex='0' aria-pressed='${visible ? "true" : "false"}' data-series-index='${idx}'><span class='${lineClass}'></span>${escapeXml(s.name)}</span>`;
    })
    .join("");
  const ciToggle = hasCiBand
    ? `<button type='button' class='chart-ci-toggle' aria-pressed='${ciBandInitiallyVisible ? "true" : "false"}'>${ciBandInitiallyVisible ? "Skjul" : "Vis"} ${escapeXml(ciBandOption.label || CI_LABEL)}</button>`
    : "";
  container.innerHTML = `<div class='chart-shell'><div class='chart-head'>${ciToggle}<div class='chart-legend'>${legend}</div></div>${svg}</div>`;

  const setSeriesVisible = (seriesIndex, visible) => {
    const chartElements = container.querySelectorAll(`.chart-svg [data-series-index='${seriesIndex}']`);
    chartElements.forEach((element) => {
      element.style.display = visible ? "" : "none";
    });

    const legendItem = container.querySelector(`.legend-item[data-series-index='${seriesIndex}']`);
    if (!legendItem) return;
    legendItem.classList.toggle("is-off", !visible);
    legendItem.setAttribute("aria-pressed", visible ? "true" : "false");
  };

  container.querySelectorAll(".legend-item[data-series-index]").forEach((legendItem) => {
    const seriesIndex = Number(legendItem.getAttribute("data-series-index"));
    const toggle = () => {
      const isVisible = legendItem.getAttribute("aria-pressed") !== "false";
      setSeriesVisible(seriesIndex, !isVisible);
    };

    legendItem.addEventListener("click", toggle);
    legendItem.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    });
  });

  const ciToggleBtn = container.querySelector(".chart-ci-toggle");
  if (ciToggleBtn) {
    const setCiBandVisible = (visible) => {
      container.querySelectorAll(".chart-svg [data-ci-band='true']").forEach((element) => {
        element.style.display = visible ? "" : "none";
      });
      ciToggleBtn.setAttribute("aria-pressed", visible ? "true" : "false");
      ciToggleBtn.textContent = `${visible ? "Skjul" : "Vis"} ${ciBandOption.label || CI_LABEL}`;
    };

    ciToggleBtn.addEventListener("click", () => {
      const isVisible = ciToggleBtn.getAttribute("aria-pressed") !== "false";
      setCiBandVisible(!isVisible);
    });
  }
}

function renderStats(data) {
  renderSummaryOverview(data);
  renderDeviationSummaries(data);
  renderDeviationCharts(data);
  renderAgeCiSummary(data);
  renderEstimatedAgeAtLastMeasurement(data);
  renderLastDpuCiReferenceChart(data);
  renderWilcoxonSection(data);

  renderGenericTable(
    document.getElementById("statsScale"),
    ["Skala", "n", "Gns afvigelse (mdr)", "Min afvigelse (mdr)", "Max afvigelse (mdr)", `${CI_LABEL} lav`, `${CI_LABEL} høj`],
    buildScaleDeviationSummaryRows(data),
    {
      valueStyles: {
        "Gns afvigelse (mdr)": (value) => ({ color: deviationMeanColor(value), fontWeight: "700" })
      }
    }
  );

  const dpuContainer = document.getElementById("statsDpu");
  if (dpuContainer) {
    dpuContainer.innerHTML = "";
  }
}

function renderSummaryOverview(data) {
  const container = document.getElementById("summaryOverview");
  if (!container) return;
  if (!data.length) {
    container.innerHTML = "<p class='small'>Ingen data.</p>";
    return;
  }

  const sorted = [...data].sort((a, b) => a.Krono_mdr - b.Krono_mdr);
  const last = sorted[sorted.length - 1];

  const totalDeviationCi = meanCi(data.map((row) => row.Afvigelse_mdr_gns));
  const totalTrend = linearTrend(
    data.map((row) => row.Krono_mdr),
    data.map((row) => row.Udviklingsalder_mdr_gns)
  );
  const totalEffect = fitMagnitudeLabel(totalTrend.rSquared);
  const totalEstimatedAge = Number.isFinite(totalDeviationCi.mean)
    ? last.Krono_mdr + totalDeviationCi.mean
    : NaN;

  const scaleCards = SCALE_NAMES.map((scale) => {
    const deviationValues = data.map((row) => row[`Afvigelse_mdr_${scale}`]).filter((v) => Number.isFinite(v));
    const deviationCi = meanCi(deviationValues);
    const trend = linearTrend(
      data.map((row) => row.Krono_mdr),
      data.map((row) => row[`Udviklingsalder_mdr_${scale}`])
    );

    return {
      scale,
      deviationMean: deviationCi.mean,
      slopePerYear: trend.slopePerYear,
      effect: fitMagnitudeLabel(trend.rSquared)
    };
  });

  const renderMetric = (label, value, valueStyle = "") => `
    <div class='summary-metric'>
      <span class='summary-metric-label'>${escapeHtml(label)}</span>
      <span class='summary-metric-value'${valueStyle ? ` style='${valueStyle}'` : ""}>${escapeHtml(value)}</span>
    </div>
  `;

  container.innerHTML = `
    <div class='chart summary-overview'>
      <div class='summary-layout'>
        <article class='summary-tile summary-tile-main'>
          <div class='summary-title'>Hele skalaen</div>
          ${renderMetric("Kronologisk alder", formatMonthsAsYearMonth(last.Krono_mdr)) }
          ${renderMetric("Estimeret alder", formatMonthsAsYearMonth(totalEstimatedAge)) }
          ${renderMetric("Afvigelse", formatMonthsAsYearMonth(totalDeviationCi.mean), `color:${deviationMeanColor(totalDeviationCi.mean)};font-weight:700;`) }
          ${renderMetric("Hældning", `${fmt(totalTrend.slopePerYear)} mdr/år`, `color:${slopeYearColor(totalTrend.slopePerYear)};font-weight:700;`) }
          ${renderMetric("Effektstørrelse", totalEffect, `color:${effectMagnitudeColor(totalEffect)};font-weight:700;`) }
        </article>

        <div class='summary-grid'>
          ${scaleCards.map((card) => `
            <article class='summary-tile summary-tile-scale'>
              <div class='summary-title'>${escapeHtml(card.scale)}</div>
              ${renderMetric("Afvigelse", `${fmt(card.deviationMean)} mdr`, `color:${deviationMeanColor(card.deviationMean)};font-weight:700;`) }
              ${renderMetric("Udvikling", `${fmt(card.slopePerYear)} mdr/år`, `color:${slopeYearColor(card.slopePerYear)};font-weight:700;`) }
              ${renderMetric("Effektstørrelse", card.effect, `color:${effectMagnitudeColor(card.effect)};font-weight:700;`) }
            </article>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderLastDpuCiReferenceChart(data) {
  const container = document.getElementById("lastDpuCiReferenceChart");
  if (!container) return;
  if (!data.length) {
    container.innerHTML = "<p class='small'>Ingen data.</p>";
    return;
  }

  const sorted = [...data].sort((a, b) => a.Krono_mdr - b.Krono_mdr);
  const last = sorted[sorted.length - 1];
  const refAge = last.Krono_mdr;

  const totalCi = meanCi(data.map((row) => row.Afvigelse_mdr_gns));
  const entries = [
    {
      label: "Total (gns)",
      meanAge: refAge + totalCi.mean,
      lowAge: Number.isFinite(totalCi.low) ? refAge + totalCi.low : NaN,
      highAge: Number.isFinite(totalCi.high) ? refAge + totalCi.high : NaN,
      observedAge: last.Udviklingsalder_mdr_gns
    }
  ];

  SCALE_NAMES.forEach((scale) => {
    const ci = meanCi(data.map((row) => row[`Afvigelse_mdr_${scale}`]));
    entries.push({
      label: scale,
      meanAge: refAge + ci.mean,
      lowAge: Number.isFinite(ci.low) ? refAge + ci.low : NaN,
      highAge: Number.isFinite(ci.high) ? refAge + ci.high : NaN,
      observedAge: last[`Udviklingsalder_mdr_${scale}`]
    });
  });

  const allValues = entries.flatMap((entry) => [entry.lowAge, entry.highAge, entry.meanAge, entry.observedAge, refAge])
    .filter((v) => Number.isFinite(v));

  if (!allValues.length) {
    container.innerHTML = "<p class='small'>Ingen CI-data tilgængelig.</p>";
    return;
  }

  const width = Math.max(620, container.clientWidth || 960);
  const rowHeight = 30;
  const topPad = 36;
  const bottomPad = 34;
  const leftPad = 220;
  const rightPad = 28;
  const height = topPad + bottomPad + entries.length * rowHeight;
  const plotW = width - leftPad - rightPad;

  let minX = Math.min(...allValues);
  let maxX = Math.max(...allValues);
  if (minX === maxX) maxX = minX + 1;
  const pad = Math.max(2, Math.round((maxX - minX) * 0.08));
  minX -= pad;
  maxX += pad;

  const xPos = (value) => leftPad + ((value - minX) / (maxX - minX)) * plotW;
  const yPos = (idx) => topPad + idx * rowHeight + rowHeight / 2;

  const ticks = 6;
  let svg = `<svg class='chart-svg' viewBox='0 0 ${width} ${height}' width='100%' height='${height}'>`;
  svg += `<rect x='${leftPad}' y='${topPad - 12}' width='${plotW}' height='${entries.length * rowHeight + 8}' fill='#ffffff' stroke='#eef2f8'/>`;

  for (let t = 0; t <= ticks; t += 1) {
    const xVal = minX + ((maxX - minX) * t) / ticks;
    const x = xPos(xVal);
    svg += `<line x1='${x}' y1='${topPad - 12}' x2='${x}' y2='${topPad + entries.length * rowHeight - 4}' stroke='#edf1f7'/>`;
    svg += `<text x='${x}' y='${height - 12}' text-anchor='middle' font-size='10' fill='#6b7280'>${xVal.toFixed(1).replace('.', ',')}</text>`;
  }

  const refX = xPos(refAge);
  svg += `<line x1='${refX}' y1='${topPad - 14}' x2='${refX}' y2='${topPad + entries.length * rowHeight - 2}' stroke='#111111' stroke-width='1.5'/>`;
  svg += `<text x='${refX + 6}' y='${topPad - 18}' font-size='10' fill='#111111'>Kronologisk alder (${fmt(refAge)} mdr)</text>`;

  entries.forEach((entry, idx) => {
    const y = yPos(idx);
    svg += `<text x='${leftPad - 10}' y='${y + 4}' text-anchor='end' font-size='11' fill='#31333f'>${escapeXml(entry.label)}</text>`;

    if (Number.isFinite(entry.lowAge) && Number.isFinite(entry.highAge)) {
      svg += `<line x1='${xPos(entry.lowAge)}' y1='${y}' x2='${xPos(entry.highAge)}' y2='${y}' stroke='#1f2937' stroke-width='2'/>`;
      svg += `<line x1='${xPos(entry.lowAge)}' y1='${y - 5}' x2='${xPos(entry.lowAge)}' y2='${y + 5}' stroke='#1f2937'/>`;
      svg += `<line x1='${xPos(entry.highAge)}' y1='${y - 5}' x2='${xPos(entry.highAge)}' y2='${y + 5}' stroke='#1f2937'/>`;
    }

    if (Number.isFinite(entry.meanAge)) {
      svg += `<circle cx='${xPos(entry.meanAge)}' cy='${y}' r='4.5' fill='#2563eb'><title>Estimeret alder: ${fmt(entry.meanAge)} mdr</title></circle>`;
    }

    if (Number.isFinite(entry.observedAge)) {
      svg += `<circle cx='${xPos(entry.observedAge)}' cy='${y}' r='3' fill='#d97706'><title>Observeret sidste DPU: ${fmt(entry.observedAge)} mdr</title></circle>`;
    }
  });

  svg += "</svg>";

  container.innerHTML = `
    <div class='chart-shell'>
      <div class='small'>Blå punkt = estimeret alder fra afvigelsesmiddel. Linje = ${CI_LABEL}. Orange punkt = observeret alder ved sidste DPU.</div>
      ${svg}
    </div>
  `;
}

function renderWilcoxonSection(data) {
  const container = document.getElementById("wilcoxonSection");
  if (!container) return;

  const yearPairs = buildYearToYearPairs(data);
  const adjacentPairs = buildAdjacentPairs(data);
  const usedPairs = yearPairs.length > 0 ? yearPairs : adjacentPairs;
  const pairingLabel = yearPairs.length > 0
    ? "Parring: 12±6 mdr (år-til-år)"
    : "Parring: nabomålinger (fallback)";

  if (!usedPairs.length) {
    container.innerHTML = "<p class='small'>Ingen par fundet til Wilcoxon-test (kræver mindst to målinger).</p>";
    return;
  }

  const totalTrend = linearTrend(
    data.map((row) => row.Krono_mdr),
    data.map((row) => row.Udviklingsalder_mdr_gns)
  );

  const rows = [
    {
      Skala: "Hele skalaen",
      "Hældning (mdr/år)": totalTrend.slopePerYear,
      "Line-fit r": totalTrend.r,
      "Line-fit R²": totalTrend.rSquared,
      "Fit niveau": fitMagnitudeLabel(totalTrend.rSquared)
    },
    ...SCALE_NAMES.map((scale) => {
    const deltas = usedPairs.map(
      (pair) => pair.to[`Udviklingsalder_mdr_${scale}`] - pair.from[`Udviklingsalder_mdr_${scale}`]
    );
    const result = wilcoxonSignedRank(deltas);
    const trend = linearTrend(
      data.map((row) => row.Krono_mdr),
      data.map((row) => row[`Udviklingsalder_mdr_${scale}`])
    );

    let interpretation = "Ikke nok data";
    if (result.allZero) {
      interpretation = "Ingen ændring";
    } else if (result.tooFewPairs) {
      interpretation = "For få par";
    } else if (Number.isFinite(result.rankBiserial)) {
      interpretation = effectMagnitudeLabel(result.rankBiserial);
    }

    return {
      Skala: scale,
      "Hældning (mdr/år)": trend.slopePerYear,
      "Line-fit r": trend.r,
      "Line-fit R²": trend.rSquared,
      "Fit niveau": fitMagnitudeLabel(trend.rSquared)
    };
  })
  ];

  renderGenericTable(
    container,
    ["Skala", "Hældning (mdr/år)", "Line-fit r", "Line-fit R²", "Fit niveau"],
    rows,
    {
      valueStyles: {
        "Hældning (mdr/år)": (value) => ({ color: slopeYearColor(value), fontWeight: "700" }),
        "Fit niveau": (value) => ({ color: effectMagnitudeColor(value), fontWeight: "700" })
      }
    }
  );
}

function buildYearToYearPairs(data) {
  const sorted = [...data].sort((a, b) => a.Krono_mdr - b.Krono_mdr);
  const pairs = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const monthDiff = curr.Krono_mdr - prev.Krono_mdr;
    if (monthDiff >= 6 && monthDiff <= 18) {
      pairs.push({ from: prev, to: curr });
    }
  }
  return pairs;
}

function buildAdjacentPairs(data) {
  const sorted = [...data].sort((a, b) => a.Krono_mdr - b.Krono_mdr);
  const pairs = [];
  for (let i = 1; i < sorted.length; i += 1) {
    pairs.push({ from: sorted[i - 1], to: sorted[i] });
  }
  return pairs;
}

function wilcoxonSignedRank(differences) {
  const finite = differences.filter((d) => Number.isFinite(d));
  const clean = finite.filter((d) => d !== 0);
  const nPairs = finite.length;
  const nEffective = clean.length;
  const allZero = nPairs >= 1 && nEffective === 0;
  const meanDelta = round2(mean(finite));
  const sdDelta = std(finite);
  const srm = Number.isFinite(sdDelta) && sdDelta > 0 ? round2(mean(finite) / sdDelta) : NaN;

  if (allZero) {
    return {
      nPairs,
      nEffective,
      medianDelta: round2(median(finite)),
      meanDelta,
      wStatistic: 0,
      zScore: 0,
      pValue: 1,
      rankBiserial: 0,
      srm: 0,
      allZero: true,
      tooFewPairs: false
    };
  }

  if (nPairs < 2 || nEffective < 2) {
    return {
      nPairs,
      nEffective,
      medianDelta: Number.isFinite(median(differences)) ? round2(median(differences)) : NaN,
      meanDelta,
      wStatistic: NaN,
      zScore: NaN,
      pValue: NaN,
      rankBiserial: NaN,
      srm,
      allZero: false,
      tooFewPairs: true
    };
  }

  const n = nEffective;

  const absWithSign = clean.map((d) => ({ sign: Math.sign(d), abs: Math.abs(d) }));
  absWithSign.sort((a, b) => a.abs - b.abs);

  let idx = 0;
  while (idx < absWithSign.length) {
    let j = idx;
    while (j < absWithSign.length && absWithSign[j].abs === absWithSign[idx].abs) {
      j += 1;
    }
    const rankStart = idx + 1;
    const rankEnd = j;
    const averageRank = (rankStart + rankEnd) / 2;
    for (let k = idx; k < j; k += 1) {
      absWithSign[k].rank = averageRank;
    }
    idx = j;
  }

  let wPlus = 0;
  let wMinus = 0;
  absWithSign.forEach((entry) => {
    if (entry.sign > 0) {
      wPlus += entry.rank;
    } else {
      wMinus += entry.rank;
    }
  });

  const wStatistic = Math.min(wPlus, wMinus);
  const totalRank = (n * (n + 1)) / 2;
  const rankBiserial = (wPlus - wMinus) / totalRank;
  const meanW = (n * (n + 1)) / 4;
  const varW = (n * (n + 1) * (2 * n + 1)) / 24;
  const z = (Math.abs(wPlus - meanW) - 0.5) / Math.sqrt(varW);
  const p = 2 * (1 - normalCdf(z));

  return {
    nPairs,
    nEffective,
    medianDelta: round2(median(differences)),
    meanDelta,
    wStatistic: round2(wStatistic),
    zScore: round2(z),
    pValue: round4(p),
    rankBiserial: round2(rankBiserial),
    srm,
    allZero: false,
    tooFewPairs: false
  };
}

function effectMagnitudeLabel(rankBiserial) {
  const absValue = Math.abs(rankBiserial);
  if (absValue < 0.1) return "Triviel";
  if (absValue < 0.3) return "Lille";
  if (absValue < 0.5) return "Moderat";
  return "Stor";
}

function linearTrend(xValues, yValues) {
  const pairs = xValues
    .map((x, idx) => ({ x, y: yValues[idx] }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

  if (pairs.length < 2) {
    return {
      slope: NaN,
      slopePerYear: NaN,
      r: NaN,
      rSquared: NaN
    };
  }

  const xs = pairs.map((p) => p.x);
  const ys = pairs.map((p) => p.y);
  const meanX = mean(xs);
  const meanY = mean(ys);

  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < pairs.length; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0 || denY === 0) {
    return {
      slope: NaN,
      slopePerYear: NaN,
      r: NaN,
      rSquared: NaN
    };
  }

  const slope = num / denX;
  const r = num / Math.sqrt(denX * denY);
  const rSquared = r * r;

  return {
    slope: round4(slope),
    slopePerYear: round2(slope * 12),
    r: round4(r),
    rSquared: round4(rSquared)
  };
}

function fitMagnitudeLabel(rSquared) {
  if (!Number.isFinite(rSquared)) return "Ikke beregnelig";
  if (rSquared < 0.1) return "Meget lav";
  if (rSquared < 0.3) return "Lav";
  if (rSquared < 0.5) return "Moderat";
  if (rSquared < 0.7) return "God";
  return "Høj";
}

function effectMagnitudeColor(label) {
  if (label === "Meget lav") return "#d62828";
  if (label === "Lav") return "#f59e0b";
  return "#111111";
}

function slopeYearColor(value) {
  if (!Number.isFinite(value)) return "#111111";
  if (value <= 3) return "#d62828";

  if (value <= 5) {
    const ratio = (value - 3) / 2;
    return interpolateColor("#d62828", "#f59e0b", ratio);
  }

  if (value <= 7.5) {
    const ratio = (value - 5) / 2.5;
    return interpolateColor("#f59e0b", "#111111", ratio);
  }

  return "#111111";
}

function deviationMeanColor(value) {
  if (!Number.isFinite(value)) return "#111111";
  if (value >= -8) return "#111111";
  if (value >= -12) {
    const ratio = (Math.abs(value) - 8) / 4;
    return interpolateColor("#111111", "#f59e0b", ratio);
  }
  if (value >= -24) {
    const ratio = (Math.abs(value) - 12) / 12;
    return interpolateColor("#f59e0b", "#d62828", ratio);
  }
  return "#d62828";
}

function interpolateColor(startHex, endHex, ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  const r = Math.round(start.r + (end.r - start.r) * clamped);
  const g = Math.round(start.g + (end.g - start.g) * clamped);
  const b = Math.round(start.b + (end.b - start.b) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function median(values) {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!clean.length) return NaN;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * absX);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-absX * absX);
  return sign * y;
}

function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function round2(n) {
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
}

function round4(n) {
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 10000) / 10000;
}

function renderDeviationCharts(data) {
  const container = document.getElementById("deviationCharts");
  if (!container) return;
  container.innerHTML = "";

  const dpuBox = document.createElement("div");
  dpuBox.className = "chart";
  const dpuTitle = document.createElement("div");
  dpuTitle.className = "scale-chart-title";
  dpuTitle.textContent = "Total afvigelse pr. DPU";
  dpuBox.appendChild(dpuTitle);
  const dpuHost = document.createElement("div");
  dpuBox.appendChild(dpuHost);
  const dataByAge = [...data].sort((a, b) => a.Krono_mdr - b.Krono_mdr);
  const totalDeviationCiByDpu = dataByAge.map((row) => {
    const values = SCALE_NAMES.map((scale) => row[`Afvigelse_mdr_${scale}`]);
    return meanCi(values);
  });
  renderLineChart(
    dpuHost,
    dataByAge.map((row) => row.DPU),
    [
      {
        name: "Afvigelse total (mdr)",
        values: dataByAge.map((row) => row.Afvigelse_mdr_gns),
        colorClass: "series-color-1"
      }
    ],
    "Afvigelse (mdr)",
    {
      zeroLine: 0,
      height: 525,
      xValues: dataByAge.map((row) => row.Krono_mdr),
      ciBand: {
        label: CI_LABEL,
        lowValues: totalDeviationCiByDpu.map((ci) => round1(ci.low)),
        highValues: totalDeviationCiByDpu.map((ci) => round1(ci.high)),
        color: "#6b7280",
        opacity: 0.2,
        initiallyVisible: true
      }
    }
  );
  container.appendChild(dpuBox);

  const scaleBox = document.createElement("div");
  scaleBox.className = "chart";
  const scaleTitle = document.createElement("div");
  scaleTitle.className = "scale-chart-title";
  scaleTitle.textContent = "Gennemsnitlig afvigelse pr. skala";
  scaleBox.appendChild(scaleTitle);
  const scaleHost = document.createElement("div");
  scaleBox.appendChild(scaleHost);

  const deviationStatsByScale = SCALE_NAMES.map((scale) => {
    const vals = data
      .map((row) => row[`Afvigelse_mdr_${scale}`])
      .filter((v) => Number.isFinite(v));
    const ci = meanCi(vals);
    return {
      mean: ci.mean,
      low: ci.low,
      high: ci.high
    };
  });

  renderLineChart(
    scaleHost,
    SCALE_NAMES,
    [
      {
        name: "Gns afvigelse (mdr)",
        values: deviationStatsByScale.map((entry) => round1(entry.mean)),
        colorClass: "series-color-3"
      }
    ],
    "Afvigelse (mdr)",
    {
      zeroLine: 0,
      height: 525,
      ciBand: {
        label: CI_LABEL,
        lowValues: deviationStatsByScale.map((entry) => round1(entry.low)),
        highValues: deviationStatsByScale.map((entry) => round1(entry.high)),
        color: "#6b7280",
        opacity: 0.2,
        initiallyVisible: true
      }
    }
  );
  container.appendChild(scaleBox);
}

function renderDeviationSummaries(data) {
  void data;
  const byDpuContainer = document.getElementById("deviationSummaryByDpu");
  const byScaleContainer = document.getElementById("deviationSummaryByScale");
  if (byDpuContainer) {
    byDpuContainer.innerHTML = "";
  }
  if (byScaleContainer) {
    byScaleContainer.innerHTML = "";
  }
}

function buildScaleDeviationSummaryRows(data) {
  return SCALE_NAMES.map((scale) => {
    const values = data.map((row) => row[`Afvigelse_mdr_${scale}`]).filter((v) => Number.isFinite(v));
    const ci = meanCi(values);
    return {
      Skala: scale,
      n: ci.n,
      "Gns afvigelse (mdr)": ci.mean,
      "Min afvigelse (mdr)": values.length ? Math.min(...values) : NaN,
      "Max afvigelse (mdr)": values.length ? Math.max(...values) : NaN,
      [`${CI_LABEL} lav`]: ci.low,
      [`${CI_LABEL} høj`]: ci.high
    };
  });
}

function renderAgeCiSummary(data) {
  const ageCiContainer = document.getElementById("ageCiSummary");
  const kronoValues = data.map((row) => row.Krono_mdr);
  const devMeanValues = data.map((row) => row.Udviklingsalder_mdr_gns);

  const kronoCi = meanCi(kronoValues);
  const devCi = meanCi(devMeanValues);

  const rows = [
    {
      Mål: "Kronologisk alder (mdr)",
      n: kronoCi.n,
      "Gennemsnit (mdr)": kronoCi.mean,
      [`${CI_LABEL} lav`]: kronoCi.low,
      [`${CI_LABEL} høj`]: kronoCi.high
    },
    {
      Mål: "DPU-gennemsnitsalder (mdr)",
      n: devCi.n,
      "Gennemsnit (mdr)": devCi.mean,
      [`${CI_LABEL} lav`]: devCi.low,
      [`${CI_LABEL} høj`]: devCi.high
    }
  ];

  renderGenericTable(ageCiContainer, ["Mål", "n", "Gennemsnit (mdr)", `${CI_LABEL} lav`, `${CI_LABEL} høj`], rows);
}

function renderEstimatedAgeAtLastMeasurement(data) {
  const container = document.getElementById("estimatedLastAgeSummary");
  if (!container) return;
  if (!data.length) {
    container.innerHTML = "<p class='small'>Ingen data.</p>";
    return;
  }

  const sorted = [...data].sort((a, b) => a.Krono_mdr - b.Krono_mdr);
  const last = sorted[sorted.length - 1];

  const rows = SCALE_NAMES.map((scale) => {
    const deviationValues = data.map((row) => row[`Afvigelse_mdr_${scale}`]);
    const ci = meanCi(deviationValues);
    return {
      Skala: scale,
      "Sidste kronologiske alder (mdr)": last.Krono_mdr,
      "Estimeret alder (mdr)": last.Krono_mdr + ci.mean,
      [`${CI_LABEL} lav (mdr)`]: Number.isFinite(ci.low) ? last.Krono_mdr + ci.low : NaN,
      [`${CI_LABEL} høj (mdr)`]: Number.isFinite(ci.high) ? last.Krono_mdr + ci.high : NaN
    };
  });

  renderGenericTable(
    container,
    [
      "Skala",
      "Sidste kronologiske alder (mdr)",
      "Estimeret alder (mdr)",
      `${CI_LABEL} lav (mdr)`,
      `${CI_LABEL} høj (mdr)`
    ],
    rows
  );
}

function renderGenericTable(container, headers, rows, options = {}) {
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  headers.forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    headers.forEach((header) => {
      const td = document.createElement("td");
      const value = row[header];
      if (!Number.isFinite(value)) {
        td.textContent = String(value ?? "-");
      } else if (header === "n" || header.includes("n (")) {
        td.textContent = String(Math.round(value));
      } else {
        td.textContent = fmt(value);
      }

      const styleFn = options.valueStyles?.[header];
      if (typeof styleFn === "function") {
        const styleMap = styleFn(value);
        if (styleMap && typeof styleMap === "object") {
          Object.entries(styleMap).forEach(([key, styleValue]) => {
            td.style[key] = String(styleValue);
          });
        }
      }

      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "table-wrap spaced";
  wrap.appendChild(table);
  container.appendChild(wrap);
}

function renderStatsTable(container, rows, firstColLabel) {
  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr><th>${firstColLabel}</th><th>n</th><th>Gns afvigelse</th><th>${CI_LABEL} lav</th><th>${CI_LABEL} høj</th></tr>
    </thead>
    <tbody>
      ${rows.map((r) => `
        <tr>
          <td>${escapeHtml(r.Name)}</td>
          <td>${r.N}</td>
          <td>${fmt(r.Mean)}</td>
          <td>${fmt(r.Low)}</td>
          <td>${fmt(r.High)}</td>
        </tr>
      `).join("")}
    </tbody>
  `;
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "table-wrap spaced";
  wrap.appendChild(table);
  container.appendChild(wrap);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return { rows: [], hasMonthColumn: false };

  const delimiter = detectDelimiter(lines[0]);
  let headers = splitCsvLine(lines[0], delimiter).map((h) => h.trim());
  if (headers.length && headers[0].charCodeAt(0) === 0xfeff) {
    headers[0] = headers[0].replace(/^\uFEFF/, "");
  }

  const normalizedHeaders = headers.map(normalizeHeaderKey);
  const expectsHeader = normalizedHeaders.includes("dpu") && normalizedHeaders.includes("alder_ar");
  const hasMonthColumn = normalizedHeaders.includes("alder_mdr");
  const dataLines = expectsHeader ? lines.slice(1) : lines;

  if (!expectsHeader) {
    const firstCols = splitCsvLine(lines[0], delimiter);
    if (firstCols.length === SCALE_NAMES.length + 2) {
      headers = ["DPU", "Alder_år", ...SCALE_NAMES];
    } else if (firstCols.length === SCALE_NAMES.length + 3) {
      headers = ["DPU", "Alder_år", "Alder_mdr", ...SCALE_NAMES];
    }
  }

  const normalizedToCanonical = buildNormalizedHeaderMap();

  const rows = dataLines.map((line) => {
    const cols = splitCsvLine(line, delimiter);
    const obj = {};
    headers.forEach((h, i) => {
      const normalized = normalizeHeaderKey(h);
      const canonicalKey = normalizedToCanonical[normalized] || h;
      obj[canonicalKey] = (cols[i] || "").trim();
    });
    return obj;
  });

  return {
    rows,
    hasMonthColumn: headers.map(normalizeHeaderKey).includes("alder_mdr")
  };
}

function normalizeHeaderKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .replace(/aar/g, "ar");
}

function buildNormalizedHeaderMap() {
  const map = {
    dpu: "DPU",
    navn: "DPU",
    navn_id: "DPU",
    alder_ar: "Alder_år",
    alder_aar: "Alder_år",
    alder_year: "Alder_år",
    alder_years: "Alder_år",
    alder_mdr: "Alder_mdr",
    alder_maneder: "Alder_mdr",
    alder_months: "Alder_mdr"
  };

  SCALE_NAMES.forEach((scale) => {
    map[normalizeHeaderKey(scale)] = scale;
  });

  return map;
}

function getImportLineInfo(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) {
    return { dataLineCount: 0 };
  }

  const delimiter = detectDelimiter(lines[0]);
  const firstCols = splitCsvLine(lines[0], delimiter).map((col) => col.trim());
  const hasHeader = firstCols.includes("DPU") && firstCols.includes("Alder_år");
  const dataLineCount = hasHeader ? Math.max(0, lines.length - 1) : lines.length;

  return { dataLineCount };
}

function detectDelimiter(line) {
  const counts = {
    ";": (line.match(/;/g) || []).length,
    ",": (line.match(/,/g) || []).length,
    "\t": (line.match(/\t/g) || []).length
  };
  if (counts["\t"] >= counts[";"] && counts["\t"] >= counts[","]) {
    return "\t";
  }
  return counts[";"] >= counts[","] ? ";" : ",";
}

function splitCsvLine(line, delimiter) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}


function fmt(n) {
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(2).replace(".", ",");
}

function formatMonthsAsYearMonth(monthValue) {
  if (!Number.isFinite(monthValue)) return "-";
  const sign = monthValue < 0 ? "-" : "";
  const totalMonths = Math.round(Math.abs(monthValue));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return `${sign}${years}:${months} år`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeXml(s) {
  return escapeHtml(s);
}

function rerender() {
  state.rows = normalizeRows(state.rows, state.numDpu);
  numDpuEl.value = String(state.numDpu);
  renderInputTable();
  rerenderDataViews();
}

function rerenderDataViews() {
  const data = calculateData();
  renderComputedTable(data);
  renderCharts(data);
  renderStats(data);
}

rerender();
