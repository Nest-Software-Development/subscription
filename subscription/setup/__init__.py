# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

import os

import frappe

from subscription.push import ensure_vapid_keys
from subscription.setup.seed import ensure_default_settings, import_seed_if_empty


def force_reload_subscription_doctypes() -> None:
	"""Force-reload Subscription DocTypes and bump `tabDocType.modified` so browser
	`localforage` (IndexedDB) immediately evicts any cached client script (`__js`) or schema."""
	if not hasattr(frappe, "reload_doc"):
		return
	doctypes = (
		("Subscription Wallet", "subscription_wallet"),
		("Client Subscription", "client_subscription"),
		("Vendor Subscription", "vendor_subscription"),
		("Subscription Transaction", "subscription_transaction"),
		("Subscription Settings", "subscription_settings"),
		("Subscription Reminder Rule", "subscription_reminder_rule"),
	)
	now_ts = frappe.utils.now_datetime()
	for dt_name, dt_slug in doctypes:
		if not frappe.db.exists("DocType", dt_name):
			continue
		try:
			frappe.reload_doc("subscription", "doctype", dt_slug, force=True)
			frappe.db.set_value("DocType", dt_name, "modified", now_ts, update_modified=False)
			if hasattr(frappe, "clear_cache"):
				frappe.clear_cache(doctype=dt_name)
		except Exception:
			frappe.log_error(frappe.get_traceback(), f"Subscription DocType Reload ({dt_name})")


def sync_desk_navigation() -> None:
	"""Ensure Frappe v16 Sidebar, Dock, Desktop Icon, and Workspace Sidebar JSONs are imported
	with their Lucide & dual-tone icons, and purge any pre-existing placeholder overrides."""
	try:
		from frappe.modules.import_file import import_file_by_path
	except Exception:
		return

	nav_files = (
		("Sidebar", ("subscription", "sidebar", "subscription", "subscription.json")),
		("Sidebar", ("subscription", "sidebar", "subscription_setup", "subscription_setup.json")),
		("Dock", ("dock", "subscription", "subscription.json")),
		("Desktop Icon", ("desktop_icon", "subscription.json")),
		("Desktop Icon", ("desktop_icon", "subscription_setup.json")),
		("Workspace Sidebar", ("workspace_sidebar", "subscription.json")),
		("Workspace Sidebar", ("workspace_sidebar", "subscription_setup.json")),
	)
	for dt, rel_parts in nav_files:
		if not frappe.db.exists("DocType", dt):
			continue
		full_path = frappe.get_app_path("subscription", *rel_parts)
		if os.path.exists(full_path):
			try:
				import_file_by_path(full_path, force=True)
			except Exception:
				frappe.log_error(frappe.get_traceback(), f"Subscription Nav Sync ({dt})")

	# Remove or upgrade stale auto-generated Dock rows that still point to Module instead of Sidebar
	if frappe.db.exists("DocType", "Dock"):
		for drow in frappe.get_all("Dock", filters={"app": "subscription"}, fields=["name", "standard"]):
			try:
				ddoc = frappe.get_doc("Dock", drow.name)
				items = ddoc.get("items") or []
				icons = {getattr(it, "icon", "") for it in items}
				has_module_fallback = any(getattr(it, "link_type", "") == "Module" for it in items)
				if not drow.standard and (has_module_fallback or not (icons & {"subscription-soft", "subscription-setup-soft"})):
					frappe.delete_doc("Dock", drow.name, ignore_permissions=True, force=True)
				elif drow.standard and has_module_fallback:
					ddoc.set(
						"items",
						[
							{
								"icon": "subscription-soft",
								"link_to": "Subscription",
								"link_type": "Sidebar",
								"title": "Subscription",
							},
							{
								"icon": "subscription-setup-soft",
								"link_to": "Subscription Setup",
								"link_type": "Sidebar",
								"title": "Subscription Setup",
							},
						],
					)
					ddoc.flags.ignore_permissions = True
					ddoc.save()
			except Exception:
				pass

	# Remove stale auto-generated non-standard Sidebars that only had generic 'list' icons
	if frappe.db.exists("DocType", "Sidebar"):
		for sname in frappe.get_all("Sidebar", filters={"app": "subscription", "standard": 0}, pluck="name"):
			try:
				sdoc = frappe.get_doc("Sidebar", sname)
				icons = {
					getattr(it, "icon", "")
					for it in (sdoc.get("items") or [])
					if getattr(it, "child", 0) == 0
				}
				if icons <= {"", "list", "house", "settings", None}:
					frappe.delete_doc("Sidebar", sname, ignore_permissions=True, force=True)
			except Exception:
				pass

	if hasattr(frappe, "clear_cache"):
		try:
			frappe.clear_cache()
		except Exception:
			pass


def after_install():
	"""Idempotent setup executed after `bench install-app subscription` and every `bench migrate`."""
	force_reload_subscription_doctypes()
	sync_desk_navigation()
	ensure_default_settings()
	ensure_vapid_keys()
	import_seed_if_empty()
