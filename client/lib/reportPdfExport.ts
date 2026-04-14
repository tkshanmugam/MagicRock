/** Matches backend `reports` routes: `limit` max is 2000 (see `backend/app/api/reports.py`). */
export const REPORT_PDF_FETCH_CHUNK = 2000;

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
