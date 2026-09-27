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
    <title>DeepSea Guardian — Complete Project Guide</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        
        @page {{
            size: A4;
            margin: 18mm 16mm 18mm 16mm;
            @bottom-right {{
                content: "Page " counter(page);
                font-family: 'Plus Jakarta Sans', sans-serif;
                font-size: 10px;
                color: #94a3b8;
            }}
        }}

        body {{
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.68;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 8px;
            font-size: 13.5px;
        }}

        h1 {{
            color: #0f172a;
            font-size: 26px;
            font-weight: 800;
            border-bottom: 3px solid #0284c7;
            padding-bottom: 8px;
            margin-top: 28px;
            margin-bottom: 16px;
            letter-spacing: -0.02em;
        }}

        h2 {{
            color: #0369a1;
            font-size: 19px;
            font-weight: 700;
            border-bottom: 1.5px solid #e2e8f0;
            padding-bottom: 6px;
            margin-top: 26px;
            margin-bottom: 14px;
            page-break-after: avoid;
            letter-spacing: -0.01em;
        }}

        h3 {{
            color: #0f172a;
            font-size: 15.5px;
            font-weight: 700;
            margin-top: 20px;
            margin-bottom: 10px;
            page-break-after: avoid;
        }}

        p {{
            color: #334155;
            margin-top: 0;
            margin-bottom: 12px;
        }}

        ul, ol {{
            color: #334155;
            padding-left: 22px;
            margin-bottom: 14px;
        }}

        li {{
            margin-bottom: 6px;
        }}

        code {{
            font-family: 'JetBrains Mono', monospace;
            background-color: #f0fdf4;
            color: #166534;
            padding: 2px 6px;
            border-radius: 5px;
            font-size: 12px;
            font-weight: 600;
            border: 1px solid #bbf7d0;
        }}

        pre {{
            background-color: #0f172a;
            color: #f8fafc;
            padding: 16px;
            border-radius: 10px;
            overflow-x: auto;
            font-size: 12px;
            line-height: 1.55;
            page-break-inside: avoid;
            margin: 14px 0;
            border: 1px solid #334155;
        }}

        pre code {{
            background-color: transparent;
            color: #38bdf8;
            padding: 0;
            border: none;
            font-weight: 400;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 18px 0;
            font-size: 12.5px;
            page-break-inside: avoid;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }}

        th, td {{
            padding: 10px 14px;
            text-align: left;
            border: 1px solid #cbd5e1;
        }}

        th {{
            background-color: #f1f5f9;
            color: #0f172a;
            font-weight: 700;
            border-bottom: 2px solid #64748b;
        }}

        tr:nth-child(even) {{
            background-color: #f8fafc;
        }}

        blockquote {{
            border-left: 4px solid #0ea5e9;
            background-color: #f0f9ff;
            margin: 16px 0;
            padding: 12px 18px;
            border-radius: 0 8px 8px 0;
            color: #0369a1;
            font-size: 13.5px;
        }}

        hr {{
            border: none;
            border-top: 1.5px solid #e2e8f0;
            margin: 28px 0;
        }}

        .cover {{
            text-align: center;
            padding: 40px 20px 20px 20px;
            page-break-after: always;
            border: 2px solid #e2e8f0;
            border-radius: 16px;
            background: linear-gradient(180deg, #f8fafc 0%, #f0f9ff 100%);
            margin-bottom: 20px;
        }}

        .cover h1 {{
            font-size: 34px;
            color: #0369a1;
            border: none;
            margin-bottom: 8px;
            padding: 0;
        }}

        .cover p.subtitle {{
            font-size: 17px;
            color: #0284c7;
            font-weight: 600;
            margin-bottom: 24px;
        }}

        .badge {{
            display: inline-block;
            background: #e0f2fe;
            color: #0369a1;
            padding: 5px 12px;
            border-radius: 9999px;
            font-size: 11.5px;
            font-weight: 700;
            margin: 3px;
            border: 1px solid #bae6fd;
        }}
    </style>
</head>
<body>
    <div class="cover">
        <div style="font-size: 42px; margin-bottom: 8px;">🌊🤖</div>
        <h1>DeepSea Guardian</h1>
        <p class="subtitle">AI-Powered Ocean Monitoring & Marine Life Protection Platform</p>
        <p style="font-size: 14px; color: #475569;"><strong>Complete Project Guide & System Walkthrough</strong></p>
        
        <div style="margin-top: 20px;">
            <span class="badge">AI Chemical Spill Detection</span>
            <span class="badge">Autonomous Drone Dispatch</span>
            <span class="badge">6-Hour Pollution Forecast</span>
            <span class="badge">Marine Species Vision AI</span>
            <span class="badge">Live Ocean Map</span>
        </div>

        <div style="margin-top: 50px; font-size: 13px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 20px;">
            <p><strong>Author:</strong> Raman Kumar Tiwari</p>
            <p><strong>Project Version:</strong> 1.0.0 (Production Release)</p>
            <p><strong>Repository:</strong> https://github.com/tiwariraman884/DeepSee.git</p>
        </div>
    </div>

    {html_content}
</body>
</html>
"""

    with open(HTML_FILE, "w", encoding="utf-8") as f:
        f.write(styled_html)
    print(f"Generated clean HTML: {HTML_FILE}")

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
    
    print(f"Generating PDF with high readability...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"PDF successfully generated at: {pdf_abs}")
    else:
        print(f"Error generating PDF: {result.stderr}")

if __name__ == "__main__":
    build_html()
    convert_to_pdf()
