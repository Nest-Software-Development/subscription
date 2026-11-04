frappe.query_reports["Detailed Payment Schedule"] = {
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
