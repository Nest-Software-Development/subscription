# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

app_name = "subscription"
app_title = "Subscription"
app_publisher = "nsdLabs — Nest Software Development"
app_description = (
	"Enterprise recurring client & vendor subscription management, multi-client vendor cost "
	"allocation, wallets, renewal email automation, and native mobile PWA for ERPNext v16."
)
app_email = "info@nsd-eg.com"
app_license = "mit"
app_logo_url = "/assets/subscription/images/logo.png"
app_home = "/desk/subscription"

required_apps = ["frappe", "erpnext"]

app_include_icons = [
	"/assets/subscription/icons/module-icons.svg",
]

add_to_apps_screen = [
	{
		"name": "subscription",
		"logo": "/assets/subscription/images/logo.png",
		"title": "Subscription",
		"route": app_home,
		"has_permission": "subscription.api.pwa.check_app_permission",
	}
]

# Route the Subscription PWA SPA at /subscriptions and all nested client routes
website_route_rules = [
	{"from_route": "/subscriptions/<path:app_path>", "to_route": "subscriptions"},
]

after_install = "subscription.setup.after_install"
after_migrate = "subscription.setup.after_install"

scheduler_events = {
	"daily": [
		"subscription.tasks.run_daily_subscription_checks",
	],
	"hourly": [
		"subscription.tasks.sync_due_states",
	],
}

