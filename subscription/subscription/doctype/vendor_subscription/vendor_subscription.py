# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

from subscription.utils import (
	annualize,
	compute_due_state,
	ensure_erpnext_supplier,
	get_exchange_rate,
	recalculate_client_subscription_costs,
	to_egp,
	to_usd,
)


class VendorSubscription(Document):
	def validate(self):
		if flt(self.amount) < 0:
			frappe.throw(_("Vendor subscription amount cannot be negative."))
		if self.supplier and not self.vendor_name:
			self.vendor_name = frappe.db.get_value("Supplier", self.supplier, "supplier_name") or self.supplier
		elif self.vendor_name and not self.supplier:
			linked_sup = ensure_erpnext_supplier(self.vendor_name)
			if linked_sup:
				self.supplier = linked_sup

		# Remember previously linked client subscriptions so removed ones also recalculate!
		prev_doc = self.get_doc_before_save()
		self._prev_linked_clients = (
			{row.client_subscription for row in (prev_doc.linked_subscriptions or []) if row.client_subscription}
			if prev_doc
			else set()
		)

		seen = set()
		for row in self.linked_subscriptions or []:
			if row.client_subscription in seen:
				frappe.throw(_("Client Subscription {0} is linked more than once.").format(row.client_subscription))
			seen.add(row.client_subscription)

		self.compute_metrics_and_allocations()

	def compute_metrics_and_allocations(self):
		rate = get_exchange_rate()
		ann_orig = annualize(flt(self.amount), self.billing_cycle)
		self.annualized_egp = to_egp(ann_orig, self.currency, rate)
		self.annualized_usd = to_usd(ann_orig, self.currency, rate)
		self.days_until_due, self.due_state = compute_due_state(self.next_due_date, self.status)

		rows = list(self.linked_subscriptions or [])
		count = len(rows)
		self.linked_clients_count = count
		self.is_unlinked_overhead = 1 if count == 0 else 0

		if count == 0:
			self.linked_revenue_egp = 0.0
			self.net_contribution_egp = -flt(self.annualized_egp)
			return

		# Fetch linked client subscriptions details
		c_names = [r.client_subscription for r in rows]
		c_docs = {
			d.name: d
			for d in frappe.get_all(
				"Client Subscription",
				filters={"name": ["in", c_names]},
				fields=["name", "client_name", "service", "billing_cycle", "annualized_egp"],
			)
		}

		total_rev_egp = sum(flt(c_docs.get(r.client_subscription, {}).get("annualized_egp")) for r in rows)
		self.linked_revenue_egp = round(total_rev_egp, 2)

		mode = self.allocation_mode or "Equal Split"
		if mode == "Custom Percentage":
			total_pct = sum(flt(r.allocation_weight_pct) for r in rows)
			if total_pct <= 0:
				# Fallback to equal split if user hasn't entered weights yet
				for r in rows:
					r.allocation_weight_pct = round(100.0 / count, 4)
			elif abs(total_pct - 100.0) > 0.5:
				frappe.throw(
					_("Custom Percentage weights must sum to 100% (currently {0}%).").format(round(total_pct, 2))
				)
		elif mode == "Revenue Proportional" and total_rev_egp > 0:
			for r in rows:
				rev = flt(c_docs.get(r.client_subscription, {}).get("annualized_egp"))
				r.allocation_weight_pct = round((rev / total_rev_egp) * 100.0, 4)
		else:
			for r in rows:
				r.allocation_weight_pct = round(100.0 / count, 4)

		for r in rows:
			info = c_docs.get(r.client_subscription) or {}
			r.client_name = info.get("client_name") or r.client_name
			r.service = info.get("service") or r.service
			r.billing_cycle = info.get("billing_cycle") or r.billing_cycle
			share = flt(r.allocation_weight_pct) / 100.0
			r.allocated_annual_egp = round(flt(self.annualized_egp) * share, 2)
			r.allocated_annual_usd = round(flt(self.annualized_usd) * share, 2)

		self.net_contribution_egp = round(flt(self.linked_revenue_egp) - flt(self.annualized_egp), 2)

	def on_update(self):
		affected = {r.client_subscription for r in (self.linked_subscriptions or []) if r.client_subscription}
		affected |= getattr(self, "_prev_linked_clients", set())
		if affected:
			recalculate_client_subscription_costs(affected)

	def after_delete(self):
		affected = {r.client_subscription for r in (self.linked_subscriptions or []) if r.client_subscription}
		if affected:
			recalculate_client_subscription_costs(affected)
