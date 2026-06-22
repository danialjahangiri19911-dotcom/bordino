def normalize_phone_number(phone_number: str) -> str:
    if not phone_number.startswith("0"):
        phone_number = f"0{phone_number}"
    return phone_number
