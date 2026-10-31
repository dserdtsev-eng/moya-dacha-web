// ⚠️ УКАЖИ ЗДЕСЬ СВОЙ РЕПОЗИТОРИЙ
const GITHUB_USER = 'dserdtsev-eng';
const GITHUB_REPO = 'moya-dacha-web';
const JSON_FILE = 'snt_data.json'; // файл будет лежать в корне репозитория

let appData = null;
let currentPlot = null;

// --- УТИЛИТЫ ---
async function sha256(text) {
    const msg = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', msg);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

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

// --- ЗАГРУЗКА ДАННЫХ ---
async function loadData() {
    try {
        // Добавляем ?t=... чтобы обойти кэш GitHub
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

// --- ЭКРАН ВХОДА ---
function initLoginScreen() {
    const streetSelect = document.getElementById('street-select');
    const houseSelect = document.getElementById('house-select');
    
    // Собираем уникальные улицы
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

// --- ДАШБОРД ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function renderDashboard() {
    const plot = currentPlot.data;
    document.getElementById('user-title').textContent = `${plot.owner || 'Участок'} (${plot.street} ${plot.house})`;
    
    // Переключение вкладок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTab(btn.dataset.tab);
        };
    });
    
    renderTab('debts');
}

function renderTab(tab) {
    const content = document.getElementById('tab-content');
    const plotId = currentPlot.id;
    const plot = currentPlot.data;
    const settings = appData.settings;

    if (tab === 'debts') {
        // Упрощенный расчет (для полной точности нужен полный порт логики из Python)
        const memberFee = settings.member_fee || 0;
        const targetFee = settings.target_fee || 0;
        const promo = plot.member_promo || 0;
        
        // Считаем оплаты текущего периода
        let paidMember = 0, paidTarget = 0;
        appData.payments.forEach(p => {
            if (p.plot === plotId && p.period === 'current') {
                if (p.description && p.description.toLowerCase().includes('членск')) paidMember += p.amount;
                if (p.description && p.description.toLowerCase().includes('целев')) paidTarget += p.amount;
            }
        });

        const debtMember = Math.max(0, memberFee - promo - paidMember);
        const debtTarget = Math.max(0, targetFee - paidTarget);
        const total = debtMember + debtTarget;

        content.innerHTML = `
            <div class="card">
                <h3>Текущий период</h3>
                <div class="row"><span>Членские взносы</span><span>${formatMoney(debtMember)}</span></div>
                <div class="row"><span>Целевые взносы</span><span>${formatMoney(debtTarget)}</span></div>
                <div class="row total"><span>Итого к оплате</span><span>${formatMoney(total)}</span></div>
            </div>
            ${total === 0 ? '<div class="card success">✅ Задолженности нет</div>' : ''}
        `;
    } 
    else if (tab === 'payments') {
        const payments = appData.payments.filter(p => p.plot === plotId).sort((a,b) => b.date.localeCompare(a.date));
        let html = '<div class="card"><h3>История платежей</h3>';
        if (payments.length === 0) html += '<p>Платежей пока нет</p>';
        payments.forEach(p => {
            html += `
                <div class="row">
                    <div>
                        <div>${p.date}</div>
                        <small style="color:#777">${p.description || ''}</small>
                    </div>
                    <span>${formatMoney(p.amount)}</span>
                </div>
            `;
        });
        html += '</div>';
        content.innerHTML = html;
    }
    else if (tab === 'readings') {
        const readings = (plot.meter_readings || []).sort((a,b) => b.date.localeCompare(a.date));
        let html = '<div class="card"><h3>Показания счётчиков</h3>';
        if (readings.length === 0) html += '<p>Показаний пока нет</p>';
        readings.forEach(r => {
            html += `<div class="row"><span>${r.date}</span><span>${Object.values(r.values).join(' / ')}</span></div>`;
        });
        html += '</div>';
        content.innerHTML = html;
    }
    else if (tab === 'electric') {
        content.innerHTML = `<div class="card"><h3>⚡ Электричество</h3>
            <p>Расчет баланса кВт·ч доступен в полной версии.</p>
            <p style="color:#777; font-size:12px; margin-top:10px;">Данные подтягиваются из базы председателя.</p>
        </div>`;
    }
    else if (tab === 'deadlines') {
        content.innerHTML = `
            <div class="card">
                <h3>Сроки оплаты</h3>
                <div class="row"><span>Членские взносы</span><span>до ${settings.member_deadline || '—'}</span></div>
                <div class="row"><span>Целевые взносы</span><span>до ${settings.target_deadline || '—'}</span></div>
                <div class="row"><span>Электроэнергия</span><span>до ${settings.electric_day || '—'} числа</span></div>
            </div>
        `;
    }
}

// --- ВЫХОД ---
document.getElementById('logout-btn').onclick = () => {
    currentPlot = null;
    document.getElementById('password-input').value = '';
    document.getElementById('login-error').textContent = '';
    showScreen('login-screen');
};

// --- СТАРТ ---
loadData();
