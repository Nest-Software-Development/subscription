# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

"""Native RFC 8292 VAPID Web Push & In-App Notification Center for the Subscription PWA.

Delivers renewal alerts directly from ERPNext to subscribed mobile/desktop browsers
without any third-party relay or Firebase account. VAPID keys are generated once on
install/migrate and stored securely in Subscription Settings.
"""

import base64
import hashlib
import json

import frappe
from frappe import _
from frappe.utils import cint, flt, formatdate, getdate, now_datetime, nowdate

from subscription.utils import SETTINGS_DOCTYPE, compute_due_state, parse_offset_days

APP_ROUTE = "/subscriptions"
PUSH_SUB_DOCTYPE = "Subscription Push Subscription"
NOTIF_LOG_DOCTYPE = "Subscription Notification Log"


def _b64url(raw: bytes) -> str:
	return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def ensure_vapid_keys() -> None:
	"""Generate the site's ECDSA P-256 VAPID key pair once. Idempotent on migrate."""
	if not frappe.db.exists("DocType", SETTINGS_DOCTYPE):
		return
	if frappe.db.get_single_value(SETTINGS_DOCTYPE, "vapid_public_key"):
		return
	try:
		from cryptography.hazmat.primitives import serialization
		from cryptography.hazmat.primitives.asymmetric import ec
	except ImportError:
		frappe.log_error(title="Subscription: cryptography package missing, Web Push disabled")
		return

	key = ec.generate_private_key(ec.SECP256R1())
	private_raw = key.private_numbers().private_value.to_bytes(32, "big")
	public_raw = key.public_key().public_bytes(
		serialization.Encoding.X962,
		serialization.PublicFormat.UncompressedPoint,
	)
	settings = frappe.get_single(SETTINGS_DOCTYPE)
	settings.vapid_public_key = _b64url(public_raw)
	settings.vapid_private_key = _b64url(private_raw)
	if not settings.vapid_subject:
		settings.vapid_subject = "mailto:info@nsd-eg.com"
	settings.flags.ignore_permissions = True
	settings.save()


def get_public_key() -> str:
	if not frappe.db.exists("DocType", SETTINGS_DOCTYPE):
		return ""
	return frappe.db.get_single_value(SETTINGS_DOCTYPE, "vapid_public_key") or ""


@frappe.whitelist(methods=["POST"])
def subscribe(
	subscription: str | dict | None = None,
	subscription_json: str | dict | None = None,
	device_label: str | None = None,
):
	"""Store the browser's PushSubscription for the authenticated user."""
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required"), frappe.PermissionError)

	raw_sub = subscription if subscription is not None else subscription_json
	sub_data = frappe.parse_json(raw_sub) if isinstance(raw_sub, str) else (raw_sub or {})
	endpoint = sub_data.get("endpoint")
	keys = sub_data.get("keys") or {}
	if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
		frappe.throw(_("Invalid push subscription payload."))
	if not str(endpoint).startswith("https://") and not str(endpoint).startswith("http://localhost"):
		frappe.throw(_("Push endpoint must use HTTPS."))

	endpoint_hash = hashlib.sha256(str(endpoint).encode()).hexdigest()
	ua = (frappe.get_request_header("User-Agent") or "")[:180]
	label = (device_label or _infer_device_label(ua))[:80]

	values = {
		"user": frappe.session.user,
		"device_label": label,
		"endpoint": endpoint,
		"p256dh": keys.get("p256dh"),
		"auth": keys.get("auth"),
		"user_agent": ua,
		"last_seen": now_datetime(),
	}
	if frappe.db.exists(PUSH_SUB_DOCTYPE, endpoint_hash):
		frappe.db.set_value(PUSH_SUB_DOCTYPE, endpoint_hash, values)
	else:
		doc = frappe.get_doc({"doctype": PUSH_SUB_DOCTYPE, "endpoint_hash": endpoint_hash, **values})
		doc.insert(ignore_permissions=True)

	return {
		"subscribed": True,
		"devices": frappe.db.count(PUSH_SUB_DOCTYPE, {"user": frappe.session.user}),
	}


@frappe.whitelist(methods=["POST"])
def unsubscribe(endpoint: str):
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required"), frappe.PermissionError)
	endpoint_hash = hashlib.sha256((endpoint or "").encode()).hexdigest()
	if frappe.db.get_value(PUSH_SUB_DOCTYPE, endpoint_hash, "user") == frappe.session.user:
		frappe.delete_doc(PUSH_SUB_DOCTYPE, endpoint_hash, ignore_permissions=True, force=True)
	return {
		"subscribed": False,
		"devices": frappe.db.count(PUSH_SUB_DOCTYPE, {"user": frappe.session.user}),
	}


def _infer_device_label(ua: str) -> str:
	low = (ua or "").lower()
	if "iphone" in low:
		return "iPhone"
	if "ipad" in low:
		return "iPad"
	if "android" in low:
		return "Android Phone"
	if "macintosh" in low or "mac os" in low:
		return "Mac"
	if "windows" in low:
		return "Windows Desktop"
	return "Browser Device"


def get_unread_count(user: str) -> int:
	if not frappe.db.exists("DocType", NOTIF_LOG_DOCTYPE):
		return 0
	return cint(frappe.db.count(NOTIF_LOG_DOCTYPE, {"recipient": user, "read": 0}))


def send_to_user(
	user: str,
	title: str,
	body: str = "",
	url: str | None = None,
	tag: str | None = None,
	problems: list[str] | None = None,
	badge: int | None = None,
) -> int:
	"""Deliver a Web Push payload (including Declarative Web Push compatibility fields)
	to every device registered by `user`."""
	problems = problems if problems is not None else []
	public_key = get_public_key()
	if not public_key:
		ensure_vapid_keys()
		public_key = get_public_key()
	if not public_key:
		problems.append(_("Web Push VAPID key is missing. Run bench migrate on the server."))
		return 0

	subscriptions = frappe.get_all(
		PUSH_SUB_DOCTYPE,
		filters={"user": user},
		fields=["name", "endpoint", "p256dh", "auth"],
	)
	if not subscriptions:
		problems.append(_("No subscribed mobile/desktop device found for your account."))
		return 0

	try:
		from pywebpush import WebPushException, webpush
	except ImportError:
		frappe.log_error(title="Subscription: pywebpush is not installed")
		problems.append(_("The pywebpush Python package is not installed. Run: bench setup requirements --python"))
		return 0

	settings = frappe.get_single(SETTINGS_DOCTYPE)
	private_key = settings.get_password("vapid_private_key", raise_exception=False)
	if not private_key:
		problems.append(_("Web Push private key is missing in Subscription Settings."))
		return 0

	clean_title = (title or _("Subscription")).strip()
	clean_body = frappe.utils.strip_html(body or "").strip()
	target_url = url or APP_ROUTE
	badge_count = badge if badge is not None else get_unread_count(user)

	payload = json.dumps(
		{
			"web_push": 8030,
			"title": clean_title,
			"body": clean_body,
			"url": target_url,
			"tag": tag,
			"badge": badge_count,
			"notification": {
				"title": clean_title,
				"body": clean_body,
				"navigate": target_url,
				"app_badge": str(badge_count) if badge_count and badge_count > 0 else "0",
			},
		}
	)

	sent = 0
	for sub in subscriptions:
		try:
			webpush(
				subscription_info={
					"endpoint": sub.endpoint,
					"keys": {"p256dh": sub.p256dh, "auth": sub.auth},
				},
				data=payload,
				vapid_private_key=private_key,
				vapid_claims={"sub": settings.vapid_subject or "mailto:info@nsd-eg.com"},
				ttl=86400,
			)
			sent += 1
		except WebPushException as exc:
			status = getattr(exc.response, "status_code", None)
			if status in (404, 410):
				frappe.delete_doc(PUSH_SUB_DOCTYPE, sub.name, ignore_permissions=True, force=True)
				problems.append(_("An expired device subscription was cleaned up. Re-enable notifications on that device."))
			else:
				frappe.log_error(title="Subscription Push Delivery Error", message=frappe.get_traceback())
				detail = (getattr(exc.response, "text", "") or str(exc))[:180]
				problems.append(_("Push service rejected message ({0}): {1}").format(status or "?", detail))
		except Exception as exc:
			frappe.log_error(title="Subscription Push Delivery Error", message=frappe.get_traceback())
			problems.append(_("Push failed: {0}").format(str(exc)[:180]))
	return sent


def create_user_notification(
	user: str,
	title: str,
	body: str,
	category: str = "System",
	reference_doctype: str | None = None,
	reference_name: str | None = None,
	due_date: str | None = None,
	days_before: int | None = None,
	dedup_key: str | None = None,
	target_url: str | None = None,
	send_push: bool = True,
) -> bool:
	"""Create an in-app notification row (deduplicated if dedup_key is given) and optionally push to user's devices."""
	if dedup_key and frappe.db.exists(NOTIF_LOG_DOCTYPE, {"recipient": user, "dedup_key": dedup_key}):
		return False

	doc = frappe.get_doc(
		{
			"doctype": NOTIF_LOG_DOCTYPE,
			"recipient": user,
			"title": title[:140],
			"body": body,
			"category": category,
			"reference_doctype": reference_doctype,
			"reference_name": reference_name,
			"due_date": due_date,
			"days_before": days_before if days_before is not None else 0,
			"dedup_key": dedup_key,
			"read": 0,
			"sent_push": 0,
			"created_at": now_datetime(),
		}
	)
	doc.insert(ignore_permissions=True)

	if send_push:
		unread = get_unread_count(user)
		delivered = send_to_user(
			user=user,
			title=title,
			body=body,
			url=target_url or APP_ROUTE,
			tag=dedup_key or doc.name,
			badge=unread,
		)
		if delivered > 0:
			frappe.db.set_value(NOTIF_LOG_DOCTYPE, doc.name, "sent_push", 1, update_modified=False)
	return True


@frappe.whitelist(methods=["POST"])
def send_test():
	"""Verify push delivery on the current user's mobile/desktop device."""
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required"), frappe.PermissionError)

	problems: list[str] = []
	unread = get_unread_count(frappe.session.user)
	sent = send_to_user(
		frappe.session.user,
		_("Subscription Alerts Active"),
		_("You will be notified before client & vendor subscription renewal dates arrive."),
		url=f"{APP_ROUTE}/alerts",
		tag="subscription-test-push",
		problems=problems,
		badge=unread if unread > 0 else None,
	)
	devices = frappe.db.count(PUSH_SUB_DOCTYPE, {"user": frappe.session.user})
	return {"sent": sent, "devices": devices, "problems": list(dict.fromkeys(problems))}


@frappe.whitelist(methods=["POST"])
def send_test_push():
	"""Alias used by the Subscription Mobile PWA to record a test alert & trigger Web Push."""
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required"), frappe.PermissionError)
	create_user_notification(
		user=frappe.session.user,
		title=_("Subscription Alerts Active"),
		body=_("Push notifications are connected — you will be alerted before subscription renewals expire."),
		category="System",
		target_url=f"{APP_ROUTE}/alerts",
		send_push=False,
	)
	return send_test()


def _get_target_recipients() -> list[str]:
	"""Return all active System Users who have Push Subscriptions or System Manager / Accounts roles."""
	subscribed_users = set(frappe.get_all(PUSH_SUB_DOCTYPE, pluck="user"))
	admin_users = set(
		frappe.get_all(
			"Has Role",
			filters={"role": ["in", ["System Manager", "Accounts Manager", "Sales Manager"]], "parenttype": "User"},
			pluck="parent",
		)
	)
	candidates = (subscribed_users | admin_users) - {"Guest"}
	if not candidates:
		return []
	return frappe.get_all("User", filters={"name": ["in", list(candidates)], "enabled": 1}, pluck="name")


def run_push_renewal_alerts() -> dict:
	"""Scan active Client & Vendor Subscriptions and notify users when renewal dates enter configured windows."""
	if not frappe.db.exists("DocType", SETTINGS_DOCTYPE):
		return {"notifications_created": 0, "checked": 0}

	settings = frappe.get_single(SETTINGS_DOCTYPE)
	if not cint(settings.enable_push_notifications):
		return {"notifications_created": 0, "checked": 0, "disabled": True}

	offsets = set(parse_offset_days(settings.push_reminder_offsets, default=(30, 15, 7, 3, 1, 0)))
	# Also alert once when a subscription first turns overdue (-1 day)
	offsets.add(-1)

	recipients = _get_target_recipients()
	if not recipients:
		return {"notifications_created": 0, "checked": 0}

	created_count = 0
	checked_count = 0

	if cint(settings.notify_client_renewals):
		csubs = frappe.get_all(
			"Client Subscription",
			filters={"status": "Active"},
			fields=["name", "client_name", "service", "amount", "currency", "next_due_date", "billing_cycle"],
		)
		for sub in csubs:
			checked_count += 1
			days, _state = compute_due_state(sub.next_due_date, "Active")
			if days not in offsets:
				continue
			when_txt = (
				_("due today")
				if days == 0
				else (_("overdue by {0} day").format(abs(days)) if days < 0 else _("due in {0} days").format(days))
			)
			title = _("{0} Renewal {1}").format(sub.client_name, _("Today") if days == 0 else f"({days}d)")
			body = _("{0} ({1} {2:,.2f} · {3}) is {4} on {5}.").format(
				sub.service,
				sub.currency,
				flt(sub.amount),
				sub.billing_cycle,
				when_txt,
				formatdate(getdate(sub.next_due_date), "dd MMM yyyy"),
			)
			for user in recipients:
				dedup = f"client::{sub.name}::{sub.next_due_date}::{days}"
				if create_user_notification(
					user=user,
					title=title,
					body=body,
					category="Client Renewal",
					reference_doctype="Client Subscription",
					reference_name=sub.name,
					due_date=str(sub.next_due_date),
					days_before=days,
					dedup_key=dedup,
					target_url=f"{APP_ROUTE}/client/{sub.name}",
					send_push=True,
				):
					created_count += 1

	if cint(settings.notify_vendor_renewals):
		vsubs = frappe.get_all(
			"Vendor Subscription",
			filters={"status": "Active"},
			fields=["name", "vendor_name", "service", "amount", "currency", "next_due_date", "billing_cycle"],
		)
		for vsub in vsubs:
			checked_count += 1
			days, _state = compute_due_state(vsub.next_due_date, "Active")
			if days not in offsets:
				continue
			when_txt = (
				_("due today")
				if days == 0
				else (_("overdue by {0} day").format(abs(days)) if days < 0 else _("due in {0} days").format(days))
			)
			title = _("Vendor Renewal: {0}").format(vsub.vendor_name)
			body = _("{0} ({1} {2:,.2f} · {3}) is {4} on {5}.").format(
				vsub.service,
				vsub.currency,
				flt(vsub.amount),
				vsub.billing_cycle,
				when_txt,
				formatdate(getdate(vsub.next_due_date), "dd MMM yyyy"),
			)
			for user in recipients:
				dedup = f"vendor::{vsub.name}::{vsub.next_due_date}::{days}"
				if create_user_notification(
					user=user,
					title=title,
					body=body,
					category="Vendor Renewal",
					reference_doctype="Vendor Subscription",
					reference_name=vsub.name,
					due_date=str(vsub.next_due_date),
					days_before=days,
					dedup_key=dedup,
					target_url=f"{APP_ROUTE}/vendor/{vsub.name}",
					send_push=True,
				):
					created_count += 1

	return {"notifications_created": created_count, "checked": checked_count, "date": nowdate()}

