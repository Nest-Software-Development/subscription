# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

"""PWA shell endpoints: session bootstrap, cookie login (with 2FA support),
notification read-state sync, and zero-config Service Worker delivery."""

import os

import frappe
from frappe import _
from frappe.auth import LoginManager
from frappe.rate_limiter import rate_limit
from frappe.twofactor import authenticate_for_2factor, confirm_otp_token, should_run_2fa
from frappe.utils import cint, flt

import subscription
from subscription.push import PUSH_SUB_DOCTYPE, get_unread_count
from subscription.utils import SETTINGS_DOCTYPE

APP_ROUTE = "/subscriptions"


def check_app_permission() -> bool:
	"""Show the Subscription app tile on Desk's Apps screen for System Users."""
	if frappe.session.user == "Administrator":
		return True
	if frappe.session.user == "Guest":
		return False
	return frappe.get_cached_value("User", frappe.session.user, "user_type") == "System User"


@frappe.whitelist(allow_guest=True, methods=["POST"])
@rate_limit(limit=10, seconds=300)
def login(usr: str, pwd: str):
	"""Start a Frappe cookie session for the mobile PWA (supports site 2FA)."""
	login_manager = LoginManager()
	login_manager.authenticate(usr, pwd)
	user = login_manager.user

	if frappe.db.get_value("User", user, "user_type") != "System User" and user != "Administrator":
		frappe.throw(_("Only System Users may access Subscription Manager."), frappe.AuthenticationError)

	if should_run_2fa(user):
		authenticate_for_2factor(user)
		return {
			"two_factor_required": True,
			"tmp_id": frappe.local.response.get("tmp_id"),
			"verification": frappe.local.response.get("verification"),
		}

	login_manager.post_login()
	return {"logged_in": True}


@frappe.whitelist(allow_guest=True, methods=["POST"])
@rate_limit(limit=10, seconds=300)
def verify_otp(tmp_id: str, otp: str):
	"""Complete second factor login when 2FA is active."""
	user = frappe.safe_decode(frappe.cache.get(str(tmp_id) + "_usr"))
	if not user:
		frappe.throw(_("Login session expired. Please sign in again."), frappe.AuthenticationError)
	login_manager = LoginManager()
	login_manager.user = user
	if not confirm_otp_token(login_manager, otp=str(otp), tmp_id=tmp_id):
		frappe.throw(_("Invalid verification code. Please try again."), frappe.AuthenticationError)
	login_manager.post_login()
	return {"logged_in": True}


@frappe.whitelist(methods=["GET"])
def get_session():
	"""Return user identity, role permissions, settings summary, and Web Push public key."""
	user = frappe.session.user
	if user == "Guest":
		frappe.throw(_("Authentication required"), frappe.AuthenticationError)

	settings = frappe.get_single(SETTINGS_DOCTYPE)
	roles = set(frappe.get_roles(user))
	is_admin = "System Manager" in roles or "Accounts Manager" in roles or user == "Administrator"

	due_soon_clients = frappe.db.count(
		"Client Subscription",
		{"status": "Active", "due_state": ["in", ["Overdue", "Due Today", "Due within 7d", "Due within 30d"]]},
	)
	due_soon_vendors = frappe.db.count(
		"Vendor Subscription",
		{"status": "Active", "due_state": ["in", ["Overdue", "Due Today", "Due within 7d", "Due within 30d"]]},
	)

	return {
		"csrf_token": frappe.sessions.get_csrf_token(),
		"user": frappe.db.get_value(
			"User", user, ["name", "full_name", "user_image", "email", "language"], as_dict=True
		),
		"roles": sorted(roles),
		"is_admin": is_admin,
		"permissions": {
			"can_write_subscriptions": bool(frappe.has_permission("Client Subscription", "write")),
			"can_write_wallets": bool(frappe.has_permission("Subscription Wallet", "write")),
			"can_write_settings": bool(frappe.has_permission(SETTINGS_DOCTYPE, "write")),
		},
		"settings": {
			"usd_egp_rate": flt(settings.usd_egp_rate) or 56.25,
			"default_currency": settings.default_currency or "USD",
			"enable_email_reminders": cint(settings.enable_email_reminders),
			"enable_push_notifications": cint(settings.enable_push_notifications),
			"notify_client_renewals": cint(settings.notify_client_renewals),
			"notify_vendor_renewals": cint(settings.notify_vendor_renewals),
			"push_reminder_offsets": settings.push_reminder_offsets or "30, 15, 7, 3, 1, 0",
			"email_template": settings.email_template or "nest",
			"from_name": settings.from_name or "Nest Software Development",
			"reply_to": settings.reply_to or "info@nsd-eg.com",
		},
		"push_public_key": settings.vapid_public_key or "",
		"subscribed_devices": frappe.db.count(PUSH_SUB_DOCTYPE, {"user": user}),
		"notification_count": get_unread_count(user),
		"urgent_count": cint(due_soon_clients + due_soon_vendors),
		"version": subscription.__version__,
	}


@frappe.whitelist(allow_guest=True, methods=["GET"])
def sw():
	"""Serve compiled Service Worker with `Service-Worker-Allowed: /subscriptions`
	so zero Nginx header customization is required in production."""
	from werkzeug.wrappers import Response

	sw_path = frappe.get_app_path("subscription", "public", "frontend", "sw.js")
	if not os.path.exists(sw_path):
		return Response(
			"// Subscription PWA bundle not built yet. Run: bench build --app subscription\n",
			status=404,
			mimetype="text/javascript",
		)
	with open(sw_path, "rb") as f:
		response = Response(f.read(), mimetype="text/javascript")
	response.headers["Service-Worker-Allowed"] = APP_ROUTE
	response.headers["Cache-Control"] = "no-cache"
	return response

