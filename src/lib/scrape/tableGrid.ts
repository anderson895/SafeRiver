import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';

/**
 * Normalizes an HTML <table> into a dense 2D grid of strings, expanding
 * `rowspan` and `colspan` so that every logical cell position is filled.
 *
 * This is required for the PAGASA dam table, which nests rowspans heavily:
 * each dam occupies 4 physical <tr>s, and columns like "Water Level Deviation"
 * carry rowspan=4 while "Reservoir Water Level" carries rowspan=2. Reading
 * cells by positional index against the raw <tr> would silently misalign
 * values onto the wrong columns — which is the most dangerous failure mode in
 * this system, because a misread outflow reads as "safe".
 */
export function buildTableGrid($: CheerioAPI, $table: Cheerio<Element>): string[][] {
  const grid: string[][] = [];

  // Tracks cells still spanning down from earlier rows: occupied[row][col].
  const occupied: boolean[][] = [];

  const ensure = (r: number, c: number) => {
    while (grid.length <= r) grid.push([]);
    while (occupied.length <= r) occupied.push([]);
    while (grid[r].length <= c) grid[r].push('');
    while (occupied[r].length <= c) occupied[r].push(false);
  };

  $table.find('tr').each((rowIndex, tr) => {
    let col = 0;

    $(tr)
      .find('th,td')
      .each((_, cell) => {
        const $cell = $(cell);
        const value = $cell.text().replace(/\s+/g, ' ').trim();

        const colspan = Math.max(1, parseInt($cell.attr('colspan') ?? '1', 10) || 1);
        const rowspan = Math.max(1, parseInt($cell.attr('rowspan') ?? '1', 10) || 1);

        // Skip forward past any slot already claimed by a span from above.
        ensure(rowIndex, col);
        while (occupied[rowIndex][col]) {
          col += 1;
          ensure(rowIndex, col);
        }

        for (let dr = 0; dr < rowspan; dr += 1) {
          for (let dc = 0; dc < colspan; dc += 1) {
            const r = rowIndex + dr;
            const c = col + dc;
            ensure(r, c);
            grid[r][c] = value;
            occupied[r][c] = true;
          }
        }

        col += colspan;
      });
  });

  // Pad every row to the widest row so callers can index safely.
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
  for (const row of grid) {
    while (row.length < width) row.push('');
  }

  return grid;
}

/** Collapses a header label to a stable lookup key: "Gate Opening Gates" -> "gate_opening_gates". */
export function canonicalizeHeader(label: string): string {
  return label
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // drop unit annotations like "(m)" / "(cms)"
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Builds a `canonicalHeaderName -> columnIndex` map from the first `headerRows`
 * rows of a grid. Grouped headers are joined ("Estimated (cms)" + "Outflow"
 * becomes `estimated_outflow`), and duplicate labels caused by rowspan are
 * collapsed rather than repeated.
 */
export function buildHeaderMap(grid: string[][], headerRows: number): Map<string, number> {
  const map = new Map<string, number>();
  const width = grid[0]?.length ?? 0;

  for (let c = 0; c < width; c += 1) {
    const parts: string[] = [];
    for (let r = 0; r < headerRows; r += 1) {
      const part = grid[r]?.[c] ?? '';
      // A rowspan header repeats down the column; only keep it once.
      if (part && parts[parts.length - 1] !== part) parts.push(part);
    }
    const key = canonicalizeHeader(parts.join(' '));
    if (key && !map.has(key)) map.set(key, c);
  }

  return map;
}
