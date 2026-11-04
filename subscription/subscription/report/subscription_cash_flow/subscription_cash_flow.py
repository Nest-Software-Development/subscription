# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
from frappe import _
from subscription.api.v1 import get_analytics


def execute(filters=None):
	rows = get_analytics(horizon_months=12)["cashflow_months"]
	columns = [
		{"fieldname": "label", "label": _("Month"), "fieldtype": "Data", "width": 140},
		{"fieldname": "tx_count", "label": _("Transactions"), "fieldtype": "Int", "width": 120},
		{"fieldname": "in_egp", "label": _("Actual Inflow (EGP)"), "fieldtype": "Float", "precision": 2, "width": 175},
		{"fieldname": "out_egp", "label": _("Actual Outflow (EGP)"), "fieldtype": "Float", "precision": 2, "width": 175},
		{"fieldname": "net_egp", "label": _("Net Cash Flow (EGP)"), "fieldtype": "Float", "precision": 2, "width": 175},
	]
	chart = {
		"data": {
			"labels": [r["label"] for r in rows],
			"datasets": [
				{"name": _("Inflow (EGP)"), "values": [r["in_egp"] for r in rows]},
				{"name": _("Outflow (EGP)"), "values": [r["out_egp"] for r in rows]},
			],
		},
		"type": "bar",
		"colors": ["#10b981", "#ff5757"],
	}
	return columns, rows, None, chart
