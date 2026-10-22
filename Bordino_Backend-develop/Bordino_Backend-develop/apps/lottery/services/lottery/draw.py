import secrets

# The ticket picker offers balls 1–40 and a ticket has 6 different ones (BuyTicket in the PWA).
HIGHEST_NUMBER = 40
NUMBERS_PER_DRAW = 6


def draw_numbers():
    """Six different winning numbers from 1–40, sorted, from the OS's cryptographic random source
    (`secrets`): drawn by the server only when the lottery is settled, after ticket sales closed,
    so nobody — players or staff — can know them while tickets can still be bought."""
    return sorted(secrets.SystemRandom().sample(range(1, HIGHEST_NUMBER + 1), NUMBERS_PER_DRAW))
