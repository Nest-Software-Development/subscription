# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from subscription.email_alerts import parse_email_list


class SubscriptionReminderRule(Document):
	def validate(self):
		valid_to = parse_email_list(self.to_emails)
		if not valid_to:
			frappe.throw(_("Please enter at least one valid recipient email address in 'To Email(s)'."))
		self.to_emails = ", ".join(valid_to)
		valid_cc = parse_email_list(self.cc_emails)
		self.cc_emails = ", ".join(valid_cc)

		if not self.offsets:
			for d in (30, 15, 7, 1):
				self.append("offsets", {"days_before": d, "enabled": 1})
