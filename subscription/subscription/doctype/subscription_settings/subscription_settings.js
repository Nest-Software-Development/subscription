frappe.ui.form.on("Subscription Settings", {
	refresh(frm) {
		frm.add_custom_button(__("Open Mobile PWA"), () => {
			window.open("/subscriptions", "_blank");
		});
		frm.add_custom_button(__("Run Reminders & Push Alerts Now"), () => {
			frappe.call({
				method: "subscription.api.v1.run_all_reminders_now",
				freeze: true,
				freeze_message: __("Dispatching reminders and push alerts..."),
				callback(r) {
					const d = r.message || {};
					frappe.msgprint(
						__("Email sent: {0} (skipped {1}) · Push notifications created: {2}", [
							d.email?.sent || 0,
							d.email?.skipped || 0,
							d.push?.notifications_created || 0,
						])
					);
				},
			});
		});
		frm.add_custom_button(__("Sync Bundled Production Dataset"), () => {
			frappe.confirm(
				__("Sync the bundled Nest Subscription dataset idempotently into this site?"),
				() => {
					frappe.call({
						method: "subscription.api.v1.sync_seed_dataset",
						args: { replace: 0 },
						freeze: true,
						callback(r) {
							const s = r.message || {};
							frappe.show_alert({
								message: __("Synced {0} client subs, {1} vendor subs, {2} wallets.", [
									s.client_subscriptions || 0,
									s.vendor_subscriptions || 0,
									s.wallets || 0,
								]),
								indicator: "green",
							});
						},
					});
				}
			);
		});
	},
});
