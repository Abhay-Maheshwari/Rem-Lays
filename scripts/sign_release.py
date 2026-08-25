import minisign
import os
import json
import base64

def sign_release():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    key_path = os.path.expanduser('~/.tauri/remlays.key')
    pub_path = os.path.expanduser('~/.tauri/remlays.key.pub')
    target_file = os.path.join(base_dir, 'website', 'downloads', 'Rem-Lays-Setup.exe')
    latest_json_path = os.path.join(base_dir, 'latest.json')
    
    with open(key_path, 'rb') as f:
        sec_raw = base64.b64decode(f.read().strip())

    with open(pub_path, 'rb') as f:
        pub_raw = base64.b64decode(f.read().strip())

    sk = minisign.SecretKey.from_bytes(sec_raw)
    if sk.is_encrypted():
        sk.decrypt('')

    pk = minisign.PublicKey.from_bytes(pub_raw)
    
    sig = sk.sign_file(target_file)
    sig_str = bytes(sig).decode('utf-8')
    
    # Verify signature
    pk.verify_file(target_file, sig)
    print("Verification: SUCCESSFUL!")
    
    # Save .sig file
    sig_file_path = target_file + '.sig'
    with open(sig_file_path, 'w', encoding='utf-8') as f:
        f.write(sig_str)
    print(f"Written signature to: {sig_file_path}")

    # Read latest.json
    with open(latest_json_path, 'r', encoding='utf-8') as f:
        latest_data = json.load(f)

    # Put signature into latest.json
    if "platforms" in latest_data:
        if "windows-x86_64" in latest_data["platforms"]:
            latest_data["platforms"]["windows-x86_64"]["signature"] = sig_str

    with open(latest_json_path, 'w', encoding='utf-8') as f:
        json.dump(latest_data, f, indent=2)

    print("Updated latest.json with verified signature!")

if __name__ == '__main__':
    sign_release()
