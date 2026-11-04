frappe.query_reports["Monthly Collection Forecast"] = {
	filters: [
		{
			fieldname: "horizon_months",
			label: __("Forecast Horizon (Months)"),
			fieldtype: "Select",
			options: "6\n12\n18\n24",
			default: "12",
		},
	],
};
