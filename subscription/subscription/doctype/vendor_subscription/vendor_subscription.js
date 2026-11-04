frappe.ui.form.on("Vendor Subscription", {
	refresh(frm) {
		if (frm.is_new()) return;

		frm.add_custom_button(__("Record Vendor Payment"), () => {
			const d = new frappe.ui.Dialog({
				title: __("Pay Vendor Subscription — {0}", [frm.doc.vendor_name]),
				fields: [
					{ fieldname: "wallet", fieldtype: "Link", options: "Subscription Wallet", label: __("Pay From Wallet"), reqd: 1 },
					{ fieldname: "transaction_date", fieldtype: "Date", label: __("Payment Date"), default: frappe.datetime.get_today(), reqd: 1 },
					{ fieldname: "amount", fieldtype: "Float", label: __("Amount ({0})", [frm.doc.currency]), default: frm.doc.amount, reqd: 1 },
					{ fieldname: "advance_due_date", fieldtype: "Check", label: __("Advance Next Renewal Date ({0})", [frm.doc.billing_cycle]), default: 1 },
					{ fieldname: "notes", fieldtype: "Small Text", label: __("Notes") },
				],
				primary_action_label: __("Record Payment"),
				primary_action(values) {
					frappe.call({
						method: "subscription.api.v1.record_payment",
						args: {
							payload: {
								reference_kind: "vendor",
								vendor_subscription: frm.doc.name,
								currency: frm.doc.currency,
								...values,
							},
						},
						freeze: true,
						callback(r) {
							d.hide();
							frappe.show_alert({ message: r.message?.message || __("Vendor payment recorded"), indicator: "green" });
							frm.reload_doc();
						},
					});
				},
			});
			d.show();
		}, __("Actions"));

		frm.add_custom_button(__("Link Multiple Client Subscriptions"), () => {
			new frappe.ui.form.MultiSelectDialog({
				doctype: "Client Subscription",
				target: frm,
				setters: { client_name: null, status: "Active" },
				add_filters_group: 1,
				get_query() {
					return { filters: { status: ["!=", "Cancelled"] } };
				},
				action(selections) {
					const existing = new Set((frm.doc.linked_subscriptions || []).map((r) => r.client_subscription));
					let added = 0;
					(selections || []).forEach((subName) => {
						if (!existing.has(subName)) {
							const row = frm.add_child("linked_subscriptions");
							row.client_subscription = subName;
							added++;
						}
					});
					if (added > 0) {
						frm.refresh_field("linked_subscriptions");
						frm.dirty();
					}
					cur_dialog.hide();
				},
			});
		}, __("Actions"));
	},
});
