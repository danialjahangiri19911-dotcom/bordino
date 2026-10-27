import re

_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def normalize_iban(value: str) -> str:
    """«ir ۱۲ ۳۴…» → "IR1234…": Latin digits, no spaces or dashes, upper case, IR added if the
    number was typed without it."""
    iban = re.sub(r"[\s\-]", "", (value or "").translate(_DIGITS)).upper()
    if re.fullmatch(r"\d{24}", iban):
        iban = "IR" + iban
    return iban


def is_valid_iban(iban: str) -> bool:
    """An Iranian Sheba number: IR + 24 digits whose ISO 13616 check (mod 97) holds."""
    if not re.fullmatch(r"IR\d{24}", iban):
        return False
    rearranged = iban[4:] + iban[:4]
    numeric = "".join(str(int(ch, 36)) for ch in rearranged)
    return int(numeric) % 97 == 1


def bank_code_of(iban: str) -> str | None:
    """The three-digit bank code of a valid Iranian Sheba number (IRkk BBB…), else None."""
    return iban[4:7] if is_valid_iban(iban) else None
