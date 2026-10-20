from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import migrations, models
import django.db.models.deletion


def assign_existing_data(apps, schema_editor):
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    Tracker = apps.get_model("tracker", "Tracker")
    DailySnapshot = apps.get_model("tracker", "DailySnapshot")

    if not Tracker.objects.exists() and not DailySnapshot.objects.exists():
        return

    owner = User.objects.order_by("pk").first()
    if owner is None:
        owner = User.objects.create(
            username="legacy-data",
            email="legacy-data@local.invalid",
            password=make_password(None),
        )

    Tracker.objects.filter(user__isnull=True).update(user=owner)
    DailySnapshot.objects.filter(user__isnull=True).update(user=owner)


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0009_remove_auth_ownership"),
    ]

    operations = [
        migrations.AlterField(
            model_name="dailysnapshot",
            name="date",
            field=models.DateField(),
        ),
        migrations.AddField(
            model_name="tracker",
            name="user",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="dailysnapshot",
            name="user",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(assign_existing_data, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="tracker",
            name="user",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="dailysnapshot",
            name="user",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterUniqueTogether(
            name="dailysnapshot",
            unique_together={("user", "date")},
        ),
    ]
