// Диагностика формы данных AlfaCRM БЕЗ вывода персональных данных.
// Сохраняет вывод в shapeout.txt, чтобы можно было читать по частям.
//
// Запуск: node alfashape2.js <API_KEY>

const HOST = 'https://358.s20.online';
const EMAIL = 'hsh_kaluga@mail.ru';

const apiKey = process.argv[2];
if (!apiKey) {
  console.error('Использование: node alfashape2.js <API_KEY>');
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
  return { status: res.status, json, text: json ? null : (text || '').slice(0, 300) };
}

function shape(v) {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return `array(${v.length})`;
  if (typeof v === 'string') return `string(${v.length})`;
  return v;
}

function redacted(obj, sensitiveKeys) {
  const out = {};
  for (const k of Object.keys(obj)) {
    out[k] = sensitiveKeys.includes(k) ? shape(obj[k]) : obj[k];
  }
  return out;
}

const buf = [];
function log(s) {
  console.log(s);
  buf.push(s);
}

function show(label, obj) {
  log(`\n-- ${label} --`);
  log(JSON.stringify(obj, null, 2).slice(0, 2500));
}

const CUSTOMER_SENSITIVE = ['name', 'phone', 'email', 'web', 'addr', 'dob', 'note', 'legal_name'];
const PAY_SENSITIVE = ['payer_name', 'note'];
const GROUP_SENSITIVE = ['teachers', 'note'];
const LESSON_SENSITIVE = ['teachers', 'note', 'topic'];

async function main() {
  const login = await call('/v2api/auth/login', { email: EMAIL, api_key: apiKey });
  token = login.json?.token;
  if (!token) { console.error('no token', login); process.exit(1); }
  log('logged in');

  const subj = await call('/v2api/1/subject/index', { page: 0 });
  show('subject (программы)', subj.json);

  const cust = await call('/v2api/1/customer/index', { page: 0, count: 3 });
  const custSample = (cust.json?.items || []).slice(0, 2).map((c) => redacted(c, CUSTOMER_SENSITIVE));
  show('customer shape x2 (ПДн скрыты)', custSample);

  const studyStatus = await call('/v2api/1/study-status/index', { page: 0 });
  show('study-status (справочник)', studyStatus.json);

  const leadStatus = await call('/v2api/1/lead-status/index', { page: 0 });
  show('lead-status (справочник)', leadStatus.json);

  const allCust = await call('/v2api/1/customer/index', { page: 0, count: 100 });
  const items = allCust.json?.items || [];
  const studying = items.filter((c) => c.is_study);
  log(`\nTotal customers: ${items.length}, is_study=true: ${studying.length}`);
  const probe = studying[0] || items[0];
  if (probe) {
    log(`probe customer id: ${probe.id}`);
    const cgi = await call('/v2api/1/cgi/index', { page: 0, customer_id: probe.id });
    show('cgi for probe customer (участие в группах)', cgi.json);

    const ctariff = await call('/v2api/1/customer-tariff/index', { page: 0, customer_id: probe.id });
    show('customer-tariff for probe customer (абонементы)', ctariff.json);
  }

  const lesson = await call('/v2api/1/lesson/index', { page: 0, count: 2 });
  const lessonSample = (lesson.json?.items || []).map((l) => redacted(l, LESSON_SENSITIVE));
  show('lesson shape x2 (с details)', lessonSample);

  const pay = await call('/v2api/1/pay/index', { page: 0, count: 2 });
  const paySample = (pay.json?.items || []).map((p) => redacted(p, PAY_SENSITIVE));
  show('pay shape x2', paySample);

  const tariff = await call('/v2api/1/tariff/index', { page: 0, count: 3 });
  show('tariff sample x3', tariff.json?.items);

  const group = await call('/v2api/1/group/index', { page: 0, count: 3 });
  const groupSample = (group.json?.items || []).map((g) => redacted(g, GROUP_SENSITIVE));
  show('group shape x3', groupSample);

  log('\nDONE');
  require('fs').writeFileSync('shapeout.txt', buf.join('\n'));
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
