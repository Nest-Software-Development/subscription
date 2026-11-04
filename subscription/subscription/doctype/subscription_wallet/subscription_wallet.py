# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt


class SubscriptionWallet(Document):
	def validate(self):
		self._compute_totals()

	def _compute_totals(self):
		if self.is_new() or not frappe.db.exists("DocType", "Subscription Transaction"):
			self.total_in = 0.0
			self.total_out = 0.0
			self.transaction_count = 0
			self.current_balance = round(flt(self.opening_balance), 2)
			return

		agg = frappe.db.sql(
			"""
			SELECT
				COALESCE(SUM(CASE WHEN direction = 'in' THEN wallet_amount ELSE 0 END), 0) AS sum_in,
				COALESCE(SUM(CASE WHEN direction = 'out' THEN wallet_amount ELSE 0 END), 0) AS sum_out,
				COUNT(*) AS cnt
			FROM `tabSubscription Transaction`
			WHERE wallet = %s
			""",
			(self.name,),
			as_dict=True,
		)[0]
		self.total_in = round(flt(agg.sum_in), 2)
		self.total_out = round(flt(agg.sum_out), 2)
		self.transaction_count = cint(agg.cnt)
		self.current_balance = round(flt(self.opening_balance) + self.total_in - self.total_out, 2)

	def recalculate_balance(self):
		self._compute_totals()
		self.db_update()

	def on_trash(self):
		tx_count = frappe.db.count("Subscription Transaction", {"wallet": self.name})
		if tx_count > 0:
			frappe.throw(
				_(
					"Cannot delete Wallet '{0}' because it has {1} ledger transactions. Mark it as Archived instead."
				).format(self.wallet_name, tx_count)
			)
