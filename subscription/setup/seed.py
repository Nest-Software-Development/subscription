# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

"""Idempotent seed & legacy Nest Subscription Manager JSON importer.

Ships `nest_subscriptions_full_export.json` inside `subscription/setup/data/` so
fresh installations and migrations can seamlessly load all 26 client subscriptions,
12 vendor subscriptions (with multi-client links), 2 wallets, 17 ledger transactions,
email templates/settings, and 9 customer reminder rules.
"""

import json
import os

import frappe
from frappe.utils import cint, flt, getdate, nowdate

from subscription.email_alerts import DEFAULT_TEXTS
from subscription.utils import SETTINGS_DOCTYPE, recalculate_all_vendor_and_client_metrics


def ensure_default_settings() -> None:
	if not frappe.db.exists("DocType", SETTINGS_DOCTYPE):
		return
	settings = frappe.get_single(SETTINGS_DOCTYPE)
	changed = False
	defaults = {
		"usd_egp_rate": 56.25,
		"default_currency": "USD",
		"auto_create_erpnext_parties": 1,
		"enable_email_reminders": 1,
		"from_name": "Nest Software Development",
		"reply_to": "info@nsd-eg.com",
		"email_template": "nest",
		"enable_push_notifications": 1,
		"notify_client_renewals": 1,
		"notify_vendor_renewals": 1,
		"push_reminder_offsets": "30, 15, 7, 3, 1, 0",
		"vapid_subject": "mailto:info@nsd-eg.com",
		**DEFAULT_TEXTS,
	}
	for field, val in defaults.items():
		if settings.get(field) in (None, ""):
			settings.set(field, val)
			changed = True
	if changed:
		settings.flags.ignore_permissions = True
		settings.save()


def import_seed_if_empty() -> None:
	"""Populate initial dataset only if no Client/Vendor Subscriptions exist yet."""
	if not frappe.db.exists("DocType", "Client Subscription"):
		return
	if frappe.db.count("Client Subscription") > 0 or frappe.db.count("Vendor Subscription") > 0:
		return
	seed_path = frappe.get_app_path("subscription", "setup", "data", "nest_subscriptions_full_export.json")
	if os.path.exists(seed_path):
		with open(seed_path, encoding="utf-8") as f:
			payload = json.load(f)
		import_workspace_payload(payload, replace=False)


def import_workspace_payload(payload: dict, replace: bool = False) -> dict:
	"""Import either a legacy `nest_subscriptions_full_export.json` (`raw_database` wrapper)
	or a direct workspace export dict idempotently by `legacy_id` / natural keys."""
	raw = payload.get("raw_database") if isinstance(payload, dict) and "raw_database" in payload else payload
	if not isinstance(raw, dict):
		frappe.throw(frappe._("Invalid subscription export JSON structure."))

	if replace:
		for dt in (
			"Subscription Transaction",
			"Vendor Subscription",
			"Client Subscription",
			"Subscription Wallet",
			"Subscription Reminder Rule",
		):
			for docname in frappe.get_all(dt, pluck="name"):
				frappe.delete_doc(dt, docname, ignore_permissions=True, force=True)

	# 1. Settings
	settings_doc = frappe.get_single(SETTINGS_DOCTYPE)
	src_settings = raw.get("settings") or {}
	if raw.get("rate") or src_settings.get("usd_egp_rate"):
		settings_doc.usd_egp_rate = flt(raw.get("rate") or src_settings.get("usd_egp_rate"))
	if src_settings.get("from_name") or src_settings.get("smtp_from_name"):
		settings_doc.from_name = src_settings.get("from_name") or src_settings.get("smtp_from_name")
	if src_settings.get("reply_to") or src_settings.get("smtp_user") or src_settings.get("from_email"):
		settings_doc.reply_to = (
			src_settings.get("reply_to") or src_settings.get("from_email") or src_settings.get("smtp_user")
		)
	if src_settings.get("email_template") in ("nest", "modern", "minimal"):
		settings_doc.email_template = src_settings["email_template"]
	if src_settings.get("email_footer"):
		settings_doc.email_footer = src_settings["email_footer"]
	email_text = src_settings.get("email_text") or {}
	text_aliases = {
		"tx_subject": src_settings.get("tx_subject") or email_text.get("subject"),
		"tx_greeting": src_settings.get("tx_greeting") or email_text.get("greeting"),
		"tx_intro": src_settings.get("tx_intro") or email_text.get("intro"),
		"tx_closing": src_settings.get("tx_closing") or email_text.get("closing"),
		"tx_cta": src_settings.get("tx_cta") or email_text.get("cta"),
		"tx_signoff": src_settings.get("tx_signoff") or email_text.get("signoff"),
	}
	for tx_key, tx_val in text_aliases.items():
		if tx_val:
			settings_doc.set(tx_key, tx_val)
	settings_doc.flags.ignore_permissions = True
	settings_doc.save()

	# 2. Client Subscriptions (map legacy_id -> Frappe doc name)
	client_id_map: dict[str, str] = {}
	imported_clients = 0
	client_rows = raw.get("subscriptions") or raw.get("client_subscriptions") or raw.get("subs") or []
	for item in client_rows:
		leg_id = str(item.get("id") or item.get("legacy_id") or "").strip()
		existing_name = (
			frappe.db.get_value("Client Subscription", {"legacy_id": leg_id}, "name") if leg_id else None
		)
		values = {
			"legacy_id": leg_id or None,
			"client_name": (item.get("client") or item.get("client_name") or "").strip(),
			"service": (item.get("service") or "").strip(),
			"billing_cycle": item.get("cycle") or item.get("billing_cycle") or "Annual",
			"currency": (item.get("cur") or item.get("currency") or "USD").upper(),
			"amount": flt(item.get("amt") if "amt" in item else item.get("amount")),
			"next_due_date": getdate(item.get("due") or item.get("next_due_date") or nowdate()),
			"status": item.get("status") or "Active",
			"notes": item.get("notes") or "",
		}
		if not values["client_name"] or not values["service"]:
			continue
		if existing_name:
			doc = frappe.get_doc("Client Subscription", existing_name)
			doc.update(values)
			doc.flags.ignore_permissions = True
			doc.save()
		else:
			doc = frappe.get_doc({"doctype": "Client Subscription", **values})
			doc.flags.ignore_permissions = True
			doc.insert()
		if leg_id:
			client_id_map[leg_id] = doc.name
		client_id_map[doc.name] = doc.name
		imported_clients += 1

	# 3. Vendor Subscriptions (map legacy_id -> Frappe doc name, resolving link_subs cleanly)
	vendor_id_map: dict[str, str] = {}
	imported_vendors = 0
	skipped_orphan_links = 0
	vendor_rows = raw.get("vendor_subscriptions") or raw.get("vsubs") or []
	for vitem in vendor_rows:
		leg_id = str(vitem.get("id") or vitem.get("legacy_id") or "").strip()
		existing_name = (
			frappe.db.get_value("Vendor Subscription", {"legacy_id": leg_id}, "name") if leg_id else None
		)
		raw_links = vitem.get("link_subs") or vitem.get("linked_subscriptions") or []
		child_rows = []
		seen_targets: set[str] = set()
		for entry in raw_links:
			if isinstance(entry, dict):
				ref = entry.get("client_subscription") or entry.get("id") or ""
				weight = flt(entry.get("allocation_weight_pct"))
			else:
				ref = str(entry).strip()
				weight = 0.0
			target_name = client_id_map.get(ref) or (
				frappe.db.get_value("Client Subscription", {"legacy_id": ref}, "name")
				if ref
				else None
			)
			if not target_name and ref and frappe.db.exists("Client Subscription", ref):
				target_name = ref
			if not target_name:
				skipped_orphan_links += 1
				continue
			if target_name in seen_targets:
				continue
			seen_targets.add(target_name)
			child_rows.append(
				{
					"client_subscription": target_name,
					"allocation_weight_pct": weight,
				}
			)

		v_values = {
			"legacy_id": leg_id or None,
			"vendor_name": (vitem.get("vendor") or vitem.get("vendor_name") or "").strip(),
			"service": (vitem.get("service") or "").strip(),
			"billing_cycle": vitem.get("cycle") or vitem.get("billing_cycle") or "Annual",
			"currency": (vitem.get("cur") or vitem.get("currency") or "USD").upper(),
			"amount": flt(vitem.get("amt") if "amt" in vitem else vitem.get("amount")),
			"next_due_date": getdate(vitem.get("due") or vitem.get("next_due_date") or nowdate()),
			"status": vitem.get("status") or "Active",
			"allocation_mode": vitem.get("allocation_mode") or "Equal Split",
			"notes": vitem.get("notes") or "",
			"linked_subscriptions": child_rows,
		}
		if not v_values["vendor_name"] or not v_values["service"]:
			continue
		if existing_name:
			vdoc = frappe.get_doc("Vendor Subscription", existing_name)
			vdoc.update({k: v for k, v in v_values.items() if k != "linked_subscriptions"})
			vdoc.set("linked_subscriptions", child_rows)
			vdoc.flags.ignore_permissions = True
			vdoc.save()
		else:
			vdoc = frappe.get_doc({"doctype": "Vendor Subscription", **v_values})
			vdoc.flags.ignore_permissions = True
			vdoc.insert()
		if leg_id:
			vendor_id_map[leg_id] = vdoc.name
		vendor_id_map[vdoc.name] = vdoc.name
		imported_vendors += 1

	# 4. Wallets
	wallet_id_map: dict[str, str] = {}
	imported_wallets = 0
	for witem in raw.get("wallets") or []:
		leg_id = str(witem.get("id") or witem.get("legacy_id") or "").strip()
		wname_str = (witem.get("name") or witem.get("wallet_name") or "").strip()
		if not wname_str:
			continue
		existing_name = (
			(frappe.db.get_value("Subscription Wallet", {"legacy_id": leg_id}, "name") if leg_id else None)
			or frappe.db.get_value("Subscription Wallet", {"wallet_name": wname_str}, "name")
		)
		w_values = {
			"legacy_id": leg_id or None,
			"wallet_name": wname_str,
			"currency": (witem.get("cur") or witem.get("currency") or "EGP").upper(),
			"opening_balance": flt(witem.get("opening") if "opening" in witem else witem.get("opening_balance")),
			"archived": cint(witem.get("archived")),
			"notes": witem.get("notes") or "",
		}
		if existing_name:
			wdoc = frappe.get_doc("Subscription Wallet", existing_name)
			wdoc.update(w_values)
			wdoc.flags.ignore_permissions = True
			wdoc.save()
		else:
			wdoc = frappe.get_doc({"doctype": "Subscription Wallet", **w_values})
			wdoc.flags.ignore_permissions = True
			wdoc.insert()
		if leg_id:
			wallet_id_map[leg_id] = wdoc.name
		wallet_id_map[wdoc.name] = wdoc.name
		imported_wallets += 1

	# 5. Ledger Transactions (do NOT re-advance due dates on historical import!)
	imported_txns = 0
	txn_rows = raw.get("transactions") or raw.get("txns") or []
	for titem in txn_rows:
		leg_id = str(titem.get("id") or titem.get("legacy_id") or "").strip()
		existing_name = (
			frappe.db.get_value("Subscription Transaction", {"legacy_id": leg_id}, "name") if leg_id else None
		)
		if existing_name:
			imported_txns += 1
			continue
		raw_wid = str(titem.get("wallet_id") or titem.get("wallet") or "").strip()
		target_wallet = wallet_id_map.get(raw_wid) or (
			frappe.db.get_value("Subscription Wallet", {"legacy_id": raw_wid}, "name") if raw_wid else None
		)
		if not target_wallet and raw_wid and frappe.db.exists("Subscription Wallet", raw_wid):
			target_wallet = raw_wid
		if not target_wallet:
			continue

		ref_kind = (titem.get("ref_kind") or titem.get("reference_kind") or "manual").lower()
		ref_id = str(titem.get("ref_id") or titem.get("client_subscription") or titem.get("vendor_subscription") or "").strip()
		c_sub = None
		v_sub = None
		if ref_kind == "client":
			c_sub = client_id_map.get(ref_id) or (
				frappe.db.get_value("Client Subscription", {"legacy_id": ref_id}, "name") if ref_id else None
			)
		elif ref_kind == "vendor":
			v_sub = vendor_id_map.get(ref_id) or (
				frappe.db.get_value("Vendor Subscription", {"legacy_id": ref_id}, "name") if ref_id else None
			)

		tdoc = frappe.get_doc(
			{
				"doctype": "Subscription Transaction",
				"legacy_id": leg_id or None,
				"transaction_date": getdate(
					titem.get("tdate") or titem.get("date") or titem.get("transaction_date") or nowdate()
				),
				"direction": (titem.get("direction") or "in").lower(),
				"wallet": target_wallet,
				"reference_kind": ref_kind if ref_kind in ("client", "vendor", "manual") else "manual",
				"client_subscription": c_sub,
				"vendor_subscription": v_sub,
				"party": titem.get("party") or "",
				"service": titem.get("service") or "",
				"amount": flt(titem.get("amount")),
				"currency": (titem.get("cur") or titem.get("currency") or "EGP").upper(),
				"exchange_rate": flt(titem.get("rate") or titem.get("exchange_rate") or settings_doc.usd_egp_rate),
				"wallet_amount": flt(titem.get("wallet_amount")),
				"advance_due_date": 0,
				"notes": titem.get("notes") or "",
			}
		)
		tdoc.flags.ignore_permissions = True
		tdoc.insert()
		imported_txns += 1

	# 6. Customer Reminder Rules
	imported_rules = 0
	rule_rows = raw.get("reminder_rules") or raw.get("rules") or []
	for ritem in rule_rows:
		cname = (ritem.get("client") or ritem.get("client_name") or "").strip()
		if not cname:
			continue
		leg_id = str(ritem.get("id") or ritem.get("legacy_id") or "").strip()
		existing_name = frappe.db.get_value("Subscription Reminder Rule", {"client_name": cname}, "name")
		to_val = ritem.get("to") if "to" in ritem else ritem.get("to_emails")
		cc_val = ritem.get("cc") if "cc" in ritem else ritem.get("cc_emails")
		if isinstance(to_val, list):
			to_val = ", ".join(to_val)
		if isinstance(cc_val, list):
			cc_val = ", ".join(cc_val)

		offset_rows = []
		for off in ritem.get("offsets") or []:
			offset_rows.append(
				{
					"days_before": cint(off.get("days") if "days" in off else off.get("days_before")),
					"enabled": cint(off.get("enabled", 1)),
				}
			)
		if not offset_rows:
			offset_rows = [{"days_before": d, "enabled": 1} for d in (30, 15, 7, 1)]

		r_values = {
			"legacy_id": leg_id or None,
			"client_name": cname,
			"enabled": cint(ritem.get("enabled", 1)),
			"to_emails": to_val or "",
			"cc_emails": cc_val or "",
			"offsets": offset_rows,
		}
		if existing_name:
			rdoc = frappe.get_doc("Subscription Reminder Rule", existing_name)
			rdoc.update({k: v for k, v in r_values.items() if k != "offsets"})
			rdoc.set("offsets", offset_rows)
			rdoc.flags.ignore_permissions = True
			rdoc.save()
		else:
			rdoc = frappe.get_doc({"doctype": "Subscription Reminder Rule", **r_values})
			rdoc.flags.ignore_permissions = True
			rdoc.insert()
		imported_rules += 1

	# 7. Historical Email Logs (optional, idempotent by subscription + due_date + days_before)
	imported_logs = 0
	if frappe.db.exists("DocType", "Subscription Email Log"):
		for litem in raw.get("email_log") or raw.get("email_logs") or []:
			sub_ref = str(litem.get("sub_id") or litem.get("client_subscription") or "").strip()
			c_sub = client_id_map.get(sub_ref) or (
				frappe.db.get_value("Client Subscription", {"legacy_id": sub_ref}, "name") if sub_ref else None
			)
			due_val = litem.get("due") or litem.get("due_date")
			days_b = cint(litem.get("days_before"))
			if c_sub and due_val:
				already = frappe.db.exists(
					"Subscription Email Log",
					{"client_subscription": c_sub, "due_date": getdate(due_val), "days_before": days_b},
				)
				if already:
					continue
			c_info = (
				frappe.db.get_value("Client Subscription", c_sub, ["client_name", "service"], as_dict=True)
				if c_sub
				else None
			)
			ldoc = frappe.get_doc(
				{
					"doctype": "Subscription Email Log",
					"client_subscription": c_sub,
					"client_name": litem.get("client_name") or (c_info.client_name if c_info else ""),
					"service": litem.get("service") or (c_info.service if c_info else ""),
					"due_date": getdate(due_val) if due_val else None,
					"days_before": days_b,
					"recipients": litem.get("recipients") or "",
					"subject": litem.get("subject") or "",
					"template_used": settings_doc.email_template or "nest",
					"is_test": cint(litem.get("is_test", 0)),
					"status": litem.get("status") or "Sent",
					"sent_at": litem.get("sent_at") or frappe.utils.now_datetime(),
				}
			)
			ldoc.flags.ignore_permissions = True
			ldoc.insert()
			imported_logs += 1

	recalculate_all_vendor_and_client_metrics()

	return {
		"client_subscriptions": imported_clients,
		"vendor_subscriptions": imported_vendors,
		"wallets": imported_wallets,
		"transactions": imported_txns,
		"reminder_rules": imported_rules,
		"email_logs": imported_logs,
		"skipped_orphan_links": skipped_orphan_links,
	}
