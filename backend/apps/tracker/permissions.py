# tracker/permissions.py
from rest_framework import permissions
from rest_framework.permissions import BasePermission

class CanCreateTracker(permissions.BasePermission):
    """
    Permission to check if user can create more trackers.
    Authenticated users can create trackers without a plan limit.
    """
    
    def has_permission(self, request, view):
        return True

class IsOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.user == request.user

class IsEntryOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        # Entry ownership is through tracker
        return obj.tracker.user == request.user
