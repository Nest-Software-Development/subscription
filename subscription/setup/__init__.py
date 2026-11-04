# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

import os

import frappe

from subscription.push import ensure_vapid_keys
from subscription.setup.seed import ensure_default_settings, import_seed_if_empty


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

	# Remove stale auto-generated user Dock overrides created before standard Dock existed
	if frappe.db.exists("DocType", "Dock"):
		for dname in frappe.get_all("Dock", filters={"app": "subscription", "standard": 0}, pluck="name"):
			try:
				ddoc = frappe.get_doc("Dock", dname)
				icons = {getattr(it, "icon", "") for it in (ddoc.get("items") or [])}
				if not (icons & {"subscription-soft", "subscription-setup-soft"}):
					frappe.delete_doc("Dock", dname, ignore_permissions=True, force=True)
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


def after_install():
	"""Idempotent setup executed after `bench install-app subscription` and every `bench migrate`."""
	sync_desk_navigation()
	ensure_default_settings()
	ensure_vapid_keys()
	import_seed_if_empty()
