# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
from frappe import _
from subscription.api.v1 import get_analytics


def execute(filters=None):
	rows = get_analytics(horizon_months=12)["by_cycle"]
	columns = [
		{"fieldname": "billing_cycle", "label": _("Billing Cycle"), "fieldtype": "Data", "width": 160},
		{"fieldname": "count", "label": _("Subscriptions"), "fieldtype": "Int", "width": 130},
		{"fieldname": "annual_revenue_usd", "label": _("Annualized Revenue (USD)"), "fieldtype": "Float", "precision": 2, "width": 185},
		{"fieldname": "annual_revenue_egp", "label": _("Annualized Revenue (EGP)"), "fieldtype": "Float", "precision": 2, "width": 185},
		{"fieldname": "share_pct", "label": _("Share %"), "fieldtype": "Percent", "width": 120},
	]
	chart = {
		"data": {
			"labels": [r["billing_cycle"] for r in rows],
			"datasets": [{"name": _("Annualized EGP"), "values": [r["annual_revenue_egp"] for r in rows]}],
		},
		"type": "donut",
	}
	return columns, rows, None, chart
