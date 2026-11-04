// Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
// For license information, please see license.txt

frappe.ui.form.on("Subscription Wallet", {
	setup(frm) {
		frm.set_query("bank_account", () => {
			const filters = {
				is_group: 0,
				account_type: ["in", ["Bank", "Cash"]],
			};
			if (frm.doc.company) {
				filters.company = frm.doc.company;
			}
			return { filters };
		});

		frm.set_query("erpnext_bank_account", () => {
			const filters = { is_company_account: 1 };
			if (frm.doc.company) {
				filters.company = frm.doc.company;
			}
			if (frm.doc.erpnext_bank) {
				filters.bank = frm.doc.erpnext_bank;
			}
			return { filters };
		});
	},

	onload(frm) {
		if (frm.is_new() && !frm.doc.company) {
			const defaultCompany = frappe.defaults.get_user_default("Company");
			if (defaultCompany) {
				frm.set_value("company", defaultCompany);
			}
		}
	},

	erpnext_bank_account(frm) {
		if (!frm.doc.erpnext_bank_account) return;
		frappe.call({
			method: "subscription.subscription.doctype.subscription_wallet.subscription_wallet.fetch_erpnext_account_details",
			args: {
				erpnext_bank_account: frm.doc.erpnext_bank_account,
				bank_account: frm.doc.bank_account || "",
			},
			callback(r) {
				const d = r.message || {};
				if (d.erpnext_bank && !frm.doc.erpnext_bank) frm.set_value("erpnext_bank", d.erpnext_bank);
				if (d.bank_account) frm.set_value("bank_account", d.bank_account);
				if (d.company && !frm.doc.company) frm.set_value("company", d.company);
				if (d.bank_account_no && !frm.doc.bank_account_no) frm.set_value("bank_account_no", d.bank_account_no);
				if (d.iban && !frm.doc.iban) frm.set_value("iban", d.iban);
				frm.set_value("gl_account_currency", d.gl_account_currency || "");
				frm.set_value("erpnext_gl_balance", d.erpnext_gl_balance || 0);
			},
		});
	},

	bank_account(frm) {
		if (!frm.doc.bank_account) {
			frm.set_value("gl_account_currency", "");
			frm.set_value("erpnext_gl_balance", 0);
			return;
		}
		frappe.call({
			method: "subscription.subscription.doctype.subscription_wallet.subscription_wallet.fetch_erpnext_account_details",
			args: { bank_account: frm.doc.bank_account },
			callback(r) {
				const d = r.message || {};
				if (d.company && !frm.doc.company) frm.set_value("company", d.company);
				frm.set_value("gl_account_currency", d.gl_account_currency || "");
				frm.set_value("erpnext_gl_balance", d.erpnext_gl_balance || 0);
			},
		});
	},

	refresh(frm) {
		if (frm.is_new()) return;

		frm.add_custom_button(__("Manual Deposit / Withdrawal"), () => {
			const d = new frappe.ui.Dialog({
				title: __("Manual Entry — {0}", [frm.doc.wallet_name]),
				fields: [
					{
						fieldname: "direction",
						fieldtype: "Select",
						options: "in\nout",
						label: __("Direction (in / out)"),
						default: "in",
						reqd: 1,
					},
					{
						fieldname: "transaction_date",
						fieldtype: "Date",
						label: __("Date"),
						default: frappe.datetime.get_today(),
						reqd: 1,
					},
					{
						fieldname: "party",
						fieldtype: "Data",
						label: __("Counterparty / Source"),
						reqd: 1,
					},
					{
						fieldname: "service",
						fieldtype: "Data",
						label: __("Description / Purpose"),
						reqd: 1,
					},
					{
						fieldname: "amount",
						fieldtype: "Float",
						label: __("Amount"),
						reqd: 1,
					},
					{
						fieldname: "currency",
						fieldtype: "Select",
						options: "EGP\nUSD",
						label: __("Currency"),
						default: frm.doc.currency,
						reqd: 1,
					},
					{
						fieldname: "notes",
						fieldtype: "Small Text",
						label: __("Notes"),
					},
				],
				primary_action_label: __("Post Entry"),
				primary_action(values) {
					frappe.call({
						method: "subscription.api.v1.record_payment",
						args: {
							payload: {
								reference_kind: "manual",
								wallet: frm.doc.name,
								advance_due_date: 0,
								...values,
							},
						},
						freeze: true,
						callback() {
							d.hide();
							frm.reload_doc();
						},
					});
				},
			});
			d.show();
		});

		if (frm.doc.bank_account) {
			frm.add_custom_button(
				__("Open ERPNext General Ledger"),
				() => {
					frappe.route_options = {
						company: frm.doc.company || frappe.defaults.get_user_default("Company"),
						account: [frm.doc.bank_account],
					};
					frappe.set_route("query-report", "General Ledger");
				},
				__("ERPNext Accounting")
			);
		}

		frm.add_custom_button(
			__("New ERPNext Bank Account"),
			() => {
				frappe.new_doc("Bank Account", {
					account_name: frm.doc.wallet_name,
					bank: frm.doc.erpnext_bank || "",
					account: frm.doc.bank_account || "",
					company: frm.doc.company || frappe.defaults.get_user_default("Company"),
					is_company_account: 1,
				});
			},
			__("ERPNext Accounting")
		);
	},
});
