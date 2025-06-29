Murf Dub Automation API Documentation

Overview

The Murf Dub Automation API enables you to automate high-quality dubbing for videos and audio content with realistic, multi-language support. Designed for bulk operations, the API allows you to scale dubbing for apps, games, and videos in minutes, integrating seamlessly into your workflow for rapid global content localization.

Key Features:
	•	High-quality dubbing in 28 languages
	•	Bulk processing for thousands of files
	•	Automation for consistency and efficiency
	•	Enterprise-grade security with options for ephemeral or controlled data retention

API Modes

The API supports two primary usage modes:

1. Transient (Temporary & Lightweight)
	•	Instantly generate dubs with temporary storage.
	•	Output links expire in 72 hours for secure, API-only processing.
	•	No data is stored on the Murf platform beyond the expiry.

2. Persistent (Project-Based & Editable)
	•	Create and manage dubs via API or the Murf Dubbing platform UI.
	•	Enables editing, re-synthesis, QA checks, collaboration, refinements, and re-downloads.
	•	Dubs are stored permanently (subject to renewal or manual deletion).

Quickstart

Prerequisites
	•	API Key: Generate an API key from the MurfDub platform (distinct from other Murf services).
	•	Install SDK: (Python example)pip install murf

Creating a Dub Job

Python Examplefrom murf import MurfDub

client = MurfDub(
    api_key="YOUR_API_KEY"  # Optional if environment variable MURFDUB_API_KEY is set
)

file_path = "PATH_TO_YOUR_FILE"  # Path to the file you want to dub

create_response = client.dubbing.jobs.create(
    target_locales=["fr_FR"],  # Target language(s)
    file_name="File Name",     # Reference name
    file=open(file_path, "rb"),
    priority="LOW"
    # file_url="URL_TO_YOUR_FILE",  # Optional: Use if file is publicly accessible
    # webhook_url="WEBHOOK_URL",    # Optional: For job status notifications
    # webhook_secret="YOUR_WEBHOOK_SECRET"  # Optional: For validating webhooks
)

print("Job created successfully:", create_response)

Response Example{
  "dubbing_type": "AUTOMATED",
  "file_name": "file_name",
  "priority": "LOW",
  "job_id": "job_id",
  "target_locales": ["fr_FR"],
  "file_url": "file_url",
  "webhook_url": "webhook_url",
  "source_locale": "en_US",
  "warning": "warning"
}

Checking Job Status

You can check the status of a dubbing job using the job ID.

Python Examplefrom murf import MurfDub

client = MurfDub(
    api_key="YOUR_API_KEY"
)
status_res = client.dubbing.jobs.get_status(
    job_id="job_id"
)
print("Job status:", status_res)

Response Example{
  "job_id": "job_id",
  "status": "status",
  "project_id": "project_id",
  "download_details": [
    {
      "locale": "locale",
      "status": "status",
      "error_message": "error_message",
      "download_url": "download_url",
      "download_srt_url": "download_srt_url"
    }
  ],
  "credits_used": 1000000,
  "credits_remaining": 1000000,
  "failure_reason": "failure_reason",
  "failure_code": "failure_code"
}

	•	Use the ‎⁠download_url⁠ to retrieve the dubbed file once completed.

Supported Languages

Source Languages (22)
	•	Auto Detect
	•	English (US & Canada) (en_US)
	•	English (UK) (en_UK)
	•	English (India) (en_IN)
	•	English (Scotland) (en_SCOTT)
	•	English (Australia) (en_AU)
	•	French (fr_FR)
	•	German (de_DE)
	•	Spanish (Spain) (es_ES)
	•	Spanish (Mexico) (es_MX)
	•	Italian (it_IT)
	•	Portuguese (Brazil) (pt_BR)
	•	Polish (pl_PL)
	•	Hindi (hi_IN)
	•	Korean (ko_KR)
	•	Japanese (ja_JP)
	•	Mandarin (Chinese) (zh_CN)
	•	Dutch (nl_NL)
	•	Finnish (fi_FI)
	•	Russian (ru_RU)
	•	Turkish (tr_TR)
	•	Ukrainian (uk_UA)

Destination Languages (26)
	•	English (US & Canada) (en_US)
	•	English (UK) (en_UK)
	•	English (India) (en_IN)
	•	English (Scotland) (en_SCOTT)
	•	English (Australia) (en_AU)
	•	French (fr_FR)
	•	German (de_DE)
	•	Spanish (Spain) (es_ES)
	•	Spanish (Mexico) (es_MX)
	•	Italian (it_IT)
	•	Portuguese (Brazil) (pt_BR)
	•	Polish (pl_PL)
	•	Hindi (hi_IN)
	•	Korean (ko_KR)
	•	Tamil (ta_IN)
	•	Bengali (bn_IN)
	•	Japanese (ja_JP)
	•	Mandarin (Chinese) (zh_CN)
	•	Dutch (nl_NL)
	•	Finnish (fi_FI)
	•	Russian (ru_RU)
	•	Turkish (tr_TR)
	•	Ukrainian (uk_UA)
	•	Danish (da_DK)
	•	Indonesian (id_ID)
	•	Romanian (ro_RO)
	•	Norwegian (nb_NO)

API Limits

Plan

Free

Pay-as-you-go

Enterprise

Concurrency

up to 5

up to 5

15 (customizable)

Video Length

up to 1hr

up to 1hr

up to 1hr

Resolution

up to 1080p (Full HD)

up to 1080p (Full HD)

up to 1080p (Full HD)

QA

-

-

Yes (Project ID endpoint)

Watermark

Yes

No

No


	•	Higher limits and custom requirements available for enterprise users.

Troubleshooting

Error Code

Description

Solution

‎⁠INSUFFICIENT_CREDITS⁠

Not enough credits to process the job

Purchase more credits from the Murf platform

‎⁠CREDITS_EXHAUSTED⁠

All credits used up

Purchase more credits from the Murf platform

‎⁠LANGUAGE_NOT_SUPPORTED⁠

Language not supported

Use a supported language (see above)

‎⁠SPEECH_NOT_PRESENT⁠

No speech detected in audio

Ensure the audio contains clear speech

‎⁠SOURCE_LANGUAGE_MISMATCH⁠

Source language does not match provided value

Verify and match the source language

‎⁠WEBHOOK_ERROR⁠

Error calling webhook

Check webhook URL, ensure it’s reachable, use Job Status API

‎⁠SERVER_ERROR⁠

Processing failed

Contact Murf support

Frequently Asked Questions

Q: What’s the difference between ‎⁠/jobs/create⁠ and ‎⁠/jobs/create-with-project-id⁠?
	•	‎⁠/jobs/create-with-project-ID⁠: Jobs appear in the Murf platform UI for editing, QA, and permanent storage.
	•	‎⁠/jobs/create⁠: Purely API-based, ephemeral jobs. Output expires after 72 hours, not editable via UI.

Q: How do I bulk upload my library?
	•	Loop through your file list and call the job-creation endpoint for each file. Use multipart form-data for uploads or provide a public file link. Batch requests for efficiency.

Q: What SLAs apply to the Bulk Dubbing API?
	•	Standard uptime is 99%. Higher SLAs and throughput may be available for premium customers.

Q: How is dubbing priced?
	•	Each dub consumes credits based on duration and number of languages. Track usage and limits on the dashboard.

Q: What happens if a dub fails?
	•	You’ll receive an error code and/or webhook with the failure reason. For project-based jobs, see the reason in the platform; for ephemeral jobs, see API/webhook.

Q: Can I edit an uploaded dub?
	•	Yes, for project-based jobs (UI-enabled). Not available for ephemeral jobs.

Q: Are API features gated by plan?
	•	Yes: Concurrency, QA, and advanced features depend on your subscription.

Contact & Support

For custom requirements, enterprise plans, or support, contact the Murf sales or support team through the Murf platform.

Related Documentation
	•	API Reference ↗
	•	Changelog ↗
	•	Webhooks Guide ↗