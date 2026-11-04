# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
from frappe import _
from subscription.api.v1 import get_analytics


def execute(filters=None):
	rows = get_analytics(horizon_months=12)["by_client"]
	columns = [
		{"fieldname": "client_name", "label": _("Client"), "fieldtype": "Data", "width": 220},
		{"fieldname": "subscriptions_count", "label": _("Active Subscriptions"), "fieldtype": "Int", "width": 150},
		{"fieldname": "annual_revenue_usd", "label": _("Annualized Revenue (USD)"), "fieldtype": "Float", "precision": 2, "width": 180},
		{"fieldname": "annual_revenue_egp", "label": _("Annualized Revenue (EGP)"), "fieldtype": "Float", "precision": 2, "width": 180},
		{"fieldname": "share_pct", "label": _("Revenue Share %"), "fieldtype": "Percent", "width": 130},
	]
	chart = {
		"data": {
			"labels": [r["client_name"] for r in rows[:10]],
			"datasets": [{"name": _("Annualized EGP"), "values": [r["annual_revenue_egp"] for r in rows[:10]]}],
		},
		"type": "bar",
		"colors": ["#2563eb"],
	}
	return columns, rows, None, chart
