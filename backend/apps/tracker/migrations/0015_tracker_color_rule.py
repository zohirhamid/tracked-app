from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [('tracker', '0014_add_per_user_ownership')]

    operations = [
        migrations.AddField(
            model_name='tracker',
            name='color_rule',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Optional rule used to colour good and bad entries in the grid',
            ),
        ),
    ]
