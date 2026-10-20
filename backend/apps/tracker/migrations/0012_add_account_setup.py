from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def mark_existing_accounts_complete(apps, schema_editor):
    User = apps.get_model(*settings.AUTH_USER_MODEL.split("."))
    AccountSetup = apps.get_model("tracker", "AccountSetup")
    db_alias = schema_editor.connection.alias

    AccountSetup.objects.using(db_alias).bulk_create(
        [
            AccountSetup(user_id=user_id, username_is_set=True)
            for user_id in User.objects.using(db_alias).values_list("pk", flat=True)
        ],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("tracker", "0011_remove_authentication"),
    ]

    operations = [
        migrations.CreateModel(
            name="AccountSetup",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("username_is_set", models.BooleanField(default=False)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="account_setup",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.RunPython(
            mark_existing_accounts_complete,
            migrations.RunPython.noop,
        ),
    ]
