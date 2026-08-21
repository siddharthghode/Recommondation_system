from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User, UserProfile

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if instance.role == "student":
        profile, created_prof = UserProfile.objects.get_or_create(
            user=instance,
            defaults={
                "student_id": instance.username,
                "approval_status": "pending",
                "department": instance.department,
            }
        )
        if instance.department and not profile.department:
            profile.department = instance.department
            profile.save()
        elif profile.department and not instance.department:
            User.objects.filter(id=instance.id).update(department=profile.department)
