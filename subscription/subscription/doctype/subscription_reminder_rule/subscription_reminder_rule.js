frappe.ui.form.on("Subscription Reminder Rule", {
	refresh(frm) {
		if (frm.is_new()) return;
		frm.add_custom_button(__("Send [TEST] Email"), () => {
			frappe.db.get_value(
				"Client Subscription",
				{ client_name: frm.doc.client_name, status: "Active" },
				"name"
			).then((r) => {
				const subName = r?.message?.name;
				if (!subName) {
					frappe.msgprint(__("No active Client Subscription found for {0}.", [frm.doc.client_name]));
					return;
				}
				frappe.call({
					method: "subscription.api.v1.send_reminder_now",
					args: {
						client_subscription: subName,
						to_emails: frm.doc.to_emails,
						is_test: 1,
					},
					freeze: true,
					callback(res) {
						if (res.message?.sent) {
							frappe.show_alert({ message: __("Test email dispatched to {0}", [frm.doc.to_emails]), indicator: "green" });
						} else {
							frappe.msgprint(res.message?.error || __("Failed to send test email."));
						}
					},
				});
			});
		});
	},
});
