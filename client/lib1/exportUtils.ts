export type CsvColumn<T> = {
    key: keyof T;
    label: string;
    format?: (value: T[keyof T], row: T) => string | number | null | undefined;
};

export const exportToCsv = <T>(filename: string, rows: T[], columns: CsvColumn<T>[]) => {
    const header = columns.map((col) => col.label).join(',');
    const body = rows
        .map((row) =>
            columns
                .map((col) => {
                    const rawValue = col.format ? col.format(row[col.key], row) : row[col.key];
                    const safe = rawValue === null || rawValue === undefined ? '' : String(rawValue);
                    const escaped = safe.replace(/"/g, '""');
                    return `"${escaped}"`;
                })
                .join(',')
        )
        .join('\n');
    const csv = [header, body].filter(Boolean).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
