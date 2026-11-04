# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

"""Background scheduler tasks for the Subscription app."""

import frappe

from subscription.email_alerts import run_email_reminders
from subscription.push import run_push_renewal_alerts
from subscription.utils import compute_due_state


def sync_due_states() -> None:
	"""Keep days_until_due and due_state fresh across all Client and Vendor Subscriptions."""
	if frappe.db.exists("DocType", "Client Subscription"):
		for row in frappe.get_all(
			"Client Subscription", fields=["name", "next_due_date", "status"]
		):
			days, state = compute_due_state(row.next_due_date, row.status)
			frappe.db.set_value(
				"Client Subscription",
				row.name,
				{"days_until_due": days, "due_state": state},
				update_modified=False,
			)

	if frappe.db.exists("DocType", "Vendor Subscription"):
		for row in frappe.get_all(
			"Vendor Subscription", fields=["name", "next_due_date", "status"]
		):
			days, state = compute_due_state(row.next_due_date, row.status)
			frappe.db.set_value(
				"Vendor Subscription",
				row.name,
				{"days_until_due": days, "due_state": state},
				update_modified=False,
			)


def run_daily_subscription_checks() -> dict:
	"""Daily scheduled job: refresh due states, dispatch client email reminders, and push mobile alerts."""
	sync_due_states()
	email_result = run_email_reminders()
	push_result = run_push_renewal_alerts()
	return {"email": email_result, "push": push_result}

