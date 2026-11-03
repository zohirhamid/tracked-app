from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [('tracker', '0016_tracker_group_name')]

    operations = [
        migrations.AddField(
            model_name='tracker',
            name='entry_mode',
            field=models.CharField(
                choices=[
                    ('direct', 'Enter a value'),
                    ('accumulative', 'Tap to add'),
                ],
                default='direct',
                help_text='How values are entered in the daily mobile log',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='tracker',
            name='increment_value',
            field=models.DecimalField(
                decimal_places=2,
                default=1,
                help_text='Amount added by each tap for an accumulative tracker',
                max_digits=10,
            ),
        ),
    ]
