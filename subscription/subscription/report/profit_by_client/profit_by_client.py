# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
from frappe import _
from subscription.api.v1 import get_analytics


def execute(filters=None):
	rows = get_analytics(horizon_months=12)["by_client"]
	columns = [
		{"fieldname": "client_name", "label": _("Client"), "fieldtype": "Data", "width": 220},
		{"fieldname": "subscriptions_count", "label": _("Services"), "fieldtype": "Int", "width": 100},
		{"fieldname": "annual_revenue_egp", "label": _("Annual Revenue (EGP)"), "fieldtype": "Float", "precision": 2, "width": 175},
		{"fieldname": "allocated_cost_egp", "label": _("Allocated Vendor Cost (EGP)"), "fieldtype": "Float", "precision": 2, "width": 195},
		{"fieldname": "annual_profit_egp", "label": _("Annual Profit (EGP)"), "fieldtype": "Float", "precision": 2, "width": 170},
		{"fieldname": "margin_pct", "label": _("Profit Margin %"), "fieldtype": "Percent", "width": 130},
	]
	chart = {
		"data": {
			"labels": [r["client_name"] for r in rows[:10]],
			"datasets": [
				{"name": _("Revenue (EGP)"), "values": [r["annual_revenue_egp"] for r in rows[:10]]},
				{"name": _("Profit (EGP)"), "values": [r["annual_profit_egp"] for r in rows[:10]]},
			],
		},
		"type": "bar",
		"colors": ["#0ea5e9", "#10b981"],
	}
	return columns, rows, None, chart
