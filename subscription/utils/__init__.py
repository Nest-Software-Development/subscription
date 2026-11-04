# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

"""Shared domain calculations for Client & Vendor Subscriptions, currency conversion,
billing-cycle date advancement, multi-client vendor cost allocation, and schedule forecasts."""

from datetime import date

import frappe
from frappe.utils import add_months, cint, date_diff, flt, getdate, nowdate

SETTINGS_DOCTYPE = "Subscription Settings"
DEFAULT_USD_EGP_RATE = 56.25

CYCLE_MONTHS: dict[str, int] = {
	"Monthly": 1,
	"Quarterly": 3,
	"Annual": 12,
	"Biennial": 24,
}

CYCLE_ANNUAL_FACTOR: dict[str, float] = {
	"Monthly": 12.0,
	"Quarterly": 4.0,
	"Annual": 1.0,
	"Biennial": 0.5,
}


def get_exchange_rate() -> float:
	"""Return configured USD -> EGP exchange rate (fallback 56.25)."""
	try:
		if frappe.db.exists("DocType", SETTINGS_DOCTYPE):
			rate = flt(frappe.db.get_single_value(SETTINGS_DOCTYPE, "usd_egp_rate"))
			if rate > 0:
				return rate
	except Exception:
		pass
	return DEFAULT_USD_EGP_RATE


def to_egp(amount: float, currency: str, rate: float | None = None) -> float:
	r = flt(rate) if flt(rate) > 0 else get_exchange_rate()
	cur = (currency or "EGP").upper()
	if cur == "USD":
		return round(flt(amount) * r, 2)
	return round(flt(amount), 2)


def to_usd(amount: float, currency: str, rate: float | None = None) -> float:
	r = flt(rate) if flt(rate) > 0 else get_exchange_rate()
	cur = (currency or "USD").upper()
	if cur == "EGP":
		return round(flt(amount) / r, 2) if r > 0 else 0.0
	return round(flt(amount), 2)


def convert_currency(amount: float, from_currency: str, to_currency: str, rate: float | None = None) -> float:
	f_cur = (from_currency or "EGP").upper()
	t_cur = (to_currency or "EGP").upper()
	if f_cur == t_cur:
		return round(flt(amount), 2)
	r = flt(rate) if flt(rate) > 0 else get_exchange_rate()
	if f_cur == "USD" and t_cur == "EGP":
		return round(flt(amount) * r, 2)
	if f_cur == "EGP" and t_cur == "USD":
		return round(flt(amount) / r, 2) if r > 0 else 0.0
	return round(flt(amount), 2)


def annualize(amount: float, billing_cycle: str) -> float:
	factor = CYCLE_ANNUAL_FACTOR.get(billing_cycle or "Annual", 1.0)
	return round(flt(amount) * factor, 2)


def advance_cycle_date(due_date: str | date, billing_cycle: str) -> date:
	"""Advance a subscription due date by one full billing cycle with safe end-of-month clamping."""
	months = CYCLE_MONTHS.get(billing_cycle or "Annual", 12)
	return getdate(add_months(getdate(due_date), months))


def compute_due_state(next_due_date: str | date | None, status: str = "Active") -> tuple[int, str]:
	"""Return (days_until_due, due_state) relative to site today."""
	if (status or "Active") != "Active" or not next_due_date:
		return 0, "Inactive"
	days = cint(date_diff(getdate(next_due_date), getdate(nowdate())))
	if days < 0:
		return days, "Overdue"
	if days == 0:
		return 0, "Due Today"
	if days <= 7:
		return days, "Due within 7d"
	if days <= 30:
		return days, "Due within 30d"
	return days, "Upcoming"


def parse_offset_days(raw: str | None, default: tuple[int, ...] = (30, 15, 7, 3, 1, 0)) -> list[int]:
	if not raw:
		return list(default)
	result: list[int] = []
	for part in str(raw).replace(";", ",").split(","):
		part = part.strip()
		if not part:
			continue
		try:
			val = int(part)
			if -30 <= val <= 365 and val not in result:
				result.append(val)
		except ValueError:
			continue
	return sorted(result, reverse=True) if result else list(default)


def generate_schedule_occurrences(
	next_due_date: str | date,
	billing_cycle: str,
	start_date: str | date | None = None,
	horizon_months: int = 12,
) -> list[date]:
	"""Return all expected renewal dates falling within [start_date_month_start, end_date]."""
	if not next_due_date:
		return []
	base_start = getdate(start_date or nowdate())
	window_start = date(base_start.year, base_start.month, 1)
	window_end = getdate(add_months(window_start, max(1, min(int(horizon_months or 12), 36))))
	months_step = CYCLE_MONTHS.get(billing_cycle or "Annual", 12)

	cur = getdate(next_due_date)
	# Roll overdue dates forward if they precede window_start, while keeping overdue items
	# that fall in the current month or rolling by cycle until >= window_start
	guard = 0
	while cur < window_start and guard < 120:
		cur = getdate(add_months(cur, months_step))
		guard += 1

	occurrences: list[date] = []
	while cur < window_end and len(occurrences) < 60:
		occurrences.append(cur)
		cur = getdate(add_months(cur, months_step))
	return occurrences


def ensure_erpnext_customer(client_name: str) -> str | None:
	"""Optionally link or auto-create an ERPNext Customer record when ERPNext is present."""
	client_name = (client_name or "").strip()
	if not client_name or not frappe.db.exists("DocType", "Customer"):
		return None
	existing = frappe.db.get_value("Customer", {"customer_name": client_name}, "name")
	if existing:
		return existing
	if frappe.db.exists("Customer", client_name):
		return client_name
	auto_create = True
	if frappe.db.exists("DocType", SETTINGS_DOCTYPE):
		val = frappe.db.get_single_value(SETTINGS_DOCTYPE, "auto_create_erpnext_parties")
		if val is not None:
			auto_create = bool(cint(val))
	if not auto_create:
		return None
	try:
		group = (
			frappe.db.get_single_value("Selling Settings", "customer_group")
			or frappe.db.get_value("Customer Group", {"is_group": 0}, "name")
			or frappe.db.get_value("Customer Group", {}, "name")
		)
		territory = (
			frappe.db.get_single_value("Selling Settings", "territory")
			or frappe.db.get_value("Territory", {"is_group": 0}, "name")
			or frappe.db.get_value("Territory", {}, "name")
		)
		doc = frappe.get_doc(
			{
				"doctype": "Customer",
				"customer_name": client_name,
				"customer_type": "Company",
				"customer_group": group,
				"territory": territory,
			}
		)
		doc.flags.ignore_permissions = True
		doc.insert()
		return doc.name
	except Exception:
		return None


def ensure_erpnext_supplier(vendor_name: str) -> str | None:
	"""Optionally link or auto-create an ERPNext Supplier record when ERPNext is present."""
	vendor_name = (vendor_name or "").strip()
	if not vendor_name or not frappe.db.exists("DocType", "Supplier"):
		return None
	existing = frappe.db.get_value("Supplier", {"supplier_name": vendor_name}, "name")
	if existing:
		return existing
	if frappe.db.exists("Supplier", vendor_name):
		return vendor_name
	auto_create = True
	if frappe.db.exists("DocType", SETTINGS_DOCTYPE):
		val = frappe.db.get_single_value(SETTINGS_DOCTYPE, "auto_create_erpnext_parties")
		if val is not None:
			auto_create = bool(cint(val))
	if not auto_create:
		return None
	try:
		group = (
			frappe.db.get_single_value("Buying Settings", "supplier_group")
			or frappe.db.get_value("Supplier Group", {"is_group": 0}, "name")
			or frappe.db.get_value("Supplier Group", {}, "name")
		)
		doc = frappe.get_doc(
			{
				"doctype": "Supplier",
				"supplier_name": vendor_name,
				"supplier_type": "Company",
				"supplier_group": group,
			}
		)
		doc.flags.ignore_permissions = True
		doc.insert()
		return doc.name
	except Exception:
		return None


def recalculate_client_subscription_costs(client_sub_names: list[str] | set[str] | None = None) -> None:
	"""Recompute allocated_vendor_cost_egp, annual_profit_egp, and profit_margin_pct
	for affected (or all) Client Subscription documents from active Vendor Subscription Links."""
	if not frappe.db.exists("DocType", "Client Subscription") or not frappe.db.exists(
		"DocType", "Vendor Subscription"
	):
		return

	filters = {"name": ["in", list(client_sub_names)]} if client_sub_names else {}
	client_subs = frappe.get_all(
		"Client Subscription",
		filters=filters,
		fields=["name", "amount", "currency", "billing_cycle", "next_due_date", "status"],
	)
	if not client_subs:
		return

	rate = get_exchange_rate()

	# Sum allocated_annual_egp per client_subscription across Active Vendor Subscriptions
	link_rows = frappe.db.sql(
		"""
		SELECT
			link.client_subscription AS client_sub,
			COALESCE(SUM(link.allocated_annual_egp), 0) AS total_cost_egp
		FROM `tabVendor Subscription Link` link
		INNER JOIN `tabVendor Subscription` vsub ON vsub.name = link.parent
		WHERE vsub.status = 'Active'
		GROUP BY link.client_subscription
		""",
		as_dict=True,
	)
	cost_map = {row.client_sub: flt(row.total_cost_egp) for row in link_rows}

	for sub in client_subs:
		ann_orig = annualize(flt(sub.amount), sub.billing_cycle)
		ann_egp = to_egp(ann_orig, sub.currency, rate)
		ann_usd = to_usd(ann_orig, sub.currency, rate)
		cost_egp = round(cost_map.get(sub.name, 0.0), 2)
		profit_egp = round(ann_egp - cost_egp, 2)
		margin_pct = round((profit_egp / ann_egp) * 100.0, 2) if ann_egp > 0 else 0.0
		days, due_state = compute_due_state(sub.next_due_date, sub.status)

		frappe.db.set_value(
			"Client Subscription",
			sub.name,
			{
				"annualized_egp": ann_egp,
				"annualized_usd": ann_usd,
				"allocated_vendor_cost_egp": cost_egp,
				"annual_profit_egp": profit_egp,
				"profit_margin_pct": margin_pct,
				"days_until_due": days,
				"due_state": due_state,
			},
			update_modified=False,
		)


def recalculate_all_vendor_and_client_metrics() -> None:
	"""Recalculate all Vendor Subscription cost splits and Client Subscription margins (e.g. after FX rate update)."""
	if frappe.db.exists("DocType", "Vendor Subscription"):
		for vname in frappe.get_all("Vendor Subscription", pluck="name"):
			vdoc = frappe.get_doc("Vendor Subscription", vname)
			vdoc.compute_metrics_and_allocations()
			vdoc.db_update()
			for row in vdoc.linked_subscriptions:
				row.db_update()
	recalculate_client_subscription_costs()

