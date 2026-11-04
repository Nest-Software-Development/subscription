# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt

from subscription.utils import advance_cycle_date, convert_currency, get_exchange_rate


class SubscriptionTransaction(Document):
	def validate(self):
		if flt(self.amount) <= 0:
			frappe.throw(_("Transaction amount must be greater than zero."))

		prev = self.get_doc_before_save()
		self._prev_wallet = prev.wallet if prev else None

		if not flt(self.exchange_rate):
			self.exchange_rate = get_exchange_rate()

		w_cur = frappe.db.get_value("Subscription Wallet", self.wallet, "currency") or "EGP"
		self.wallet_currency = w_cur
		if flt(self.wallet_amount) <= 0:
			self.wallet_amount = convert_currency(flt(self.amount), self.currency, w_cur, flt(self.exchange_rate))

		if self.reference_kind == "client" and self.client_subscription:
			c_info = frappe.db.get_value(
				"Client Subscription", self.client_subscription, ["client_name", "service"], as_dict=True
			)
			if c_info:
				self.party = self.party or c_info.client_name
				self.service = self.service or c_info.service
		elif self.reference_kind == "vendor" and self.vendor_subscription:
			v_info = frappe.db.get_value(
				"Vendor Subscription", self.vendor_subscription, ["vendor_name", "service"], as_dict=True
			)
			if v_info:
				self.party = self.party or v_info.vendor_name
				self.service = self.service or v_info.service

	def after_insert(self):
		if cint(self.advance_due_date):
			self._advance_linked_subscription()
		self._refresh_wallets()

	def on_update(self):
		self._refresh_wallets()

	def after_delete(self):
		self._refresh_wallets()

	def _advance_linked_subscription(self):
		if self.reference_kind == "client" and self.client_subscription:
			sub = frappe.get_doc("Client Subscription", self.client_subscription)
			old_due = sub.next_due_date
			new_due = advance_cycle_date(old_due, sub.billing_cycle)
			sub.next_due_date = new_due
			sub.save(ignore_permissions=True)
			self.db_set({"previous_due_date": old_due, "new_due_date": new_due}, update_modified=False)
		elif self.reference_kind == "vendor" and self.vendor_subscription:
			vsub = frappe.get_doc("Vendor Subscription", self.vendor_subscription)
			old_due = vsub.next_due_date
			new_due = advance_cycle_date(old_due, vsub.billing_cycle)
			vsub.next_due_date = new_due
			vsub.save(ignore_permissions=True)
			self.db_set({"previous_due_date": old_due, "new_due_date": new_due}, update_modified=False)

	def _refresh_wallets(self):
		wallets = {self.wallet}
		if getattr(self, "_prev_wallet", None):
			wallets.add(self._prev_wallet)
		for w_name in wallets:
			if w_name and frappe.db.exists("Subscription Wallet", w_name):
				frappe.get_doc("Subscription Wallet", w_name).recalculate_balance()
