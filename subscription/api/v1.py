# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

"""Production RPC/REST API v1 for the Subscription Desk & Mobile PWA."""

import json
import os
from datetime import date

import frappe
from frappe import _
from frappe.utils import add_months, cint, date_diff, flt, formatdate, getdate, nowdate

from subscription.email_alerts import (
	DEFAULT_TEXTS,
	parse_email_list,
	render_renewal_email,
	run_email_reminders,
	send_subscription_reminder,
)
from subscription.push import (
	NOTIF_LOG_DOCTYPE,
	create_user_notification,
	get_unread_count,
	run_push_renewal_alerts,
)
from subscription.setup.seed import import_workspace_payload
from subscription.utils import (
	SETTINGS_DOCTYPE,
	annualize,
	compute_due_state,
	convert_currency,
	generate_schedule_occurrences,
	get_exchange_rate,
	recalculate_all_vendor_and_client_metrics,
	to_egp,
	to_usd,
)


def _require_perm(doctype: str, ptype: str = "read", doc=None) -> None:
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required."), frappe.PermissionError)
	if doc is not None:
		doc.check_permission(ptype)
	elif not frappe.has_permission(doctype, ptype):
		frappe.throw(_("Not permitted to {0} {1}.").format(ptype, doctype), frappe.PermissionError)


def _serialize_vendor_links_by_client() -> tuple[list[dict], dict[str, list[dict]]]:
	"""Return enriched Vendor Subscriptions and a reverse lookup map: client_sub_name -> list of vendor cost shares."""
	vsubs = frappe.get_list(
		"Vendor Subscription",
		fields=[
			"name",
			"legacy_id",
			"supplier",
			"vendor_name",
			"service",
			"status",
			"billing_cycle",
			"currency",
			"amount",
			"next_due_date",
			"days_until_due",
			"due_state",
			"allocation_mode",
			"linked_clients_count",
			"annualized_usd",
			"annualized_egp",
			"linked_revenue_egp",
			"net_contribution_egp",
			"is_unlinked_overhead",
			"notes",
		],
		order_by="next_due_date asc, vendor_name asc",
		limit_page_length=500,
	)
	if not vsubs:
		return [], {}

	vnames = [v.name for v in vsubs]
	all_links = frappe.get_all(
		"Vendor Subscription Link",
		filters={"parent": ["in", vnames]},
		fields=[
			"parent",
			"client_subscription",
			"client_name",
			"service",
			"billing_cycle",
			"allocation_weight_pct",
			"allocated_annual_egp",
			"allocated_annual_usd",
			"idx",
		],
		order_by="idx asc",
	)

	links_by_vendor: dict[str, list[dict]] = {}
	reverse_by_client: dict[str, list[dict]] = {}
	v_lookup = {v.name: v for v in vsubs}

	for link in all_links:
		links_by_vendor.setdefault(link.parent, []).append(dict(link))
		v_parent = v_lookup.get(link.parent)
		if v_parent:
			reverse_by_client.setdefault(link.client_subscription, []).append(
				{
					"vendor_subscription": v_parent.name,
					"vendor_name": v_parent.vendor_name,
					"vendor_service": v_parent.service,
					"vendor_status": v_parent.status,
					"allocation_mode": v_parent.allocation_mode,
					"allocation_weight_pct": flt(link.allocation_weight_pct),
					"allocated_annual_egp": flt(link.allocated_annual_egp),
					"allocated_annual_usd": flt(link.allocated_annual_usd),
				}
			)

	out_vendors = []
	for v in vsubs:
		d = dict(v)
		d["next_due_date"] = str(v.next_due_date) if v.next_due_date else ""
		d["days_until_due"], d["due_state"] = compute_due_state(v.next_due_date, v.status)
		d["linked_subscriptions"] = links_by_vendor.get(v.name, [])
		out_vendors.append(d)

	return out_vendors, reverse_by_client


@frappe.whitelist(methods=["GET"])
def get_bootstrap():
	"""Single-round-trip workspace snapshot for the Subscription PWA and Desk tools."""
	_require_perm("Client Subscription", "read")

	rate = get_exchange_rate()
	settings_doc = frappe.get_single(SETTINGS_DOCTYPE)

	client_subs_raw = frappe.get_list(
		"Client Subscription",
		fields=[
			"name",
			"legacy_id",
			"customer",
			"client_name",
			"service",
			"status",
			"billing_cycle",
			"currency",
			"amount",
			"next_due_date",
			"days_until_due",
			"due_state",
			"annualized_usd",
			"annualized_egp",
			"allocated_vendor_cost_egp",
			"annual_profit_egp",
			"profit_margin_pct",
			"notes",
		],
		order_by="next_due_date asc, client_name asc",
		limit_page_length=500,
	)

	vendor_subs, reverse_links = _serialize_vendor_links_by_client()

	client_subs = []
	for c in client_subs_raw:
		d = dict(c)
		d["next_due_date"] = str(c.next_due_date) if c.next_due_date else ""
		d["days_until_due"], d["due_state"] = compute_due_state(c.next_due_date, c.status)
		d["vendor_cost_links"] = reverse_links.get(c.name, [])
		client_subs.append(d)

	wallets = frappe.get_list(
		"Subscription Wallet",
		fields=[
			"name",
			"legacy_id",
			"wallet_name",
			"currency",
			"opening_balance",
			"total_in",
			"total_out",
			"current_balance",
			"transaction_count",
			"archived",
			"notes",
		],
		order_by="archived asc, wallet_name asc",
		limit_page_length=100,
	)

	transactions = frappe.get_list(
		"Subscription Transaction",
		fields=[
			"name",
			"legacy_id",
			"transaction_date",
			"direction",
			"wallet",
			"wallet_currency",
			"reference_kind",
			"client_subscription",
			"vendor_subscription",
			"party",
			"service",
			"amount",
			"currency",
			"exchange_rate",
			"wallet_amount",
			"advance_due_date",
			"previous_due_date",
			"new_due_date",
			"notes",
		],
		order_by="transaction_date desc, creation desc",
		limit_page_length=250,
	)
	for t in transactions:
		t["transaction_date"] = str(t["transaction_date"]) if t.get("transaction_date") else ""

	rules_raw = frappe.get_list(
		"Subscription Reminder Rule",
		fields=["name", "legacy_id", "client_name", "customer", "enabled", "to_emails", "cc_emails"],
		order_by="client_name asc",
		limit_page_length=200,
	)
	rule_names = [r.name for r in rules_raw]
	rule_offsets = (
		frappe.get_all(
			"Subscription Reminder Offset",
			filters={"parent": ["in", rule_names]},
			fields=["parent", "days_before", "enabled"],
			order_by="days_before desc",
		)
		if rule_names
		else []
	)
	offsets_by_rule: dict[str, list[dict]] = {}
	for off in rule_offsets:
		offsets_by_rule.setdefault(off.parent, []).append(
			{"days_before": cint(off.days_before), "enabled": cint(off.enabled)}
		)

	reminder_rules = []
	for r in rules_raw:
		rd = dict(r)
		rd["offsets"] = offsets_by_rule.get(r.name, [])
		reminder_rules.append(rd)

	email_logs = frappe.get_list(
		"Subscription Email Log",
		fields=[
			"name",
			"client_subscription",
			"client_name",
			"service",
			"due_date",
			"days_before",
			"recipients",
			"subject",
			"template_used",
			"is_test",
			"status",
			"sent_at",
		],
		order_by="sent_at desc",
		limit_page_length=60,
	)
	for log in email_logs:
		log["due_date"] = str(log["due_date"]) if log.get("due_date") else ""
		log["sent_at"] = str(log["sent_at"]) if log.get("sent_at") else ""

	notifications = frappe.get_all(
		NOTIF_LOG_DOCTYPE,
		filters={"recipient": frappe.session.user},
		fields=[
			"name",
			"title",
			"body",
			"category",
			"reference_doctype",
			"reference_name",
			"due_date",
			"days_before",
			"read",
			"created_at",
		],
		order_by="created_at desc",
		limit_page_length=50,
	)
	for n in notifications:
		n["due_date"] = str(n["due_date"]) if n.get("due_date") else ""
		n["created_at"] = str(n["created_at"]) if n.get("created_at") else ""

	# Compute executive KPIs
	active_c = [c for c in client_subs if c["status"] == "Active"]
	active_v = [v for v in vendor_subs if v["status"] == "Active"]
	ann_rev_egp = round(sum(flt(c["annualized_egp"]) for c in active_c), 2)
	ann_rev_usd = round(to_usd(ann_rev_egp, "EGP", rate), 2)
	ann_cost_egp = round(sum(flt(v["annualized_egp"]) for v in active_v), 2)
	ann_cost_usd = round(to_usd(ann_cost_egp, "EGP", rate), 2)
	unlinked_cost_egp = round(
		sum(flt(v["annualized_egp"]) for v in active_v if cint(v.get("is_unlinked_overhead"))), 2
	)
	net_profit_egp = round(ann_rev_egp - ann_cost_egp, 2)
	net_profit_usd = round(to_usd(net_profit_egp, "EGP", rate), 2)
	net_margin_pct = round((net_profit_egp / ann_rev_egp) * 100.0, 2) if ann_rev_egp > 0 else 0.0

	wallet_total_egp = round(
		sum(to_egp(flt(w["current_balance"]), w["currency"], rate) for w in wallets if not cint(w["archived"])),
		2,
	)

	kpis = {
		"usd_egp_rate": rate,
		"active_client_subs": len(active_c),
		"distinct_clients": len({c["client_name"] for c in active_c}),
		"active_vendor_subs": len(active_v),
		"distinct_vendors": len({v["vendor_name"] for v in active_v}),
		"annual_revenue_egp": ann_rev_egp,
		"annual_revenue_usd": ann_rev_usd,
		"mrr_egp": round(ann_rev_egp / 12.0, 2),
		"mrr_usd": round(ann_rev_usd / 12.0, 2),
		"annual_vendor_cost_egp": ann_cost_egp,
		"annual_vendor_cost_usd": ann_cost_usd,
		"unlinked_overhead_egp": unlinked_cost_egp,
		"annual_net_profit_egp": net_profit_egp,
		"annual_net_profit_usd": net_profit_usd,
		"net_margin_pct": net_margin_pct,
		"wallet_total_egp": wallet_total_egp,
		"wallet_total_usd": round(to_usd(wallet_total_egp, "EGP", rate), 2),
		"overdue_count": sum(1 for c in active_c if c["days_until_due"] < 0)
		+ sum(1 for v in active_v if v["days_until_due"] < 0),
		"due_30d_count": sum(1 for c in active_c if 0 <= c["days_until_due"] <= 30)
		+ sum(1 for v in active_v if 0 <= v["days_until_due"] <= 30),
	}

	return {
		"kpis": kpis,
		"settings": {
			"usd_egp_rate": rate,
			"default_currency": settings_doc.default_currency or "USD",
			"enable_email_reminders": cint(settings_doc.enable_email_reminders),
			"from_name": settings_doc.from_name or "Nest Software Development",
			"reply_to": settings_doc.reply_to or "info@nsd-eg.com",
			"email_template": settings_doc.email_template or "nest",
			"email_footer": settings_doc.email_footer or DEFAULT_TEXTS["email_footer"],
			"signature_image": settings_doc.signature_image or "",
			"tx_subject": settings_doc.tx_subject or DEFAULT_TEXTS["tx_subject"],
			"tx_greeting": settings_doc.tx_greeting or DEFAULT_TEXTS["tx_greeting"],
			"tx_intro": settings_doc.tx_intro or DEFAULT_TEXTS["tx_intro"],
			"tx_closing": settings_doc.tx_closing or DEFAULT_TEXTS["tx_closing"],
			"tx_cta": settings_doc.tx_cta or DEFAULT_TEXTS["tx_cta"],
			"tx_signoff": settings_doc.tx_signoff or DEFAULT_TEXTS["tx_signoff"],
			"enable_push_notifications": cint(settings_doc.enable_push_notifications),
			"notify_client_renewals": cint(settings_doc.notify_client_renewals),
			"notify_vendor_renewals": cint(settings_doc.notify_vendor_renewals),
			"push_reminder_offsets": settings_doc.push_reminder_offsets or "30, 15, 7, 3, 1, 0",
		},
		"client_subscriptions": client_subs,
		"vendor_subscriptions": vendor_subs,
		"wallets": wallets,
		"transactions": transactions,
		"reminder_rules": reminder_rules,
		"email_logs": email_logs,
		"notifications": notifications,
		"unread_notifications": get_unread_count(frappe.session.user),
	}


@frappe.whitelist(methods=["POST"])
def save_client_subscription(payload):
	data = frappe.parse_json(payload) or {}
	name = data.get("name")
	if name and frappe.db.exists("Client Subscription", name):
		doc = frappe.get_doc("Client Subscription", name)
		_require_perm("Client Subscription", "write", doc)
	else:
		_require_perm("Client Subscription", "create")
		doc = frappe.new_doc("Client Subscription")

	for field in ("client_name", "customer", "service", "billing_cycle", "currency", "status", "notes"):
		if field in data:
			doc.set(field, data.get(field))
	if "amount" in data:
		doc.amount = flt(data.get("amount"))
	if "next_due_date" in data and data.get("next_due_date"):
		doc.next_due_date = getdate(data.get("next_due_date"))

	doc.save()
	return {"name": doc.name, "message": _("Client subscription saved.")}


@frappe.whitelist(methods=["POST"])
def delete_client_subscription(name: str):
	doc = frappe.get_doc("Client Subscription", name)
	_require_perm("Client Subscription", "delete", doc)
	doc.delete()
	return {"deleted": True}


@frappe.whitelist(methods=["POST"])
def save_vendor_subscription(payload):
	"""Create or update a Vendor Subscription, including multi-client cost allocation links."""
	data = frappe.parse_json(payload) or {}
	name = data.get("name")
	if name and frappe.db.exists("Vendor Subscription", name):
		doc = frappe.get_doc("Vendor Subscription", name)
		_require_perm("Vendor Subscription", "write", doc)
	else:
		_require_perm("Vendor Subscription", "create")
		doc = frappe.new_doc("Vendor Subscription")

	for field in (
		"vendor_name",
		"supplier",
		"service",
		"billing_cycle",
		"currency",
		"status",
		"allocation_mode",
		"notes",
	):
		if field in data:
			doc.set(field, data.get(field))
	if "amount" in data:
		doc.amount = flt(data.get("amount"))
	if "next_due_date" in data and data.get("next_due_date"):
		doc.next_due_date = getdate(data.get("next_due_date"))

	if "linked_subscriptions" in data:
		rows = []
		seen = set()
		for item in data.get("linked_subscriptions") or []:
			c_sub = item.get("client_subscription") if isinstance(item, dict) else str(item)
			weight = flt(item.get("allocation_weight_pct")) if isinstance(item, dict) else 0.0
			if c_sub and c_sub not in seen and frappe.db.exists("Client Subscription", c_sub):
				seen.add(c_sub)
				rows.append({"client_subscription": c_sub, "allocation_weight_pct": weight})
		doc.set("linked_subscriptions", rows)

	doc.save()
	return {"name": doc.name, "message": _("Vendor subscription saved.")}


@frappe.whitelist(methods=["POST"])
def delete_vendor_subscription(name: str):
	doc = frappe.get_doc("Vendor Subscription", name)
	_require_perm("Vendor Subscription", "delete", doc)
	doc.delete()
	return {"deleted": True}


@frappe.whitelist(methods=["POST"])
def record_payment(payload):
	"""Record a Client inflow or Vendor outflow into a Wallet and optionally advance next_due_date."""
	_require_perm("Subscription Transaction", "create")
	data = frappe.parse_json(payload) or {}

	ref_kind = (data.get("reference_kind") or "manual").lower()
	wallet_name = data.get("wallet")
	if not wallet_name or not frappe.db.exists("Subscription Wallet", wallet_name):
		frappe.throw(_("Please select a valid Subscription Wallet."))

	wallet_doc = frappe.get_doc("Subscription Wallet", wallet_name)
	rate = flt(data.get("exchange_rate")) or get_exchange_rate()

	c_sub = None
	v_sub = None
	direction = data.get("direction") or ("out" if ref_kind == "vendor" else "in")
	party = data.get("party") or ""
	service = data.get("service") or ""
	currency = (data.get("currency") or wallet_doc.currency or "EGP").upper()
	amount = flt(data.get("amount"))

	if ref_kind == "client" and data.get("client_subscription"):
		sub_doc = frappe.get_doc("Client Subscription", data.get("client_subscription"))
		c_sub = sub_doc.name
		direction = "in"
		party = party or sub_doc.client_name
		service = service or sub_doc.service
		currency = (data.get("currency") or sub_doc.currency).upper()
		if amount <= 0:
			amount = flt(sub_doc.amount)
	elif ref_kind == "vendor" and data.get("vendor_subscription"):
		v_doc = frappe.get_doc("Vendor Subscription", data.get("vendor_subscription"))
		v_sub = v_doc.name
		direction = "out"
		party = party or v_doc.vendor_name
		service = service or v_doc.service
		currency = (data.get("currency") or v_doc.currency).upper()
		if amount <= 0:
			amount = flt(v_doc.amount)

	if amount <= 0:
		frappe.throw(_("Payment amount must be greater than zero."))

	wallet_amt = flt(data.get("wallet_amount"))
	if wallet_amt <= 0:
		wallet_amt = convert_currency(amount, currency, wallet_doc.currency, rate)

	txn = frappe.get_doc(
		{
			"doctype": "Subscription Transaction",
			"transaction_date": getdate(data.get("transaction_date") or nowdate()),
			"direction": direction,
			"wallet": wallet_doc.name,
			"reference_kind": ref_kind,
			"client_subscription": c_sub,
			"vendor_subscription": v_sub,
			"party": party,
			"service": service,
			"amount": amount,
			"currency": currency,
			"exchange_rate": rate,
			"wallet_amount": wallet_amt,
			"advance_due_date": cint(data.get("advance_due_date", 1 if ref_kind in ("client", "vendor") else 0)),
			"notes": data.get("notes") or "",
		}
	)
	txn.insert()

	return {
		"transaction": txn.name,
		"wallet_amount": txn.wallet_amount,
		"wallet_currency": wallet_doc.currency,
		"new_due_date": str(txn.new_due_date) if txn.new_due_date else "",
		"message": _("Payment recorded in {0}.").format(wallet_doc.wallet_name),
	}


@frappe.whitelist(methods=["POST"])
def save_wallet(payload):
	data = frappe.parse_json(payload) or {}
	name = data.get("name")
	if name and frappe.db.exists("Subscription Wallet", name):
		doc = frappe.get_doc("Subscription Wallet", name)
		_require_perm("Subscription Wallet", "write", doc)
	else:
		_require_perm("Subscription Wallet", "create")
		doc = frappe.new_doc("Subscription Wallet")

	for field in ("wallet_name", "currency", "bank_account", "notes"):
		if field in data:
			doc.set(field, data.get(field))
	if "opening_balance" in data:
		doc.opening_balance = flt(data.get("opening_balance"))
	if "archived" in data:
		doc.archived = cint(data.get("archived"))

	doc.save()
	return {"name": doc.name, "message": _("Wallet saved.")}


@frappe.whitelist(methods=["POST"])
def delete_wallet(name: str):
	doc = frappe.get_doc("Subscription Wallet", name)
	_require_perm("Subscription Wallet", "delete", doc)
	doc.delete()
	return {"deleted": True}


@frappe.whitelist(methods=["POST"])
def delete_transaction(name: str):
	doc = frappe.get_doc("Subscription Transaction", name)
	_require_perm("Subscription Transaction", "delete", doc)
	doc.delete()
	return {"deleted": True}


@frappe.whitelist(methods=["POST"])
def save_reminder_rule(payload):
	data = frappe.parse_json(payload) or {}
	name = data.get("name")
	if name and frappe.db.exists("Subscription Reminder Rule", name):
		doc = frappe.get_doc("Subscription Reminder Rule", name)
		_require_perm("Subscription Reminder Rule", "write", doc)
	else:
		existing = frappe.db.get_value(
			"Subscription Reminder Rule", {"client_name": (data.get("client_name") or "").strip()}, "name"
		)
		if existing:
			doc = frappe.get_doc("Subscription Reminder Rule", existing)
			_require_perm("Subscription Reminder Rule", "write", doc)
		else:
			_require_perm("Subscription Reminder Rule", "create")
			doc = frappe.new_doc("Subscription Reminder Rule")

	for field in ("client_name", "customer", "to_emails", "cc_emails"):
		if field in data:
			doc.set(field, data.get(field))
	if "enabled" in data:
		doc.enabled = cint(data.get("enabled"))
	if "offsets" in data:
		rows = []
		for off in data.get("offsets") or []:
			rows.append(
				{
					"days_before": cint(off.get("days_before") if "days_before" in off else off.get("days")),
					"enabled": cint(off.get("enabled", 1)),
				}
			)
		doc.set("offsets", rows)

	doc.save()
	return {"name": doc.name, "message": _("Reminder rule saved.")}


@frappe.whitelist(methods=["POST"])
def delete_reminder_rule(name: str):
	doc = frappe.get_doc("Subscription Reminder Rule", name)
	_require_perm("Subscription Reminder Rule", "delete", doc)
	doc.delete()
	return {"deleted": True}


@frappe.whitelist(methods=["POST"])
def save_settings(payload):
	_require_perm(SETTINGS_DOCTYPE, "write")
	data = frappe.parse_json(payload) or {}
	doc = frappe.get_single(SETTINGS_DOCTYPE)
	old_rate = flt(doc.usd_egp_rate)

	allowed_fields = (
		"usd_egp_rate",
		"default_currency",
		"enable_email_reminders",
		"from_name",
		"reply_to",
		"email_template",
		"email_footer",
		"tx_subject",
		"tx_greeting",
		"tx_intro",
		"tx_closing",
		"tx_cta",
		"tx_signoff",
		"enable_push_notifications",
		"notify_client_renewals",
		"notify_vendor_renewals",
		"push_reminder_offsets",
	)
	for field in allowed_fields:
		if field in data:
			doc.set(field, data.get(field))
	doc.save()

	if abs(flt(doc.usd_egp_rate) - old_rate) > 0.0001:
		recalculate_all_vendor_and_client_metrics()

	return {"saved": True, "usd_egp_rate": flt(doc.usd_egp_rate)}


@frappe.whitelist(methods=["GET", "POST"])
def preview_email(client_subscription: str | None = None, days_before: int | None = None, overrides=None):
	"""Render a live HTML preview for a specific Client Subscription or sample subscription."""
	_require_perm("Client Subscription", "read")
	ov = frappe.parse_json(overrides) if overrides else None

	if client_subscription and frappe.db.exists("Client Subscription", client_subscription):
		sub_data = frappe.get_doc("Client Subscription", client_subscription).as_dict()
	else:
		first = frappe.get_all(
			"Client Subscription",
			filters={"status": "Active"},
			fields=["client_name", "service", "billing_cycle", "currency", "amount", "next_due_date"],
			limit=1,
		)
		sub_data = (
			first[0]
			if first
			else {
				"client_name": "Acme Holdings",
				"service": "Managed Cloud ERP + Domain",
				"billing_cycle": "Annual",
				"currency": "USD",
				"amount": 480.0,
				"next_due_date": str(add_months(getdate(nowdate()), 1)),
			}
		)

	return render_renewal_email(
		sub_data=sub_data,
		days_before=int(days_before) if days_before not in (None, "") else None,
		settings_override=ov,
		is_test=False,
		preview_mode=True,
	)


@frappe.whitelist(methods=["POST"])
def send_reminder_now(client_subscription: str, to_emails: str | None = None, is_test: int = 0):
	"""Immediately send a renewal reminder (or `[TEST]` email) for a Client Subscription."""
	_require_perm("Client Subscription", "write")
	sub_doc = frappe.get_doc("Client Subscription", client_subscription)

	recipients = parse_email_list(to_emails)
	cc_list: list[str] = []
	if not recipients:
		rule = frappe.db.get_value(
			"Subscription Reminder Rule",
			{"client_name": sub_doc.client_name},
			["to_emails", "cc_emails"],
			as_dict=True,
		)
		if rule:
			recipients = parse_email_list(rule.to_emails)
			cc_list = parse_email_list(rule.cc_emails)

	if not recipients:
		frappe.throw(_("No recipient email configured for {0}. Add a Reminder Rule or enter an email.").format(sub_doc.client_name))

	return send_subscription_reminder(
		client_sub_doc=sub_doc,
		to_emails=recipients,
		cc_emails=cc_list,
		is_test=bool(cint(is_test)),
		force=True,
	)


@frappe.whitelist(methods=["POST"])
def run_all_reminders_now():
	"""Manually execute both Email Reminder Rules and Push Renewal Alerts right now."""
	_require_perm(SETTINGS_DOCTYPE, "write")
	email_res = run_email_reminders()
	push_res = run_push_renewal_alerts()
	return {"email": email_res, "push": push_res}


@frappe.whitelist(methods=["POST"])
def mark_notifications_read(name: str | None = None):
	if frappe.session.user == "Guest":
		frappe.throw(_("Authentication required"), frappe.PermissionError)
	filters: dict = {"recipient": frappe.session.user, "read": 0}
	if name:
		filters["name"] = name
	frappe.db.set_value(NOTIF_LOG_DOCTYPE, filters, "read", 1, update_modified=False)
	return {"unread_count": get_unread_count(frappe.session.user)}


@frappe.whitelist(methods=["GET"])
def get_analytics(horizon_months: int = 12):
	"""Compute all 7 analytical datasets & chronological payment timeline in one call."""
	_require_perm("Client Subscription", "read")
	horizon = max(3, min(cint(horizon_months) or 12, 24))
	rate = get_exchange_rate()
	today = getdate(nowdate())
	month_0 = date(today.year, today.month, 1)

	client_subs = frappe.get_list(
		"Client Subscription",
		filters={"status": "Active"},
		fields=[
			"name",
			"client_name",
			"service",
			"billing_cycle",
			"currency",
			"amount",
			"next_due_date",
			"annualized_egp",
			"annualized_usd",
			"allocated_vendor_cost_egp",
			"annual_profit_egp",
			"profit_margin_pct",
		],
		limit_page_length=500,
	)
	vendor_subs = frappe.get_list(
		"Vendor Subscription",
		filters={"status": "Active"},
		fields=[
			"name",
			"vendor_name",
			"service",
			"billing_cycle",
			"currency",
			"amount",
			"next_due_date",
			"annualized_egp",
			"annualized_usd",
			"linked_clients_count",
			"is_unlinked_overhead",
		],
		limit_page_length=500,
	)

	# 1. Monthly Collection Forecast + Detailed Payment Schedule
	months_map: dict[str, dict] = {}
	for i in range(horizon):
		m_dt = getdate(add_months(month_0, i))
		m_key = m_dt.strftime("%Y-%m")
		months_map[m_key] = {
			"month_key": m_key,
			"label": m_dt.strftime("%b %Y"),
			"short_label": m_dt.strftime("%b '%y"),
			"inflow_egp": 0.0,
			"inflow_usd": 0.0,
			"outflow_egp": 0.0,
			"outflow_usd": 0.0,
			"net_egp": 0.0,
			"net_usd": 0.0,
			"items": [],
		}

	schedule_rows: list[dict] = []
	for c in client_subs:
		egp_val = to_egp(flt(c.amount), c.currency, rate)
		usd_val = to_usd(flt(c.amount), c.currency, rate)
		for occ in generate_schedule_occurrences(c.next_due_date, c.billing_cycle, today, horizon):
			mk = occ.strftime("%Y-%m")
			if mk not in months_map:
				continue
			entry = {
				"date": str(occ),
				"month_key": mk,
				"kind": "client",
				"ref_name": c.name,
				"party": c.client_name,
				"service": c.service,
				"billing_cycle": c.billing_cycle,
				"currency": c.currency,
				"amount": flt(c.amount),
				"amount_egp": egp_val,
				"amount_usd": usd_val,
				"days_from_today": cint(date_diff(occ, today)),
			}
			months_map[mk]["inflow_egp"] = round(months_map[mk]["inflow_egp"] + egp_val, 2)
			months_map[mk]["inflow_usd"] = round(months_map[mk]["inflow_usd"] + usd_val, 2)
			months_map[mk]["items"].append(entry)
			schedule_rows.append(entry)

	for v in vendor_subs:
		egp_val = to_egp(flt(v.amount), v.currency, rate)
		usd_val = to_usd(flt(v.amount), v.currency, rate)
		for occ in generate_schedule_occurrences(v.next_due_date, v.billing_cycle, today, horizon):
			mk = occ.strftime("%Y-%m")
			if mk not in months_map:
				continue
			entry = {
				"date": str(occ),
				"month_key": mk,
				"kind": "vendor",
				"ref_name": v.name,
				"party": v.vendor_name,
				"service": v.service,
				"billing_cycle": v.billing_cycle,
				"currency": v.currency,
				"amount": flt(v.amount),
				"amount_egp": egp_val,
				"amount_usd": usd_val,
				"days_from_today": cint(date_diff(occ, today)),
			}
			months_map[mk]["outflow_egp"] = round(months_map[mk]["outflow_egp"] + egp_val, 2)
			months_map[mk]["outflow_usd"] = round(months_map[mk]["outflow_usd"] + usd_val, 2)
			months_map[mk]["items"].append(entry)
			schedule_rows.append(entry)

	forecast_months = []
	for m in months_map.values():
		m["net_egp"] = round(m["inflow_egp"] - m["outflow_egp"], 2)
		m["net_usd"] = round(m["inflow_usd"] - m["outflow_usd"], 2)
		m["items"].sort(key=lambda x: x["date"])
		forecast_months.append(m)

	schedule_rows.sort(key=lambda x: (x["date"], x["kind"], x["party"]))

	# 2. Revenue & Profit by Client
	total_rev_egp = sum(flt(c.annualized_egp) for c in client_subs) or 1.0
	by_client_map: dict[str, dict] = {}
	for c in client_subs:
		bucket = by_client_map.setdefault(
			c.client_name,
			{
				"client_name": c.client_name,
				"subscriptions_count": 0,
				"annual_revenue_egp": 0.0,
				"annual_revenue_usd": 0.0,
				"allocated_cost_egp": 0.0,
				"annual_profit_egp": 0.0,
			},
		)
		bucket["subscriptions_count"] += 1
		bucket["annual_revenue_egp"] = round(bucket["annual_revenue_egp"] + flt(c.annualized_egp), 2)
		bucket["annual_revenue_usd"] = round(bucket["annual_revenue_usd"] + flt(c.annualized_usd), 2)
		bucket["allocated_cost_egp"] = round(bucket["allocated_cost_egp"] + flt(c.allocated_vendor_cost_egp), 2)
		bucket["annual_profit_egp"] = round(bucket["annual_profit_egp"] + flt(c.annual_profit_egp), 2)

	by_client = []
	for b in by_client_map.values():
		b["share_pct"] = round((b["annual_revenue_egp"] / total_rev_egp) * 100.0, 1)
		b["margin_pct"] = (
			round((b["annual_profit_egp"] / b["annual_revenue_egp"]) * 100.0, 1)
			if b["annual_revenue_egp"] > 0
			else 0.0
		)
		by_client.append(b)
	by_client.sort(key=lambda x: x["annual_revenue_egp"], reverse=True)

	# 3. Revenue by Billing Cycle
	cycle_map: dict[str, dict] = {}
	for cycle_name in ("Monthly", "Quarterly", "Annual", "Biennial"):
		cycle_map[cycle_name] = {
			"billing_cycle": cycle_name,
			"count": 0,
			"annual_revenue_egp": 0.0,
			"annual_revenue_usd": 0.0,
		}
	for c in client_subs:
		cyc = c.billing_cycle if c.billing_cycle in cycle_map else "Annual"
		cycle_map[cyc]["count"] += 1
		cycle_map[cyc]["annual_revenue_egp"] = round(
			cycle_map[cyc]["annual_revenue_egp"] + flt(c.annualized_egp), 2
		)
		cycle_map[cyc]["annual_revenue_usd"] = round(
			cycle_map[cyc]["annual_revenue_usd"] + flt(c.annualized_usd), 2
		)
	by_cycle = []
	for cyc_row in cycle_map.values():
		cyc_row["share_pct"] = round((cyc_row["annual_revenue_egp"] / total_rev_egp) * 100.0, 1)
		by_cycle.append(cyc_row)

	# 4. Cost & Profit by Service (including Unlinked Vendor Overhead rows)
	by_service = []
	for c in client_subs:
		by_service.append(
			{
				"kind": "client_service",
				"name": c.name,
				"party": c.client_name,
				"service": c.service,
				"annual_revenue_egp": flt(c.annualized_egp),
				"allocated_cost_egp": flt(c.allocated_vendor_cost_egp),
				"annual_profit_egp": flt(c.annual_profit_egp),
				"margin_pct": flt(c.profit_margin_pct),
			}
		)
	for v in vendor_subs:
		if cint(v.is_unlinked_overhead):
			by_service.append(
				{
					"kind": "unlinked_vendor",
					"name": v.name,
					"party": f"{v.vendor_name} (Unlinked Overhead)",
					"service": v.service,
					"annual_revenue_egp": 0.0,
					"allocated_cost_egp": flt(v.annualized_egp),
					"annual_profit_egp": -flt(v.annualized_egp),
					"margin_pct": -100.0,
				}
			)
	by_service.sort(key=lambda x: x["annual_profit_egp"], reverse=True)

	# 5. Actual Ledger Cash Flow by Month
	txns = frappe.get_list(
		"Subscription Transaction",
		fields=["transaction_date", "direction", "amount", "currency", "exchange_rate"],
		order_by="transaction_date asc",
		limit_page_length=1000,
	)
	cashflow_map: dict[str, dict] = {}
	for t in txns:
		if not t.transaction_date:
			continue
		dt = getdate(t.transaction_date)
		mk = dt.strftime("%Y-%m")
		bucket = cashflow_map.setdefault(
			mk,
			{
				"month_key": mk,
				"label": dt.strftime("%b %Y"),
				"in_egp": 0.0,
				"out_egp": 0.0,
				"net_egp": 0.0,
				"tx_count": 0,
			},
		)
		egp = to_egp(flt(t.amount), t.currency, flt(t.exchange_rate) or rate)
		if t.direction == "in":
			bucket["in_egp"] = round(bucket["in_egp"] + egp, 2)
		else:
			bucket["out_egp"] = round(bucket["out_egp"] + egp, 2)
		bucket["net_egp"] = round(bucket["in_egp"] - bucket["out_egp"], 2)
		bucket["tx_count"] += 1

	cashflow_months = [cashflow_map[k] for k in sorted(cashflow_map.keys())]

	return {
		"horizon_months": horizon,
		"usd_egp_rate": rate,
		"forecast_months": forecast_months,
		"detailed_schedule": schedule_rows,
		"by_client": by_client,
		"by_cycle": by_cycle,
		"by_service": by_service,
		"cashflow_months": cashflow_months,
	}


@frappe.whitelist(methods=["GET"])
def export_workspace_json():
	"""Export the complete Subscription workspace in a clean JSON format."""
	_require_perm("Client Subscription", "read")
	snap = get_bootstrap()
	return {
		"exported_at": str(frappe.utils.now_datetime()),
		"publisher": "nsdLabs — Nest Software Development",
		"rate": snap["kpis"]["usd_egp_rate"],
		"settings": snap["settings"],
		"client_subscriptions": snap["client_subscriptions"],
		"vendor_subscriptions": snap["vendor_subscriptions"],
		"wallets": snap["wallets"],
		"transactions": snap["transactions"],
		"reminder_rules": snap["reminder_rules"],
	}


@frappe.whitelist(methods=["POST"])
def sync_seed_dataset(replace: int = 0):
	"""Import/sync the bundled `nest_subscriptions_full_export.json` production dataset."""
	_require_perm(SETTINGS_DOCTYPE, "write")
	seed_path = frappe.get_app_path("subscription", "setup", "data", "nest_subscriptions_full_export.json")
	if not os.path.exists(seed_path):
		frappe.throw(_("Seed file not found on server."))
	with open(seed_path, encoding="utf-8") as f:
		payload = json.load(f)
	return import_workspace_payload(payload, replace=bool(cint(replace)))


@frappe.whitelist(methods=["POST"])
def import_workspace_json(payload, replace: int = 0):
	"""Import an uploaded workspace JSON export (supports both legacy MySQL export and ERPNext v16 export)."""
	_require_perm(SETTINGS_DOCTYPE, "write")
	parsed = frappe.parse_json(payload) if isinstance(payload, str) else payload
	if not isinstance(parsed, dict):
		frappe.throw(_("Invalid JSON workspace backup."))
	return import_workspace_payload(parsed, replace=bool(cint(replace)))
