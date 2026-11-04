# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
from frappe import _
from subscription.api.v1 import get_analytics


def execute(filters=None):
	rows = get_analytics(horizon_months=12)["by_service"]
	columns = [
		{"fieldname": "party", "label": _("Client / Overhead"), "fieldtype": "Data", "width": 220},
		{"fieldname": "service", "label": _("Service"), "fieldtype": "Data", "width": 240},
		{"fieldname": "annual_revenue_egp", "label": _("Annual Revenue (EGP)"), "fieldtype": "Float", "precision": 2, "width": 165},
		{"fieldname": "allocated_cost_egp", "label": _("Allocated Vendor Cost (EGP)"), "fieldtype": "Float", "precision": 2, "width": 195},
		{"fieldname": "annual_profit_egp", "label": _("Net Profit (EGP)"), "fieldtype": "Float", "precision": 2, "width": 155},
		{"fieldname": "margin_pct", "label": _("Margin %"), "fieldtype": "Percent", "width": 110},
	]
	return columns, rows
