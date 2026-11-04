# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

"""Integration & unit tests for the Subscription ERPNext v16 application."""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import flt, getdate

from subscription.email_alerts import render_renewal_email
from subscription.utils import advance_cycle_date, annualize, convert_currency


class TestSubscription(IntegrationTestCase):
	def test_cycle_annualization_and_currency(self):
		self.assertEqual(annualize(100, "Monthly"), 1200.0)
		self.assertEqual(annualize(300, "Quarterly"), 1200.0)
		self.assertEqual(annualize(500, "Annual"), 500.0)
		self.assertEqual(annualize(1000, "Biennial"), 500.0)
		self.assertEqual(convert_currency(100, "USD", "EGP", 56.25), 5625.0)
		self.assertEqual(convert_currency(5625, "EGP", "USD", 56.25), 100.0)

	def test_advance_cycle_date_end_of_month(self):
		self.assertEqual(str(advance_cycle_date("2026-01-31", "Monthly")), "2026-02-28")
		self.assertEqual(str(advance_cycle_date("2026-11-15", "Annual")), "2027-11-15")
		self.assertEqual(str(advance_cycle_date("2026-05-10", "Biennial")), "2028-05-10")

	def test_multi_client_vendor_cost_allocation_and_wallet_ledger(self):
		settings = frappe.get_single("Subscription Settings")
		settings.usd_egp_rate = 50.0
		settings.save(ignore_permissions=True)

		c1 = frappe.get_doc(
			{
				"doctype": "Client Subscription",
				"client_name": "Test Client Alpha",
				"service": "Managed ERP Cloud",
				"billing_cycle": "Annual",
				"currency": "USD",
				"amount": 600,
				"next_due_date": "2027-01-15",
				"status": "Active",
			}
		).insert(ignore_permissions=True)

		c2 = frappe.get_doc(
			{
				"doctype": "Client Subscription",
				"client_name": "Test Client Beta",
				"service": "Managed ERP Cloud",
				"billing_cycle": "Annual",
				"currency": "USD",
				"amount": 400,
				"next_due_date": "2027-02-15",
				"status": "Active",
			}
		).insert(ignore_permissions=True)

		# Link ONE vendor subscription ($20/month = $240/yr = 12,000 EGP/yr) to BOTH clients!
		v1 = frappe.get_doc(
			{
				"doctype": "Vendor Subscription",
				"vendor_name": "Test Cloud Host",
				"service": "Dedicated VPS Cluster",
				"billing_cycle": "Monthly",
				"currency": "USD",
				"amount": 20,
				"next_due_date": "2026-12-01",
				"status": "Active",
				"allocation_mode": "Equal Split",
				"linked_subscriptions": [
					{"client_subscription": c1.name},
					{"client_subscription": c2.name},
				],
			}
		).insert(ignore_permissions=True)

		self.assertEqual(v1.linked_clients_count, 2)
		self.assertEqual(flt(v1.annualized_egp), 12000.0)

		c1.reload()
		c2.reload()
		# Each client receives 50% of 12,000 EGP = 6,000 EGP/yr allocated vendor cost
		self.assertEqual(flt(c1.allocated_vendor_cost_egp), 6000.0)
		self.assertEqual(flt(c2.allocated_vendor_cost_egp), 6000.0)
		self.assertEqual(flt(c1.annual_profit_egp), 24000.0)  # 30,000 - 6,000

		# Wallet + Transaction + Due Date Advancement + Delete Protection
		wallet = frappe.get_doc(
			{
				"doctype": "Subscription Wallet",
				"wallet_name": "Test CIB Vault",
				"currency": "EGP",
				"opening_balance": 10000,
			}
		).insert(ignore_permissions=True)

		txn = frappe.get_doc(
			{
				"doctype": "Subscription Transaction",
				"transaction_date": "2026-11-04",
				"direction": "in",
				"wallet": wallet.name,
				"reference_kind": "client",
				"client_subscription": c1.name,
				"amount": 600,
				"currency": "USD",
				"exchange_rate": 50.0,
				"advance_due_date": 1,
			}
		).insert(ignore_permissions=True)

		wallet.reload()
		c1.reload()
		self.assertEqual(flt(wallet.current_balance), 40000.0)  # 10,000 + (600 * 50)
		self.assertEqual(str(getdate(c1.next_due_date)), "2028-01-15")

		with self.assertRaises(frappe.ValidationError):
			wallet.delete()

		# Clean up test docs
		txn.delete(ignore_permissions=True)
		wallet.delete(ignore_permissions=True)
		v1.delete(ignore_permissions=True)
		c1.delete(ignore_permissions=True)
		c2.delete(ignore_permissions=True)

	def test_email_template_rendering(self):
		for tpl in ("nest", "modern", "minimal"):
			res = render_renewal_email(
				sub_data={
					"client_name": "Alexandria Logistics",
					"service": "Google Workspace Business",
					"billing_cycle": "Annual",
					"currency": "USD",
					"amount": 432,
					"next_due_date": "2026-12-01",
				},
				days_before=7,
				settings_override={"email_template": tpl},
				preview_mode=True,
			)
			self.assertIn("Alexandria Logistics", res["html"])
			self.assertIn("$432.00 USD", res["html"])
			self.assertIn("Google Workspace Business", res["subject"])

