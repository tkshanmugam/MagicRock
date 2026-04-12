/** First and last calendar day of the current month as YYYY-MM-DD (for HTML date inputs). */
export function getCurrentMonthDateRange(): { start: string; end: string } {
    const now = new Date();
    const y = now.getFullYear();
    const monthIndex = now.getMonth();
    const mm = String(monthIndex + 1).padStart(2, '0');
    const lastDay = new Date(y, monthIndex + 1, 0).getDate();
    const endDd = String(lastDay).padStart(2, '0');
    return {
        start: `${y}-${mm}-01`,
        end: `${y}-${mm}-${endDd}`,
    };
}

/** Current calendar month as YYYY-MM (for `<input type="month" />`). */
export function getCurrentMonthYearMonth(): string {
    const { start } = getCurrentMonthDateRange();
    return start.slice(0, 7);
}
