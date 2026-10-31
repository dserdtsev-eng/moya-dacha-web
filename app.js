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
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateStr(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
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
        alert('Ошибка загрузки данных: ' + e.message);
        document.getElementById('loading').innerHTML = `<p class="error">Ошибка загрузки базы данных.</p>`;
    }
}

// ─── ЭКРАН ВХОДА ───
function initLoginScreen() {
    const streetSelect = document.getElementById('street-select');
    const houseSelect = document.getElementById('house-select');
    const pwdInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    const rememberCb = document.getElementById('remember-me');

    const streets = new Set();
    Object.values(appData.plots).forEach(p => { if (p.street) streets.add(p.street); });

    streetSelect.innerHTML = '<option value=""></option>';
    Array.from(streets).sort().forEach(s => {
        streetSelect.innerHTML += `<option value="${s}">${s}</option>`;
    });

    // 1. Сначала назначаем обработчики
    streetSelect.onchange = () => {
        const selectedStreet = streetSelect.value;
        houseSelect.innerHTML = '<option value=""></option>';
        if (!selectedStreet) { checkForm(); return; }

        Object.entries(appData.plots).forEach(([id, p]) => {
            if (p.street === selectedStreet) {
                houseSelect.innerHTML += `<option value="${id}">${p.house}</option>`;
            }
        });
        checkForm();
    };

    houseSelect.onchange = checkForm;
    pwdInput.oninput = checkForm;

    function checkForm() {
        loginBtn.disabled = !(houseSelect.value && pwdInput.value.length === 4);
    }

    loginBtn.onclick = async () => {
        const plotId = houseSelect.value;
        const pwd = pwdInput.value;
        const errEl = document.getElementById('login-error');
        
        errEl.textContent = 'Проверка...';
        const plot = appData.plots[plotId];

        try {
            if (!plot.passport_hash || !plot.passport_salt) {
                errEl.textContent = 'Пароль для этого участка не задан';
                return;
            }
            const hash = await pbkdf2(pwd, plot.passport_salt);
            if (hash === plot.passport_hash) {
                if (rememberCb.checked) {
                    localStorage.setItem('snt_street', plot.street);
                    localStorage.setItem('snt_house', plotId);
                } else {
                    localStorage.removeItem('snt_street');
                    localStorage.removeItem('snt_house');
                }
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

    // 2. Только ТЕПЕРЬ восстанавливаем сохранённый выбор
    const savedStreet = localStorage.getItem('snt_street');
    const savedHouse = localStorage.getItem('snt_house');
    if (savedStreet) {
        streetSelect.value = savedStreet;
        // Вызываем onchange вручную, чтобы наполнить список домов
        if (typeof streetSelect.onchange === 'function') {
            streetSelect.onchange();
        }
        
        if (savedHouse) {
            houseSelect.value = savedHouse;
            checkForm();
        }
    }
}

// ─── ДАШБОРД ───
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function renderDashboard() {
    const plot = currentPlot.data;
    document.getElementById('user-name').textContent = plot.owner || 'Участок';
    document.getElementById('user-address').textContent = `${plot.street} ${plot.house}`;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTab(btn.dataset.tab);
            document.getElementById('tab-content').scrollTop = 0;
        };
    });
    renderTab('debts');
}

// ─── ЛОГИКА ДОЛГОВ ───
function addYearMinusDay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d)) return '';
    d.setFullYear(d.getFullYear() + 1);
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
    const fee = Number(s.member_fee || 0);
    if (!s.fee_start_date || fee <= 0) return 0;
    const paid = sumPaymentsInPeriod(plotId, isMemberPayment, 'current');
    return Math.max(0, fee - getMemberPromo(plot, 'current') - paid);
}

function getTargetDebt(plot, plotId) {
    const s = appData.settings;
    const fee = Number(s.target_fee || 0);
    if (!s.fee_start_date || fee <= 0) return 0;
    const paid = sumPaymentsInPeriod(plotId, isTargetPayment, 'current');
    return Math.max(0, fee - paid);
}

function getPrevMemberDebt(plot, plotId) {
    const s = appData.settings;
    const fee = Number(s.prev_member_fee || 0);
    if (fee <= 0 || !s.prev_fee_start_date) return 0;
    const paid = sumPaymentsInPeriod(plotId, isMemberPayment, 'prev');
    return Math.max(0, fee - getMemberPromo(plot, 'prev') - paid);
}

function getPrevTargetDebt(plot, plotId) {
    const s = appData.settings;
    const fee = Number(s.prev_target_fee || 0);
    if (fee <= 0 || !s.prev_fee_start_date) return 0;
    const paid = sumPaymentsInPeriod(plotId, isTargetPayment, 'prev');
    return Math.max(0, fee - paid);
}

// ─── ЭЛЕКТРИЧЕСТВО ───
function getLastReplacementDate(plot) {
    let latest = '';
    for (const r of (plot.meter_readings || [])) {
        if (r.replaced && r.date > latest) latest = r.date;
    }
    return latest;
}

function getElectricSummary(plot, plotId) {
    const tariffs = (appData.tariffs || []).slice().sort((a, b) => (a.date||'').localeCompare(b.date||''));
    const since = getLastReplacementDate(plot);
    
    let paidKwh = 0;
    let paidRub = 0;
    for (const p of (appData.payments || [])) {
        if (String(p.plot) !== String(plotId)) continue;
        if (!isElectricPayment(p.description)) continue;
        if (since && p.date < since) continue;
        
        let tPrice = 0;
        for (const t of tariffs) { if (t.date <= p.date) tPrice = t.price; }
        if (tPrice > 0) {
            paidKwh += Number(p.amount) / tPrice;
            paidRub += Number(p.amount);
        }
    }

    let consumedKwh = 0;
    const meters = plot.meters || [{id:1}];
    for (const m of meters) {
        const mid = String(m.id);
        const rwm = (plot.meter_readings || []).filter(r => r.values && r.values[mid] !== undefined).sort((a,b) => (a.date||'').localeCompare(b.date||''));
        
        let startIdx = 0;
        for (let i=0; i<rwm.length; i++) { if (rwm[i].replaced) startIdx = i; }
        
        let prev = null;
        for (let i=startIdx; i<rwm.length; i++) {
            const v = Number(rwm[i].values[mid]);
            if (prev !== null && !rwm[i].replaced && v > prev) {
                consumedKwh += (v - prev);
            }
            prev = v;
        }
    }
    return { paidKwh, consumedKwh, paidRub, balance: paidKwh - consumedKwh, lastReplacement: since };
}

// ─── QR-КОД ───
function buildPaymentQR(amount, purpose) {
    const req = appData.settings.requisites || {};
    if (!req.personal_acc || !req.bic) return null;
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
    
    if (!qrString) {
        container.innerHTML = '<p class="error" style="text-align:center;">Реквизиты СНТ не заполнены в базе.</p>';
        return;
    }
    if (typeof QRCode === 'undefined') {
        container.innerHTML = '<p class="error" style="text-align:center;">Библиотека QR не загрузилась. Проверьте интернет.</p>';
        return;
    }
    
    try {
        new QRCode(container, { 
            text: qrString, 
            width: 200, 
            height: 200, 
            correctLevel: QRCode.CorrectLevel.M 
        });
    } catch (e) {
        container.innerHTML = `<p class="error" style="text-align:center;">Ошибка генерации: ${e.message}</p>`;
    }
}

// ─── РЕНДЕР ВКЛАДОК ───
function renderTab(tab) {
    const content = document.getElementById('tab-content');
    const plotId = currentPlot.id;
    const plot = currentPlot.data;

    if (tab === 'debts') {
        const memberDebt = getMemberDebt(plot, plotId);
        const targetDebt = getTargetDebt(plot, plotId);
        const prevMemberDebt = getPrevMemberDebt(plot, plotId);
        const prevTargetDebt = getPrevTargetDebt(plot, plotId);
        
        const totalCurrent = memberDebt + targetDebt;
        const totalPrev = prevMemberDebt + prevTargetDebt;
        const totalAll = totalCurrent + totalPrev;

        let html = '<h3>Задолженности</h3>';

        if (totalAll === 0) {
            html += '<div class="card card-blue"><span style="font-size:24px; margin-right:10px;">✓</span> Задолженностей по взносам нет</div>';
        } else {
            html += '<div class="card">';
            if (totalPrev > 0) {
                html += `<div class="row"><span>Прошлый период</span><span>${formatMoney(totalPrev)}</span></div>`;
            }
            if (totalCurrent > 0) {
                html += `<div class="row"><span>Текущий период</span><span>${formatMoney(totalCurrent)}</span></div>`;
            }
            html += `<div class="row total" style="border-top: 1px solid #ccc; padding-top:10px;"><span>Итого</span><span>${formatMoney(totalAll)}</span></div>`;
            html += '</div>';
        }
        content.innerHTML = html;
    }
    else if (tab === 'payments') {
        const payments = (appData.payments || [])
            .filter(p => String(p.plot) === String(plotId))
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        
        let html = '<h3>История платежей</h3>';
        if (payments.length === 0) {
            html += '<p>Платежей пока нет</p>';
        } else {
            payments.forEach(p => {
                let per = '';
                const period = paymentPeriod(p);
                if (period === 'prev') per = 'прошлый период';
                if (period === 'current') per = 'текущий период';
                
                html += `
                    <div class="card" style="padding: 15px;">
                        <div style="font-size: 18px; margin-bottom: 5px;">${formatDateStr(p.date)}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="color:var(--text-light);">${p.description || ''}<br><small>${per}</small></div>
                            <span style="font-size: 20px; font-weight: bold; color: var(--primary);">${formatMoney(Number(p.amount)||0)}</span>
                        </div>
                    </div>
                `;
            });
        }
        content.innerHTML = html;
    }
    else if (tab === 'readings') {
        const readings = (plot.meter_readings || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const meters = plot.meters || [{ id: 1, name: 'Счётчик' }];
        
        let html = '<h3>Показания счётчиков</h3>';
        if (readings.length === 0) {
            html += '<p>Показаний пока нет</p>';
        } else {
            readings.forEach(r => {
                const vals = meters.map(m => r.values && r.values[m.id] !== undefined ? `${m.name}: ${r.values[m.id]}` : '').filter(Boolean).join(' / ');
                html += `
                    <div class="card" style="padding: 15px;">
                        <div style="font-size: 18px; margin-bottom: 5px;">${formatDateStr(r.date)}</div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--text-light);">${vals}</span>
                        </div>
                    </div>
                `;
            });
        }
        content.innerHTML = html;
    }
    else if (tab === 'deadlines') {
        const s = appData.settings;
        content.innerHTML = `
            <h3>Сроки оплаты</h3>
            <div class="card">
                <div class="card-title">Годовой членский взнос</div>
                <div class="row"><span>Сумма:</span><span>${formatMoney(s.member_fee || 0)}</span></div>
                <div class="row"><span>Срок:</span><span>${formatDateStr(s.member_deadline)}</span></div>
            </div>
            <div class="card">
                <div class="card-title">Годовой целевой взнос</div>
                <div class="row"><span>Сумма:</span><span>${formatMoney(s.target_fee || 0)}</span></div>
                <div class="row"><span>Срок:</span><span>${formatDateStr(s.target_deadline)}</span></div>
            </div>
            <div class="card">
                <div class="card-title">Электроэнергия</div>
                <div class="row"><span>Срок:</span><span>до ${s.electric_day || 20} числа</span></div>
            </div>
            <h3 style="margin-top:20px;">Период взносов</h3>
            <div class="card">
                <div class="row"><span>Начало:</span><span>${formatDateStr(s.fee_start_date)}</span></div>
                <div class="row"><span>Конец:</span><span>${formatDateStr(addYearMinusDay(s.fee_start_date))}</span></div>
            </div>
        `;
    }
    else if (tab === 'electric') {
        const summary = getElectricSummary(plot, plotId);
        let html = '<h3>Электричество</h3>';
        
        if (summary.lastReplacement) {
            html += `<p style="margin-bottom:15px; font-size:16px;">Период: с ${formatDateStr(summary.lastReplacement)} (после замены счётчика)</p>`;
        }

        html += '<div class="card">';
        html += '<div class="card-title">Баланс</div>';
        html += `<div class="row"><span>Оплачено, кВт·ч</span><span>${summary.paidKwh.toFixed(2)}</span></div>`;
        html += `<div class="row"><span>Израсходовано, кВт·ч</span><span>${summary.consumedKwh.toFixed(2)}</span></div>`;
        html += `<div class="row total" style="border-top: 1px solid #ccc; padding-top:10px;"><span>Итог</span><span>${summary.balance.toFixed(2)}</span></div>`;
        html += '</div>';

        const electricPayments = (appData.payments || [])
            .filter(p => String(p.plot) === String(plotId) && isElectricPayment(p.description))
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            
        if (electricPayments.length > 0) {
            html += '<h3 style="margin-top:20px;">Оплаченные кВт·ч</h3>';
            const tariffs = (appData.tariffs || []).slice().sort((a, b) => (a.date||'').localeCompare(b.date||''));
            
            electricPayments.forEach(p => {
                let tPrice = 0;
                for (const t of tariffs) { if (t.date <= p.date) tPrice = t.price; }
                const kwh = tPrice > 0 ? (Number(p.amount) / tPrice) : 0;
                
                html += `
                    <div class="card" style="padding: 15px; margin-bottom: 10px;">
                        <div style="font-size: 18px; margin-bottom: 5px;">${formatDateStr(p.date)}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="color:var(--text-light); font-size: 14px;">
                                ${formatMoney(Number(p.amount)||0)} ÷ ${tPrice.toFixed(2)} ₽/кВт·ч
                            </div>
                            <span style="font-size: 20px; font-weight: bold;">${kwh.toFixed(0)}</span>
                        </div>
                    </div>
                `;
            });
        }
        content.innerHTML = html;
    }
    else if (tab === 'qr') {
        const s = appData.settings;
        const memberDebt = getMemberDebt(plot, plotId);
        const targetDebt = getTargetDebt(plot, plotId);
        const prevMemberDebt = getPrevMemberDebt(plot, plotId);
        const prevTargetDebt = getPrevTargetDebt(plot, plotId);
        const totalVznosy = memberDebt + targetDebt + prevMemberDebt + prevTargetDebt;

        let html = '<h3>Оплата по QR-коду</h3>';

        // Взносы
        html += '<div class="card">';
        html += '<div class="card-title">Взносы</div>';
        if (totalVznosy > 0) {
            html += `<div class="row"><span>Сумма к оплате</span><span>${formatMoney(totalVznosy)}</span></div>`;
            html += `<div id="qr-vznosy" style="text-align:center; margin-top:15px;"></div>`;
            html += `<p style="text-align:center; font-size:12px; color:#777; margin-top:10px;">Отсканируйте в приложении банка</p>`;
        } else {
            html += `<div class="row" style="color:var(--success); font-weight:bold; justify-content:center;">Задолженностей нет</div>`;
        }
        html += '</div>';

        // Электричество
        html += '<div class="card" style="margin-top: 20px;">';
        html += '<div class="card-title">Электричество</div>';
        
        const tariffs = (appData.tariffs || []).slice().sort((a, b) => (a.date||'').localeCompare(b.date||''));
        let currentTariff = null;
        const today = todayStr();
        for (const t of tariffs) { if (t.date <= today) currentTariff = t; }
        const tariffPrice = currentTariff ? Number(currentTariff.price) : 0;

        if (tariffPrice <= 0) {
            html += '<p class="error">Тариф не задан. Обратитесь к председателю.</p>';
        } else {
            html += `<div class="row" style="color:var(--text-light); margin-bottom:10px;"><span>Тариф</span><span>${tariffPrice.toFixed(2)} ₽/кВт·ч</span></div>`;
            
            const meters = plot.meters || [{ id: 1, name: 'Счётчик' }];
            const readings = plot.meter_readings || [];
            
            meters.forEach(m => {
                const mid = String(m.id);
                const mReadings = readings.filter(r => r.values && r.values[mid] !== undefined).sort((a,b) => (a.date||'').localeCompare(b.date||''));
                let startIdx = 0;
                for (let i=0; i<mReadings.length; i++) { if (mReadings[i].replaced) startIdx = i; }
                const relevant = mReadings.slice(startIdx);
                const last = relevant[relevant.length - 1];
                const prevVal = last ? Number(last.values[mid]) : 0;

                html += `<div style="margin-top: 15px; padding-top:15px; border-top: 1px dashed #ccc;">`;
                html += `<div class="row"><span>Предыдущее (${m.name})</span><span>${prevVal}</span></div>`;
                html += `<input type="number" class="input-large" id="qr-new-reading-${mid}" placeholder="Новое показание">`;
                html += `<button class="btn-calc" onclick="calcElectricQR('${mid}', ${prevVal}, ${tariffPrice})">Рассчитать</button>`;
                html += `<div id="qr-elec-result-${mid}" style="margin-top:10px;"></div>`;
                html += `<div id="qr-elec-code-${mid}" style="text-align:center; margin-top:15px;"></div>`;
                html += `</div>`;
            });
        }
        html += '</div>';

        content.innerHTML = html;

        if (totalVznosy > 0) {
            const purpose = `${plot.street} ${plot.house}, взносы`;
            renderQR('qr-vznosy', buildPaymentQR(totalVznosy, purpose));
        }
    }
}

// Функция для расчета и рендера QR на вкладке "QR"
window.calcElectricQR = function(mid, prevVal, tariffPrice) {
    const input = document.getElementById(`qr-new-reading-${mid}`);
    const val = parseFloat(input.value);
    const resultDiv = document.getElementById(`qr-elec-result-${mid}`);
    const qrDiv = document.getElementById(`qr-elec-code-${mid}`);
    
    if (isNaN(val) || val < 0) {
        resultDiv.innerHTML = '<p class="error">Введите корректное показание</p>';
        qrDiv.innerHTML = '';
        return;
    }
    if (val < prevVal) {
        resultDiv.innerHTML = `<p class="error">Введите показание больше предыдущего (${prevVal})</p>`;
        qrDiv.innerHTML = '';
        return;
    }
    
    const delta = val - prevVal;
    const amount = delta * tariffPrice;
    
    resultDiv.innerHTML = `
        <div class="row"><span>Расход</span><span>${delta.toFixed(2)} кВт·ч</span></div>
        <div class="row total" style="color:var(--primary);"><span>Сумма к оплате</span><span>${formatMoney(amount)}</span></div>
    `;
    
    if (amount > 0) {
        const plot = currentPlot.data;
        const meterObj = (plot.meters || []).find(x => String(x.id) === String(mid));
        const mName = meterObj ? meterObj.name : 'электричество';
        const purpose = `${plot.street} ${plot.house}, электроэнергия (${mName})`;
        renderQR(`qr-elec-code-${mid}`, buildPaymentQR(amount, purpose));
    } else {
        qrDiv.innerHTML = '';
    }
};

// ─── ДЕЙСТВИЯ В ШАПКЕ ───
document.getElementById('logout-btn').onclick = () => {
    currentPlot = null;
    document.getElementById('password-input').value = '';
    document.getElementById('login-error').textContent = '';
    showScreen('login-screen');
};

document.getElementById('refresh-btn').onclick = () => {
    loadData();
};

document.getElementById('info-btn').onclick = () => {
    if (!currentPlot) return;
    const s = appData.settings;
    let info = `Владелец: ${currentPlot.data.owner}\n`;
    info += `Телефон: ${currentPlot.data.phone || '—'}\n`;
    info += `Проживание: ${currentPlot.data.residence || '—'}\n\n`;
    info += `Реквизиты СНТ:\n`;
    if (s.requisites) {
        info += `Получатель: ${s.requisites.name}\n`;
        info += `Счёт: ${s.requisites.personal_acc}\n`;
        info += `Банк: ${s.requisites.bank_name}\n`;
        info += `БИК: ${s.requisites.bic}\n`;
        info += `Корр. счёт: ${s.requisites.corresp_acc}\n`;
        info += `ИНН: ${s.requisites.inn}\n`;
        info += `КПП: ${s.requisites.kpp}\n`;
    }
    alert(info);
};

// ─── СТАРТ ───
loadData();
