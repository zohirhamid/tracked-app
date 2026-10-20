from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def remove_column_if_present(apps, schema_editor, model_name):
    model = apps.get_model("tracker", model_name)
    table_name = model._meta.db_table

    with schema_editor.connection.cursor() as cursor:
        columns = {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(
                cursor,
                table_name,
            )
        }

    if "user_id" not in columns:
        return

    legacy_field = model._meta.get_field("user")
    schema_editor.remove_field(model, legacy_field)


def repair_legacy_user_columns(apps, schema_editor):
    remove_column_if_present(apps, schema_editor, "Tracker")
    remove_column_if_present(apps, schema_editor, "DailySnapshot")


class Migration(migrations.Migration):
    dependencies = [
        ("tracker", "0012_add_account_setup"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="tracker",
                    name="user",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                migrations.AddField(
                    model_name="dailysnapshot",
                    name="user",
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.RunPython(
            repair_legacy_user_columns,
            migrations.RunPython.noop,
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(
                    model_name="tracker",
                    name="user",
                ),
                migrations.RemoveField(
                    model_name="dailysnapshot",
                    name="user",
                ),
            ],
        ),
    ]
