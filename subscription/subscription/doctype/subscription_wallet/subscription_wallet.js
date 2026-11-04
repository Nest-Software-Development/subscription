// Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
// For license information, please see license.txt

function syncGlAccountDetails(frm, accountName, markDirty = true) {
	if (!accountName) {
		if (markDirty) {
			frm.set_value("gl_account_currency", "");
			frm.set_value("erpnext_gl_balance", 0);
		}
		return;
	}

	frappe.db.get_value("Account", accountName, ["account_currency", "company"]).then((r) => {
		const acc = (r && r.message) || {};
		if (markDirty) {
			if (acc.company && !frm.doc.company) {
				frm.set_value("company", acc.company);
			}
			frm.set_value("gl_account_currency", acc.account_currency || "");
		} else if (acc.account_currency && frm.doc.gl_account_currency !== acc.account_currency) {
			frm.doc.gl_account_currency = acc.account_currency;
			frm.refresh_field("gl_account_currency");
		}
	});

	frappe.call({
		method: "subscription.subscription.doctype.subscription_wallet.subscription_wallet.fetch_erpnext_account_details",
		args: {
			bank_account: accountName,
		},
		silent: true,
		callback(r) {
			const d = (r && r.message) || {};
			const bal = Number(d.erpnext_gl_balance || 0);
			if (markDirty) {
				frm.set_value("erpnext_gl_balance", bal);
			} else {
				frm.doc.erpnext_gl_balance = bal;
				frm.refresh_field("erpnext_gl_balance");
			}
		},
		error() {
			// Server validate/onload also computes erpnext_gl_balance on save
		},
	});
}

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
		frappe.db
			.get_value("Bank Account", frm.doc.erpnext_bank_account, [
				"bank",
				"account",
				"company",
				"bank_account_no",
				"iban",
			])
			.then((r) => {
				const ba = (r && r.message) || {};
				if (ba.bank && !frm.doc.erpnext_bank) {
					frm.set_value("erpnext_bank", ba.bank);
				}
				if (ba.company && !frm.doc.company) {
					frm.set_value("company", ba.company);
				}
				if (ba.bank_account_no && !frm.doc.bank_account_no) {
					frm.set_value("bank_account_no", ba.bank_account_no);
				}
				if (ba.iban && !frm.doc.iban) {
					frm.set_value("iban", ba.iban);
				}
				if (ba.account) {
					frm.set_value("bank_account", ba.account);
				} else if (frm.doc.bank_account) {
					syncGlAccountDetails(frm, frm.doc.bank_account, true);
				}
			});
	},

	bank_account(frm) {
		syncGlAccountDetails(frm, frm.doc.bank_account, true);
	},

	refresh(frm) {
		if (frm.is_new()) return;

		if (frm.doc.bank_account) {
			syncGlAccountDetails(frm, frm.doc.bank_account, false);
		}

		frm.add_custom_button(__("Manual Deposit / Withdrawal"), () => {
			const d = new frappe.ui.Dialog({
				title: __("Manual Entry — {0}", [frm.doc.wallet_name]),
				fields: [
					{
						fieldname: "direction",
						fieldtype: "Select",
						options: ["in", "out"],
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
						options: ["EGP", "USD"],
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
