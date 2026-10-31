// ⚠️ УКАЖИ ЗДЕСЬ СВОЙ РЕПОЗИТОРИЙ
const GITHUB_USER = 'dserdtsev-eng';
const GITHUB_REPO = 'moya-dacha-web';
const JSON_FILE = 'snt_data.json';

let appData = null;
let currentPlot = null;

// ─── УТИЛИТЫ ───
async function pbkdf2(password, saltBase64) {
    const enc = new TextEncoder();
    const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), {name: 'PBKDF2'}, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({
        name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256'
    }, keyMaterial, 256);
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

function formatMoney(amount) {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' ₽';
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

// ─── ЗАГРУЗКА ДАННЫХ ───
async function loadData() {
    try {
        const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/${JSON_FILE}?t=${Date.now()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Не удалось скачать базу');
        appData = await response.json();
        initLoginScreen();
        showScreen('login-screen');
    } catch (e) {
        alert('Ошибка загрузки данных: ' + e.message + '\nПроверьте, что snt_data.json загружен на GitHub.');
    }
}

// ─── ЭКРАН ВХОДА ───
function initLoginScreen() {
    const streetSelect = document.getElementById('street-select');
    const houseSelect = document.getElementById('house-select');

    const streets = new Set();
    Object.values(appData.plots).forEach(p => { if (p.street) streets.add(p.street); });

    streetSelect.innerHTML = '<option value="">Выберите улицу</option>';
    Array.from(streets).sort().forEach(s => {
        streetSelect.innerHTML += `<option value="${s}">${s}</option>`;
    });

    streetSelect.onchange = () => {
        const selectedStreet = streetSelect.value;
        houseSelect.innerHTML = '<option value="">Выберите дом</option>';
        if (!selectedStreet) return;
        Object.entries(appData.plots).forEach(([id, p]) => {
            if (p.street === selectedStreet) {
                houseSelect.innerHTML += `<option value="${id}">${p.house}</option>`;
            }
        });
    };

    document.getElementById('login-btn').onclick = async () => {
        const plotId = houseSelect.value;
        const pwd = document.getElementById('password-input').value;
        const errEl = document.getElementById('login-error');
        if (!plotId || pwd.length !== 4) {
            errEl.textContent = 'Выберите участок и введите 4 цифры';
            return;
        }
        errEl.textContent = 'Проверка...';
        const plot = appData.plots[plotId];
        try {
            if (!plot.passport_hash || !plot.passport_salt) {
                errEl.textContent = 'Пароль для этого участка не задан';
                return;
            }
            const hash = await pbkdf2(pwd, plot.passport_salt);
            if (hash === plot.passport_hash) {
                currentPlot = { id: plotId, data: plot };
                showScreen('dashboard-screen');
                renderDashboard();
            } else {
                errEl.textContent = 'Неверный пароль';
            }
        } catch (e) {
            errEl.textContent = 'Ошибка проверки пароля';
        }
    };
}

// ─── ДАШБОРД ───
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function renderDashboard() {
    const plot = currentPlot.data;
    document.getElementById('user-title').textContent = `${plot.owner || 'Участок'} (${plot.street} ${plot.house})`;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTab(btn.dataset.tab);
        };
    });
    renderTab('debts');
}

// ─── ЛОГИКА РАСЧЁТА ДОЛГОВ ───
function addYearMinusDay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return '';
    d.setFullYear(d.getFullYear() + 1);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

function paymentPeriod(payment) {
    const explicit = (payment.period || '').trim().toLowerCase();
    if (explicit === 'prev' || explicit === 'current') return explicit;

    const s = appData.settings;
    const pd = payment.date;
    if (!pd) return null;

    const curStart = s.fee_start_date || '';
    const prevStart = s.prev_fee_start_date || '';

    if (curStart) {
        const curEnd = addYearMinusDay(curStart);
        if (pd >= curStart && pd <= curEnd) return 'current';
    }
    if (prevStart) {
        const prevEnd = addYearMinusDay(prevStart);
        if (pd >= prevStart && pd <= prevEnd) return 'prev';
    }
    // Fallback: платёж до curStart при наличии prev_start → прошлый
    if (curStart && pd < curStart) return 'prev';
    if (!curStart) return 'current';
    return null;
}

function isMemberPayment(desc) { return (desc || '').toLowerCase().includes('членск'); }
function isTargetPayment(desc) { return (desc || '').toLowerCase().includes('целев'); }
function isElectricPayment(desc) { return (desc || '').toLowerCase().includes('электр'); }

function sumPaymentsInPeriod(plotId, predicate, period) {
    let total = 0;
    for (const p of (appData.payments || [])) {
        if (String(p.plot) !== String(plotId)) continue;
        if (!predicate(p.description || '')) continue;
        if (paymentPeriod(p) === period) total += Number(p.amount) || 0;
    }
    return total;
}

function getMemberPromo(plot, period) {
    if (period === 'prev') return Number(plot.member_promo_prev || 0);
    return Number(plot.member_promo || 0);
}

function getMemberDebt(plot, plotId) {
    const s = appData.settings;
    const memberFee = Number(s.member_fee || 0);
    if (!s.fee_start_date || memberFee <= 0) return 0;
    const paid = sumPaymentsInPeriod(plotId, isMemberPayment, 'current');
    const promo = getMemberPromo(plot, 'current');
    return Math.max(0, memberFee - promo - paid);
}

function getTargetDebt(plot, plotId) {
    const s = appData.settings;
    const targetFee = Number(s.target_fee || 0);
    if (!s.fee_start_date || targetFee <= 0) return 0;
    const paid = sumPaymentsInPeriod(plotId, isTargetPayment, 'current');
    return Math.max(0, targetFee - paid);
}

function getPrevMemberDebt(plot, plotId) {
    const s = appData.settings;
    const prevFee = Number(s.prev_member_fee || 0);
    if (prevFee <= 0 || !s.prev_fee_start_date) return 0;
    const paid = sumPaymentsInPeriod(plotId, isMemberPayment, 'prev');
    const promo = getMemberPromo(plot, 'prev');
    return Math.max(0, prevFee - promo - paid);
}

function getPrevTargetDebt(plot, plotId) {
    const s = appData.settings;
    const prevFee = Number(s.prev_target_fee || 0);
    if (prevFee <= 0 || !s.prev_fee_start_date) return 0;
    const paid = sumPaymentsInPeriod(plotId, isTargetPayment, 'prev');
    return Math.max(0, prevFee - paid);
}

// ─── QR-КОД ───
function buildPaymentQR(plot, amount, purpose) {
    const req = appData.settings.requisites || {};
    return [
        'ST00012',
        'Name=' + (req.name || 'СНТ НАДЕЖДА'),
        'PersonalAcc=' + (req.personal_acc || ''),
        'BankName=' + (req.bank_name || ''),
        'BIC=' + (req.bic || ''),
        'CorrespAcc=' + (req.corresp_acc || ''),
        'PayeeINN=' + (req.inn || ''),
        'KPP=' + (req.kpp || ''),
        'Sum=' + Math.round(amount * 100),
        'Purpose=' + purpose
    ].join('|');
}

function renderQR(containerId, qrString) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (typeof QRCode === 'undefined') {
        container.innerHTML = '<p class="error">Библиотека QR не загрузилась</p>';
        return;
    }
    new QRCode(container, { text: qrString, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
}

// ─── РЕНДЕР ВКЛАДОК ───
function renderTab(tab) {
    const content = document.getElementById('tab-content');
    const plotId = currentPlot.id;
    const plot = currentPlot.data;
    const settings = appData.settings;

    if (tab === 'debts') {
        const s = settings;
        const memberFee = Number(s.member_fee || 0);
        const targetFee = Number(s.target_fee || 0);
        const prevMemberFee = Number(s.prev_member_fee || 0);
        const prevTargetFee = Number(s.prev_target_fee || 0);

        const paidMemberCur = sumPaymentsInPeriod(plotId, isMemberPayment, 'current');
        const paidTargetCur = sumPaymentsInPeriod(plotId, isTargetPayment, 'current');
        const paidMemberPrev = sumPaymentsInPeriod(plotId, isMemberPayment, 'prev');
        const paidTargetPrev = sumPaymentsInPeriod(plotId, isTargetPayment, 'prev');

        const promoCur = getMemberPromo(plot, 'current');
        const promoPrev = getMemberPromo(plot, 'prev');

        const memberDebt = getMemberDebt(plot, plotId);
        const targetDebt = getTargetDebt(plot, plotId);
        const prevMemberDebt = getPrevMemberDebt(plot, plotId);
        const prevTargetDebt = getPrevTargetDebt(plot, plotId);
        const totalCurrent = memberDebt + targetDebt;
        const totalPrev = prevMemberDebt + prevTargetDebt;
        const totalAll = totalCurrent + totalPrev;

        let html = '<div class="card"><h3>Текущий период</h3>';

        // Членские: начислено − премия − оплачено = долг
        if (memberFee > 0) {
            html += `<div class="row"><span>Членский взнос (начислено)</span><span>${formatMoney(memberFee)}</span></div>`;
            if (promoCur > 0) {
                html += `<div class="row"><span>🎁 Премия</span><span>−${formatMoney(promoCur)}</span></div>`;
            }
            if (paidMemberCur > 0) {
                html += `<div class="row"><span>Оплачено (членские)</span><span>−${formatMoney(paidMemberCur)}</span></div>`;
            }
            html += `<div class="row total"><span>Долг по членским</span><span>${formatMoney(memberDebt)}</span></div>`;
        }

        // Целевые
        if (targetFee > 0) {
            html += `<div class="row" style="margin-top:8px;"><span>Целевой взнос (начислено)</span><span>${formatMoney(targetFee)}</span></div>`;
            if (paidTargetCur > 0) {
                html += `<div class="row"><span>Оплачено (целевые)</span><span>−${formatMoney(paidTargetCur)}</span></div>`;
            }
            html += `<div class="row total"><span>Долг по целевым</span><span>${formatMoney(targetDebt)}</span></div>`;
        }

        html += `<div class="row total" style="border-top:2px solid #2e7d32;"><span>Итого за текущий</span><span>${formatMoney(totalCurrent)}</span></div>`;
        html += '</div>';

        // Прошлый период
        if (prevMemberFee > 0 || prevTargetFee > 0) {
            html += '<div class="card"><h3>Прошлый период</h3>';
            if (prevMemberFee > 0) {
                html += `<div class="row"><span>Членский (начислено)</span><span>${formatMoney(prevMemberFee)}</span></div>`;
                if (promoPrev > 0) {
                    html += `<div class="row"><span>🎁 Премия (прошлый)</span><span>−${formatMoney(promoPrev)}</span></div>`;
                }
                if (paidMemberPrev > 0) {
                    html += `<div class="row"><span>Оплачено (членские)</span><span>−${formatMoney(paidMemberPrev)}</span></div>`;
                }
                html += `<div class="row total"><span>Долг по членским (прошлый)</span><span>${formatMoney(prevMemberDebt)}</span></div>`;
            }
            if (prevTargetFee > 0) {
                html += `<div class="row" style="margin-top:8px;"><span>Целевой (начислено)</span><span>${formatMoney(prevTargetFee)}</span></div>`;
                if (paidTargetPrev > 0) {
                    html += `<div class="row"><span>Оплачено (целевые)</span><span>−${formatMoney(paidTargetPrev)}</span></div>`;
                }
                html += `<div class="row total"><span>Долг по целевым (прошлый)</span><span>${formatMoney(prevTargetDebt)}</span></div>`;
            }
            html += `<div class="row total" style="border-top:2px solid #2e7d32;"><span>Итого за прошлый</span><span>${formatMoney(totalPrev)}</span></div>`;
            html += '</div>';
        }

        if (totalAll === 0) {
            html += '<div class="card success">✅ Задолженности нет</div>';
        } else {
            html += `<div class="card"><div class="row total"><span>Всего к оплате</span><span>${formatMoney(totalAll)}</span></div></div>`;
            html += '<div class="card" style="text-align:center;"><h3>QR для оплаты взносов</h3><div id="debt-qr"></div><p class="hint">Отсканируйте в приложении банка. Сумма и реквизиты подставятся автоматически.</p></div>';
        }

        content.innerHTML = html;
        if (totalAll > 0) {
            const purpose = `${plot.street} ${plot.house}, взносы`;
            renderQR('debt-qr', buildPaymentQR(plot, totalAll, purpose));
        }
    }
    else if (tab === 'payments') {
        const payments = (appData.payments || [])
            .filter(p => String(p.plot) === String(plotId))
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        let html = '<div class="card"><h3>История платежей</h3>';
        if (payments.length === 0) {
            html += '<p>Платежей пока нет</p>';
        } else {
            payments.forEach(p => {
                html += `<div class="row"><div style="text-align:left;"><div>${p.date || ''}</div><small style="color:#777;">${p.description || ''}</small></div><span>${formatMoney(Number(p.amount) || 0)}</span></div>`;
            });
        }
        html += '</div>';
        content.innerHTML = html;
    }
    else if (tab === 'readings') {
        const readings = (plot.meter_readings || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const meters = plot.meters || [{ id: 1, name: 'Счётчик' }];
        let html = '<div class="card"><h3>Показания счётчиков</h3>';
        if (readings.length === 0) {
            html += '<p>Показаний пока нет</p>';
        } else {
            readings.forEach(r => {
                const vals = meters.map(m => r.values && r.values[m.id] !== undefined ? `${m.name}: ${r.values[m.id]}` : '').filter(Boolean).join(' / ');
                html += `<div class="row"><span>${r.date || ''}</span><span>${vals || '—'}</span></div>`;
            });
        }
        html += '</div>';
        content.innerHTML = html;
    }
    else if (tab === 'deadlines') {
        const feeStart = settings.fee_start_date || '—';
        const feeEnd = feeStart !== '—' ? addYearMinusDay(feeStart) : '—';
        content.innerHTML = `
            <div class="card">
                <h3>Сроки оплаты</h3>
                <div class="row"><span>Период взносов</span><span>${feeStart} — ${feeEnd}</span></div>
                <div class="row"><span>Членские взносы</span><span>до ${settings.member_deadline || '—'}</span></div>
                <div class="row"><span>Целевые взносы</span><span>до ${settings.target_deadline || '—'}</span></div>
                <div class="row"><span>Электроэнергия</span><span>до ${settings.electric_day || '—'} числа</span></div>
            </div>
            <div class="card">
                <h3>Реквизиты СНТ</h3>
                <div class="row"><span>Получатель</span><span>${(settings.requisites || {}).name || '—'}</span></div>
                <div class="row"><span>Расчётный счёт</span><span>${(settings.requisites || {}).personal_acc || '—'}</span></div>
                <div class="row"><span>Банк</span><span>${(settings.requisites || {}).bank_name || '—'}</span></div>
                <div class="row"><span>БИК</span><span>${(settings.requisites || {}).bic || '—'}</span></div>
                <div class="row"><span>Корр. счёт</span><span>${(settings.requisites || {}).corresp_acc || '—'}</span></div>
                <div class="row"><span>ИНН</span><span>${(settings.requisites || {}).inn || '—'}</span></div>
                <div class="row"><span>КПП</span><span>${(settings.requisites || {}).kpp || '—'}</span></div>
            </div>
        `;
    }
    else if (tab === 'electric') {
        renderElectricTab(plot, plotId, content);
    }
}

// ─── ВКЛАДКА «ЭЛЕКТРО» ───
function renderElectricTab(plot, plotId, content) {
    const meters = plot.meters || [{ id: 1, name: 'Счётчик' }];
    const readings = (plot.meter_readings || []).slice();
    const tariffs = (appData.tariffs || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const lastRepl = getLastReplacementDate(plot);

    const today = todayStr();
    let currentTariff = null;
    for (const t of tariffs) {
        if (t.date && t.date <= today) currentTariff = t;
    }
    const tariffPrice = currentTariff ? Number(currentTariff.price) : 0;

    const meterData = meters.map(m => {
        const mid = String(m.id);
        const mReadings = readings
            .filter(r => r.values && r.values[mid] !== undefined)
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        let startIdx = 0;
        for (let i = 0; i < mReadings.length; i++) {
            if (mReadings[i].replaced) startIdx = i;
        }
        const relevant = mReadings.slice(startIdx);
        const last = relevant[relevant.length - 1] || null;
        const prev = relevant.length >= 2 ? relevant[relevant.length - 2] : null;
        return { meter: m, lastReading: last, prevReading: prev };
    });

    let html = '';

    if (!currentTariff) {
        html += '<div class="warning">⚠ Тариф на электроэнергию не задан. Обратитесь к председателю.</div>';
    }

    html += '<div class="card"><h3>⚡ Расчёт оплаты электричества</h3>';
    html += `<div class="row"><span>Тариф на сегодня</span><span>${tariffPrice > 0 ? tariffPrice.toFixed(2) + ' ₽/кВт·ч' : '—'}</span></div>`;
    if (currentTariff && currentTariff.date) {
        html += `<div class="row"><span>Действует с</span><span>${currentTariff.date}</span></div>`;
    }
    if (lastRepl) {
        html += `<div class="row"><span>Последняя замена счётчика</span><span>${lastRepl}</span></div>`;
    }
    html += '</div>';

    meterData.forEach(md => {
        const mid = md.meter.id;
        const prevVal = md.lastReading ? Number(md.lastReading.values[String(mid)]) : 0;
        const prevDate = md.lastReading ? md.lastReading.date : '—';

        html += `<div class="card" data-meter-id="${mid}">`;
        html += `<h3>${md.meter.name}</h3>`;
        html += `<div class="row"><span>Предыдущее показание</span><span>${md.lastReading ? prevVal : '—'}</span></div>`;
        html += `<div class="row"><span>Дата предыдущего</span><span>${prevDate}</span></div>`;
        html += `<div class="form-group" style="margin-top:10px;">
            <label>Новое показание</label>
            <input type="number" id="new-reading-${mid}" step="1" min="0" placeholder="Введите текущее показание">
        </div>`;
        html += `<button class="calc-meter-btn" data-meter-id="${mid}" data-prev="${prevVal}">Рассчитать</button>`;
        html += `<div id="result-${mid}" style="margin-top:10px;"></div>`;
        html += `<div id="qr-${mid}" class="qr-container" style="margin-top:10px;"></div>`;
        html += '</div>';
    });

    html += `<div class="card" style="text-align:center;">
        <h3>Итого по всем счётчикам</h3>
        <div class="row total"><span>Сумма</span><span id="electric-total">0,00 ₽</span></div>
        <div id="qr-total" class="qr-container" style="margin-top:15px;"></div>
        <p class="hint">Введите показания по всем счётчикам и нажмите «Рассчитать» — появится общий QR на оплату.</p>
    </div>`;

    content.innerHTML = html;

    const totals = {};

    document.querySelectorAll('.calc-meter-btn').forEach(btn => {
        btn.onclick = () => {
            const mid = btn.dataset.meterId;
            const prev = parseFloat(btn.dataset.prev) || 0;
            const input = document.getElementById(`new-reading-${mid}`);
            const resultDiv = document.getElementById(`result-${mid}`);
            const qrDiv = document.getElementById(`qr-${mid}`);
            const val = parseFloat(input.value);

            // Проверка: пусто, отрицательное, не число
            if (isNaN(val) || val < 0) {
                resultDiv.innerHTML = '<p class="error">Введите корректное показание</p>';
                qrDiv.innerHTML = '';
                delete totals[mid];
                updateTotal();
                return;
            }
            // Проверка: меньше предыдущего
            if (val < prev) {
                resultDiv.innerHTML = `<p class="error">Показание не может быть меньше предыдущего (${prev})</p>`;
                qrDiv.innerHTML = '';
                delete totals[mid];
                updateTotal();
                return;
            }
            if (tariffPrice <= 0) {
                resultDiv.innerHTML = '<p class="error">Тариф не задан</p>';
                return;
            }

            const delta = val - prev;
            const amount = delta * tariffPrice;
            totals[mid] = { delta, amount, value: val };

            resultDiv.innerHTML = `
                <div class="row"><span>Расход</span><span>${delta.toFixed(2)} кВт·ч</span></div>
                <div class="row"><span>К оплате</span><span>${formatMoney(amount)}</span></div>
            `;

            if (amount > 0) {
                const meterName = md.meter ? '' : '';
                // Ищем имя счётчика по mid
                const meterObj = meters.find(x => String(x.id) === String(mid));
                const mName = meterObj ? meterObj.name : 'счётчик';
                const purpose = `${plot.street} ${plot.house}, электроэнергия (${mName})`;
                renderQR(`qr-${mid}`, buildPaymentQR(plot, amount, purpose));
            } else {
                qrDiv.innerHTML = '';
            }

            updateTotal();
        };
    });

    function updateTotal() {
        let sum = 0;
        Object.values(totals).forEach(t => { sum += t.amount; });

        document.getElementById('electric-total').textContent = formatMoney(sum);

        const qrTotalDiv = document.getElementById('qr-total');
        if (sum > 0) {
            const purpose = `${plot.street} ${plot.house}, электроэнергия`;
            renderQR('qr-total', buildPaymentQR(plot, sum, purpose));
        } else {
            qrTotalDiv.innerHTML = '';
        }
    }
}

// ─── ВСПОМОГАТЕЛЬНЫЕ ───
function getLastReplacementDate(plot) {
    const readings = plot.meter_readings || [];
    let latest = '';
    for (const r of readings) {
        if (!r.replaced) continue;
        const d = r.date || '';
        if (d > latest) latest = d;
    }
    return latest;
}

// ─── ВЫХОД ───
document.getElementById('logout-btn').onclick = () => {
    currentPlot = null;
    document.getElementById('password-input').value = '';
    document.getElementById('login-error').textContent = '';
    showScreen('login-screen');
};

// ─── СТАРТ ───
loadData();
