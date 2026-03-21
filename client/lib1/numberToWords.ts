/**
 * Convert number to words using Indian numbering system (Lakh, Crore).
 * 1,00,000 = One Lakh, 1,00,00,000 = One Crore
 */
export const numberToWords = (value: number): string => {
    if (!Number.isFinite(value)) {
        return 'Rupees Zero Only';
    }

    const absValue = Math.abs(value);
    const whole = Math.floor(absValue);
    const fraction = Math.round((absValue - whole) * 100);

    const ones = [
        'Zero',
        'One',
        'Two',
        'Three',
        'Four',
        'Five',
        'Six',
        'Seven',
        'Eight',
        'Nine',
        'Ten',
        'Eleven',
        'Twelve',
        'Thirteen',
        'Fourteen',
        'Fifteen',
        'Sixteen',
        'Seventeen',
        'Eighteen',
        'Nineteen',
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convertHundreds = (val: number): string => {
        const result: string[] = [];
        if (val >= 100) {
            result.push(`${ones[Math.floor(val / 100)]} Hundred`);
            val %= 100;
        }
        if (val >= 20) {
            result.push(tens[Math.floor(val / 10)]);
            val %= 10;
        }
        if (val > 0) {
            result.push(ones[val]);
        }
        return result.join(' ');
    };

    const toWords = (num: number): string => {
        if (num === 0) {
            return ones[0];
        }
        const parts: string[] = [];
        // Indian system: Crore, Lakh, Thousand, (last 3 digits)
        const remainder = num % 1000;
        const thousands = Math.floor((num / 1_000) % 100);
        const lakhs = Math.floor((num / 100_000) % 100);
        const crores = Math.floor((num / 10_000_000) % 100);
        const arabs = Math.floor((num / 1_000_000_000) % 100);

        if (arabs) {
            parts.push(`${convertHundreds(arabs)} Arab`);
        }
        if (crores) {
            parts.push(`${convertHundreds(crores)} Crore`);
        }
        if (lakhs) {
            parts.push(`${convertHundreds(lakhs)} Lakh`);
        }
        if (thousands) {
            parts.push(`${convertHundreds(thousands)} Thousand`);
        }
        if (remainder) {
            parts.push(convertHundreds(remainder));
        }

        return parts.join(' ');
    };

    const wholeWords = toWords(whole);
    if (fraction) {
        const fractionWords = toWords(fraction);
        return `Rupees ${wholeWords} and Paise ${fractionWords} Only`;
    }
    return `Rupees ${wholeWords} Only`;
};
