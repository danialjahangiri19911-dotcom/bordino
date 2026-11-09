"""Who may do what in «بردینو ادمین».

Roles are Django groups holding real model permissions, so the rest of the code agrees with them
(the reviewer role holds gamemaster.review_game: Game Master's own `is_reviewer` says yes too). The
owners (settings.OPS_OWNERS, by default 09128007728) have every role and are the only ones who
manage the staff; being an owner comes from the server's settings, so nobody can be locked out from
inside the app."""

from django.conf import settings
from django.contrib.auth.models import Group, Permission

from apps.user_management.admin_otp import normalize_phone

# key: (group name, Persian name, permissions "app_label.codename", what it opens)
ROLES = {
    "reviewer": ("ops_reviewer", "بررسی بازی", ["gamemaster.review_game"], "بازی‌های سازندگان: بررسی، تأیید، توقف، پایان"),
    "finance": (
        "ops_finance",
        "مالی",
        ["wallet.change_currencytransaction", "wallet.view_currencytransaction", "wallet.change_bankaccount", "wallet.view_bankaccount"],
        "درخواست‌های برداشت و تأیید حساب‌های بانکی",
    ),
    "settings": (
        "ops_settings",
        "تنظیمات",
        ["configuration.change_systemconfiguration", "configuration.view_systemconfiguration"],
        "تنظیمات برنامه (هزینه‌ها، سقف‌ها، روشن/خاموش‌ها)",
    ),
    "support": ("ops_support", "پشتیبانی", ["users.view_customer"], "جست‌وجوی کاربران و داشبوردها (فقط دیدن)"),
}
# What each role is checked by (one permission is enough to have the role).
ROLE_PERM = {"reviewer": "gamemaster.review_game", "finance": "wallet.change_currencytransaction", "settings": "configuration.change_systemconfiguration", "support": "users.view_customer"}


def owners() -> set[str]:
    raw = getattr(settings, "OPS_OWNERS", ["9128007728"])
    return {p for p in map(normalize_phone, raw) if p}


def is_owner(user) -> bool:
    return bool(user and user.is_authenticated and user.is_active and normalize_phone(user.phone_number) in owners())


def member(user):
    from apps.ops.models import OpsMember  # pylint: disable=import-outside-toplevel

    if not user or not user.is_authenticated:
        return None
    return OpsMember.objects.filter(user=user).first()


def can_sign_in(user) -> bool:
    """An owner, or an active member (whatever roles they have)."""
    if not user or not user.is_active:
        return False
    if is_owner(user):
        return True
    m = member(user)
    return bool(m and m.is_active)


def roles_of(user) -> list[str]:
    if is_owner(user):
        return list(ROLES)
    if not can_sign_in(user):
        return []
    names = set(user.groups.values_list("name", flat=True))
    return [k for k, (group, *_rest) in ROLES.items() if group in names]


def has_role(user, role: str) -> bool:
    return role in roles_of(user)


def group(role: str) -> Group:
    """The role's group, made (and given its permissions) the first time it is needed."""
    name, _fa, perms, _what = ROLES[role]
    g, _ = Group.objects.get_or_create(name=name)
    wanted = []
    for p in perms:
        app_label, codename = p.split(".", 1)
        perm = Permission.objects.filter(content_type__app_label=app_label, codename=codename).first()
        if perm:
            wanted.append(perm)
    if set(g.permissions.all()) != set(wanted):
        g.permissions.set(wanted)
    return g


def set_roles(user, roles: list[str]):
    """Gives `user` exactly these roles (the other ops groups are taken away; other groups stay)."""
    keep = set(roles)
    for key in ROLES:
        g = group(key)
        if key in keep:
            user.groups.add(g)
        else:
            user.groups.remove(g)
    # (Django caches a user's permissions on the object.)
    for attr in ("_perm_cache", "_group_perm_cache", "_user_perm_cache"):
        if hasattr(user, attr):
            delattr(user, attr)


def user_for_phone(phone: str):
    """The user who may receive an admin-app code for this number, or None."""
    from django.contrib.auth import get_user_model  # pylint: disable=import-outside-toplevel

    user = get_user_model().objects.filter(phone_number=phone, is_active=True).first()
    return user if can_sign_in(user) else None
