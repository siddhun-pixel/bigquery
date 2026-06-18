import re
import time
import xml.etree.ElementTree as ET
import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for release notes
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION = 900  # 15 minutes in seconds

def parse_entry_content(html_content):
    """
    Parses the CDATA HTML content from the Atom feed entry.
    Splits the content by <h3> headers to identify separate updates (e.g., Feature, Issue, Announcement).
    """
    if not html_content:
        return []

    # Clean up namespaces or entities if necessary
    html_content = html_content.strip()
    
    # Find all matches of <h3>...</h3> headers which indicate note types
    matches = list(re.finditer(r'<h3>(.*?)</h3>', html_content))
    if not matches:
        # If no headers found, return the whole block as 'General' note
        return [{"type": "General", "html_content": html_content}]
    
    notes = []
    for i, match in enumerate(matches):
        note_type = match.group(1).strip()
        start_idx = match.end()
        # Find ending index (either start of next <h3> or end of content)
        end_idx = matches[i+1].start() if i + 1 < len(matches) else len(html_content)
        
        note_html = html_content[start_idx:end_idx].strip()
        notes.append({
            "type": note_type,
            "html_content": note_html
        })
    
    return notes

def fetch_and_parse_feed():
    """
    Fetches the BigQuery Release Notes RSS/Atom feed and parses it into JSON-serializable structure.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    response = requests.get(FEED_URL, headers=headers, timeout=15)
    response.raise_for_status()
    
    # Register the default namespace to parse it properly
    xml_data = response.text
    root = ET.fromstring(xml_data)
    
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    
    entries = []
    
    for entry in root.findall("atom:entry", ns):
        title_elem = entry.find("atom:title", ns)
        date_str = title_elem.text.strip() if title_elem is not None else "Unknown Date"
        
        updated_elem = entry.find("atom:updated", ns)
        updated_str = updated_elem.text.strip() if updated_elem is not None else ""
        
        # Extract alternate link for the specific release date
        link_elem = entry.find("atom:link[@rel='alternate']", ns)
        if link_elem is None:
            link_elem = entry.find("atom:link", ns)
        link_url = link_elem.attrib.get("href", "").strip() if link_elem is not None else ""
        
        content_elem = entry.find("atom:content", ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        notes = parse_entry_content(content_html)
        
        entries.append({
            "date": date_str,
            "updated": updated_str,
            "link": link_url,
            "notes": notes
        })
        
    return entries

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/release-notes")
def get_release_notes():
    force_refresh = request.args.get("refresh", "").lower() == "true"
    current_time = time.time()
    
    if force_refresh or not cache["data"] or (current_time - cache["last_fetched"] > CACHE_DURATION):
        try:
            parsed_data = fetch_and_parse_feed()
            cache["data"] = parsed_data
            cache["last_fetched"] = current_time
            cache["error"] = None
        except Exception as e:
            # If fetch fails but we have cached data, serve it with a warning
            if cache["data"]:
                return jsonify({
                    "notes": cache["data"],
                    "cached_at": cache["last_fetched"],
                    "warning": f"Failed to fetch live feed: {str(e)}. Displaying cached data."
                })
            else:
                return jsonify({"error": f"Failed to retrieve release notes: {str(e)}"}), 500
                
    return jsonify({
        "notes": cache["data"],
        "cached_at": cache["last_fetched"]
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)
