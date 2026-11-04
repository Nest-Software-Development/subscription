frappe.query_reports["Monthly Collection Forecast"] = {
	filters: [
		{
			fieldname: "horizon_months",
			label: __("Forecast Horizon (Months)"),
			fieldtype: "Select",
			options: ["6", "12", "18", "24"],
			default: "12",
		},
	],
};
