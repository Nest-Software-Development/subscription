# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
from frappe import _
from frappe.utils import cint
from subscription.api.v1 import get_analytics


def execute(filters=None):
	horizon = cint((filters or {}).get("horizon_months") or 12)
	rows = get_analytics(horizon_months=horizon)["detailed_schedule"]
	columns = [
		{"fieldname": "date", "label": _("Renewal Date"), "fieldtype": "Date", "width": 120},
		{"fieldname": "kind", "label": _("Type"), "fieldtype": "Data", "width": 95},
		{"fieldname": "party", "label": _("Client / Vendor"), "fieldtype": "Data", "width": 190},
		{"fieldname": "service", "label": _("Service"), "fieldtype": "Data", "width": 230},
		{"fieldname": "billing_cycle", "label": _("Cycle"), "fieldtype": "Data", "width": 100},
		{"fieldname": "currency", "label": _("Currency"), "fieldtype": "Data", "width": 85},
		{"fieldname": "amount", "label": _("Original Amount"), "fieldtype": "Float", "precision": 2, "width": 140},
		{"fieldname": "amount_egp", "label": _("Amount (EGP)"), "fieldtype": "Float", "precision": 2, "width": 140},
	]
	return columns, rows
