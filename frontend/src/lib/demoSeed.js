// Bundled Nest Subscription Manager dataset for offline/standalone preview fallback
export const DEMO_RAW_DB = {
  "exported_at": "2026-11-01T09:45:18",
  "source": "https://subs.nsd-eg.com (Nest Subscription Manager, MySQL)",
  "counts": {
    "subscriptions": 26,
    "vendor_subscriptions": 12,
    "wallets": 2,
    "transactions": 17,
    "reminder_rules": 9,
    "email_log": 9
  },
  "settings": {
    "usd_egp_rate": 56.25,
    "smtp_host": "mail.nsd-eg.com",
    "smtp_port": 465,
    "smtp_user": "renewal@nsd-eg.com",
    "smtp_from_name": "Nest Software Development",
    "smtp_password": "(not exported — re-enter in ERPNext Email Account)",
    "email_footer": "Banque Misr\nNest Software Development | Account Number :\n1760001000010231 | IBAN:\nEG100002017601760001000010231 | Swift Code:\nBMISEGCX176",
    "email_template": "nest",
    "email_text": {
      "subject": "Renewal Reminder: {client} — {service} due {due}",
      "greeting": "Dear {client} team,",
      "intro": "This is a friendly reminder that the following service is due for renewal {when}.",
      "closing": "Please arrange the payment before the due date to ensure uninterrupted service.\n\nIf the payment is made in EGP, please note that an additional 3% currency coverage fee will be applied to account for exchange rate fluctuations.\n\nThe service is provided with an online invoice issued directly by the service provider.\n\nIf an Egyptian Tax Authority (ETA) e-invoice is required, an additional 14% VAT will be applied in accordance with applicable tax regulations.",
      "cta": "Reply to confirm payment",
      "signoff": "Thanks, and best regards,\nNest Software Development"
    }
  },
  "subscriptions": [
    {
      "id": "jp9l0b9v",
      "client": "Cars Empire",
      "service": "Cloud Server Hosting",
      "cycle": "Annual",
      "cur": "EGP",
      "amount": 16000,
      "due": "2027-01-01",
      "notes": ""
    },
    {
      "id": "0kmba58x",
      "client": "Cwater",
      "service": "Cloud server (ERP)",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 450,
      "due": "2026-12-01",
      "notes": "Due before 1 Dec."
    },
    {
      "id": "2502wiye",
      "client": "Cwater",
      "service": "ERP support contract",
      "cycle": "Annual",
      "cur": "EGP",
      "amount": 18000,
      "due": "2027-07-01",
      "notes": ""
    },
    {
      "id": "rv7hi3rl",
      "client": "Cwater",
      "service": "Website hosting (Cwater Host)",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 180,
      "due": "2027-11-01",
      "notes": ""
    },
    {
      "id": "763iqx49",
      "client": "Josoor",
      "service": "Cloud server & license",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 621,
      "due": "2027-11-01",
      "notes": "Billed via Kayan (Hazem Ali)."
    },
    {
      "id": "sxdtuf38",
      "client": "Josoor",
      "service": "Hosting",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 579.6,
      "due": "2027-11-01",
      "notes": "Billed via Kayan."
    },
    {
      "id": "zw481k5o",
      "client": "Kayan",
      "service": "Google Drive 2 TB",
      "cycle": "Annual",
      "cur": "EGP",
      "amount": 3600,
      "due": "2027-01-01",
      "notes": ""
    },
    {
      "id": "jpxqn0h9",
      "client": "Kayan",
      "service": "Annual hosting",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 2300,
      "due": "2027-04-01",
      "notes": "Grouped with ZAD hosting, due 1 Apr."
    },
    {
      "id": "ycv69ix5",
      "client": "Kayan",
      "service": "Microsoft 365 Family",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 122,
      "due": "2027-08-10",
      "notes": ""
    },
    {
      "id": "y42sp8k5",
      "client": "Kayan",
      "service": "Cloud server & license",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 621,
      "due": "2027-11-01",
      "notes": "Renews before 1 Nov."
    },
    {
      "id": "la9l4xpl",
      "client": "LCS Sustainable Solutions",
      "service": "ERP server & system (Verpex VPS)",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 520,
      "due": "2027-03-01",
      "notes": "2026 invoice VPX-208314 ($520 incl. 14% VAT)."
    },
    {
      "id": "u9as0iy9",
      "client": "LCS Sustainable Solutions",
      "service": "ERPNext support contract",
      "cycle": "Annual",
      "cur": "EGP",
      "amount": 36000,
      "due": "2027-07-01",
      "notes": "2026: EGP 2,850 advance received, EGP 33,150 balance."
    },
    {
      "id": "xt1q5kn1",
      "client": "leendigitalconsulting.com",
      "service": "Hosting",
      "cycle": "Annual",
      "cur": "EGP",
      "amount": 6000,
      "due": "2027-10-24",
      "notes": ""
    },
    {
      "id": "szppg58n",
      "client": "MHG Holding",
      "service": "IT outsourcing / technical support",
      "cycle": "Monthly",
      "cur": "EGP",
      "amount": 5244,
      "due": "2026-11-25",
      "notes": "Excl. tax. Contract 01/01/2026–31/12/2026; re-sign each January (2026 had +15% uplift)."
    },
    {
      "id": "6j5b5ful",
      "client": "MHG Holding",
      "service": "bijjora.com Host Renewal",
      "cycle": "Annual",
      "cur": "EGP",
      "amount": 5000,
      "due": "2027-08-11",
      "notes": "Price excludes 14% VAT"
    },
    {
      "id": "hncb2myv",
      "client": "MHG Holding",
      "service": "sianches.com Host Renewal",
      "cycle": "Annual",
      "cur": "EGP",
      "amount": 5000,
      "due": "2027-08-11",
      "notes": "Price excludes 14% VAT"
    },
    {
      "id": "kqiy2w16",
      "client": "MHG Holding",
      "service": "cheopsprive.com Host Renewal",
      "cycle": "Annual",
      "cur": "EGP",
      "amount": 6400,
      "due": "2027-08-11",
      "notes": "Price excludes 14% VAT"
    },
    {
      "id": "muk09ose",
      "client": "MHG Holding",
      "service": "bijiandco.com Host Renewal",
      "cycle": "Annual",
      "cur": "EGP",
      "amount": 5000,
      "due": "2027-08-11",
      "notes": "Price excludes 14% VAT"
    },
    {
      "id": "ymkalwnh",
      "client": "MHG Holding",
      "service": "Microsoft Office 365",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 210,
      "due": "2027-08-11",
      "notes": "6 User Package X 2\nPrice excludes 14% VAT"
    },
    {
      "id": "xnzfnont",
      "client": "Sigma AO",
      "service": "Support contract (quarterly)",
      "cycle": "Quarterly",
      "cur": "EGP",
      "amount": 20000,
      "due": "2026-11-01",
      "notes": "Raised from 15,000 after ERPNext v16 upgrade. Due 1 Feb / May / Aug / Nov."
    },
    {
      "id": "tcczr5vf",
      "client": "Sigma AO",
      "service": "Cloud server & system (ERPNext)",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 675,
      "due": "2027-02-01",
      "notes": "Due before 1 Feb."
    },
    {
      "id": "fojqa5n8",
      "client": "Sigma AO",
      "service": "Website & email hosting",
      "cycle": "Biennial",
      "cur": "USD",
      "amount": 440,
      "due": "2028-06-06",
      "notes": "2-year term 06/06/2026–05/06/2028, $440 total."
    },
    {
      "id": "vtfgqsl5",
      "client": "sigmacontracting.net",
      "service": "domain renewal",
      "cycle": "Annual",
      "cur": "EGP",
      "amount": 5800,
      "due": "2027-01-11",
      "notes": ""
    },
    {
      "id": "mmt31mqe",
      "client": "Trending",
      "service": "Cloud Server ERP",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 330,
      "due": "2026-11-01",
      "notes": ""
    },
    {
      "id": "ffpo5nvm",
      "client": "Xenios",
      "service": "Hosting",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 579.6,
      "due": "2027-11-01",
      "notes": "Billed via Kayan."
    },
    {
      "id": "o9j3zl05",
      "client": "ZAD Electromechanical",
      "service": "Annual hosting",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 1000,
      "due": "2027-04-01",
      "notes": "Grouped with Kayan hosting."
    }
  ],
  "vendor_subscriptions": [
    {
      "id": "7wvw3ihx",
      "vendor": "Contabo",
      "service": "VPS",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 54.12,
      "due": "2026-11-03",
      "link_subs": [
        "la9l4xpl",
        "763iqx49"
      ],
      "notes": ""
    },
    {
      "id": "233i455y",
      "vendor": "Contabo",
      "service": "VPS",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 54.12,
      "due": "2027-01-27",
      "link_subs": [
        "0kmba58x",
        "y42sp8k5"
      ],
      "notes": ""
    },
    {
      "id": "vvtfgqsl5",
      "vendor": "Spaceship",
      "service": "domain renewal (sigmacontracting.net)",
      "cycle": "Annual",
      "cur": "EGP",
      "amount": 600,
      "due": "2027-01-11",
      "link_subs": [
        "vtfgqsl5"
      ],
      "notes": "Migrated from service costs"
    },
    {
      "id": "vffpo5nvm",
      "vendor": "Vendor",
      "service": "Xenios | Domain Renewal",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 14,
      "due": "2026-11-30",
      "link_subs": [
        "ffpo5nvm"
      ],
      "notes": "Migrated from service costs"
    },
    {
      "id": "vmjcnw0jn",
      "vendor": "Verpex",
      "service": "MIR-United | Domain Renewal",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 14,
      "due": "2026-10-20",
      "link_subs": [
        "mjcnw0jn"
      ],
      "notes": "Migrated from service costs"
    },
    {
      "id": "2ev72rod",
      "vendor": "Verpex",
      "service": "Josoor | Domain Renewal",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 14,
      "due": "2026-11-12",
      "link_subs": [
        "sxdtuf38"
      ],
      "notes": ""
    },
    {
      "id": "2ffthsfn",
      "vendor": "Verpex",
      "service": "Nest Software | Domain Renewal",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 14,
      "due": "2026-11-12",
      "link_subs": [],
      "notes": ""
    },
    {
      "id": "2ztkcj9h",
      "vendor": "Verpex",
      "service": "C-Water | Domain Renewal",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 14,
      "due": "2026-11-12",
      "link_subs": [
        "rv7hi3rl"
      ],
      "notes": ""
    },
    {
      "id": "qjabrnhn",
      "vendor": "Verpex",
      "service": "Pro Reseller",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 300,
      "due": "2026-11-12",
      "link_subs": [
        "jpxqn0h9",
        "rv7hi3rl",
        "sxdtuf38"
      ],
      "notes": ""
    },
    {
      "id": "vjp9l0b9v",
      "vendor": "Verpex",
      "service": "Cloud Server Hosting (Cars Empire)",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 14,
      "due": "2027-01-01",
      "link_subs": [
        "jp9l0b9v"
      ],
      "notes": "Migrated from service costs"
    },
    {
      "id": "vo9j3zl05",
      "vendor": "Verpex",
      "service": "Annual hosting (ZAD Electromechanical)",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 14,
      "due": "2027-04-01",
      "link_subs": [
        "o9j3zl05"
      ],
      "notes": "Migrated from service costs"
    },
    {
      "id": "vfojqa5n8",
      "vendor": "Verpex",
      "service": "Sigma AO | Domain Renewal",
      "cycle": "Annual",
      "cur": "USD",
      "amount": 14,
      "due": "2028-06-06",
      "link_subs": [
        "fojqa5n8"
      ],
      "notes": "Migrated from service costs"
    }
  ],
  "wallets": [
    {
      "id": "by39n5km",
      "name": "Banque Misr",
      "cur": "EGP",
      "opening": 179.96,
      "notes": "",
      "archived": 0,
      "in": 145555.5,
      "out": 0,
      "balance": 145735.46
    },
    {
      "id": "r8vyglfx",
      "name": "CIB",
      "cur": "EGP",
      "opening": 2988.23,
      "notes": "",
      "archived": 0,
      "in": 58033,
      "out": 7017.01,
      "balance": 54004.22
    }
  ],
  "transactions": [
    {
      "id": 17,
      "tdate": "2026-11-01",
      "direction": "in",
      "wallet_id": "by39n5km",
      "ref_kind": "client",
      "ref_id": "ffpo5nvm",
      "party": "Xenios",
      "service": "Hosting",
      "amount": 579.6,
      "cur": "USD",
      "wallet_amount": 32602.5,
      "rate": 56.25,
      "notes": ""
    },
    {
      "id": 16,
      "tdate": "2026-11-01",
      "direction": "in",
      "wallet_id": "by39n5km",
      "ref_kind": "client",
      "ref_id": "szppg58n",
      "party": "MHG Holding",
      "service": "IT outsourcing / technical support",
      "amount": 5244,
      "cur": "EGP",
      "wallet_amount": 5244,
      "rate": 56.25,
      "notes": ""
    },
    {
      "id": 15,
      "tdate": "2026-11-01",
      "direction": "in",
      "wallet_id": "by39n5km",
      "ref_kind": "client",
      "ref_id": "y42sp8k5",
      "party": "Kayan",
      "service": "Cloud server & license",
      "amount": 621,
      "cur": "USD",
      "wallet_amount": 34931.25,
      "rate": 56.25,
      "notes": ""
    },
    {
      "id": 14,
      "tdate": "2026-11-01",
      "direction": "in",
      "wallet_id": "by39n5km",
      "ref_kind": "client",
      "ref_id": "sxdtuf38",
      "party": "Josoor",
      "service": "Hosting",
      "amount": 579.6,
      "cur": "USD",
      "wallet_amount": 32602.5,
      "rate": 56.25,
      "notes": ""
    },
    {
      "id": 13,
      "tdate": "2026-11-01",
      "direction": "in",
      "wallet_id": "by39n5km",
      "ref_kind": "client",
      "ref_id": "763iqx49",
      "party": "Josoor",
      "service": "Cloud server & license",
      "amount": 621,
      "cur": "USD",
      "wallet_amount": 34931.25,
      "rate": 56.25,
      "notes": ""
    },
    {
      "id": 12,
      "tdate": "2026-11-01",
      "direction": "in",
      "wallet_id": "r8vyglfx",
      "ref_kind": "client",
      "ref_id": "rv7hi3rl",
      "party": "Cwater",
      "service": "Website hosting (Cwater Host)",
      "amount": 180,
      "cur": "USD",
      "wallet_amount": 10125,
      "rate": 56.25,
      "notes": ""
    },
    {
      "id": 11,
      "tdate": "2026-11-01",
      "direction": "in",
      "wallet_id": "by39n5km",
      "ref_kind": "client",
      "ref_id": "szppg58n",
      "party": "MHG Holding",
      "service": "IT outsourcing / technical support",
      "amount": 5244,
      "cur": "EGP",
      "wallet_amount": 5244,
      "rate": 56.25,
      "notes": ""
    },
    {
      "id": 10,
      "tdate": "2026-09-02",
      "direction": "in",
      "wallet_id": "r8vyglfx",
      "ref_kind": "client",
      "ref_id": "szppg58n",
      "party": "MHG Holding",
      "service": "IT outsourcing / technical support",
      "amount": 4600,
      "cur": "EGP",
      "wallet_amount": 4600,
      "rate": 50.8,
      "notes": ""
    },
    {
      "id": 9,
      "tdate": "2026-08-12",
      "direction": "in",
      "wallet_id": "r8vyglfx",
      "ref_kind": "manual",
      "ref_id": "",
      "party": "MHG Taxes",
      "service": "",
      "amount": 4471,
      "cur": "EGP",
      "wallet_amount": 4471,
      "rate": 49.7,
      "notes": ""
    },
    {
      "id": 8,
      "tdate": "2026-08-12",
      "direction": "in",
      "wallet_id": "r8vyglfx",
      "ref_kind": "client",
      "ref_id": "ymkalwnh",
      "party": "MHG Holding",
      "service": "Microsoft Office 365",
      "amount": 210,
      "cur": "USD",
      "wallet_amount": 10437,
      "rate": 49.7,
      "notes": ""
    },
    {
      "id": 7,
      "tdate": "2026-08-12",
      "direction": "in",
      "wallet_id": "r8vyglfx",
      "ref_kind": "client",
      "ref_id": "muk09ose",
      "party": "MHG Holding",
      "service": "bijiandco.com Host Renewal",
      "amount": 5000,
      "cur": "EGP",
      "wallet_amount": 5000,
      "rate": 49.7,
      "notes": ""
    },
    {
      "id": 6,
      "tdate": "2026-08-12",
      "direction": "in",
      "wallet_id": "r8vyglfx",
      "ref_kind": "client",
      "ref_id": "kqiy2w16",
      "party": "MHG Holding",
      "service": "cheopsprive.com Host Renewal",
      "amount": 6400,
      "cur": "EGP",
      "wallet_amount": 6400,
      "rate": 49.7,
      "notes": ""
    },
    {
      "id": 5,
      "tdate": "2026-08-12",
      "direction": "in",
      "wallet_id": "r8vyglfx",
      "ref_kind": "client",
      "ref_id": "hncb2myv",
      "party": "MHG Holding",
      "service": "sianches.com Host Renewal",
      "amount": 5000,
      "cur": "EGP",
      "wallet_amount": 5000,
      "rate": 49.7,
      "notes": ""
    },
    {
      "id": 4,
      "tdate": "2026-08-12",
      "direction": "in",
      "wallet_id": "r8vyglfx",
      "ref_kind": "client",
      "ref_id": "6j5b5ful",
      "party": "MHG Holding",
      "service": "bijjora.com Host Renewal",
      "amount": 5000,
      "cur": "EGP",
      "wallet_amount": 5000,
      "rate": 49.7,
      "notes": ""
    },
    {
      "id": 3,
      "tdate": "2026-08-10",
      "direction": "out",
      "wallet_id": "r8vyglfx",
      "ref_kind": "manual",
      "ref_id": "",
      "party": "Transfere to Mohamed Basma",
      "service": "",
      "amount": 1011.01,
      "cur": "EGP",
      "wallet_amount": 1011.01,
      "rate": 49.7,
      "notes": ""
    },
    {
      "id": 2,
      "tdate": "2026-08-10",
      "direction": "out",
      "wallet_id": "r8vyglfx",
      "ref_kind": "manual",
      "ref_id": "",
      "party": "Transfere to Heba",
      "service": "",
      "amount": 6006,
      "cur": "EGP",
      "wallet_amount": 6006,
      "rate": 49.7,
      "notes": ""
    },
    {
      "id": 1,
      "tdate": "2026-08-10",
      "direction": "in",
      "wallet_id": "r8vyglfx",
      "ref_kind": "client",
      "ref_id": "ycv69ix5",
      "party": "Kayan",
      "service": "Microsoft 365 Family",
      "amount": 7000,
      "cur": "EGP",
      "wallet_amount": 7000,
      "rate": 49.7,
      "notes": ""
    }
  ],
  "reminder_rules": [
    {
      "id": "4mvztp0s",
      "client": "Cwater",
      "to_emails": "a.hashad@cw-eg.com",
      "cc_emails": "khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "offsets": [
        {
          "days": 30,
          "enabled": true
        },
        {
          "days": 15,
          "enabled": true
        },
        {
          "days": 7,
          "enabled": true
        },
        {
          "days": 1,
          "enabled": true
        }
      ],
      "enabled": 1
    },
    {
      "id": "zfu37es3",
      "client": "Josoor",
      "to_emails": "hazem.ali@kayan-eg.net",
      "cc_emails": "khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "offsets": [
        {
          "days": 30,
          "enabled": true
        },
        {
          "days": 15,
          "enabled": true
        },
        {
          "days": 7,
          "enabled": true
        },
        {
          "days": 1,
          "enabled": true
        }
      ],
      "enabled": 1
    },
    {
      "id": "j5ki31pl",
      "client": "Kayan",
      "to_emails": "hazem.ali@kayan-eg.net",
      "cc_emails": "khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "offsets": [
        {
          "days": 30,
          "enabled": true
        },
        {
          "days": 15,
          "enabled": true
        },
        {
          "days": 7,
          "enabled": true
        },
        {
          "days": 1,
          "enabled": true
        }
      ],
      "enabled": 1
    },
    {
      "id": "hqxfa5a7",
      "client": "LCS Sustainable Solutions",
      "to_emails": "m.albialy@lcs-eg.com, m.almandouh@lcs-eg.net",
      "cc_emails": "khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "offsets": [
        {
          "days": 30,
          "enabled": true
        },
        {
          "days": 15,
          "enabled": true
        },
        {
          "days": 7,
          "enabled": true
        },
        {
          "days": 1,
          "enabled": true
        }
      ],
      "enabled": 1
    },
    {
      "id": "rmf2eh21",
      "client": "Leendigitalconsulting.com",
      "to_emails": "matar@leendigitalconsulting.com, info@leendigitalconsulting.com",
      "cc_emails": "khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "offsets": [
        {
          "days": 30,
          "enabled": true
        },
        {
          "days": 15,
          "enabled": true
        },
        {
          "days": 7,
          "enabled": true
        },
        {
          "days": 1,
          "enabled": true
        }
      ],
      "enabled": 1
    },
    {
      "id": "44r2f092",
      "client": "Sigma AO",
      "to_emails": "a.saleh@sigma-egypt.com, vibronia.nashaat@sigma-egypt.com",
      "cc_emails": "khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "offsets": [
        {
          "days": 30,
          "enabled": true
        },
        {
          "days": 15,
          "enabled": true
        },
        {
          "days": 7,
          "enabled": true
        },
        {
          "days": 1,
          "enabled": true
        }
      ],
      "enabled": 1
    },
    {
      "id": "3kwx0428",
      "client": "sigmacontracting.net",
      "to_emails": "a.saleh@sigma-egypt.com, vibronia.nashaat@sigma-egypt.com",
      "cc_emails": "khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "offsets": [
        {
          "days": 30,
          "enabled": true
        },
        {
          "days": 15,
          "enabled": true
        },
        {
          "days": 7,
          "enabled": true
        },
        {
          "days": 1,
          "enabled": true
        }
      ],
      "enabled": 1
    },
    {
      "id": "4n2oda95",
      "client": "Trending",
      "to_emails": "nada@trending-eg.com, basel@trending-eg.com, emad@trending-eg.com",
      "cc_emails": "khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "offsets": [
        {
          "days": 30,
          "enabled": true
        },
        {
          "days": 15,
          "enabled": true
        },
        {
          "days": 7,
          "enabled": true
        },
        {
          "days": 1,
          "enabled": true
        }
      ],
      "enabled": 1
    },
    {
      "id": "ty23t3zx",
      "client": "Xenios",
      "to_emails": "hazem.ali@kayan-eg.net",
      "cc_emails": "khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "offsets": [
        {
          "days": 30,
          "enabled": true
        },
        {
          "days": 15,
          "enabled": true
        },
        {
          "days": 7,
          "enabled": true
        },
        {
          "days": 1,
          "enabled": true
        }
      ],
      "enabled": 1
    }
  ],
  "email_log": [
    {
      "sub_id": "xnzfnont",
      "due": "2026-11-01",
      "days_before": 1,
      "recipients": "a.saleh@sigma-egypt.com, vibronia.nashaat@sigma-egypt.com, khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "subject": "Renewal Reminder: Sigma AO — Support contract (quarterly) due 01 Nov 2026",
      "status": "sent via SMTP",
      "sent_at": "2026-11-01 09:22:24"
    },
    {
      "sub_id": "mmt31mqe",
      "due": "2026-11-01",
      "days_before": 1,
      "recipients": "nada@trending-eg.com, basel@trending-eg.com, emad@trending-eg.com, khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "subject": "Renewal Reminder: Trending — Cloud Server ERP due 01 Nov 2026",
      "status": "sent via SMTP",
      "sent_at": "2026-11-01 09:22:24"
    },
    {
      "sub_id": "0kmba58x",
      "due": "2026-12-01",
      "days_before": 30,
      "recipients": "a.hashad@cw-eg.com, khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "subject": "Renewal Reminder: Cwater — Cloud server (ERP) due 01 Dec 2026",
      "status": "sent via SMTP",
      "sent_at": "2026-11-01 09:22:22"
    },
    {
      "sub_id": "y42sp8k5",
      "due": "2026-11-01",
      "days_before": 7,
      "recipients": "hazem.ali@kayan-eg.net, khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "subject": "Renewal Reminder: Kayan — Cloud server & license due 01 Nov 2026",
      "status": "sent via SMTP",
      "sent_at": "2026-10-26 17:30:15"
    },
    {
      "sub_id": "xnzfnont",
      "due": "2026-11-01",
      "days_before": 7,
      "recipients": "a.saleh@sigma-egypt.com, vibronia.nashaat@sigma-egypt.com, khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "subject": "Renewal Reminder: Sigma AO — Support contract (quarterly) due 01 Nov 2026",
      "status": "sent via SMTP",
      "sent_at": "2026-10-26 17:30:15"
    },
    {
      "sub_id": "sxdtuf38",
      "due": "2026-11-01",
      "days_before": 7,
      "recipients": "hazem.ali@kayan-eg.net, khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "subject": "Renewal Reminder: Josoor — Hosting due 01 Nov 2026",
      "status": "sent via SMTP",
      "sent_at": "2026-10-26 17:30:15"
    },
    {
      "sub_id": "rv7hi3rl",
      "due": "2026-11-01",
      "days_before": 7,
      "recipients": "a.hashad@cw-eg.com, khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "subject": "Renewal Reminder: Cwater — Website hosting (Cwater Host) due 01 Nov 2026",
      "status": "sent via SMTP",
      "sent_at": "2026-10-26 17:30:15"
    },
    {
      "sub_id": "ffpo5nvm",
      "due": "2026-11-01",
      "days_before": 7,
      "recipients": "hazem.ali@kayan-eg.net, khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "subject": "Renewal Reminder: Xenios — Hosting due 01 Nov 2026",
      "status": "sent via SMTP",
      "sent_at": "2026-10-26 17:30:15"
    },
    {
      "sub_id": "763iqx49",
      "due": "2026-11-01",
      "days_before": 7,
      "recipients": "hazem.ali@kayan-eg.net, khaled.elshiekh@nsd-eg.com, heba.elmenyawy@nsd-eg.com",
      "subject": "Renewal Reminder: Josoor — Cloud server & license due 01 Nov 2026",
      "status": "sent via SMTP",
      "sent_at": "2026-10-26 17:30:15"
    }
  ]
}
