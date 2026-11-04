# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

from subscription.utils import (
	annualize,
	compute_due_state,
	ensure_erpnext_customer,
	get_exchange_rate,
	recalculate_client_subscription_costs,
	to_egp,
	to_usd,
)


class ClientSubscription(Document):
	def validate(self):
		if flt(self.amount) < 0:
			frappe.throw(_("Subscription amount cannot be negative."))
		if self.customer and not self.client_name:
			self.client_name = frappe.db.get_value("Customer", self.customer, "customer_name") or self.customer
		elif self.client_name and not self.customer:
			linked = ensure_erpnext_customer(self.client_name)
			if linked:
				self.customer = linked

		rate = get_exchange_rate()
		ann_orig = annualize(flt(self.amount), self.billing_cycle)
		self.annualized_egp = to_egp(ann_orig, self.currency, rate)
		self.annualized_usd = to_usd(ann_orig, self.currency, rate)
		self.days_until_due, self.due_state = compute_due_state(self.next_due_date, self.status)
		self.annual_profit_egp = round(flt(self.annualized_egp) - flt(self.allocated_vendor_cost_egp), 2)
		self.profit_margin_pct = (
			round((self.annual_profit_egp / flt(self.annualized_egp)) * 100.0, 2)
			if flt(self.annualized_egp) > 0
			else 0.0
		)

	def on_update(self):
		recalculate_client_subscription_costs([self.name])
