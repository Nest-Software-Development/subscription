# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

"""Automated & manual Client Subscription Renewal Email Engine.

Replicates and enhances all 3 branded templates from Nest Subscription Manager:
  - `nest`: Warm cream + night obsidian + cyan (#00cefb) NSD corporate layout with inline logo
  - `modern`: Crisp neutral enterprise card layout
  - `minimal`: Clean executive letter layout

Supports full token interpolation ({client}, {service}, {amount}, {due}, {when}, {days}, {cycle}),
inline logo & optional signature image embedding, live HTML preview, [TEST] emails, and
stage-based deduplication via Subscription Email Log.
"""

import html
import os

import frappe
from frappe import _
from frappe.utils import cint, date_diff, flt, formatdate, getdate, now_datetime, nowdate, validate_email_address

from subscription.utils import SETTINGS_DOCTYPE

EMAIL_LOG_DOCTYPE = "Subscription Email Log"
REMINDER_RULE_DOCTYPE = "Subscription Reminder Rule"

DEFAULT_TEXTS = {
	"tx_subject": "Upcoming renewal: {service} — due {due}",
	"tx_greeting": "Dear {client} team,",
	"tx_intro": (
		"We hope you are doing well. This is a friendly reminder from Nest Software Development "
		"that your subscription below is scheduled to renew {when}."
	),
	"tx_closing": (
		"To ensure uninterrupted service, please arrange payment on or before the due date. "
		"If payment has already been sent, kindly disregard this message — and thank you."
	),
	"tx_cta": "Reply to confirm payment",
	"tx_signoff": "Warm regards,\nAccounts & Renewals",
	"email_footer": "Nest Software Development · Alexandria, Egypt · nsd-eg.com",
}


def parse_email_list(raw: str | None) -> list[str]:
	if not raw:
		return []
	cleaned: list[str] = []
	for item in str(raw).replace(";", ",").split(","):
		addr = item.strip()
		if addr and validate_email_address(addr, throw=False) and addr not in cleaned:
			cleaned.append(addr)
	return cleaned


def _format_amount(amount: float, currency: str) -> str:
	cur = (currency or "USD").upper()
	if cur == "USD":
		return f"${flt(amount):,.2f} USD"
	return f"{flt(amount):,.0f} {cur}"


def _when_label(days: int) -> tuple[str, str, str]:
	"""Return (when_prose, badge_label, badge_hex_bg)."""
	if days < 0:
		abs_d = abs(days)
		return (f"{abs_d} day{'s' if abs_d != 1 else ''} ago (overdue)", "OVERDUE", "#C92A2A")
	if days == 0:
		return ("today", "DUE TODAY", "#C92A2A")
	if days == 1:
		return ("tomorrow", "TOMORROW", "#D97706")
	if days <= 7:
		return (f"in {days} days", f"IN {days} DAYS", "#D97706")
	return (f"in {days} days", f"IN {days} DAYS", "#0086A8")


def _apply_tokens(template_str: str, tokens: dict[str, str], escape_html: bool = False) -> str:
	out = template_str or ""
	for k, v in tokens.items():
		val = html.escape(str(v)) if escape_html else str(v)
		out = out.replace("{" + k + "}", val)
	return out


def render_renewal_email(
	sub_data: dict,
	days_before: int | None = None,
	settings_override: dict | None = None,
	is_test: bool = False,
	preview_mode: bool = False,
) -> dict:
	"""Render subject, HTML body, and plain-text fallback for a Client Subscription."""
	settings = frappe.get_single(SETTINGS_DOCTYPE).as_dict() if frappe.db.exists("DocType", SETTINGS_DOCTYPE) else {}
	if settings_override:
		settings.update({k: v for k, v in settings_override.items() if v is not None})

	due_dt = getdate(sub_data.get("next_due_date") or nowdate())
	days = int(days_before) if days_before is not None else cint(date_diff(due_dt, getdate(nowdate())))
	when_prose, badge_text, badge_color = _when_label(days)

	due_pretty = formatdate(due_dt, "dd MMM yyyy")
	amount_pretty = _format_amount(flt(sub_data.get("amount")), sub_data.get("currency") or "USD")
	client_name = sub_data.get("client_name") or "Valued Client"
	service_name = sub_data.get("service") or "Managed Service"
	cycle_name = sub_data.get("billing_cycle") or "Annual"
	reply_to = settings.get("reply_to") or "info@nsd-eg.com"
	from_name = settings.get("from_name") or "Nest Software Development"

	tokens = {
		"client": client_name,
		"service": service_name,
		"amount": amount_pretty,
		"due": due_pretty,
		"when": when_prose,
		"days": str(days),
		"cycle": cycle_name,
	}

	raw_subject = settings.get("tx_subject") or DEFAULT_TEXTS["tx_subject"]
	subject = _apply_tokens(raw_subject, tokens, escape_html=False)
	if is_test:
		subject = f"[TEST] {subject}"

	greeting_html = _apply_tokens(settings.get("tx_greeting") or DEFAULT_TEXTS["tx_greeting"], tokens, escape_html=True)
	intro_html = _apply_tokens(settings.get("tx_intro") or DEFAULT_TEXTS["tx_intro"], tokens, escape_html=True).replace("\n", "<br>")
	closing_html = _apply_tokens(settings.get("tx_closing") or DEFAULT_TEXTS["tx_closing"], tokens, escape_html=True).replace("\n", "<br>")
	cta_html = _apply_tokens(settings.get("tx_cta") or DEFAULT_TEXTS["tx_cta"], tokens, escape_html=True)
	signoff_html = _apply_tokens(settings.get("tx_signoff") or DEFAULT_TEXTS["tx_signoff"], tokens, escape_html=True).replace("\n", "<br>")
	footer_html = html.escape(settings.get("email_footer") or DEFAULT_TEXTS["email_footer"])

	logo_src = "/assets/subscription/images/email-logo.png" if preview_mode else "cid:nestlogo"
	sig_url = settings.get("signature_image") or ""
	sig_block = ""
	if sig_url:
		sig_src = sig_url if preview_mode else "cid:nestsign"
		sig_block = f'<div style="margin-top:14px"><img src="{html.escape(sig_src)}" alt="Signature" style="max-height:64px;width:auto;display:block"></div>'

	mailto_href = f"mailto:{html.escape(reply_to)}?subject={html.escape('Payment Confirmation: ' + service_name + ' (' + client_name + ')')}"
	tpl = (settings.get("email_template") or "nest").lower()

	c_esc = html.escape(client_name)
	s_esc = html.escape(service_name)
	cy_esc = html.escape(cycle_name)
	am_esc = html.escape(amount_pretty)
	du_esc = html.escape(due_pretty)

	if tpl == "minimal":
		html_body = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:32px 18px;background:#ffffff;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6">
  <div style="max-width:560px;margin:0 auto">
    <div style="padding-bottom:18px;border-bottom:2px solid #111827;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
      <strong style="font-size:16px;letter-spacing:0.02em">{html.escape(from_name)}</strong>
      <span style="font-size:11px;font-weight:700;color:{badge_color};letter-spacing:0.08em">{badge_text}</span>
    </div>
    <p style="font-size:15px;margin:0 0 14px">{greeting_html}</p>
    <p style="font-size:15px;color:#374151;margin:0 0 22px">{intro_html}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin:0 0 22px;font-size:14px">
      <tr><td style="padding:10px 0;color:#6b7280">Service</td><td style="padding:10px 0;text-align:right;font-weight:600">{s_esc}</td></tr>
      <tr><td style="padding:10px 0;color:#6b7280;border-top:1px solid #f3f4f6">Billing Cycle</td><td style="padding:10px 0;text-align:right;border-top:1px solid #f3f4f6">{cy_esc}</td></tr>
      <tr><td style="padding:10px 0;color:#6b7280;border-top:1px solid #f3f4f6">Renewal Date</td><td style="padding:10px 0;text-align:right;font-weight:600;border-top:1px solid #f3f4f6">{du_esc}</td></tr>
      <tr><td style="padding:12px 0;color:#111827;font-weight:700;border-top:1px solid #e5e7eb">Amount Due</td><td style="padding:12px 0;text-align:right;font-size:18px;font-weight:700;color:#111827;border-top:1px solid #e5e7eb">{am_esc}</td></tr>
    </table>
    <p style="font-size:14px;color:#4b5563;margin:0 0 22px">{closing_html}</p>
    <p style="margin:0 0 26px"><a href="{mailto_href}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:6px;font-size:14px;font-weight:600">{cta_html}</a></p>
    <p style="font-size:14px;color:#374151;margin:0">{signoff_html}</p>
    {sig_block}
    <p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af">{footer_html}</p>
  </div>
</body></html>"""
	elif tpl == "modern":
		html_body = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:28px 14px;background:#f3f4f6;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="padding:24px 28px;background:#0f172a;color:#ffffff">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;margin-bottom:6px">{html.escape(from_name)}</div>
      <div style="font-size:20px;font-weight:700">Subscription Renewal Notice</div>
    </div>
    <div style="padding:28px">
      <span style="display:inline-block;background:{badge_color};color:#ffffff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;letter-spacing:0.06em;margin-bottom:16px">{badge_text}</span>
      <p style="font-size:15px;margin:0 0 12px">{greeting_html}</p>
      <p style="font-size:14px;color:#475569;margin:0 0 22px">{intro_html}</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin-bottom:22px">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">Service</div>
        <div style="font-size:17px;font-weight:700;color:#0f172a;margin:2px 0 14px">{s_esc}</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
          <tr><td style="padding:5px 0;color:#64748b">Client</td><td style="padding:5px 0;text-align:right;font-weight:600">{c_esc}</td></tr>
          <tr><td style="padding:5px 0;color:#64748b">Billing Cycle</td><td style="padding:5px 0;text-align:right;font-weight:600">{cy_esc}</td></tr>
          <tr><td style="padding:5px 0;color:#64748b">Due Date</td><td style="padding:5px 0;text-align:right;font-weight:600">{du_esc}</td></tr>
          <tr><td style="padding:10px 0 0;color:#0f172a;font-weight:700;border-top:1px solid #e2e8f0">Amount Due</td><td style="padding:10px 0 0;text-align:right;font-size:20px;font-weight:800;color:#c92a2a;border-top:1px solid #e2e8f0">{am_esc}</td></tr>
        </table>
      </div>
      <p style="font-size:14px;color:#475569;margin:0 0 22px">{closing_html}</p>
      <a href="{mailto_href}" style="display:inline-block;background:#c92a2a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:600">{cta_html}</a>
      <div style="margin-top:26px;font-size:14px;color:#334155">{signoff_html}</div>
      {sig_block}
    </div>
    <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center">{footer_html}</div>
  </div>
</body></html>"""
	else:
		# Default `nest` branded template (warm cream + deep obsidian + signature cyan/coral accents)
		html_body = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:28px 14px;background:#f5f2eb;color:#0e131f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e6e0d4;box-shadow:0 12px 32px rgba(14,19,31,0.06)">
    <div style="background:#0b1220;padding:24px 30px;border-bottom:3px solid #00cefb">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td><img src="{html.escape(logo_src)}" alt="nsdLabs" style="height:34px;width:auto;display:block;background:#ffffff;padding:6px 10px;border-radius:8px"></td>
          <td style="text-align:right"><span style="display:inline-block;background:{badge_color};color:#ffffff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;letter-spacing:0.08em">{badge_text}</span></td>
        </tr>
      </table>
    </div>
    <div style="padding:30px">
      <p style="font-size:16px;font-weight:600;color:#0b1220;margin:0 0 12px">{greeting_html}</p>
      <p style="font-size:14.5px;color:#374151;margin:0 0 24px">{intro_html}</p>
      <div style="background:#fbf9f5;border:1px solid #e7e1d5;border-left:4px solid #ff5757;border-radius:12px;padding:20px 22px;margin-bottom:24px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280">Subscription Summary</div>
        <div style="font-size:18px;font-weight:700;color:#0b1220;margin:4px 0 14px">{s_esc}</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
          <tr><td style="padding:6px 0;color:#6b7280">Client Account</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0b1220">{c_esc}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;border-top:1px dashed #e5dfd3">Billing Cycle</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0b1220;border-top:1px dashed #e5dfd3">{cy_esc}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;border-top:1px dashed #e5dfd3">Next Renewal Date</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#0b1220;border-top:1px dashed #e5dfd3">{du_esc}</td></tr>
          <tr><td style="padding:12px 0 2px;color:#0b1220;font-weight:700;border-top:1px solid #dfd8ca">Renewal Amount</td><td style="padding:12px 0 2px;text-align:right;font-size:21px;font-weight:800;color:#c92a2a;border-top:1px solid #dfd8ca">{am_esc}</td></tr>
        </table>
      </div>
      <p style="font-size:14px;color:#4b5563;margin:0 0 24px">{closing_html}</p>
      <div style="margin:0 0 26px">
        <a href="{mailto_href}" style="display:inline-block;background:#0b1220;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;border:1px solid #0b1220">{cta_html} &rarr;</a>
      </div>
      <div style="font-size:14px;color:#1f2937">{signoff_html}</div>
      {sig_block}
    </div>
    <div style="background:#0b1220;color:#94a3b8;padding:16px 30px;font-size:12px;text-align:center">
      {footer_html}
    </div>
  </div>
</body></html>"""

	plain_text = (
		f"{_apply_tokens(settings.get('tx_greeting') or DEFAULT_TEXTS['tx_greeting'], tokens)}\n\n"
		f"{_apply_tokens(settings.get('tx_intro') or DEFAULT_TEXTS['tx_intro'], tokens)}\n\n"
		f"Service: {service_name}\n"
		f"Client: {client_name}\n"
		f"Billing Cycle: {cycle_name}\n"
		f"Due Date: {due_pretty}\n"
		f"Amount: {amount_pretty}\n\n"
		f"{_apply_tokens(settings.get('tx_closing') or DEFAULT_TEXTS['tx_closing'], tokens)}\n\n"
		f"{_apply_tokens(settings.get('tx_signoff') or DEFAULT_TEXTS['tx_signoff'], tokens)}\n"
		f"--\n{settings.get('email_footer') or DEFAULT_TEXTS['email_footer']}"
	)

	return {
		"subject": subject,
		"html": html_body,
		"text": plain_text,
		"days": days,
		"when": when_prose,
		"template": tpl,
	}


def _collect_inline_attachments(settings: dict, template: str) -> list[dict]:
	"""Prepare inline CID attachments if needed by the template."""
	attachments: list[dict] = []
	if template == "nest":
		logo_path = frappe.get_app_path("subscription", "public", "images", "email-logo.png")
		if os.path.exists(logo_path):
			with open(logo_path, "rb") as f:
				attachments.append({"fname": "email-logo.png", "fcontent": f.read(), "content_id": "nestlogo"})
	sig_url = settings.get("signature_image")
	if sig_url and str(sig_url).startswith("/files/"):
		sig_path = frappe.get_site_path("public", sig_url.lstrip("/"))
		if os.path.exists(sig_path):
			with open(sig_path, "rb") as f:
				attachments.append(
					{"fname": os.path.basename(sig_path), "fcontent": f.read(), "content_id": "nestsign"}
				)
	return attachments


def send_subscription_reminder(
	client_sub_doc,
	to_emails: list[str],
	cc_emails: list[str] | None = None,
	days_before: int | None = None,
	is_test: bool = False,
	force: bool = False,
) -> dict:
	"""Render and dispatch a renewal reminder email, recording a Subscription Email Log entry."""
	if not to_emails:
		frappe.throw(_("At least one valid recipient email address is required."))

	settings = frappe.get_single(SETTINGS_DOCTYPE).as_dict()
	due_dt = getdate(client_sub_doc.next_due_date)
	days = int(days_before) if days_before is not None else cint(date_diff(due_dt, getdate(nowdate())))
	stage_key = None if (is_test or force) else f"{client_sub_doc.name}::{due_dt}::{days}"

	if stage_key and frappe.db.exists(EMAIL_LOG_DOCTYPE, {"stage_key": stage_key, "status": ["in", ["Sent", "Queued"]]}):
		return {"sent": False, "skipped": True, "reason": "already_sent_for_stage", "stage_key": stage_key}

	rendered = render_renewal_email(
		sub_data=client_sub_doc.as_dict(),
		days_before=days,
		settings_override=settings,
		is_test=is_test,
		preview_mode=False,
	)

	status = "Sent"
	error_msg = ""
	try:
		attachments = _collect_inline_attachments(settings, rendered["template"])
		reply_to = settings.get("reply_to") or "info@nsd-eg.com"
		frappe.sendmail(
			recipients=to_emails,
			cc=cc_emails or [],
			subject=rendered["subject"],
			message=rendered["html"],
			reply_to=reply_to,
			reference_doctype="Client Subscription",
			reference_name=client_sub_doc.name,
			attachments=attachments or None,
			now=True,
		)
	except Exception as exc:
		status = "Failed"
		error_msg = str(exc)[:500]
		frappe.log_error(title="Subscription Email Reminder Failed", message=frappe.get_traceback())

	log = frappe.get_doc(
		{
			"doctype": EMAIL_LOG_DOCTYPE,
			"client_subscription": client_sub_doc.name,
			"client_name": client_sub_doc.client_name,
			"service": client_sub_doc.service,
			"due_date": due_dt,
			"days_before": days,
			"stage_key": stage_key if status == "Sent" else None,
			"recipients": ", ".join(to_emails),
			"cc_recipients": ", ".join(cc_emails or []),
			"subject": rendered["subject"],
			"template_used": rendered["template"],
			"is_test": 1 if is_test else 0,
			"status": status,
			"error_message": error_msg,
			"sent_at": now_datetime(),
		}
	)
	log.insert(ignore_permissions=True)

	return {
		"sent": status == "Sent",
		"status": status,
		"error": error_msg,
		"log": log.name,
		"subject": rendered["subject"],
	}


def run_email_reminders() -> dict:
	"""Daily cron job: evaluate all enabled Subscription Reminder Rules against active Client Subscriptions."""
	if not frappe.db.exists("DocType", SETTINGS_DOCTYPE):
		return {"sent": 0, "skipped": 0, "failed": 0}

	settings = frappe.get_single(SETTINGS_DOCTYPE)
	if not cint(settings.enable_email_reminders):
		return {"sent": 0, "skipped": 0, "failed": 0, "disabled": True}

	rules = frappe.get_all(
		REMINDER_RULE_DOCTYPE,
		filters={"enabled": 1},
		fields=["name", "client_name", "to_emails", "cc_emails"],
	)
	if not rules:
		return {"sent": 0, "skipped": 0, "failed": 0}

	rule_by_client: dict[str, dict] = {}
	for r in rules:
		rdoc = frappe.get_doc(REMINDER_RULE_DOCTYPE, r.name)
		enabled_days = {cint(row.days_before) for row in (rdoc.offsets or []) if cint(row.enabled)}
		rule_by_client[(r.client_name or "").strip().lower()] = {
			"to": parse_email_list(r.to_emails),
			"cc": parse_email_list(r.cc_emails),
			"days": enabled_days,
		}

	today = getdate(nowdate())
	active_subs = frappe.get_all("Client Subscription", filters={"status": "Active"}, pluck="name")
	sent = 0
	skipped = 0
	failed = 0

	for sub_name in active_subs:
		sub_doc = frappe.get_doc("Client Subscription", sub_name)
		rule = rule_by_client.get((sub_doc.client_name or "").strip().lower())
		if not rule or not rule["to"] or not sub_doc.next_due_date:
			continue
		days_left = cint(date_diff(getdate(sub_doc.next_due_date), today))
		if days_left not in rule["days"]:
			continue
		res = send_subscription_reminder(
			client_sub_doc=sub_doc,
			to_emails=rule["to"],
			cc_emails=rule["cc"],
			days_before=days_left,
			is_test=False,
		)
		if res.get("sent"):
			sent += 1
		elif res.get("skipped"):
			skipped += 1
		else:
			failed += 1

	return {"sent": sent, "skipped": skipped, "failed": failed, "date": str(today)}

