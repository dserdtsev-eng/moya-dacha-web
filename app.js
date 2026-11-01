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
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateRu(dateStr) {
    if (!dateStr || dateStr === '—') return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return dateStr;
}

// ─── ЗАГРУЗКА ДАННЫХ ───
async function loadData(isRefresh = false) {
    if (!isRefresh) showScreen('loading');
    try {
        const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/${JSON_FILE}?t=${Date.now()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Не удалось скачать базу');
        appData = await response.json();
        
        if (isRefresh && currentPlot) {
            // Обновляем данные текущего участка без выхода на экран логина
            currentPlot.data = appData.plots[currentPlot.id];
            document.querySelectorAll('.tab-btn').forEach(btn => {
                if (btn.classList.contains('active')) {
                    renderTab(btn.dataset.tab);
                }
            });
            // Короткое уведомление об обновлении
            const toast = document.createElement('div');
            toast.textContent = 'Данные обновлены';
            toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--primary);color:white;padding:10px 20px;border-radius:20px;z-index:1000;';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        } else {
            initLoginScreen();
            showScreen('login-screen');
            
            const savedPlotId = localStorage.getItem('snt_plot_id');
            if (savedPlotId && appData.plots[savedPlotId]) {
                document.getElementById('street-select').value = appData.plots[savedPlotId].street;
                document.getElementById('street-select').dispatchEvent(new Event('change'));
                document.getElementById('house-select').value = savedPlotId;
            }
        }
    } catch (e) {
        if (!isRefresh) alert('Ошибка загрузки данных: ' + e.message);
        else alert('Не удалось обновить данные: ' + e.message);
    }
}

// ─── ЭКРАН ВХОДА ───
function initLoginScreen() {
    const streetSelect = document.getElementById('street-select');
    const houseSelect = document.getElementById('house-select');
    const pwdInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');

    const streets = new Set();
    Object.values(appData.plots).forEach(p => { if(p.street) streets.add(p.street); });

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
        checkLoginReady();
    };

    houseSelect.onchange = checkLoginReady;
    pwdInput.oninput = checkLoginReady;

    function checkLoginReady() {
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
                currentPlot = { id: plotId, data: plot };
                if (document.getElementById('remember-me').checked) {
                    localStorage.setItem('snt_plot_id', plotId);
                } else {
                    localStorage.removeItem('snt_plot_id');
                }
                errEl.textContent = '';
                pwdInput.value = '';
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
    document.getElementById('user-name').textContent = plot.owner || 'Участок';
    document.getElementById('user-address').textContent = `${plot.street} ${plot.house}`;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTab(btn.dataset.tab);
        };
    });

    renderTab('debts');
}

// ─── ЛОГИКА РАСЧЁТА ───
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
    if (curStart && pd >= curStart && pd <= addYearMinusDay(curStart)) return 'current';
    if (prevStart && pd >= prevStart && pd <= addYearMinusDay(prevStart)) return 'prev';
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

function getMemberDebt(plot, plotId) {
    const s = appData.settings;
    const fee = Number(s.member_fee || 0);
    if (!s.fee_start_date || fee <= 0) return 0;
    const paid = sumPaymentsInPeriod(plotId, isMemberPayment, 'current');
    return Math.max(0, fee - Number(plot.member_promo || 0) - paid);
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
    return Math.max(0, fee - Number(plot.member_promo_prev || 0) - paid);
}
function getPrevTargetDebt(plot, plotId) {
    const s = appData.settings;
    const fee = Number(s.prev_target_fee || 0);
    if (fee <= 0 || !s.prev_fee_start_date) return 0;
    const paid = sumPaymentsInPeriod(plotId, isTargetPayment, 'prev');
    return Math.max(0, fee - paid);
}

function getTotalDebt(plot, plotId) {
    return getMemberDebt(plot, plotId) + getTargetDebt(plot, plotId) + getPrevMemberDebt(plot, plotId) + getPrevTargetDebt(plot, plotId);
}

// ─── ЛОГИКА ЭЛЕКТРИЧЕСТВА ───
function getLastReplacementDate(plot) {
    let latest = '';
    for (const r of (plot.meter_readings || [])) {
        if (r.replaced && (r.date || '') > latest) latest = r.date;
    }
    return latest;
}

function getElectricSummary(plot) {
    const readings = plot.meter_readings || [];
    const lastRepl = getLastReplacementDate(plot);
    
    const relevantReadings = readings.filter(r => !lastRepl || (r.date || '') >= lastRepl).sort((a,b) => (a.date||'').localeCompare(b.date||''));
    const lastReading = relevantReadings[relevantReadings.length - 1];
    const lastVal = lastReading ? Number(lastReading.values["1"] || 0) : 0;

    let consumed = 0;
    for (let i = 1; i < relevantReadings.length; i++) {
        if (!relevantReadings[i].replaced) {
            const v1 = Number(relevantReadings[i-1].values["1"] || 0);
            const v2 = Number(relevantReadings[i].values["1"] || 0);
            if (v2 > v1) consumed += (v2 - v1);
        }
    }

    let paidKwh = 0;
    const tariffs = (appData.tariffs || []).sort((a,b) => (a.date||'').localeCompare(b.date||''));
    for (const p of (appData.payments || [])) {
        if (String(p.plot) !== String(plot.id) || !isElectricPayment(p.description)) continue;
        if (lastRepl && p.date < lastRepl) continue;
        
        let tPrice = 0;
        for (const t of tariffs) { if (t.date <= p.date) tPrice = t.price; }
        if (tPrice > 0) paidKwh += (Number(p.amount) / tPrice);
    }
    
    return { lastVal, consumed, paidKwh, balance: paidKwh - consumed };
}
// ─── РЕНДЕР ВКЛАДОК ───
function renderTab(tab) {
    const content = document.getElementById('tab-content');
    const plotId = currentPlot.id;
    const plot = currentPlot.data;
    const settings = appData.settings;

    if (tab === 'debts') {
        const totalDebt = getTotalDebt(plot, plotId);

        let html = '<h3>Задолженности</h3>';
        if (totalDebt === 0) {
            html += '<div class="card card-blue" style="text-align:center; font-size:18px; font-weight:bold; padding:30px 20px;">✓ Задолженностей по взносам нет</div>';
        } else {
            html += `<div class="card card-blue">
                <div style="font-size: 18px; margin-bottom: 10px;">Общая сумма долга</div>
                <div style="font-size: 32px; font-weight: bold; color: var(--primary);">${formatMoney(totalDebt)}</div>
            </div>`;
            html += `<div class="card">
                <div class="row"><span>За текущий период</span><span>${formatMoney(getMemberDebt(plot, plotId) + getTargetDebt(plot, plotId))}</span></div>
                <div class="row"><span>За прошлый период</span><span>${formatMoney(getPrevMemberDebt(plot, plotId) + getPrevTargetDebt(plot, plotId))}</span></div>
            </div>`;
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
                let periodText = p.period === 'prev' ? 'прошлый период' : (p.period === 'current' ? 'текущий период' : '');
                html += `
                    <div class="card">
                        <div style="font-size: 16px; color: var(--text-light); margin-bottom: 5px;">${formatDateRu(p.date)}</div>
                        <div class="row" style="padding:0;">
                            <span style="font-size: 18px;">${p.description || 'Платёж'}</span>
                            <span style="font-size: 20px; color: var(--primary);">${formatMoney(Number(p.amount))}</span>
                        </div>
                        ${periodText ? `<div style="font-size: 14px; color: var(--text-light); margin-top: 5px;">${periodText}</div>` : ''}
                    </div>
                `;
            });
        }
        content.innerHTML = html;
    }

    else if (tab === 'readings') {
        const readings = (plot.meter_readings || [])
            .slice()
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        let html = '<h3>Показания счётчиков</h3>';
        if (readings.length === 0) {
            html += '<p>Показаний пока нет</p>';
        } else {
            readings.forEach(r => {
                const val = r.values && r.values["1"] !== undefined ? r.values["1"] : '—';
                html += `
                    <div class="card">
                        <div style="font-size: 16px; color: var(--text-light); margin-bottom: 5px;">${formatDateRu(r.date)}</div>
                        <div class="row" style="padding:0;">
                            <span style="font-size: 18px;">Счётчик</span>
                            <span style="font-size: 20px; font-weight: bold;">${val}</span>
                        </div>
                    </div>
                `;
            });
        }
        content.innerHTML = html;
    }

    else if (tab === 'electric') {
        const summary = getElectricSummary({ ...plot, id: plotId });
        const lastRepl = getLastReplacementDate(plot);

        let html = '<h3>Электричество</h3>';
        html += `<div style="color: var(--text-light); margin-bottom: 15px;">Период: с ${lastRepl ? formatDateRu(lastRepl) : 'начала'} (после замены счётчика)</div>`;

        html += `<div class="card">
            <h4 style="font-size: 18px; margin-bottom: 15px;">Баланс</h4>
            <div class="row"><span>Оплачено, кВт·ч</span><span>${summary.paidKwh.toFixed(1)}</span></div>
            <div class="row"><span>Израсходовано, кВт·ч</span><span>${summary.consumed.toFixed(1)}</span></div>
            <div class="row total" style="border-top: 1px solid var(--border); padding-top: 10px; margin-top: 10px;">
                <span>Итог</span><span style="color: ${summary.balance < 0 ? 'var(--error)' : 'var(--success)'}">${summary.balance.toFixed(1)}</span>
            </div>
        </div>`;

        html += `<h4 style="font-size: 18px; margin-top: 25px; margin-bottom: 15px;">Оплаченные кВт·ч</h4>`;
        const tariffs = (appData.tariffs || []).sort((a,b) => (a.date||'').localeCompare(b.date||''));
        const ePayments = (appData.payments || []).filter(p => String(p.plot) === String(plotId) && isElectricPayment(p.description)).sort((a,b) => b.date.localeCompare(a.date));
        
        if (ePayments.length === 0) {
            html += '<p>Платежей за электричество нет</p>';
        } else {
            ePayments.forEach(p => {
                let tPrice = 0;
                for (const t of tariffs) { if (t.date <= p.date) tPrice = t.price; }
                const kwh = tPrice > 0 ? (p.amount / tPrice).toFixed(0) : '—';
                html += `<div class="card">
                    <div style="font-size: 16px; color: var(--text-light); margin-bottom: 5px;">${formatDateRu(p.date)}</div>
                    <div class="row" style="padding:0;">
                        <div style="font-size: 14px; color: var(--text-light);">${formatMoney(p.amount)} ÷ ${Number(tPrice).toFixed(2)} ₽/кВт·ч</div>
                        <span style="font-size: 20px; font-weight: bold;">${kwh}</span>
                    </div>
                </div>`;
            });
        }
        content.innerHTML = html;
    }

    else if (tab === 'qr') {
        renderQRTab(plot, plotId, content);
    }

    else if (tab === 'deadlines') {
        const feeStart = settings.fee_start_date || '—';
        const feeEnd = feeStart !== '—' ? addYearMinusDay(feeStart) : '—';
        
        let html = '<h3>Сроки оплаты</h3>';
        
        if (Number(settings.member_fee) > 0) {
            html += `<div class="card">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Годовой членский взнос</div>
                <div class="row" style="padding: 5px 0;"><span>Сумма:</span><span>${formatMoney(settings.member_fee)}</span></div>
                <div class="row" style="padding: 5px 0;"><span>Срок:</span><span>${formatDateRu(settings.member_deadline) || 'не указан'}</span></div>
            </div>`;
        }
        
        if (Number(settings.target_fee) > 0) {
            html += `<div class="card">
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Годовой целевой взнос</div>
                <div class="row" style="padding: 5px 0;"><span>Сумма:</span><span>${formatMoney(settings.target_fee)}</span></div>
                <div class="row" style="padding: 5px 0;"><span>Срок:</span><span>${formatDateRu(settings.target_deadline) || 'не указан'}</span></div>
            </div>`;
        }

        html += `<div class="card">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Электроэнергия</div>
            <div class="row" style="padding: 5px 0;"><span>Срок:</span><span>до ${settings.electric_day} числа каждого месяца</span></div>
        </div>`;

        html += `<div class="card">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Период взносов</div>
            <div class="row" style="padding: 5px 0;"><span>С:</span><span>${formatDateRu(feeStart)}</span></div>
            <div class="row" style="padding: 5px 0;"><span>По:</span><span>${formatDateRu(feeEnd)}</span></div>
        </div>`;

        content.innerHTML = html;
    }
}

// ─── ВКЛАДКА «QR» ───
function renderQRTab(plot, plotId, content) {
    let totalDebt = getTotalDebt(plot, plotId);
    const summary = getElectricSummary({ ...plot, id: plotId });

    let html = `
        <div class="card">
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">Участок: ${plot.street} ${plot.house}</div>
            <div style="font-size: 18px; color: var(--text-light);">Владелец: ${plot.owner || '—'}</div>
        </div>
        
        <h3 style="margin-top: 10px;">За что платим?</h3>
        
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <button id="qr-btn-vznos" class="btn-pill" style="flex: 1; background: var(--primary); color: white;">Взносы</button>
            <button id="qr-btn-electro" class="btn-pill" style="flex: 1; background: white; color: var(--text); border: 1px solid var(--border);">Электро</button>
        </div>

        <div id="qr-content-area"></div>
    `;
    content.innerHTML = html;

    const btnVznos = document.getElementById('qr-btn-vznos');
    const btnElectro = document.getElementById('qr-btn-electro');
    const area = document.getElementById('qr-content-area');

    function setActiveTab(isVznos) {
        if (isVznos) {
            btnVznos.style.background = 'var(--primary)';
            btnVznos.style.color = 'white';
            btnVznos.style.border = 'none';
            btnElectro.style.background = 'white';
            btnElectro.style.color = 'var(--text)';
            btnElectro.style.border = '1px solid var(--border)';
            renderQRVznos(area, plot, totalDebt);
        } else {
            btnElectro.style.background = 'var(--primary)';
            btnElectro.style.color = 'white';
            btnElectro.style.border = 'none';
            btnVznos.style.background = 'white';
            btnVznos.style.color = 'var(--text)';
            btnVznos.style.border = '1px solid var(--border)';
            renderQRElectro(area, plot, summary);
        }
    }

    btnVznos.onclick = () => setActiveTab(true);
    btnElectro.onclick = () => setActiveTab(false);

    setActiveTab(true);
}

// ─── РЕНДЕР QR ДЛЯ ВЗНОСОВ ───
function renderQRVznos(area, plot, totalDebt) {
    if (totalDebt <= 0) {
        area.innerHTML = `
            <div class="card card-blue" style="text-align: center; font-size: 20px; padding: 30px 20px;">
                Сумма к оплате<br><br>
                <span style="font-size: 32px; font-weight: bold;">0,00 ₽</span>
            </div>
            <div class="card" style="text-align: center; font-size: 18px; color: var(--text-light); padding: 30px 20px;">
                Нет задолженности по взносам
            </div>
        `;
        return;
    }

    area.innerHTML = `
        <div class="card card-blue" style="text-align: center; padding: 20px;">
            <div style="font-size: 18px;">Сумма к оплате</div>
            <div style="font-size: 36px; font-weight: bold; color: var(--primary); margin-top: 10px;">${formatMoney(totalDebt)}</div>
        </div>
        <div style="text-align: center; margin-top: 20px;" id="qr-wrapper">
            <h4 style="font-size: 20px; margin-bottom: 15px;">QR-код для оплаты</h4>
            <div id="qr-target" style="display: flex; justify-content: center; margin-bottom: 15px; background: white; padding: 15px; border-radius: 12px; min-height: 240px;"></div>
            <p style="color: var(--text-light); font-size: 16px; margin-bottom: 20px;">Откройте приложение банка →<br>«Оплата по QR» → наведите камеру</p>
            <button id="save-qr-btn" class="btn-pill" style="background: var(--primary); color: white; margin-bottom: 10px;">💾 Сохранить QR в галерею</button>
        </div>
    `;

    const purpose = `${plot.street} ${plot.house}, взносы`;
    const qrData = buildPaymentQR(plot, totalDebt, purpose);
    
    setTimeout(() => {
        const qrTarget = document.getElementById('qr-target');
        if (qrTarget) {
            qrTarget.innerHTML = '';
            const qr = qrcode(0, 'M');
            qr.addData(qrData);
            qr.make();
            qrTarget.innerHTML = qr.createImgTag(5, 5);
            const img = qrTarget.querySelector('img');
            if (img) { img.style.width = '240px'; img.style.height = '240px'; img.style.display = 'block'; }
            document.getElementById('save-qr-btn').onclick = () => saveQRToGallery('qr-target');
        }
    }, 100);
}

// ─── РЕНДЕР QR ДЛЯ ЭЛЕКТРО ───
function renderQRElectro(area, plot, summary) {
    const today = todayStr();
    let currentTariff = 0;
    for (const t of (appData.tariffs || [])) { if (t.date <= today) currentTariff = t.price; }
    
    area.innerHTML = `
        <div class="card">
            <div style="font-size: 18px; margin-bottom: 15px;">Текущее показание счётчика:</div>
            <input type="number" id="qr-electro-input" class="input-large" placeholder="Показание" value="${summary.lastVal || ''}">
            <div class="row" style="margin-top: 15px;"><span>Предыдущее: ${summary.lastVal}</span></div>
            <div class="row"><span>Расход: <span id="qr-delta">0</span> кВт·ч</span></div>
            <div class="row"><span>Тариф: ${Number(currentTariff).toFixed(2)} ₽/кВт·ч</span></div>
        </div>
        
        <div class="card card-blue" style="text-align: center; padding: 20px;">
            <div style="font-size: 18px;">Сумма к оплате</div>
            <div id="qr-electro-sum" style="font-size: 36px; font-weight: bold; color: var(--primary); margin-top: 10px;">0,00 ₽</div>
            <div id="qr-electro-err" style="color: var(--error); font-size: 16px; margin-top: 10px; display: none;">Введите показание больше предыдущего</div>
        </div>
        
        <div id="qr-electro-block" style="text-align: center; margin-top: 20px; display: none;">
            <h4 style="font-size: 20px; margin-bottom: 15px;">QR-код для оплаты</h4>
            <div id="qr-target" style="display: flex; justify-content: center; margin-bottom: 15px; background: white; padding: 15px; border-radius: 12px; min-height: 240px;"></div>
            <p style="color: var(--text-light); font-size: 16px; margin-bottom: 20px;">Откройте приложение банка →<br>«Оплата по QR» → наведите камеру</p>
            <button id="save-qr-btn" class="btn-pill" style="background: var(--primary); color: white; margin-bottom: 10px;">💾 Сохранить QR в галерею</button>
        </div>
    `;

    const input = document.getElementById('qr-electro-input');
    const deltaSpan = document.getElementById('qr-delta');
    const sumDiv = document.getElementById('qr-electro-sum');
    const errDiv = document.getElementById('qr-electro-err');
    const qrBlock = document.getElementById('qr-electro-block');

    input.oninput = () => {
        const val = parseFloat(input.value);
        const prev = summary.lastVal;
        
        if (isNaN(val) || val <= prev) {
            deltaSpan.textContent = '0';
            sumDiv.textContent = '0,00 ₽';
            errDiv.style.display = val > 0 ? 'block' : 'none';
            qrBlock.style.display = 'none';
            return;
        }

        errDiv.style.display = 'none';
        const delta = val - prev;
        const sum = delta * currentTariff;
        
        deltaSpan.textContent = delta.toFixed(1);
        sumDiv.textContent = formatMoney(sum);
        qrBlock.style.display = 'block';

        const purpose = `${plot.street} ${plot.house}, электроэнергия, показание: ${val}`;
        const qrData = buildPaymentQR(plot, sum, purpose);

        setTimeout(() => {
            const qrTarget = document.getElementById('qr-target');
            if (qrTarget) {
                qrTarget.innerHTML = '';
                const qr = qrcode(0, 'M');
                qr.addData(qrData);
                qr.make();
                qrTarget.innerHTML = qr.createImgTag(5, 5);
                const img = qrTarget.querySelector('img');
                if (img) { img.style.width = '240px'; img.style.height = '240px'; img.style.display = 'block'; }
                document.getElementById('save-qr-btn').onclick = () => saveQRToGallery('qr-target');
            }
        }, 100);
    };
}

// ─── ГЕНЕРАЦИЯ И СОХРАНЕНИЕ QR ───
function buildPaymentQR(plot, amount, purpose) {
    const req = appData.settings.requisites || {};
    
    // Принудительное кодирование строки в Windows-1251 (байты)
    const toWin1251 = (str) => {
        if (!str) return '';
        const win1251Map = {
            'А':0xC0,'Б':0xC1,'В':0xC2,'Г':0xC3,'Д':0xC4,'Е':0xC5,'Ё':0xA8,'Ж':0xC6,'З':0xC7,'И':0xC8,'Й':0xC9,'К':0xCA,'Л':0xCB,'М':0xCC,'Н':0xCD,'О':0xCE,'П':0xCF,'Р':0xD0,'С':0xD1,'Т':0xD2,'У':0xD3,'Ф':0xD4,'Х':0xD5,'Ц':0xD6,'Ч':0xD7,'Ш':0xD8,'Щ':0xD9,'Ъ':0xDA,'Ы':0xDB,'Ь':0xDC,'Э':0xDD,'Ю':0xDE,'Я':0xDF,
            'а':0xE0,'б':0xE1,'в':0xE2,'г':0xE3,'д':0xE4,'е':0xE5,'ё':0xB8,'ж':0xE6,'з':0xE7,'и':0xE8,'й':0xE9,'к':0xEA,'л':0xEB,'м':0xEC,'н':0xED,'о':0xEE,'п':0xEF,'р':0xF0,'с':0xF1,'т':0xF2,'у':0xF3,'ф':0xF4,'х':0xF5,'ц':0xF6,'ч':0xF7,'ш':0xF8,'щ':0xF9,'ъ':0xFA,'ы':0xFB,'ь':0xFC,'э':0xFD,'ю':0xFE,'я':0xFF
        };
        let result = '';
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const code = win1251Map[char];
            if (code !== undefined) {
                // Превращаем код в символ (байт), который библиотека закодирует как есть
                result += String.fromCharCode(code);
            } else {
                result += char; // Цифры и латиница остаются
            }
        }
        return result;
    };

    const clean = (str) => String(str || '').replace(/\|/g, ' ').replace(/=/g, ' ').trim();

    // ВАЖНО: Используем ST00011 (версия с Windows-1251) вместо ST00012 (UTF-8)
    return [
        'ST00011',
        'Name=' + toWin1251(clean(req.name || 'СНТ НАДЕЖДА')),
        'PersonalAcc=' + clean(req.personal_acc),
        'BankName=' + toWin1251(clean(req.bank_name)),
        'BIC=' + clean(req.bic),
        'CorrespAcc=' + clean(req.corr_acc || req.corr_acc),
        'PayeeINN=' + clean(req.inn),
        'KPP=' + clean(req.kpp),
        'Sum=' + Math.round(amount * 100),
        'Purpose=' + toWin1251(clean(purpose))
    ].join('|');
}

function saveQRToGallery(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Ищем картинку внутри контейнера
    const img = container.querySelector('img');
    if (!img || !img.src) {
        alert('QR-код ещё не сгенерирован. Подождите секунду.');
        return;
    }

    // Создаем ссылку для скачивания прямо из data:image (без fetch)
    const a = document.createElement('a');
    a.href = img.src;
    const street = currentPlot.data.street ? currentPlot.data.street.replace(/\s+/g, '_') : 'Участок';
    const house = currentPlot.data.house ? currentPlot.data.house.replace(/\s+/g, '_') : '';
    a.download = `QR_${street}_${house}.png`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ─── ОБРАБОТЧИКИ ШАПКИ ───
document.getElementById('logout-btn').onclick = () => {
    currentPlot = null;
    document.getElementById('password-input').value = '';
    document.getElementById('login-error').textContent = '';
    showScreen('login-screen');
};

document.getElementById('refresh-btn').onclick = () => {
    loadData(true); // true = обновить без выхода на экран логина
};

document.getElementById('info-btn').onclick = () => {
    alert(`Моя дача — СНТ «Надежда»\n\n` + 
          `Веб-версия личного кабинета садовода.\n\n` +
          `Вкладки «Долги», «Платежи» и «Показания» показывают данные из базы СНТ.\n\n` +
          `Вкладка «Электро» отображает баланс кВт·ч.\n\n` +
          `Вкладка «QR» позволяет рассчитать сумму и сформировать QR-код для оплаты взносов или электроэнергии через приложение банка.\n\n` +
          `Если у вас возникли вопросы, обратитесь к председателю СНТ.`);
};

// ─── СТАРТ ───
loadData();
