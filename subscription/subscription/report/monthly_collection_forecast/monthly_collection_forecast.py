# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
from frappe import _
from frappe.utils import cint
from subscription.api.v1 import get_analytics


def execute(filters=None):
	horizon = cint((filters or {}).get("horizon_months") or 12)
	analytics = get_analytics(horizon_months=horizon)
	rows = analytics["forecast_months"]

	columns = [
		{"fieldname": "label", "label": _("Month"), "fieldtype": "Data", "width": 130},
		{"fieldname": "inflow_usd", "label": _("Client Inflow (USD)"), "fieldtype": "Float", "precision": 2, "width": 160},
		{"fieldname": "inflow_egp", "label": _("Client Inflow (EGP)"), "fieldtype": "Float", "precision": 2, "width": 160},
		{"fieldname": "outflow_egp", "label": _("Vendor Outflow (EGP)"), "fieldtype": "Float", "precision": 2, "width": 165},
		{"fieldname": "net_egp", "label": _("Net Cashflow (EGP)"), "fieldtype": "Float", "precision": 2, "width": 165},
	]
	chart = {
		"data": {
			"labels": [r["short_label"] for r in rows],
			"datasets": [
				{"name": _("Client Inflow (EGP)"), "values": [r["inflow_egp"] for r in rows]},
				{"name": _("Vendor Outflow (EGP)"), "values": [r["outflow_egp"] for r in rows]},
			],
		},
		"type": "bar",
		"colors": ["#10b981", "#ff5757"],
	}
	return columns, rows, None, chart
