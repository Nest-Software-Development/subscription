frappe.ui.form.on("Client Subscription", {
	refresh(frm) {
		if (frm.is_new()) return;

		frm.add_custom_button(__("Record Payment"), () => {
			const d = new frappe.ui.Dialog({
				title: __("Record Client Payment — {0}", [frm.doc.client_name]),
				fields: [
					{ fieldname: "wallet", fieldtype: "Link", options: "Subscription Wallet", label: __("Deposit Into Wallet"), reqd: 1 },
					{ fieldname: "transaction_date", fieldtype: "Date", label: __("Payment Date"), default: frappe.datetime.get_today(), reqd: 1 },
					{ fieldname: "amount", fieldtype: "Float", label: __("Amount ({0})", [frm.doc.currency]), default: frm.doc.amount, reqd: 1 },
					{ fieldname: "advance_due_date", fieldtype: "Check", label: __("Advance Next Renewal Date ({0})", [frm.doc.billing_cycle]), default: 1 },
					{ fieldname: "notes", fieldtype: "Small Text", label: __("Notes") },
				],
				primary_action_label: __("Record & Update"),
				primary_action(values) {
					frappe.call({
						method: "subscription.api.v1.record_payment",
						args: {
							payload: {
								reference_kind: "client",
								client_subscription: frm.doc.name,
								currency: frm.doc.currency,
								...values,
							},
						},
						freeze: true,
						callback(r) {
							d.hide();
							frappe.show_alert({ message: r.message?.message || __("Payment recorded"), indicator: "green" });
							frm.reload_doc();
						},
					});
				},
			});
			d.show();
		}, __("Actions"));

		frm.add_custom_button(__("Preview Renewal Email"), () => {
			frappe.call({
				method: "subscription.api.v1.preview_email",
				args: { client_subscription: frm.doc.name },
				callback(r) {
					const res = r.message || {};
					const dlg = new frappe.ui.Dialog({
						title: res.subject || __("Email Preview"),
						size: "large",
						fields: [{ fieldname: "html_preview", fieldtype: "HTML" }],
					});
					dlg.fields_dict.html_preview.$wrapper.html(
						`<iframe style="width:100%;height:520px;border:1px solid var(--border-color);border-radius:8px" srcdoc="${frappe.utils.escape_html(res.html || "")}"></iframe>`
					);
					dlg.show();
				},
			});
		}, __("Actions"));

		frm.add_custom_button(__("Send Renewal Reminder Now"), () => {
			frappe.call({
				method: "subscription.api.v1.send_reminder_now",
				args: { client_subscription: frm.doc.name, is_test: 0 },
				freeze: true,
				callback(r) {
					if (r.message?.sent) {
						frappe.show_alert({ message: __("Renewal email dispatched!"), indicator: "green" });
					} else {
						frappe.msgprint(r.message?.error || __("Could not send email."));
					}
				},
			});
		}, __("Actions"));
	},
});
