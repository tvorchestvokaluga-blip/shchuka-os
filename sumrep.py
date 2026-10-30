import json
d = json.load(open('alfareport.json'))
print('login status:', d['login']['status'])
print('branch status:', d['branch']['status'], 'total:', d['branch'].get('json',{}).get('total'))
for k, v in d['entities'].items():
    sample = v.get('sample') or []
    fields = sorted(sample[0].keys()) if sample else []
    print(f"{k}: status={v['status']} total={v['total']} fields={fields}")
