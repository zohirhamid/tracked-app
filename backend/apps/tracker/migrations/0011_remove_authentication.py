from django.db import migrations, models


def clear_tracking_data(apps, schema_editor):
    Tracker = apps.get_model("tracker", "Tracker")
    DailySnapshot = apps.get_model("tracker", "DailySnapshot")
    db_alias = schema_editor.connection.alias

    Tracker.objects.using(db_alias).all().delete()
    DailySnapshot.objects.using(db_alias).all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0010_restore_user_ownership"),
    ]

    operations = [
        migrations.RunPython(clear_tracking_data),
        migrations.AlterUniqueTogether(
            name="dailysnapshot",
            unique_together=set(),
        ),
        migrations.RemoveField(
            model_name="tracker",
            name="user",
        ),
        migrations.RemoveField(
            model_name="dailysnapshot",
            name="user",
        ),
        migrations.AlterField(
            model_name="dailysnapshot",
            name="date",
            field=models.DateField(unique=True),
        ),
    ]
