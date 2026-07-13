import type { CellFormat, CellValue } from "@/domain/grid/gridTypes";

/**
 * Locales are pinned. A formatter that followed the visitor's locale would render one string on
 * the server and a different one in the browser, which React reports as a hydration error.
 */
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

const plainNumber = new Intl.NumberFormat("en-US");

const shortDate = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Two decimals, so shaving a tenth of a second off a run is visible. */
export function formatElapsed(elapsedMs: number): string {
  return `${(elapsedMs / 1000).toFixed(2)}s`;
}

const shortDateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** Pinned to UTC like every other formatter here, so server and client can never disagree. */
export function formatDateTime(iso: string): string {
  return shortDateTime.format(new Date(iso));
}

export function formatScore(score: number): string {
  return plainNumber.format(score);
}

export function formatPercent(ratio: number): string {
  return percent.format(ratio);
}

function formatNumber(value: number, cellFormat: CellFormat): string {
  switch (cellFormat.numberFormat) {
    case "currency":
      return currency.format(value);
    case "percent":
      return percent.format(value);
    default:
      return plainNumber.format(value);
  }
}

export function formatCellValue(value: CellValue, cellFormat: CellFormat): string {
  switch (value.kind) {
    case "blank":
      return "";
    case "text":
      return value.value;
    case "number":
      return formatNumber(value.value, cellFormat);
    case "date":
      // Raw ISO until the date format is applied, so "apply the date format" is a visible change.
      return cellFormat.numberFormat === "date"
        ? shortDate.format(new Date(value.iso))
        : value.iso;
    case "formula":
      return formatCellValue(value.computed, cellFormat);
  }
}

/** Numbers hug the right edge of a cell, the way they do in a spreadsheet. */
export function isNumericValue(value: CellValue): boolean {
  switch (value.kind) {
    case "number":
    case "date":
      return true;
    case "formula":
      return isNumericValue(value.computed);
    default:
      return false;
  }
}
