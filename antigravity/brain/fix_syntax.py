import os
import glob
import re

brain_dir = r"C:\Users\Lenovo\Desktop\Todas las carpetas\proyectos\Proyecto Personal\Bot NOMA\antigravity\brain"
files = glob.glob(os.path.join(brain_dir, "*.py")) + glob.glob(os.path.join(brain_dir, "agents", "*.py"))

for file_path in files:
    if "azure_client.py" in file_path or "fix_azure.py" in file_path or "fix_syntax.py" in file_path:
        continue

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if "get_azure_client())" in content:
        content = content.replace("get_azure_client())", "get_azure_client()")
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        print(f"Fixed syntax in: {os.path.basename(file_path)}")
