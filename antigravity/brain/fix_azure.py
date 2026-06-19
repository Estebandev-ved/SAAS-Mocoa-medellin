import os
import glob
import re

brain_dir = r"C:\Users\Lenovo\Desktop\Todas las carpetas\proyectos\Proyecto Personal\Bot NOMA\antigravity\brain"
files = glob.glob(os.path.join(brain_dir, "*.py")) + glob.glob(os.path.join(brain_dir, "agents", "*.py"))

for file_path in files:
    if "azure_client.py" in file_path or "fix_azure.py" in file_path:
        continue

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Apply changes if the file uses standard OpenAI
    if "from openai import OpenAI" in content or "client = OpenAI" in content:
        content = content.replace("from openai import OpenAI", "from brain.azure_client import get_azure_client, get_azure_model")
        
        # Replace client instantiations
        content = re.sub(r'client\s*=\s*OpenAI\([^)]*\)', 'client = get_azure_client()', content)
        content = re.sub(r'self\.client\s*=\s*OpenAI\([^)]*\)', 'self.client = get_azure_client()', content)
        
        # Replace models string with function call
        content = re.sub(r'model=["\']gpt-4o[^"\']*["\']', 'model=get_azure_model()', content)
        content = re.sub(r'model=["\']gpt-4[^"\']*["\']', 'model=get_azure_model()', content)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        print(f"Updated: {os.path.basename(file_path)}")
