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

    const toWords = (num: number): string => {
        if (num === 0) {
            return ones[0];
        }
        const parts: string[] = [];
        const billions = Math.floor(num / 1_000_000_000);
        const millions = Math.floor((num / 1_000_000) % 1000);
        const thousands = Math.floor((num / 1_000) % 1000);
        const remainder = num % 1000;

        const convertHundreds = (value: number): string => {
            const result: string[] = [];
            if (value >= 100) {
                result.push(`${ones[Math.floor(value / 100)]} Hundred`);
                value %= 100;
            }
            if (value >= 20) {
                result.push(tens[Math.floor(value / 10)]);
                value %= 10;
            }
            if (value > 0) {
                result.push(ones[value]);
            }
            return result.join(' ');
        };

        if (billions) {
            parts.push(`${convertHundreds(billions)} Billion`);
        }
        if (millions) {
            parts.push(`${convertHundreds(millions)} Million`);
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
