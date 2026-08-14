# Models

Bob routes requests through a model router rather than pinning a specific model, so output quality varies.
The process prints the active model at the start of each phase so you can calibrate how much to trust the result.

Some models observed in Bob 2.0 and how successful they are with the ratchet skills:

- **Claude Opus 4.5** - Good for everything. Excellent at Load and Capture.
- **Claude Sonnet 4.5** - Good for Execute, Commit. Acceptable for Load and Capture.
- **Claude Sonnet 3.5/3.7** - Good for Commit. Acceptable for Execute. Avoid for Load and Capture.
- **GPT-5** - Good for Commit. Avoid for Load, Capture, Execute.
