# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import cint, flt


def get_gl_account_balance(account: str | None) -> float:
	"""Return live balance in account currency from ERPNext `tabGL Entry` (or 0.0 if unavailable)."""
	if not account or not frappe.db.exists("DocType", "GL Entry"):
		return 0.0
	try:
		rows = frappe.db.sql(
			"""
			SELECT
				COALESCE(SUM(debit_in_account_currency - credit_in_account_currency), 0) AS bal_acct,
				COALESCE(SUM(debit - credit), 0) AS bal_base
			FROM `tabGL Entry`
			WHERE account = %s AND is_cancelled = 0
			""",
			(account,),
			as_dict=True,
		)
		if rows:
			bal = flt(rows[0].get("bal_acct"))
			if bal == 0.0:
				bal = flt(rows[0].get("bal_base"))
			return round(bal, 2)
	except Exception:
		pass
	return 0.0


class SubscriptionWallet(Document):
	def onload(self):
		if getattr(self, "bank_account", None):
			self.erpnext_gl_balance = get_gl_account_balance(self.bank_account)

	def validate(self):
		self._sync_erpnext_bank_links()
		self._compute_totals()

	def _sync_erpnext_bank_links(self):
		# Default Company from site defaults when available
		if not getattr(self, "company", None) and frappe.db.exists("DocType", "Company"):
			default_company = None
			if hasattr(frappe, "defaults") and hasattr(frappe.defaults, "get_user_default"):
				default_company = frappe.defaults.get_user_default("Company")
			if not default_company and frappe.db.exists("DocType", "Global Defaults"):
				default_company = frappe.db.get_single_value("Global Defaults", "default_company")
			if default_company and frappe.db.exists("Company", default_company):
				self.company = default_company

		# Auto-populate Bank, GL Account, IBAN, and Account No from ERPNext Bank Account
		if getattr(self, "erpnext_bank_account", None) and frappe.db.exists("DocType", "Bank Account"):
			ba = frappe.db.get_value(
				"Bank Account",
				self.erpnext_bank_account,
				["bank", "account", "company", "bank_account_no", "iban"],
				as_dict=True,
			)
			if ba:
				if ba.get("bank") and not self.erpnext_bank:
					self.erpnext_bank = ba.get("bank")
				if ba.get("account") and not self.bank_account:
					self.bank_account = ba.get("account")
				if ba.get("company") and not self.company:
					self.company = ba.get("company")
				if ba.get("bank_account_no") and not self.bank_account_no:
					self.bank_account_no = ba.get("bank_account_no")
				if ba.get("iban") and not self.iban:
					self.iban = ba.get("iban")

		# Validate leaf GL Account and pull account currency + live GL balance
		if getattr(self, "bank_account", None) and frappe.db.exists("DocType", "Account"):
			acc = frappe.db.get_value(
				"Account",
				self.bank_account,
				["is_group", "account_currency", "company"],
				as_dict=True,
			)
			if acc:
				if cint(acc.get("is_group")):
					frappe.throw(
						_("ERPNext GL Account '{0}' is a Group Account. Please choose a leaf Bank or Cash account.").format(
							self.bank_account
						)
					)
				self.gl_account_currency = acc.get("account_currency") or ""
				if acc.get("company") and not self.company:
					self.company = acc.get("company")
			self.erpnext_gl_balance = get_gl_account_balance(self.bank_account)
		else:
			self.gl_account_currency = ""
			self.erpnext_gl_balance = 0.0

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
		self.total_in = round(flt(agg.get("sum_in")), 2)
		self.total_out = round(flt(agg.get("sum_out")), 2)
		self.transaction_count = cint(agg.get("cnt"))
		self.current_balance = round(flt(self.opening_balance) + self.total_in - self.total_out, 2)

	def recalculate_balance(self):
		self._compute_totals()
		if getattr(self, "bank_account", None):
			self.erpnext_gl_balance = get_gl_account_balance(self.bank_account)
		self.db_update()

	def on_trash(self):
		tx_count = frappe.db.count("Subscription Transaction", {"wallet": self.name})
		if tx_count > 0:
			frappe.throw(
				_(
					"Cannot delete Wallet '{0}' because it has {1} ledger transactions. Mark it as Archived instead."
				).format(self.wallet_name, tx_count)
			)


@frappe.whitelist()
def fetch_erpnext_account_details(
	erpnext_bank_account: str | None = None,
	bank_account: str | None = None,
) -> dict:
	"""Whitelisted helper for instant Desk & PWA auto-fill when linking ERPNext Bank Account or GL Account."""
	result = {
		"erpnext_bank": "",
		"bank_account": bank_account or "",
		"company": "",
		"bank_account_no": "",
		"iban": "",
		"gl_account_currency": "",
		"erpnext_gl_balance": 0.0,
	}
	if erpnext_bank_account and frappe.db.exists("Bank Account", erpnext_bank_account):
		ba = frappe.db.get_value(
			"Bank Account",
			erpnext_bank_account,
			["bank", "account", "company", "bank_account_no", "iban"],
			as_dict=True,
		)
		if ba:
			result["erpnext_bank"] = ba.get("bank") or ""
			result["bank_account"] = ba.get("account") or result["bank_account"]
			result["company"] = ba.get("company") or ""
			result["bank_account_no"] = ba.get("bank_account_no") or ""
			result["iban"] = ba.get("iban") or ""

	resolved_gl = result["bank_account"]
	if resolved_gl and frappe.db.exists("Account", resolved_gl):
		acc = frappe.db.get_value(
			"Account",
			resolved_gl,
			["account_currency", "company"],
			as_dict=True,
		)
		if acc:
			result["gl_account_currency"] = acc.get("account_currency") or ""
			if not result["company"]:
				result["company"] = acc.get("company") or ""
		result["erpnext_gl_balance"] = get_gl_account_balance(resolved_gl)

	return result
