from rest_framework.routers import DefaultRouter

from . import serializers, views

router = DefaultRouter()
for name, serializer, path in [
    ("participants", serializers.ParticipantSerializer, "deal"),
    ("passports", serializers.PassportSerializer, None),
    ("driver-licenses", serializers.DriverLicenseSerializer, None),
    ("vehicles", serializers.VehicleSerializer, "deal"),
    (
        "vehicle-registrations",
        serializers.VehicleRegistrationSerializer,
        "vehicle__deal",
    ),
    ("vehicle-titles", serializers.VehicleTitleSerializer, "vehicle__deal"),
    ("mortgages", serializers.MortgageSerializer, "deal"),
    ("mortgage-balances", serializers.MortgageBalanceSerializer, "mortgage__deal"),
    ("platforms", serializers.PlatformSerializer, None),
]:
    router.register(
        name, views.record_viewset(serializer, path), basename="insurance-data-" + name
    )
router.register("requests", views.InsuranceRequestViewSet, basename="insurance-request")
router.register("variants", views.VariantViewSet, basename="request-variant")
urlpatterns = router.urls
