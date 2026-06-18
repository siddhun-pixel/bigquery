# BigQuery Release Notes API

A lightweight Flask application that fetches, parses, caches, and serves Google BigQuery release notes from the official Atom feed.

## Features

- Fetches BigQuery release notes from Google's Atom feed
- Parses release note entries into structured JSON
- Separates update categories (Feature, Issue, Announcement, etc.)
- In-memory caching to reduce external requests
- REST API endpoint for consuming release notes
- Optional force refresh capability

## Tech Stack

- Python 3.x
- Flask
- Requests
- XML ElementTree

## Project Structure

.
├── app.py
├── .gitignore
├── templates/
│   └── index.html
└── README.md

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-folder>
