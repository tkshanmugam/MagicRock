/** Matches backend `reports` routes: `limit` max is 2000 (see `backend/app/api/reports.py`). */
export const REPORT_PDF_FETCH_CHUNK = 2000;
export const REPORT_PDF_ROWS_PER_PAGE = 20;

export type PaginatedReportBatch<T> = {
    items: T[];
    total: number;
};

/**
 * Load every row for PDF/print by paging the report API until all items are retrieved.
 */
export async function fetchAllPaginatedReportItems<T>(loadBatch: (skip: number, limit: number) => Promise<PaginatedReportBatch<T>>): Promise<T[]> {
    const out: T[] = [];
    let skip = 0;
    let reportedTotal: number | null = null;

    for (;;) {
        const { items, total } = await loadBatch(skip, REPORT_PDF_FETCH_CHUNK);
        const batch = items ?? [];
        reportedTotal = total ?? reportedTotal;
        out.push(...batch);
        if (batch.length === 0) {
            break;
        }
        if (batch.length < REPORT_PDF_FETCH_CHUNK) {
            break;
        }
        if (reportedTotal != null && out.length >= reportedTotal) {
            break;
        }
        skip += batch.length;
    }
    return out;
}

export function waitNextPaint(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
        });
    });
}

export function chunkReportRows<T>(rows: T[], rowsPerPage = REPORT_PDF_ROWS_PER_PAGE): T[][] {
    if (!rows.length) {
        return [[]];
    }

    const chunks: T[][] = [];
    for (let index = 0; index < rows.length; index += rowsPerPage) {
        chunks.push(rows.slice(index, index + rowsPerPage));
    }
    return chunks;
}

/**
 * Mobile report tables use a narrow horizontal scroll viewport (~two columns visible).
 * html2canvas captures the layout box, so PDFs would omit off-screen columns unless
 * we expand these regions in the cloned DOM. Mark scroll wrappers with
 * `data-report-table-scroll`.
 */
export function expandReportTableScrollRegionsForPdf(root: HTMLElement): void {
    root.querySelectorAll('[data-report-table-scroll]').forEach((node) => {
        if (node instanceof HTMLElement) {
            node.style.maxWidth = 'none';
            node.style.width = 'auto';
            node.style.overflow = 'visible';
        }
        node.querySelectorAll('table').forEach((t) => {
            if (t instanceof HTMLElement) {
                t.style.width = 'max-content';
            }
        });
    });
}
