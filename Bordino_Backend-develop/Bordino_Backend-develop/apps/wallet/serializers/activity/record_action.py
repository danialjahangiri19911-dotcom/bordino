from rest_framework import serializers


class RecordActionSerializer(serializers.Serializer):
    section = serializers.CharField(required=True)
    action_type = serializers.CharField(required=True)
    metadata = serializers.DictField(required=False, allow_null=True, default=dict)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
