// Диагностический скрипт: пробует залогиниться в AlfaCRM и прощупать основные
// эндпоинты v2api, чтобы понять реальную форму данных перед написанием
// скрипта переноса. Ничего не пишет и не меняет в AlfaCRM — только читает.
//
// Запуск на сервере (Node 18+, встроенный fetch):
//   node alfafetch.js <API_KEY>
//
// Email и хост захардкожены ниже (не секретны сами по себе).

const HOST = 'https://358.s20.online';
const EMAIL = 'hsh_40@mail.ru';

const apiKey = process.argv[2];
if (!apiKey) {
  console.error('Использование: node alfafetch.js <API_KEY>');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function raw(path, body) {
  const res = await fetch(HOST + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  let json = null;
  let text = null;
  try {
    text = await res.text();
    json = JSON.parse(text);
  } catch (e) {
    // не JSON
  }
  return { status: res.status, json, text: json ? null : (text || '').slice(0, 500) };
}

function truncate(obj, n = 3) {
  if (Array.isArray(obj)) return obj.slice(0, n);
  return obj;
}

async function main() {
  const report = {};

  console.log('== Шаг 1: логин ==');
  const login = await raw('/v2api/auth/login', { email: EMAIL, api_key: apiKey });
  report.login = login;
  console.log('Статус:', login.status);
  console.log(JSON.stringify(login.json || login.text, null, 2).slice(0, 2000));

  const token =
    login.json?.token ||
    login.json?.data?.token ||
    login.json?.access_token ||
    null;

  if (!token) {
    console.error('\nНЕ УДАЛОСЬ получить токен. Смотри ответ выше — возможно, неверный email или ключ.');
    await save(report);
    return;
  }
  console.log('\nТокен получен, длина:', token.length);

  async function call(path, body) {
    await sleep(250); // ~4 запроса/сек
    const res = await fetch(HOST + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ALFACRM-TOKEN': token,
      },
      body: JSON.stringify(body || { page: 0 }),
    });
    let json = null;
    let text = null;
    try {
      text = await res.text();
      json = JSON.parse(text);
    } catch (e) {}
    return { status: res.status, json, text: json ? null : (text || '').slice(0, 500) };
  }

  console.log('\n== Шаг 2: список филиалов (branch) ==');
  let branchResp = await call('/v2api/branch/index', { page: 0 });
  if (branchResp.status !== 200 || !branchResp.json) {
    console.log('branch/index без префикса не сработал, статус', branchResp.status, '— пробуем с branch_id=1');
    branchResp = await call('/v2api/1/branch/index', { page: 0 });
  }
  report.branch = branchResp;
  console.log('Статус:', branchResp.status);
  console.log(JSON.stringify(branchResp.json, null, 2)?.slice(0, 1500));

  let branchId = 1;
  const items = branchResp.json?.items || branchResp.json?.data || [];
  if (Array.isArray(items) && items.length && items[0].id) {
    branchId = items[0].id;
  }
  console.log('\nИспользуем branch_id =', branchId);

  const entities = ['customer', 'group', 'cgi', 'lesson', 'pay', 'tariff', 'customer-tariff', 'discount', 'location', 'room', 'branch'];
  report.entities = {};

  for (const entity of entities) {
    const path = `/v2api/${branchId}/${entity}/index`;
    console.log(`\n== ${entity} (${path}) ==`);
    const resp = await call(path, { page: 0 });
    const total = resp.json?.total ?? resp.json?.count ?? null;
    const arr = resp.json?.items || resp.json?.data || [];
    console.log('Статус:', resp.status, '| всего (по ответу API):', total, '| получено на странице:', Array.isArray(arr) ? arr.length : 'н/д');
    if (Array.isArray(arr) && arr.length) {
      console.log('Пример записи:', JSON.stringify(arr[0], null, 2).slice(0, 1500));
    } else if (resp.text) {
      console.log('Ответ не JSON (обрезано):', resp.text);
    } else if (resp.json) {
      console.log('Полный ответ (нет items/data):', JSON.stringify(resp.json, null, 2).slice(0, 1000));
    }
    report.entities[entity] = { status: resp.status, total, sample: truncate(arr, 2) };
  }

  await save(report);
  console.log('\nГотово. Полный отчёт сохранён в alfareport.json рядом со скриптом.');
}

async function save(report) {
  const fs = require('fs');
  fs.writeFileSync('alfareport.json', JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error('ОШИБКА:', e);
  process.exit(1);
});
