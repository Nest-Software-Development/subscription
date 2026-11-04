# Copyright (c) 2026, nsdLabs — Nest Software Development and contributors
# For license information, please see license.txt

import frappe

from subscription.push import ensure_vapid_keys
from subscription.setup.seed import ensure_default_settings, import_seed_if_empty


def after_install():
	"""Idempotent setup executed after `bench install-app subscription` and every `bench migrate`."""
	ensure_default_settings()
	ensure_vapid_keys()
	import_seed_if_empty()

