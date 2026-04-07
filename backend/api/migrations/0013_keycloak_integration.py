# Generated migration: Keycloak integration
# - Adds keycloak_id field to User model (stores Keycloak subject UUID)
# - Removes PasswordResetToken model (password management delegated to Keycloak)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0012_doctor_schedule_cache"),
    ]

    operations = [
        # Add keycloak_id to User — blank for existing users until sync_keycloak runs
        migrations.AddField(
            model_name="user",
            name="keycloak_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=36,
                help_text="Keycloak subject UUID (sub claim). Set on first SSO login.",
            ),
        ),
        # Remove PasswordResetToken — Keycloak owns password reset flows now
        migrations.DeleteModel(
            name="PasswordResetToken",
        ),
    ]
