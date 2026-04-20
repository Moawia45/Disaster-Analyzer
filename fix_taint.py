import base64
import os

def fix_html():
    logo_path = os.path.join('frontend', 'logo.png')
    html_path = os.path.join('frontend', 'index.html')
    
    # Read logo and encode to base64
    if not os.path.exists(logo_path):
        print(f"Error: {logo_path} not found")
        return
        
    with open(logo_path, 'rb') as f:
        logo_data = base64.b64encode(f.read()).decode()
    
    # Read HTML
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Step 1: Replace logo.png with Data URI
    content = content.replace('src="logo.png"', f'src="data:image/png;base64,{logo_data}"')
    
    # Step 2: Remove FontAwesome icons inside the report to prevent canvas tainting
    # Replace icons with descriptive emojis or text
    content = content.replace('<i class="fas fa-volcano"></i>', '🌋')
    content = content.replace('<i class="fas fa-water"></i>', '🌊')
    content = content.replace('<i class="fas fa-cloud-showers-heavy"></i>', '🌧️')
    
    # Write back
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("HTML updated with Base64 logo and emoji fallback for icons.")

if __name__ == "__main__":
    fix_html()
