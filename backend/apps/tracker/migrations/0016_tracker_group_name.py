from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [('tracker', '0015_tracker_color_rule')]

    operations = [
        migrations.AddField(
            model_name='tracker',
            name='group_name',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Optional heading used to group adjacent tracker columns',
                max_length=80,
            ),
        ),
    ]
