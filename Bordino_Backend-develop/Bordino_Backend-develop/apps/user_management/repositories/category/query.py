from apps.users.models.category import Category


class CategoryQueryRepository:
    @staticmethod
    def all():
        return Category.objects.all()

    @classmethod
    def filter_by_names(cls, names):
        return cls.all().filter(name__in=names)
