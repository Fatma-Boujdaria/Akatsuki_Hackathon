"""French number formatting for user-facing texts ("9,23 DT", "18 kWh")."""


def num(value: float, decimals: int = 0) -> str:
    text = f"{value:,.{decimals}f}"  # 1,234.56
    return text.replace(",", " ").replace(".", ",")  # 1 234,56 (narrow no-break space)


def dt(value: float) -> str:
    """Amount in dinars with 2 decimals: estimates, not billing-grade figures."""
    return f"{num(value, 2)} DT"


def kwh(value: float) -> str:
    return f"{num(value, 0 if abs(value) >= 10 else 1)} kWh"


def litres(value: float) -> str:
    return f"{num(value, 0)} L"


def duration(minutes: float) -> str:
    h, m = divmod(int(round(minutes)), 60)
    return f"{h} h {m:02d}" if h else f"{m} min"
