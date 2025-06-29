Murf AI Text to Speech API Documentation

Overview

Murf AI offers a robust Text to Speech (TTS) API that enables you to convert text into high-quality, natural-sounding speech. With support for over 21 languages, 20 speaking styles, and 150+ voices, the API is designed to fit a wide variety of applications, from voice assistants to telephony systems.

Quickstart

Generate an API Key
	1.	Sign up or log in to the Murf API Dashboard.
	2.	Generate your API key.
	3.	(Optional) Set the API key as an environment variable for easier integration.

Install the SDK

For Python users, install the Murf SDK:pip install murf

Basic Usage

Python SDK Examplefrom murf import Murf

client = Murf(api_key="YOUR_API_KEY")  # Not required if set as environment variable

res = client.text_to_speech.generate(
    text="There is much to be said",
    voice_id="en-US-terrell",
)

print(res.audio_file)  # Returns a link to the audio file (valid for 72 hours)

Features

Real-Time Streaming
	•	Streaming API: Generate speech in real-time with low latency and high quality.
	•	WebSockets: Build responsive, real-time voice applications with bidirectional streaming.

Voices & Styles
	•	Access a diverse library of voices and speaking styles.
	•	Customize speech to create unique and expressive voiceovers.

Supported Output Formats

Format

Description

WAV

Uncompressed, ideal for low-latency applications.

MP3

Compressed, widely supported, small file size.

FLAC

Lossless compression, high fidelity.

ALAW

Compressed for telephony, mono only, 8000 Hz.

ULAW

Similar to ALAW, mono only, 8000 Hz.

Note: Use the ‎⁠format⁠ parameter to specify output format.

Channel Type and Sample Rate
	•	Channels: ‎⁠MONO⁠ (1 channel) or ‎⁠STEREO⁠ (2 channels).
	•	Sample Rates: 8000, 24000, 44100, 48000 Hz.
	•	Restrictions: ALAW and ULAW support only mono channel and 8000 Hz.

Exampleres = client.text_to_speech.generate(
    text="Hello world!",
    voice_id="en-US-julia",
    format="MP3",
    channel_type="STEREO",
    sample_rate=44100,
)

Base64 Encoding

To receive the audio as a Base64-encoded string (for embedding in APIs or databases), set ‎⁠encode_as_base_64=True⁠.

Exampleres = client.text_to_speech.generate(
    text="Hello world!",
    voice_id="en-US-julia",
    encode_as_base_64=True
)
# Access the encoded audio with res['encodedAudio']

gzip Support

To reduce response size, enable gzip compression by including ‎⁠accept-encoding: gzip⁠ in your request headers.

Exampleclient.text_to_speech.generate(
    text="Hello, World!",
    voice_id="en-US-natalie",
    encode_as_base_64=True,
    request_options={
        'additional_headers': {
            'accept-encoding': 'gzip'
        }
    }
)

Frequently Asked Questions

Which audio format should I use?
	•	MP3: Best for web streaming.
	•	WAV: High-quality recordings.
	•	FLAC: Lossless compression, smaller size.
	•	ALAW/ULAW: Telephony systems.

When to use MONO vs STEREO?
	•	MONO: Voice calls, podcasts, telephony.
	•	STEREO: Music, films, immersive experiences.

What sample rate should I choose?
	•	8000 Hz: Telephony/VoIP (required for ALAW/ULAW).
	•	24000 Hz: Podcasts, e-learning.
	•	44100 Hz: CD-quality.
	•	48000 Hz: Film/professional audio.

What is Base64 audio?
	•	Encodes audio as text for embedding in JSON, XML, or web apps.
	•	Increases file size; use for compatibility, not storage efficiency.

Additional Resources
	•	Murf API Dashboard ↗
	•	API Reference ↗
	•	Community Support ↗