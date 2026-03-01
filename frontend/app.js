/* ═══════════════════════════════════════════════════════════
   SecureBank – Fraud Detection Dashboard
   Application Logic
   ═══════════════════════════════════════════════════════════ */

; (function () {
    'use strict';

    /* ─── DOM refs ─── */
    const $ = (s) => document.querySelector(s);
    const txnForm = $('#transaction-form');
    const analyzeBtn = $('#analyze-btn');
    const resetBtn = $('#reset-btn');

    const resultPlaceholder = $('#result-placeholder');
    const resultLoading = $('#result-loading');
    const resultContent = $('#result-content');

    const gaugeFill = $('#gauge-fill');
    const gaugeValue = $('#gauge-value');
    const riskGauge = $('#risk-gauge');

    const rdProbability = $('#rd-probability');
    const rdLevel = $('#rd-level');
    const rdDecision = $('#rd-decision');

    const historyBody = $('#history-body');
    const emptyRow = $('#empty-row');
    const historyCount = $('#history-count');
    const profileRisk = $('#profile-risk-badge');

    /* ─── Config ─── */
    const API_BASE = 'http://localhost:8000';

    /* ─── State ─── */
    let transactionHistory = [];
    let optionsLoaded = false;

    /* ─── Customer mock data ─── */
    const customer = {
        name: 'John Doe',
        id: 'CB-482917',
        city: 'New York',
    };

    /* ═══════════════  INIT: Load dropdown options  ═══════════════ */
    loadOptions();

    /* ═══════════════  TRANSACTION ANALYSIS  ═══════════════ */
    txnForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const amount = parseFloat($('#txn-amount').value);
        const merchant = $('#txn-merchant').value;
        const category = $('#txn-category').value;
        const city = $('#txn-city').value;

        if (!amount || !merchant || !category || !city) return;

        showLoading();

        try {
            const result = await callPredict({ amount, merchant, category, city });
            showResult(result, merchant, amount);
        } catch (err) {
            console.error('Prediction failed:', err);
            // Fallback to mock if backend is down
            const result = await mockPredict({ amount, merchant, category, city });
            showResult(result, merchant, amount);
        }
    });

    resetBtn.addEventListener('click', () => {
        resetResult();
    });

    /* ─── Real /predict API call ─── */
    async function callPredict({ amount, merchant, category, city }) {
        const res = await fetch(`${API_BASE}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, merchant, category, city }),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`API ${res.status}: ${err}`);
        }
        return res.json();
    }

    /* ─── Fallback mock if backend is unavailable ─── */
    function mockPredict({ amount, merchant, category, city }) {
        return new Promise((resolve) => {
            setTimeout(() => {
                let base = Math.random() * 40;
                if (amount > 5000) base += 35;
                else if (amount > 1000) base += 20;
                if (city !== customer.city) base += 15;
                const risk_score = Math.min(99, Math.max(1, Math.round(base)));
                const probability = parseFloat((risk_score / 100).toFixed(2));
                let risk_level = risk_score >= 70 ? 'High' : risk_score >= 40 ? 'Medium' : 'Low';
                let decision = risk_score >= 70 ? 'Block' : risk_score >= 40 ? 'Require OTP' : 'Approve';
                resolve({ risk_score, probability, risk_level, decision });
            }, 1000);
        });
    }

    /* ─── Load dropdown options from backend ─── */
    async function loadOptions() {
        try {
            const res = await fetch(`${API_BASE}/options`);
            if (!res.ok) return;
            const data = await res.json();

            populateSelect('#txn-merchant', data.merchants);
            populateSelect('#txn-category', data.categories);
            populateSelect('#txn-city', data.cities);
            optionsLoaded = true;
            console.log('✅ Dropdown options loaded from backend');
        } catch {
            console.warn('⚠ Backend unavailable – using hardcoded dropdowns');
        }
    }

    function populateSelect(selector, items) {
        const el = document.querySelector(selector);
        const placeholder = el.querySelector('option[disabled]');
        el.innerHTML = '';
        if (placeholder) el.appendChild(placeholder);
        items.forEach((v) => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            el.appendChild(opt);
        });
    }

    /* ─── UI state helpers ─── */
    function showLoading() {
        resultPlaceholder.style.display = 'none';
        resultContent.style.display = 'none';
        resultLoading.style.display = 'flex';
        analyzeBtn.disabled = true;
        analyzeBtn.querySelector('span').textContent = 'Analyzing…';
    }

    function showResult(data, merchant, amount) {
        resultLoading.style.display = 'none';
        resultContent.style.display = 'flex';
        analyzeBtn.disabled = false;
        analyzeBtn.querySelector('span').textContent = 'Analyze Transaction';

        // Animate gauge
        animateGauge(data.risk_score, data.risk_level);

        // Probability
        rdProbability.textContent = data.probability.toFixed(2);

        // Risk level with colour
        rdLevel.textContent = data.risk_level;
        rdLevel.className = 'rdv';
        if (data.risk_level === 'High') rdLevel.style.color = 'var(--red)';
        else if (data.risk_level === 'Medium') rdLevel.style.color = 'var(--yellow)';
        else rdLevel.style.color = 'var(--green)';

        // Decision badge
        rdDecision.textContent = data.decision;
        rdDecision.className = 'decision-badge';
        if (data.decision === 'Block') rdDecision.classList.add('decision-block');
        else if (data.decision === 'Require OTP') rdDecision.classList.add('decision-otp');
        else rdDecision.classList.add('decision-approve');

        // Update profile risk badge
        profileRisk.textContent = data.risk_level + ' Risk';
        profileRisk.className = 'badge';
        if (data.risk_level === 'High') profileRisk.classList.add('badge-red');
        else if (data.risk_level === 'Medium') profileRisk.classList.add('badge-yellow');
        else profileRisk.classList.add('badge-green');

        // Add to history
        const entry = {
            date: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            amount: amount,
            merchant: merchant,
            riskScore: data.risk_score,
            status: data.decision,
        };
        transactionHistory.unshift(entry);
        renderHistory();

        // Scroll to result
        $('#result-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function resetResult() {
        resultContent.style.display = 'none';
        resultLoading.style.display = 'none';
        resultPlaceholder.style.display = 'flex';
        gaugeValue.textContent = '0';
        gaugeFill.style.background = `conic-gradient(var(--border) 0%, var(--border) 100%)`;
    }

    /* ═══════════════  GAUGE ANIMATION  ═══════════════ */
    function animateGauge(score, level) {
        const color = level === 'High' ? 'var(--red)'
            : level === 'Medium' ? 'var(--yellow)'
                : 'var(--green)';

        // Animate the number
        let current = 0;
        const duration = 1200;
        const start = performance.now();

        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out
            const ease = 1 - Math.pow(1 - progress, 3);
            current = Math.round(ease * score);
            gaugeValue.textContent = current;

            const pct = (ease * score) / 100 * 100;
            gaugeFill.style.background = `conic-gradient(${color} 0%, ${color} ${pct}%, var(--border) ${pct}%, var(--border) 100%)`;

            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);

        // Pulse animation on the gauge value
        gaugeValue.style.animation = 'none';
        void gaugeValue.offsetWidth; // trigger reflow
        gaugeValue.style.animation = 'countUp .4s ease-out';
    }

    /* ═══════════════  TRANSACTION HISTORY  ═══════════════ */
    function renderHistory() {
        // Clear existing rows
        historyBody.innerHTML = '';

        if (transactionHistory.length === 0) {
            historyBody.innerHTML = '<tr class="empty-row"><td colspan="5">No transactions yet. Analyze a transaction to see results here.</td></tr>';
            historyCount.textContent = '0 records';
            return;
        }

        historyCount.textContent = transactionHistory.length + ' record' + (transactionHistory.length > 1 ? 's' : '');

        transactionHistory.forEach((t, i) => {
            const tr = document.createElement('tr');
            tr.style.animation = `fadeSlide .35s ease-out ${i * .05}s both`;

            let statusClass = 'status-approved';
            let statusText = 'Approved';
            if (t.status === 'Block') { statusClass = 'status-blocked'; statusText = 'Blocked'; }
            else if (t.status === 'Require OTP') { statusClass = 'status-otp'; statusText = 'OTP Required'; }

            let scoreClass = '';
            if (t.riskScore >= 70) scoreClass = 'color:var(--red)';
            else if (t.riskScore >= 40) scoreClass = 'color:var(--yellow)';
            else scoreClass = 'color:var(--green)';

            tr.innerHTML = `
        <td>${t.date}</td>
        <td><strong>$${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
        <td>${t.merchant}</td>
        <td><strong style="${scoreClass}">${t.riskScore}</strong></td>
        <td><span class="status-pill ${statusClass}">${statusText}</span></td>
      `;
            historyBody.appendChild(tr);
        });
    }

})();
