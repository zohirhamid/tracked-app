from django.db import migrations, models


def merge_snapshots_by_date(apps, schema_editor):
    DailySnapshot = apps.get_model("tracker", "DailySnapshot")
    Entry = apps.get_model("tracker", "Entry")

    dates = DailySnapshot.objects.values_list("date", flat=True).order_by().distinct()
    for snapshot_date in dates:
        snapshots = list(
            DailySnapshot.objects.filter(date=snapshot_date).order_by("pk")
        )
        if len(snapshots) < 2:
            continue

        canonical = snapshots[0]
        for duplicate in snapshots[1:]:
            for entry in Entry.objects.filter(daily_snapshot=duplicate):
                if Entry.objects.filter(
                    tracker_id=entry.tracker_id,
                    daily_snapshot=canonical,
                ).exists():
                    entry.delete()
                else:
                    entry.daily_snapshot = canonical
                    entry.save(update_fields=["daily_snapshot"])
            duplicate.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0008_add_profile_fields_back"),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name="dailysnapshot",
            unique_together=set(),
        ),
        migrations.RunPython(merge_snapshots_by_date, migrations.RunPython.noop),
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
        migrations.DeleteModel(
            name="Profile",
        ),
    ]
