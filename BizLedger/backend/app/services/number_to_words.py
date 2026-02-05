"""
Utility for converting numeric amounts into words.
"""
from decimal import Decimal

_ONES = [
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
]
_TENS = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
]


def _convert_hundreds(value: int) -> str:
    words = []
    if value >= 100:
        words.append(f"{_ONES[value // 100]} Hundred")
        value %= 100
    if value >= 20:
        words.append(_TENS[value // 10])
        value %= 10
    if value > 0:
        words.append(_ONES[value])
    return " ".join(words)


def _convert_number(value: int) -> str:
    if value == 0:
        return _ONES[0]

    parts = []
    billions = value // 1_000_000_000
    millions = (value // 1_000_000) % 1000
    thousands = (value // 1_000) % 1000
    remainder = value % 1000

    if billions:
        parts.append(f"{_convert_hundreds(billions)} Billion")
    if millions:
        parts.append(f"{_convert_hundreds(millions)} Million")
    if thousands:
        parts.append(f"{_convert_hundreds(thousands)} Thousand")
    if remainder:
        parts.append(_convert_hundreds(remainder))

    return " ".join(parts)


def amount_to_words(amount: Decimal) -> str:
    amount = amount.quantize(Decimal("0.01"))
    if amount < 0:
        amount = abs(amount)

    whole = int(amount)
    fraction = int((amount - Decimal(whole)) * 100)

    whole_words = _convert_number(whole)
    if fraction:
        fraction_words = _convert_number(fraction)
        return f"Rupees {whole_words} and Paise {fraction_words} Only"
    return f"Rupees {whole_words} Only"
