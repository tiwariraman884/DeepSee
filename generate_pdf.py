import os
import markdown
import subprocess

MD_FILE = "PROJECT_DOCUMENTATION.md"
HTML_FILE = "PROJECT_DOCUMENTATION.html"
PDF_FILE = "DeepSea_Guardian_Project_Documentation.pdf"

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

def build_html():
    with open(MD_FILE, "r", encoding="utf-8") as f:
        md_text = f.read()

    html_content = markdown.markdown(
        md_text,
        extensions=["extra", "tables", "fenced_code", "toc"]
    )

    styled_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>DeepSea Guardian — Project Documentation</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        
        @page {{
            size: A4;
            margin: 20mm 15mm 20mm 15mm;
            @bottom-right {{
                content: counter(page);
            }}
        }}

        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 10px;
            font-size: 13px;
        }}

        h1 {{
            color: #0f172a;
            font-size: 24px;
            font-weight: 800;
            border-bottom: 3px solid #0284c7;
            padding-bottom: 8px;
            margin-top: 24px;
            margin-bottom: 16px;
        }}

        h2 {{
            color: #0369a1;
            font-size: 18px;
            font-weight: 700;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
            margin-top: 24px;
            margin-bottom: 12px;
            page-break-after: avoid;
        }}

        h3 {{
            color: #0f172a;
            font-size: 15px;
            font-weight: 600;
            margin-top: 18px;
            margin-bottom: 8px;
            page-break-after: avoid;
        }}

        p, li {{
            color: #334155;
        }}

        code {{
            font-family: 'JetBrains Mono', monospace;
            background-color: #f1f5f9;
            color: #0f766e;
            padding: 2px 5px;
            border-radius: 4px;
            font-size: 11.5px;
            border: 1px solid #e2e8f0;
        }}

        pre {{
            background-color: #0f172a;
            color: #f8fafc;
            padding: 14px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 11px;
            line-height: 1.5;
            page-break-inside: avoid;
            margin: 12px 0;
        }}

        pre code {{
            background-color: transparent;
            color: inherit;
            padding: 0;
            border: none;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
            font-size: 12px;
            page-break-inside: avoid;
        }}

        th, td {{
            padding: 8px 12px;
            text-align: left;
            border: 1px solid #cbd5e1;
        }}

        th {{
            background-color: #f8fafc;
            color: #0f172a;
            font-weight: 600;
            border-bottom: 2px solid #94a3b8;
        }}

        tr:nth-child(even) {{
            background-color: #f8fafc;
        }}

        blockquote {{
            border-left: 4px solid #0284c7;
            background-color: #f0f9ff;
            margin: 14px 0;
            padding: 10px 16px;
            border-radius: 0 6px 6px 0;
            color: #0369a1;
            font-style: italic;
        }}

        hr {{
            border: none;
            border-top: 1px solid #e2e8f0;
            margin: 24px 0;
        }}

        .cover {{
            text-align: center;
            padding: 40px 20px 20px 20px;
            page-break-after: always;
        }}

        .cover h1 {{
            font-size: 32px;
            color: #0c4a6e;
            border: none;
            margin-bottom: 8px;
        }}

        .cover p.subtitle {{
            font-size: 16px;
            color: #0284c7;
            font-weight: 500;
            margin-bottom: 30px;
        }}

        .badge {{
            display: inline-block;
            background: #e0f2fe;
            color: #0369a1;
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 600;
            margin: 2px;
        }}
    </style>
</head>
<body>
    <div class="cover">
        <h1>🌊 DeepSea Guardian (DeepSee)</h1>
        <p class="subtitle">AI-Powered Autonomous Ocean Ecosystem Monitoring & Mission Control Platform</p>
        <p><strong>Complete End-to-End System Documentation</strong></p>
        <div style="margin-top: 15px;">
            <span class="badge">Next.js 15 App Router</span>
            <span class="badge">TypeScript & Node.js</span>
            <span class="badge">Python Machine Learning</span>
            <span class="badge">Isolation Forest Anomaly Detection</span>
            <span class="badge">Computer Vision Species Classifier</span>
            <span class="badge">Autonomous Drone Dispatch</span>
        </div>
        <div style="margin-top: 40px; font-size: 12px; color: #64748b;">
            <p>Author: Raman Kumar Tiwari</p>
            <p>Date: September 2026</p>
            <p>Version: 1.0.0 (Production Release)</p>
        </div>
    </div>

    {html_content}
</body>
</html>
"""

    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(styled_html)
    print(f"Generated {HTML_FILE}")

def convert_to_pdf():
    html_abs = os.path.abspath(HTML_FILE)
    pdf_abs = os.path.abspath(PDF_FILE)
    
    cmd = [
        EDGE_PATH,
        "--headless",
        "--disable-gpu",
        f"--print-to-pdf={pdf_abs}",
        f"file:///{html_abs.replace(os.sep, '/')}"
    ]
    
    print(f"Converting HTML to PDF using Edge headless...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"PDF successfully generated at: {pdf_abs}")
    else:
        print(f"Error generating PDF: {result.stderr}")

if __name__ == "__main__":
    build_html()
    convert_to_pdf()
