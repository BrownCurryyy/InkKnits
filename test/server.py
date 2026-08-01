from flask import Flask, request, jsonify
from ollama_compute import compute
import os
import time
import json

app = Flask(__name__, static_folder='.', static_url_path='')

CHILD_FILE = os.path.join(os.getcwd(), 'child_assets.json')
PARENT_FILE = os.path.join(os.getcwd(), 'parent_assets.json')

# Clear files on startup
for f in [CHILD_FILE, PARENT_FILE]:
    if os.path.exists(f):
        try:
            os.remove(f)
        except Exception:
            pass

@app.route('/')
def home():
    return app.send_static_file('index.html')

@app.route('/api/chat', methods=['POST'])
def api_chat():
    data = request.get_json(force=True)
    prompt = data.get('prompt', '').strip()
    model = data.get('model', 'gemma2:2b')
    mood = data.get('mood', 'Neutral')
    style = data.get('style', 'Narrative')
    explicit = bool(data.get('explicit', False))
    draft = data.get('draft', '').strip()
    action = data.get('action', '')
    content_length = data.get('content_length', '')
    audience = data.get('audience', '')

    if not prompt:
        return jsonify({'error': 'prompt is required'}), 400

    reply = compute(prompt, model=model, draft=draft, mood=mood, style=style, action=action, content_length=content_length, audience=audience, explicit=explicit)
    return jsonify({'reply': reply})


@app.route('/api/child', methods=['POST'])
def api_child():
    data = request.get_json(force=True)
    entry = {
        'id': f'child_{int(time.time()*1000)}',
        'parent_preview': (data.get('parent') or '')[:400],
        'selection': data.get('selection'),
        'generated': data.get('generated'),
        'action': data.get('action'),
        'mood': data.get('mood'),
        'style': data.get('style'),
        'audience': data.get('audience'),
        'length': data.get('length'),
        'timestamp': int(time.time())
    }
    try:
        arr = []
        if os.path.exists(CHILD_FILE):
            with open(CHILD_FILE, 'r', encoding='utf-8') as f:
                arr = json.load(f)
        arr.append(entry)
        with open(CHILD_FILE, 'w', encoding='utf-8') as f:
            json.dump(arr, f, ensure_ascii=False, indent=2)
        return jsonify({'id': entry['id']})
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500

@app.route('/api/atomize', methods=['POST'])
def api_atomize():
    data = request.get_json(force=True)
    parent = data.get('parent', '').strip()
    formats = data.get('formats', [])
    model = data.get('model', 'gemma2:2b')
    mood = data.get('mood', 'Neutral')
    style = data.get('style', 'Narrative')
    explicit = bool(data.get('explicit', False))
    audience = data.get('audience', '')
    length = data.get('length', '')

    if not parent or not formats:
        return jsonify({'error': 'parent content and formats are required'}), 400

    parent_id = f'parent_{int(time.time()*1000)}'
    
    # Save parent
    parent_entry = {
        'id': parent_id,
        'content': parent,
        'timestamp': int(time.time())
    }
    try:
        parr = []
        if os.path.exists(PARENT_FILE):
            with open(PARENT_FILE, 'r', encoding='utf-8') as f:
                parr = json.load(f)
        parr.append(parent_entry)
        with open(PARENT_FILE, 'w', encoding='utf-8') as f:
            json.dump(parr, f, ensure_ascii=False, indent=2)
    except Exception as exc:
        print('Error saving parent:', exc)

    results = []
    
    for fmt in formats:
        generated = compute(prompt=f'Generate a {fmt}', model=model, draft=parent, mood=mood, style=fmt, action='atomize_format', content_length=length, audience=audience, explicit=explicit)
        entry = {
            'id': f'child_{int(time.time()*1000)}_{fmt.replace(" ", "_").lower()}',
            'parent_id': parent_id,
            'asset_type': fmt,
            'preview': generated[:200] + '...' if len(generated) > 200 else generated,
            'generated': generated,
            'mood': mood,
            'style': style,
            'audience': audience,
            'length': length,
            'timestamp': int(time.time())
        }
        results.append(entry)

    try:
        arr = []
        if os.path.exists(CHILD_FILE):
            with open(CHILD_FILE, 'r', encoding='utf-8') as f:
                arr = json.load(f)
        arr.extend(results)
        with open(CHILD_FILE, 'w', encoding='utf-8') as f:
            json.dump(arr, f, ensure_ascii=False, indent=2)
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500

    return jsonify({'results': results, 'parent_id': parent_id})

@app.route('/api/child_assets', methods=['GET'])
def api_get_child_assets():
    try:
        if os.path.exists(CHILD_FILE):
            with open(CHILD_FILE, 'r', encoding='utf-8') as f:
                arr = json.load(f)
            return jsonify({'assets': arr})
        return jsonify({'assets': []})
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500

@app.route('/api/child_assets/<asset_id>', methods=['GET'])
def api_get_single_asset(asset_id):
    try:
        if os.path.exists(CHILD_FILE):
            with open(CHILD_FILE, 'r', encoding='utf-8') as f:
                arr = json.load(f)
            for asset in arr:
                if asset.get('id') == asset_id:
                    return jsonify({'asset': asset})
        return jsonify({'error': 'Asset not found'}), 404
    except Exception as exc:
        return jsonify({'error': str(exc)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
