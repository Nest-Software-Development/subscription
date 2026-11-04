# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

from subscription.utils import recalculate_all_vendor_and_client_metrics


class SubscriptionSettings(Document):
	def validate(self):
		if flt(self.usd_egp_rate) <= 0:
			frappe.throw(_("USD to EGP exchange rate must be greater than zero."))

	def on_update(self):
		if self.has_value_changed("usd_egp_rate"):
			recalculate_all_vendor_and_client_metrics()
