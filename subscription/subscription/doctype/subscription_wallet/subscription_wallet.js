frappe.ui.form.on("Subscription Wallet", {
	refresh(frm) {
		if (frm.is_new()) return;
		frm.add_custom_button(__("Manual Deposit / Withdrawal"), () => {
			const d = new frappe.ui.Dialog({
				title: __("Manual Entry — {0}", [frm.doc.wallet_name]),
				fields: [
					{ fieldname: "direction", fieldtype: "Select", options: "in
out", label: __("Direction (in / out)"), default: "in", reqd: 1 },
					{ fieldname: "transaction_date", fieldtype: "Date", label: __("Date"), default: frappe.datetime.get_today(), reqd: 1 },
					{ fieldname: "party", fieldtype: "Data", label: __("Counterparty / Source"), reqd: 1 },
					{ fieldname: "service", fieldtype: "Data", label: __("Description / Purpose"), reqd: 1 },
					{ fieldname: "amount", fieldtype: "Float", label: __("Amount"), reqd: 1 },
					{ fieldname: "currency", fieldtype: "Select", options: "EGP
USD", label: __("Currency"), default: frm.doc.currency, reqd: 1 },
					{ fieldname: "notes", fieldtype: "Small Text", label: __("Notes") },
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
	},
});
