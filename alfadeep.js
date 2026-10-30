const HOST = 'https://358.s20.online';
const EMAIL = 'hsh_kaluga@mail.ru';

const apiKey = process.argv[2];
if (!apiKey) {
  console.error('Использование: node alfadeep.js <API_KEY>');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let token = null;

async function call(path, body) {
  await sleep(260);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['X-ALFACRM-TOKEN'] = token;
  const res = await fetch(HOST + path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
  });
  let json = null;
  let text = null;
  try {
    text = await res.text();
    json = JSON.parse(text);
  } catch (e) {}
  return { status: res.status, json, text: json ? null : (text || '').slice(0, 500) };
}

function show(label, obj) {
  console.log(`\n-- ${label} --`);
  console.log(JSON.stringify(obj, null, 2).slice(0, 3000));
}

async function main() {
  const login = await call('/v2api/auth/login', { email: EMAIL, api_key: apiKey });
  token = login.json?.token;
  if (!token) { console.error('no token', login); process.exit(1); }
  console.log('logged in');

  const subj = await call('/v2api/1/subject/index', { page: 0 });
  show('subject (программы/направления)', subj.json);

  const cust = await call('/v2api/1/customer/index', { page: 0, count: 5 });
  show('customer sample x2', (cust.json?.items || []).slice(0, 2));

  const studyStatus = await call('/v2api/1/study-status/index', { page: 0 });
  show('study-status', studyStatus.json);

  const leadStatus = await call('/v2api/1/lead-status/index', { page: 0 });
  show('lead-status', leadStatus.json);

  const allCust = await call('/v2api/1/customer/index', { page: 0, count: 100 });
  const items = allCust.json?.items || [];
  const studying = items.filter((c) => c.is_study);
  console.log(`\nTotal customers: ${items.length}, is_study=true: ${studying.length}`);
  const probe = studying[0] || items[0];
  if (probe) {
    console.log('probe customer id:', probe.id, 'name:', probe.name);
    const cgi = await call('/v2api/1/cgi/index', { page: 0, customer_id: probe.id });
    show('cgi for probe customer', cgi.json);

    const ctariff = await call('/v2api/1/customer-tariff/index', { page: 0, customer_id: probe.id });
    show('customer-tariff for probe customer', ctariff.json);
  }

  const lesson = await call('/v2api/1/lesson/index', { page: 0, count: 2 });
  show('lesson sample x2 (full, with details)', lesson.json?.items);

  const pay = await call('/v2api/1/pay/index', { page: 0, count: 2 });
  show('pay sample x2', pay.json?.items);

  const tariff = await call('/v2api/1/tariff/index', { page: 0, count: 3 });
  show('tariff sample x3', tariff.json?.items);

  const group = await call('/v2api/1/group/index', { page: 0, count: 3 });
  show('group sample x3', group.json?.items);

  console.log('\nDONE');
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
