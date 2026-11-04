# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

"""Bootloader for the Subscription Mobile PWA served at /subscriptions.

`subscriptions.html` next to this module is built by Vite (`npm run build` /
`bench build --app subscription`) and rendered per request with a fresh CSRF token.
"""

import json

import frappe

import subscription

no_cache = 1


def get_context(context):
	csrf_token = frappe.sessions.get_csrf_token()
	frappe.db.commit()  # nosemgrep - persists freshly minted CSRF session token

	context.csrf_token = csrf_token
	context.site_name = frappe.local.site
	context.boot_json = json.dumps(get_boot()).replace("</", "<\\/")
	return context


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
	if not frappe.conf.developer_mode:
		frappe.throw(frappe._("Developer mode only"))
	return get_boot()


def get_boot() -> dict:
	return {
		"site_name": frappe.local.site,
		"lang": frappe.local.lang or "en",
		"socketio_port": frappe.conf.get("socketio_port") or 9000,
		"default_route": "/subscriptions",
		"version": subscription.__version__,
		"csrf_token": frappe.sessions.get_csrf_token(),
	}

