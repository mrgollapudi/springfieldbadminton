const BadmintonApp = {
    async init() {
        this.bindEventListeners();
        this.populateYearDropdowns();
        this.setDefaultSelections();
        this.updatePlayerList();
    },

    bindEventListeners() {
        document.getElementById('addPlayerBtn')?.addEventListener('click', () => this.addPlayer());
        document.getElementById('dashboardYear')?.addEventListener('change', () => this.updatePlayerList());
        document.getElementById('dashboardMonth')?.addEventListener('change', () => this.updatePlayerList());
    },

    populateYearDropdowns() {
        const currentYear = new Date().getFullYear();
        const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
        const yearSelects = ['dashboardYear'];
        yearSelects.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join('');
            }
        });
    },

    setDefaultSelections() {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const yearSelect = document.getElementById('dashboardYear');
        const monthSelect = document.getElementById('dashboardMonth');
        if (yearSelect && monthSelect) {
            yearSelect.value = currentYear;
            monthSelect.value = currentMonth;
        }
    },

    async updatePlayerList() {
        const tbody = document.getElementById('playerList');
        if (!tbody) return;

        tbody.innerHTML = '';

        try {
            const response = await fetch('/api/getPlayers');
            if (!response.ok) throw new Error('Failed to fetch players');

            const players = await response.json();
            players.forEach(({ name, contact }) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${name}</td>
                    <td>${contact}</td>
                    <td><button class="btn btn-danger btn-sm remove-player" data-name="${name}" aria-label="Remove ${name}" title="Remove ${name} from the list">Remove</button></td>
                `;
                tbody.appendChild(tr);
            });

            document.querySelectorAll('.remove-player').forEach(btn => {
                btn.addEventListener('click', () => {
                    alert(`Remove functionality not yet wired to API for ${btn.dataset.name}`);
                });
            });
        } catch (err) {
            console.error('Error loading players:', err);
            tbody.innerHTML = '<tr><td colspan="3">Failed to load players</td></tr>';
        }
    },

    async addPlayer() {
        const nameInput = document.getElementById('playerName');
        const contactInput = document.getElementById('playerContact');
        const name = nameInput?.value.trim();
        const contact = contactInput?.value.trim();

        if (!name) {
            alert('Please enter a valid player name.');
            return;
        }

        if (contact && !/^[0-9]{10}$/.test(contact)) {
            alert('Please enter a valid 10-digit contact number.');
            return;
        }

        try {
            const response = await fetch('/api/addPlayer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, contact })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
            }

            alert('Player added successfully!');
            nameInput.value = '';
            contactInput.value = '';
            this.updatePlayerList();
        } catch (err) {
            console.error('Error adding player:', err);
            alert('Error adding player.');
        }
    }
};

window.onload = () => BadmintonApp.init();
