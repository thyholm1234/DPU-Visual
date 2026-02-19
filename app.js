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
const LEGACY_STORAGE_KEYS = ["dpu_client_only_state_v1", "dpu_state", "dpu_data"];

let state = { numDpu: DEFAULT_DPU, rows: makeDefaultRows(DEFAULT_DPU) };

clearLegacyBrowserStorage();

const numDpuEl = document.getElementById("numDpu");
const inputTableEl = document.getElementById("inputTable");
const computedTableEl = document.getElementById("computedTable");
const importCsvEl = document.getElementById("importCsv");
const exportCsvEl = document.getElementById("exportCsv");
const resetBtnEl = document.getElementById("resetBtn");
const applyPasteEl = document.getElementById("applyPaste");
const pasteAreaEl = document.getElementById("pasteArea");

numDpuEl.value = String(state.numDpu);
numDpuEl.setAttribute("autocomplete", "off");
pasteAreaEl.setAttribute("autocomplete", "off");

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

applyPasteEl.addEventListener("click", () => {
  const lines = pasteAreaEl.value.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return;

  const rows = normalizeRows(state.rows, state.numDpu);
  lines.slice(0, state.numDpu).forEach((line, rowIdx) => {
    const cols = line.split("\t");
    if (!cols.length) return;

    if (cols[0] !== undefined && cols[0].trim()) rows[rowIdx].DPU = cols[0].trim();
    if (cols[1] !== undefined) rows[rowIdx].Alder_år = clampInt(parseLocaleNumber(cols[1], rows[rowIdx].Alder_år), 0, 18);
    if (cols[2] !== undefined) rows[rowIdx].Alder_mdr = clampInt(parseLocaleNumber(cols[2], rows[rowIdx].Alder_mdr), 0, 11);

    SCALE_NAMES.forEach((scale, idx) => {
      const colIdx = idx + 3;
      if (cols[colIdx] !== undefined) {
        rows[rowIdx][scale] = clamp(parseLocaleNumber(cols[colIdx], rows[rowIdx][scale]), 1, 14);
      }
    });
  });

  state.rows = rows;
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
  a.download = "dpu_scorer_client_only.csv";
  a.click();
  URL.revokeObjectURL(url);
});

function makeDefaultRows(count) {
  return Array.from({ length: count }, (_, i) => {
    const row = { DPU: `DPU_${i + 1}`, Alder_år: 0, Alder_mdr: 0 };
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

function tCritical95(df) {
  const table = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.16, 14: 2.145, 15: 2.131, 16: 2.12, 17: 2.11, 18: 2.101, 19: 2.093, 20: 2.086, 21: 2.08, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.06, 26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042 };
  if (df <= 0) return NaN;
  if (table[df]) return table[df];
  return 1.96;
}

function meanCi95(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  const n = clean.length;
  if (!n) return { n: 0, mean: NaN, low: NaN, high: NaN };
  const m = mean(clean);
  if (n < 2) return { n, mean: m, low: NaN, high: NaN };
  const s = std(clean);
  const se = s / Math.sqrt(n);
  const margin = tCritical95(n - 1) * se;
  return { n, mean: m, low: m - margin, high: m + margin };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function renderInputTable() {
  const rows = normalizeRows(state.rows, state.numDpu);
  const headers = ["DPU", "Alder_år", "Alder_mdr", ...SCALE_NAMES];

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((row, rIdx) => {
    const tr = document.createElement("tr");
    headers.forEach((h, cIdx) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      let safeHeader = h.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      if (!safeHeader) {
        safeHeader = `col_${cIdx}`;
      }
      input.name = `dpu_${rIdx}_${safeHeader}`;
      input.id = `dpu_${rIdx}_${safeHeader}`;
      input.autocomplete = "off";
      const value = row[h];
      input.value = typeof value === "number" ? String(value).replace(".", ",") : String(value);
      input.addEventListener("change", () => {
        if (h === "DPU") {
          state.rows[rIdx][h] = input.value.trim() || `DPU_${rIdx + 1}`;
        } else if (h === "Alder_år") {
          state.rows[rIdx][h] = clampInt(parseLocaleNumber(input.value, 0), 0, 18);
        } else if (h === "Alder_mdr") {
          state.rows[rIdx][h] = clampInt(parseLocaleNumber(input.value, 0), 0, 11);
        } else {
          state.rows[rIdx][h] = clamp(parseLocaleNumber(input.value, 8), 1, 14);
        }
        rerender();
      });
      td.appendChild(input);
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
  const headers = ["DPU", "Krono_mdr", "Udviklingsalder_mdr_gns", "Afvigelse_mdr_gns"];
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
    const tr = document.createElement("tr");
    headers.forEach((h) => {
      const td = document.createElement("td");
      td.textContent = String(row[h]).replace(".", ",");
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
      dashed: true
    });
  });
  renderLineChart(document.getElementById("chartCombinedProfile"), SCALE_NAMES, combinedSeries, "Alder (mdr)", { height: 360 });

  const diffSeries = data.map((row, idx) => ({
    name: row.DPU,
    values: SCALE_NAMES.map((s) => row[`Afvigelse_mdr_${s}`]),
    colorClass: COLOR_CLASS[idx % COLORS.length]
  }));
  renderLineChart(document.getElementById("chartCombinedDiff"), SCALE_NAMES, diffSeries, "Afvigelse (mdr)", { zeroLine: 0, height: 340 });

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
      data.map((r) => r.DPU),
      [
        { name: "DPU-alder", values: data.map((r) => r[`Udviklingsalder_mdr_${scale}`]), colorClass: "series-color-0" },
        { name: "Kronologisk", values: data.map((r) => r.Krono_mdr), colorClass: "series-color-muted", dashed: true }
      ],
      "Alder (mdr)",
      { height: 280 }
    );

    crossContainer.appendChild(box);
  });
}

function renderLineChart(container, labels, series, yLabel, options = {}) {
  const zeroLine = Object.prototype.hasOwnProperty.call(options, "zeroLine") ? options.zeroLine : null;
  const width = Math.max(360, container.clientWidth || container.parentElement?.clientWidth || 900);
  const height = options.height || 300;
  const hasLongLabels = labels.some((label) => String(label).length > 14);
  const margin = { top: 18, right: 20, bottom: hasLongLabels ? 88 : 58, left: 56 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const values = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
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

  const xPos = (i) => margin.left + (labels.length === 1 ? plotW / 2 : (i * plotW) / (labels.length - 1));
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
    const y = margin.top + plotH + (hasLongLabels ? 28 : 16);
    if (hasLongLabels) {
      svg += `<text x='${x}' y='${y}' text-anchor='end' transform='rotate(-30 ${x} ${y})' font-size='10' fill='#6b7280'>${escapeXml(label)}</text>`;
    } else {
      svg += `<text x='${x}' y='${y}' text-anchor='middle' font-size='10' fill='#6b7280'>${escapeXml(label)}</text>`;
    }
  });

  if (zeroLine !== null) {
    const y = yPos(zeroLine);
    svg += `<line x1='${margin.left}' y1='${y}' x2='${margin.left + plotW}' y2='${y}' stroke='#64748b' stroke-dasharray='5 4'/>`;
  }

  series.forEach((s) => {
    const pts = s.values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(" ");
    const lineClass = `series-line ${s.colorClass || "series-color-0"}${s.dashed ? " dashed" : ""}`;
    svg += `<polyline class='${lineClass}' points='${pts}' fill='none' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round' />`;
    s.values.forEach((v, i) => {
      const tip = `${s.name} | ${labels[i]}: ${Number(v).toFixed(1).replace('.', ',')}`;
      const pointClass = `series-point ${s.colorClass || "series-color-0"}`;
      svg += `<circle class='${pointClass}' cx='${xPos(i)}' cy='${yPos(v)}' r='3.2'><title>${escapeXml(tip)}</title></circle>`;
    });
  });

  svg += `<text x='14' y='${margin.top + plotH / 2}' transform='rotate(-90, 14, ${margin.top + plotH / 2})' font-size='10' fill='#6b7280'>${escapeXml(yLabel)}</text>`;
  svg += "</svg>";

  const legend = series
    .map((s) => {
      const lineClass = `legend-line ${s.colorClass || "series-color-0"}${s.dashed ? " dashed" : ""}`;
      return `<span class='legend-item'><span class='${lineClass}'></span>${escapeXml(s.name)}</span>`;
    })
    .join("");
  container.innerHTML = `<div class='chart-shell'><div class='chart-legend'>${legend}</div>${svg}</div>`;
}

function renderStats(data) {
  renderDeviationSummaries(data);
  renderDeviationCharts(data);
  renderAgeCiSummary(data);
  renderWilcoxonSection(data);

  const dpuRows = data.map((row) => {
    const values = SCALE_NAMES.map((s) => row[`Afvigelse_mdr_${s}`]);
    const ci = meanCi95(values);
    return {
      Name: row.DPU,
      N: ci.n,
      Mean: ci.mean,
      Low: ci.low,
      High: ci.high
    };
  });

  const scaleRows = SCALE_NAMES.map((scale) => {
    const values = data.map((row) => row[`Afvigelse_mdr_${scale}`]);
    const ci = meanCi95(values);
    return {
      Name: scale,
      N: ci.n,
      Mean: ci.mean,
      Low: ci.low,
      High: ci.high
    };
  });

  renderStatsTable(document.getElementById("statsDpu"), dpuRows, "DPU");
  renderStatsTable(document.getElementById("statsScale"), scaleRows, "Skala");
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

  const rows = SCALE_NAMES.map((scale) => {
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
  });

  renderGenericTable(
    container,
    ["Skala", "Hældning (mdr/år)", "Line-fit r", "Line-fit R²", "Fit niveau"],
    rows,
    {
      valueStyles: {
        "Hældning (mdr/år)": (value) => ({ color: slopeYearColor(value), fontWeight: "700" })
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

function slopeYearColor(value) {
  if (!Number.isFinite(value)) return "#111111";
  if (value <= 0.3) return "#d62828";

  if (value <= 0.5) {
    const ratio = (value - 0.3) / 0.2;
    return interpolateColor("#d62828", "#f59e0b", ratio);
  }

  if (value <= 0.75) {
    const ratio = (value - 0.5) / 0.25;
    return interpolateColor("#f59e0b", "#111111", ratio);
  }

  return "#111111";
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
  renderLineChart(
    dpuHost,
    data.map((row) => row.DPU),
    [
      {
        name: "Afvigelse total (mdr)",
        values: data.map((row) => row.Afvigelse_mdr_gns),
        colorClass: "series-color-1"
      }
    ],
    "Afvigelse (mdr)",
    { zeroLine: 0, height: 280 }
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

  const meanDeviationByScale = SCALE_NAMES.map((scale) => {
    const vals = data
      .map((row) => row[`Afvigelse_mdr_${scale}`])
      .filter((v) => Number.isFinite(v));
    return mean(vals);
  });

  renderLineChart(
    scaleHost,
    SCALE_NAMES,
    [
      {
        name: "Gns afvigelse (mdr)",
        values: meanDeviationByScale,
        colorClass: "series-color-3"
      }
    ],
    "Afvigelse (mdr)",
    { zeroLine: 0, height: 300 }
  );
  container.appendChild(scaleBox);
}

function renderDeviationSummaries(data) {
  const byDpuContainer = document.getElementById("deviationSummaryByDpu");
  const byScaleContainer = document.getElementById("deviationSummaryByScale");

  const headers = ["DPU", "Afvigelse total (mdr)", ...SCALE_NAMES.map((s) => `Afvigelse ${s}`)];
  const rows = data.map((row) => {
    const record = {
      DPU: row.DPU,
      "Afvigelse total (mdr)": row.Afvigelse_mdr_gns
    };
    SCALE_NAMES.forEach((scale) => {
      record[`Afvigelse ${scale}`] = row[`Afvigelse_mdr_${scale}`];
    });
    return record;
  });
  renderGenericTable(byDpuContainer, headers, rows);

  const byScaleRows = SCALE_NAMES.map((scale) => {
    const values = data.map((row) => row[`Afvigelse_mdr_${scale}`]).filter((v) => Number.isFinite(v));
    return {
      Skala: scale,
      "Gns afvigelse (mdr)": mean(values),
      "Min afvigelse (mdr)": values.length ? Math.min(...values) : NaN,
      "Max afvigelse (mdr)": values.length ? Math.max(...values) : NaN
    };
  });
  renderGenericTable(byScaleContainer, ["Skala", "Gns afvigelse (mdr)", "Min afvigelse (mdr)", "Max afvigelse (mdr)"], byScaleRows);
}

function renderAgeCiSummary(data) {
  const ageCiContainer = document.getElementById("ageCiSummary");
  const kronoValues = data.map((row) => row.Krono_mdr);
  const devMeanValues = data.map((row) => row.Udviklingsalder_mdr_gns);

  const kronoCi = meanCi95(kronoValues);
  const devCi = meanCi95(devMeanValues);

  const rows = [
    {
      Mål: "Kronologisk alder (mdr)",
      n: kronoCi.n,
      "Gennemsnit (mdr)": kronoCi.mean,
      "95% CI lav": kronoCi.low,
      "95% CI høj": kronoCi.high
    },
    {
      Mål: "DPU-gennemsnitsalder (mdr)",
      n: devCi.n,
      "Gennemsnit (mdr)": devCi.mean,
      "95% CI lav": devCi.low,
      "95% CI høj": devCi.high
    }
  ];

  renderGenericTable(ageCiContainer, ["Mål", "n", "Gennemsnit (mdr)", "95% CI lav", "95% CI høj"], rows);
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
      <tr><th>${firstColLabel}</th><th>n</th><th>Gns afvigelse</th><th>95% CI lav</th><th>95% CI høj</th></tr>
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
  wrap.className = "table-wrap";
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

  const expectsHeader = headers.includes("DPU") && headers.includes("Alder_år");
  const hasMonthColumn = headers.includes("Alder_mdr");
  const dataLines = expectsHeader ? lines.slice(1) : lines;

  if (!expectsHeader) {
    const firstCols = splitCsvLine(lines[0], delimiter);
    if (firstCols.length === SCALE_NAMES.length + 2) {
      headers = ["DPU", "Alder_år", ...SCALE_NAMES];
    } else if (firstCols.length === SCALE_NAMES.length + 3) {
      headers = ["DPU", "Alder_år", "Alder_mdr", ...SCALE_NAMES];
    }
  }

  const rows = dataLines.map((line) => {
    const cols = splitCsvLine(line, delimiter);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (cols[i] || "").trim();
    });
    return obj;
  });

  return {
    rows,
    hasMonthColumn: headers.includes("Alder_mdr")
  };
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
  const data = calculateData();
  renderComputedTable(data);
  renderCharts(data);
  renderStats(data);
}

rerender();
