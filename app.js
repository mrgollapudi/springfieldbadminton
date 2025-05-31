let SQL;
let db;

const BadmintonApp = {
    // Use AEST for current date (June 1, 2025, 01:49 AM AEST)
    currentDate: new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' }),
    currentYear: new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' })).getFullYear(),
    currentMonth: new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' })).getMonth(),
    currentWeek: 1,
    totalWeeks: 5,

    async init() {
        try {
            // Initialize sql.js
            const response = await fetch('https://cdn.jsdelivr.net/npm/sql.js@1.11.0/dist/sql-wasm.wasm');
            if (!response.ok) throw new Error('Failed to load sql-wasm.wasm');
            const wasmBinary = await response.arrayBuffer();
            SQL = await initSqlJs({ wasmBinary });
            db = new SQL.Database();
            this.createTables();
            this.populateYearDropdowns();
            this.setDefaultSelections();
            this.bindEventListeners();
            this.updatePlayerList();
            this.updateFeesDisplay();
            this.updateAttendanceTable();
            this.updateDashboard();
            this.generateBills();
        } catch (e) {
            console.error('Initialization error:', e);
            this.showMessage('Failed to initialize app.', true);
        }
    },

    createTables() {
        db.run(`
            CREATE TABLE IF NOT EXISTS players (
                name TEXT PRIMARY KEY,
                contact TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS fees (
                year_month TEXT PRIMARY KEY,
                regular REAL NOT NULL,
                casual REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS attendance (
                player_name TEXT,
                year_month TEXT,
                week INTEGER,
                attended INTEGER NOT NULL,
                PRIMARY KEY (player_name, year_month, week),
                FOREIGN KEY (player_name) REFERENCES players(name)
            );
            CREATE TABLE IF NOT EXISTS week_labels (
                year_month_week TEXT PRIMARY KEY,
                label TEXT NOT NULL
            );
        `);
    },

    showMessage(message, isError = false) {
        const msgDiv = document.createElement('div');
        msgDiv.textContent = message;
        msgDiv.className = `message ${isError ? 'error' : 'success'}`;
        const notificationArea = document.getElementById('notificationArea');
        if (notificationArea) {
            notificationArea.appendChild(msgDiv);
            setTimeout(() => msgDiv.remove(), 3000);
        }
    },

    sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    },

    escapeCSV(str) {
        return `"${str.replace(/"/g, '""')}"`;
    },

    populateYearDropdowns() {
        const years = Array.from({ length: 5 }, (_, i) => this.currentYear - 2 + i);
        const yearSelects = ['dashboardYear', 'attendanceYear', 'feeYear', 'billingYear'];
        yearSelects.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join('');
            }
        });
    },

    setDefaultSelections() {
        // Set default to current AEST year and month
        const selects = [
            { year: 'dashboardYear', month: 'dashboardMonth' },
            { year: 'attendanceYear', month: 'attendanceMonth' },
            { year: 'feeYear', month: 'feeMonth' },
            { year: 'billingYear', month: 'billingMonth' }
        ];
        selects.forEach(({ year, month }) => {
            const yearSelect = document.getElementById(year);
            const monthSelect = document.getElementById(month);
            if (yearSelect && monthSelect) {
                yearSelect.value = this.currentYear;
                monthSelect.value = this.currentMonth;
            }
        });
    },

    bindEventListeners() {
        // Players Tab
        document.getElementById('addPlayerBtn')?.addEventListener('click', () => this.addPlayer());
        document.getElementById('resetDataBtn')?.addEventListener('click', () => this.resetData());
        document.getElementById('downloadDbBtn')?.addEventListener('click', () => this.downloadDatabase());

        // Attendance Tab
        document.getElementById('attendanceYear')?.addEventListener('change', () => this.updateAttendanceTable());
        document.getElementById('attendanceMonth')?.addEventListener('change', () => this.updateAttendanceTable());
        document.getElementById('weekSelect')?.addEventListener('change', () => this.updateAttendanceTable());
        document.getElementById('weekLabel')?.addEventListener('change', () => this.updateWeekLabel());
        document.getElementById('prevWeekBtn')?.addEventListener('click', () => this.prevWeek());
        document.getElementById('nextWeekBtn')?.addEventListener('click', () => this.nextWeek());

        // Fees Tab
        document.getElementById('feeYear')?.addEventListener('change', () => this.updateFeesDisplay());
        document.getElementById('feeMonth')?.addEventListener('change', () => this.updateFeesDisplay());
        document.getElementById('saveFeesBtn')?.addEventListener('click', () => this.saveFees());

        // Billing Tab
        document.getElementById('billingYear')?.addEventListener('change', () => this.generateBills());
        document.getElementById('billingMonth')?.addEventListener('change', () => this.generateBills());
        document.getElementById('generateBillsBtn')?.addEventListener('click', () => this.generateBills());
        document.getElementById('downloadBillsCsvBtn')?.addEventListener('click', () => this.downloadBillsCSV());

        // Dashboard Tab
        document.getElementById('dashboardYear')?.addEventListener('change', () => this.updateDashboard());
        document.getElementById('dashboardMonth')?.addEventListener('change', () => this.updateDashboard());
    },

    addPlayer() {
        const name = this.sanitizeInput(document.getElementById('playerName')?.value.trim());
        const contact = this.sanitizeInput(document.getElementById('playerContact')?.value.trim());
        if (!name) {
            this.showMessage('Please enter a valid player name.', true);
            return;
        }
        const exists = db.exec(`SELECT 1 FROM players WHERE name = ?`, [name])[0];
        if (exists) {
            this.showMessage('Player already exists.', true);
            return;
        }
        if (contact && !/^[0-9]{10}$/.test(contact)) {
            this.showMessage('Please enter a valid 10-digit contact number.', true);
            return;
        }
        try {
            db.run(`INSERT INTO players (name, contact) VALUES (?, ?)`, [name, contact || 'N/A']);
            this.updatePlayerList();
            this.updateAttendanceTable();
            this.updateDashboard();
            document.getElementById('playerName').value = '';
            document.getElementById('playerContact').value = '';
            this.showMessage('Player added successfully!');
        } catch (e) {
            console.error('Error adding player:', e);
            this.showMessage('Error adding player.', true);
        }
    },

    removePlayer(name) {
        if (confirm(`Are you sure you want to remove ${name}?`)) {
            try {
                db.run(`DELETE FROM players WHERE name = ?`, [name]);
                db.run(`DELETE FROM attendance WHERE player_name = ?`, [name]);
                this.updatePlayerList();
                this.updateAttendanceTable();
                this.updateDashboard();
                this.generateBills();
                this.showMessage(`${name} removed successfully!`);
            } catch (e) {
                console.error('Error removing player:', e);
                this.showMessage('Error removing player.', true);
            }
        }
    },

    updatePlayerList() {
        const tbody = document.getElementById('playerList');
        if (tbody) {
            tbody.innerHTML = '';
            const result = db.exec(`SELECT name, contact FROM players`);
            const players = result[0]?.values || [];
            players.forEach(([name, contact]) => {
                if (attendance === 0) return;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${name}</td>
                    <td>${contact}</td>
                    <td><button class="btn btn-danger btn-sm remove-player" data-name="${name}" aria-label="Remove ${name}" title="Remove ${name} from the list">Remove</button></td>
                `;
                tbody.appendChild(tr);
            });
            // Bind remove buttons
            document.querySelectorAll('.remove-player').forEach(btn => {
                btn.addEventListener('click', () => this.removePlayer(btn.dataset.name));
            });
        }
    },

    saveFees() {
        const year = parseInt(document.getElementById('feeYear')?.value);
        const month = parseInt(document.getElementById('feeMonth')?.value);
        const regularFee = parseFloat(document.getElementById('regularFee')?.value) || 0;
        const casualFee = parseFloat(document.getElementById('casualFee')?.value) || 0;
        if (regularFee < 0 || casualFee < 0) {
            this.showMessage('Fees cannot be negative.', true);
            return;
        }
        const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;
        try {
            db.run(`INSERT OR REPLACE INTO fees (year_month, regular, casual) VALUES (?, ?, ?)`, [yearMonth, regularFee, casualFee]);
            this.updateFeesDisplay();
            this.updateFeeHistory();
            this.updateDashboard();
            this.showMessage('Fees saved successfully!');
        } catch (e) {
            console.error('Error saving fees:', e);
            this.showMessage('Error saving fees.', true);
        }
    },

    updateFeesDisplay() {
        const year = parseInt(document.getElementById('feeYear')?.value);
        const month = parseInt(document.getElementById('feeMonth')?.value);
        const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;
        const result = db.exec(`SELECT regular, casual FROM fees WHERE year_month = ?`, [yearMonth])[0];
        const fees = result?.values?.[0] || [0, 0];
        const regularFeeEl = document.getElementById('currentRegularFee');
        const casualFeeEl = document.getElementById('currentCasualFee');
        if (regularFeeEl && casualFeeEl) {
            regularFeeEl.textContent = fees[0].toFixed(2);
            casualFeeEl.textContent = fees[1].toFixed(2);
        }
        this.updateFeeHistory();
    },

    updateFeeHistory() {
        const tbody = document.getElementById('feeHistory');
        if (tbody) {
            tbody.innerHTML = '';
            const result = db.exec(`SELECT year_month, regular, casual FROM fees ORDER BY year_month DESC`);
            const fees = result[0]?.values || [];
            fees.forEach(([yearMonth, regular, casual]) => {
                const [year, month] = yearMonth.split('-').map(Number);
                const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { timeZone: 'Australia/Sydney', month: 'long', year: 'numeric' });
                if (attendance === 0) return;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${monthName}</td>
                    <td>${regular.toFixed(2)}</td>
                    <td>${casual.toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    },

    updateAttendanceTable() {
        const year = parseInt(document.getElementById('attendanceYear')?.value);
        const month = parseInt(document.getElementById('attendanceMonth')?.value);
        const week = parseInt(document.getElementById('weekSelect')?.value);
        this.currentYear = year;
        this.currentMonth = month;
        this.currentWeek = week;
        this.updateWeekDisplay();
        this.updateWeekButtons();
        const tbody = document.getElementById('attendanceBody');
        if (tbody) {
            tbody.innerHTML = '';
            const players = db.exec(`SELECT name FROM players`)[0]?.values || [];
            const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;
            players.forEach(([player]) => {
                const tr = document.createElement('tr');
                const tdName = document.createElement('td');
                tdName.textContent = player;
                const tdCheck = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.player = player;
                const result = db.exec(`SELECT attended FROM attendance WHERE player_name = ? AND year_month = ? AND week = ?`, [player, yearMonth, week])[0];
                checkbox.checked = result?.values?.[0]?.[0] === 1;
                checkbox.setAttribute('aria-label', `Attendance for ${player} in week ${week}`);
                checkbox.addEventListener('change', () => this.updateAttendance(player, yearMonth, week, checkbox.checked));
                tdCheck.appendChild(checkbox);
                tr.appendChild(tdName);
                tr.appendChild(tdCheck);
                tbody.appendChild(tr);
            });
            this.updateDashboard();
        }
    },

    updateWeekDisplay() {
        const monthKey = `${this.currentYear}-${this.currentMonth.toString().padStart(2, '0')}`;
        const weekKey = `${monthKey}-${this.currentWeek}`;
        const result = db.exec(`SELECT label FROM week_labels WHERE year_month_week = ?`, [weekKey])[0];
        const label = result?.values?.[0]?.[0] || `Week ${this.currentWeek}`;
        const weekLabelEl = document.getElementById('weekLabel');
        const weekSelectEl = document.getElementById('weekSelect');
        const currentWeekEl = document.getElementById('currentWeek');
        if (weekLabelEl && weekSelectEl && currentWeekEl) {
            weekLabelEl.value = result?.values?.[0]?.[0] || '';
            weekSelectEl.value = this.currentWeek;
            currentWeekEl.textContent = `${this.currentWeek} (${label})`;
        }
    },

    updateWeekLabel() {
        const label = this.sanitizeInput(document.getElementById('weekLabel')?.value.trim());
        if (label) {
            const monthKey = `${this.currentYear}-${this.currentMonth.toString().padStart(2, '0')}`;
            const weekKey = `${monthKey}-${this.currentWeek}`;
            try {
                db.run(`INSERT OR REPLACE INTO week_labels (year_month_week, label) VALUES (?, ?)`, [weekKey, label]);
                this.updateWeekDisplay();
                this.showMessage(`Week ${this.currentWeek} label updated.`);
            } catch (e) {
                console.error('Error updating week label:', e);
                this.showMessage('Error updating week label.', true);
            }
        }
    },

    updateWeekButtons() {
    const prevBtn = document.getElementById('prevWeekBtn');
    const nextBtn = document.getElementById('nextWeekBtn');
    if (prevBtn) prevBtn.disabled = this.currentWeek <= 1;
    if (nextBtn) nextBtn.disabled = this.currentWeek >= this.totalWeeks;
},

updateAttendance(player, yearMonth, week, attended) {
    try {
        db.run(
            `INSERT OR REPLACE INTO attendance (player_name, year_month, week, attended) VALUES (?, ?, ?, ?)`,
            [player, yearMonth, week, attended ? 1 : 0]
        );
        this.updateDashboard();
        this.showMessage(`Attendance updated for ${player}.`);
    } catch (e) {
        console.error('Error updating attendance:', e);
        this.showMessage('Error updating attendance.', true);
    }
},

prevWeek() {
    if (this.currentWeek > 1) {
        this.currentWeek--;
        const weekSelectEl = document.getElementById('weekSelect');
if (weekSelectEl) weekSelectEl.value = this.currentWeek;
        this.updateAttendanceTable();
        this.updateWeekButtons();  // ← ensure buttons update
    }
},

nextWeek() {
    if (this.currentWeek < this.totalWeeks) {
        this.currentWeek++;
        const weekSelectEl = document.getElementById('weekSelect');
if (weekSelectEl) weekSelectEl.value = this.currentWeek;
        this.updateAttendanceTable();
        this.updateWeekButtons();  // ← ensure buttons update
    }
},


    updateDashboard() {
        const year = parseInt(document.getElementById('dashboardYear')?.value);
        const month = parseInt(document.getElementById('dashboardMonth')?.value);
        if (isNaN(year) || isNaN(month)) {
            this.showMessage('Invalid year or month selected.', true);
            return;
        }
        const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;
        const monthName = new Date(year, month, 15).toLocaleString('en-US', { timeZone: 'Australia/Sydney', month: 'long', year: 'numeric' });

        // Update Summary Table
        const tbody = document.getElementById('dashboardSummary');
        if (tbody) {
            tbody.innerHTML = '';
            const feeResult = db.exec(`SELECT regular, casual FROM fees WHERE year_month = ?`, [yearMonth])[0];
            const fees = feeResult?.values?.[0] || [0, 0];
            const playersResult = db.exec(`SELECT name FROM players`)[0];
            const players = playersResult?.values || [];
            players.forEach(([player]) => {
                const attendanceResult = db.exec(`SELECT COUNT(*) FROM attendance WHERE player_name = ? AND year_month = ? AND attended = 1`, [player, yearMonth])[0];
                const attendance = attendanceResult?.values?.[0]?.[0] || 0;
                const isRegular = attendance >= 4;
                const fee = isRegular ? fees[0] : fees[1];
                const amount = attendance * fee;
                if (attendance === 0) return;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${player}</td>
                    <td>${monthName}</td>
                    <td>${attendance}</td>
                    <td>$${amount.toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Update Attendance Graph
        if (typeof Plotly !== 'undefined' && document.getElementById('attendanceGraph')) {
            const playersResult = db.exec(`SELECT name FROM players`)[0];
            const players = playersResult?.values || [];
            const playerNames = players.map(p => p[0] || '');
            const attendanceCounts = players.map(([player]) => {
                const result = db.exec(`SELECT COUNT(*) FROM attendance WHERE player_name = ? AND year_month = ? AND attended = 1`, [player, yearMonth])[0];
                return result?.values?.[0]?.[0] || 0;
            });
            const trace = {
                x: playerNames,
                y: attendanceCounts,
                type: 'bar',
                marker: { color: '#4ecdc4' }
            };
            const layout = {
                title: `Attendance for ${monthName}`,
                xaxis: { title: 'Player' },
                yaxis: { title: 'Attendance Count' },
                plot_bgcolor: '#fff',
                paper_bgcolor: '#fff',
                margin: { t: 50, b: 100, l: 50, r: 50 }
            };
            try {
                Plotly.newPlot('attendanceGraph', [trace], layout);
            } catch (e) {
                console.error('Error rendering Plotly graph:', e);
                this.showMessage('Failed to render attendance graph.', true);
            }
        } else {
            console.warn('Plotly not loaded or graph container missing.');
        }
    },

    generateBills() {
        const year = parseInt(document.getElementById('billingYear')?.value);
        const month = parseInt(document.getElementById('billingMonth')?.value);
        if (isNaN(year) || isNaN(month)) {
            this.showMessage('Invalid year or month selected.', true);
            return;
        }
        const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;
        const feeResult = db.exec(`SELECT regular, casual FROM fees WHERE year_month = ?`, [yearMonth])[0];
        const fees = feeResult?.values?.[0] || [0, 0];
        const monthName = new Date(year, month, 15).toLocaleString('en-US', { timeZone: 'Australia/Sydney', month: 'long' });
        const header = document.getElementById('billTableHeader');
        if (header) {
            header.innerHTML = `
                <th>Player</th>
                <th>Weeks Played (${monthName})</th>
                <th>Amount ($)</th>
            `;
        }
        const tbody = document.getElementById('billBody');
        if (tbody) {
            tbody.innerHTML = '';
            let totalRevenue = 0;
            const playersResult = db.exec(`SELECT name FROM players`)[0];
            const players = playersResult?.values || [];
            players.forEach(([player]) => {
                const attendanceResult = db.exec(`SELECT COUNT(*) FROM attendance WHERE player_name = ? AND year_month = ? AND attended = 1`, [player, yearMonth])[0];
                const attendance = attendanceResult?.values?.[0]?.[0] || 0;
                const isRegular = attendance >= 4;
                const fee = isRegular ? fees[0] : fees[1];
                const amount = fee * attendance;
                totalRevenue += amount;
                if (attendance === 0) return;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${player}</td>
                    <td>${attendance} (${isRegular ? 'Regular' : 'Casual'})</td>
                    <td>$${amount.toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
            this.showMessage(`Bills generated for ${monthName} ${year}. Total Revenue: $${totalRevenue.toFixed(2)}`);
        }
    },

    downloadBillsCSV() {
        const year = parseInt(document.getElementById('billingYear')?.value);
        const month = parseInt(document.getElementById('billingMonth')?.value);
        if (isNaN(year) || isNaN(month)) {
            this.showMessage('Invalid year or month.', true);
            return;
        }
        const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;
        const feeResult = db.exec(`SELECT regular, casual FROM fees WHERE year_month = ?`, [yearMonth])[0];
        const fees = feeResult?.values?.[0] || [0, 0];
        const monthName = new Date(year, month, 15).toLocaleString('en-US', { timeZone: 'Australia/Sydney', month: 'long' });
        let csv = 'Player,Attendance,Type,Amount\n';
        const playersResult = db.exec(`SELECT name FROM players`)[0];
        const players = playersResult?.values || [];
        players.forEach(([player]) => {
            const attendanceResult = db.exec(`SELECT COUNT(*) FROM attendance WHERE player_name = ? AND year_month = ? AND attended = 1`, [player, yearMonth])[0];
            const attendance = attendanceResult?.values?.[0]?.[0] || 0;
            const isRegular = attendance >= 4;
            const fee = isRegular ? fees[0] : fees[1];
            const amount = fee * attendance;
            csv += `${this.escapeCSV(player)},${attendance},${isRegular ? 'Regular' : 'Casual'},${amount.toFixed(2)}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `badminton_bills_${monthName}_${year}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.showMessage('Bills downloaded as CSV successfully!');
    },

    downloadDatabase() {
        const data = db.export();
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'badminton.db';
        a.click();
        URL.revokeObjectURL(url);
        this.showMessage('Database downloaded successfully!');
    },

    resetData() {
        if (confirm('Are you sure you want to reset all data?')) {
            try {
                db.run(`DROP TABLE IF EXISTS players; DROP TABLE IF EXISTS fees; DROP TABLE IF EXISTS attendance; DROP TABLE IF EXISTS week_labels;`);
                this.createTables();
                this.prefillData();
                this.updatePlayerList();
                this.updateFeesDisplay();
                this.updateAttendanceTable();
                this.updateDashboard();
                this.generateBills();
                this.showMessage('Data reset successfully!');
            } catch (e) {
                console.error('Error resetting data:', e);
                this.showMessage('Error resetting data.', true);
            }
        }
    }
};

BadmintonApp.init();
//3:00am
