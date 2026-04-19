/**
 * History Manager - AutoGrader
 * Mengelola riwayat pemeriksaan dengan localStorage
 */

const historyManager = {
    STORAGE_KEY: 'autograder_history',
    currentModalId: null,
    
    /**
     * Get all history data
     */
    getAll() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error reading history:', e);
            return [];
        }
    },
    
    /**
     * Save history data
     */
    save(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Error saving history:', e);
            if (e.name === 'QuotaExceededError') {
                alert('Penyimpanan penuh! Hapus beberapa riwayat lama.');
            }
        }
    },
    
    /**
     * Add new record
     */
    add(record) {
        const history = this.getAll();
        record.id = Date.now().toString();
        record.createdAt = new Date().toISOString();
        history.unshift(record);
        
        // Limit to 500 records
        if (history.length > 500) {
            history.pop();
        }
        
        this.save(history);
        this.render();
    },
    
    /**
     * Delete record by ID
     */
    delete(id) {
        const history = this.getAll().filter(h => h.id !== id);
        this.save(history);
        this.render();
        this.closeModal();
        app.showToast('Riwayat dihapus', 'success');
    },
    
    /**
     * Delete current modal record
     */
    deleteCurrent() {
        if (this.currentModalId) {
            if (confirm('Yakin ingin menghapus riwayat ini?')) {
                this.delete(this.currentModalId);
            }
        }
    },
    
    /**
     * Get unique subjects for filter
     */
    getSubjects() {
        const history = this.getAll();
        const subjects = [...new Set(history.map(h => h.subject).filter(Boolean))];
        return subjects.sort();
    },
    
    /**
     * Render history list
     */
    render() {
        const container = document.getElementById('historyList');
        const statsEl = document.getElementById('historyStats');
        const history = this.getFilteredData();
        
        // Update stats
        const total = this.getAll().length;
        statsEl.textContent = `${total} data tersimpan`;
        
        // Update subject filter
        this.updateSubjectFilter();
        
        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <h3>Belum Ada Riwayat</h3>
                    <p>Hasil pemeriksaan akan tersimpan otomatis di sini</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = history.map(item => this.createHistoryItem(item)).join('');
    },
    
    /**
     * Create HTML for history item
     */
    createHistoryItem(item) {
        const date = new Date(item.createdAt).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="history-item" onclick="historyManager.openModal('${item.id}')">
                <div class="history-item-header">
                    <div class="history-student">
                        <div class="history-name">${this.escapeHtml(item.name)}</div>
                        <div class="history-class">${this.escapeHtml(item.class || '-')} • ${this.escapeHtml(item.subject || 'Tanpa Mapel')}</div>
                    </div>
                    <div class="history-score">
                        <div class="history-score-value">${parseFloat(item.score).toFixed(1)}</div>
                        <div class="history-score-label">Nilai</div>
                    </div>
                </div>
                <div class="history-meta">
                    <span class="history-badge type">${item.examType || 'Ujian'}</span>
                    <span class="history-badge subject">${item.subject || 'Umum'}</span>
                    <span class="history-badge date">${date}</span>
                </div>
                <div class="history-stats-bar">
                    <span class="history-stat correct">✓ ${item.correct}</span>
                    <span class="history-stat wrong">✕ ${item.wrong}</span>
                    <span class="history-stat empty">− ${item.empty}</span>
                </div>
            </div>
        `;
    },
    
    /**
     * Open detail modal
     */
    openModal(id) {
        const item = this.getAll().find(h => h.id === id);
        if (!item) return;
        
        this.currentModalId = id;
        const modal = document.getElementById('historyModal');
        const body = document.getElementById('modalBody');
        
        const date = new Date(item.createdAt).toLocaleString('id-ID');
        
        body.innerHTML = `
            <div class="result-card" style="margin-bottom: 1.5rem;">
                <div class="result-header">
                    <div class="student-info">
                        <h3>${this.escapeHtml(item.name)}</h3>
                        <span class="student-class">${this.escapeHtml(item.class || '-')} • ${item.examType || 'Ujian'}</span>
                    </div>
                    <div class="exam-type-badge">${item.subject || 'Umum'}</div>
                </div>
                <div class="score-circle" style="width: 150px; height: 150px; margin-bottom: 1.5rem;">
                    <div class="score-content">
                        <span class="score-number" style="font-size: 2rem;">${parseFloat(item.score).toFixed(1)}</span>
                    </div>
                </div>
                <div class="stats-row">
                    <div class="stat-card correct">
                        <div class="stat-info">
                            <span class="stat-value">${item.correct}</span>
                            <span class="stat-label">Benar</span>
                        </div>
                    </div>
                    <div class="stat-card wrong">
                        <div class="stat-info">
                            <span class="stat-value">${item.wrong}</span>
                            <span class="stat-label">Salah</span>
                        </div>
                    </div>
                    <div class="stat-card empty">
                        <div class="stat-info">
                            <span class="stat-value">${item.empty}</span>
                            <span class="stat-label">Kosong</span>
                        </div>
                    </div>
                </div>
            </div>
            <div style="background: #f9fafb; padding: 1rem; border-radius: 0.75rem;">
                <p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem;">Detail Jawaban:</p>
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; font-size: 0.75rem;">
                    ${item.details.map(d => `
                        <div style="text-align: center; padding: 0.5rem; background: white; border-radius: 0.5rem; border: 2px solid ${d.status === 'correct' ? '#22c55e' : d.status === 'wrong' ? '#ef4444' : '#f59e0b'};">
                            <div style="font-weight: 700; color: #6b7280;">${d.no}</div>
                            <div style="font-weight: 800; font-size: 1rem;">${d.answer !== '-' ? d.answer : '?'}</div>
                            <div style="color: #9ca3af; font-size: 0.625rem;">K: ${d.key}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <p style="text-align: center; color: #9ca3af; font-size: 0.75rem; margin-top: 1rem;">Diperiksa: ${date}</p>
        `;
        
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    },
    
    /**
     * Close modal
     */
    closeModal() {
        document.getElementById('historyModal').classList.add('hidden');
        document.body.style.overflow = '';
        this.currentModalId = null;
    },
    
    /**
     * Get filtered and sorted data
     */
    getFilteredData() {
        let data = this.getAll();
        
        // Search filter
        const searchTerm = document.getElementById('historySearch')?.value.toLowerCase().trim() || '';
        if (searchTerm) {
            data = data.filter(item => 
                item.name.toLowerCase().includes(searchTerm) ||
                (item.class && item.class.toLowerCase().includes(searchTerm))
            );
        }
        
        // Exam type filter
        const examType = document.getElementById('filterExamType')?.value || '';
        if (examType) {
            data = data.filter(item => item.examType === examType);
        }
        
        // Subject filter
        const subject = document.getElementById('filterSubject')?.value || '';
        if (subject) {
            data = data.filter(item => item.subject === subject);
        }
        
        // Sort
        const sortBy = document.getElementById('sortBy')?.value || 'newest';
        switch (sortBy) {
            case 'oldest':
                data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            case 'score-high':
                data.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
                break;
            case 'score-low':
                data.sort((a, b) => parseFloat(a.score) - parseFloat(b.score));
                break;
            case 'name':
                data.sort((a, b) => a.name.localeCompare(b.name));
                break;
            default: // newest
                data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        
        return data;
    },
    
    /**
     * Update subject filter options
     */
    updateSubjectFilter() {
        const select = document.getElementById('filterSubject');
        if (!select) return;
        
        const currentValue = select.value;
        const subjects = this.getSubjects();
        
        let html = '<option value="">Semua Mapel</option>';
        subjects.forEach(sub => {
            html += `<option value="${this.escapeHtml(sub)}">${this.escapeHtml(sub)}</option>`;
        });
        
        select.innerHTML = html;
        select.value = currentValue;
    },
    
    /**
     * Filter handler
     */
    filter() {
        const searchClear = document.getElementById('searchClear');
        const searchValue = document.getElementById('historySearch')?.value || '';
        
        if (searchClear) {
            searchClear.classList.toggle('hidden', !searchValue);
        }
        
        this.render();
    },
    
    /**
     * Clear search
     */
    clearSearch() {
        const input = document.getElementById('historySearch');
        if (input) {
            input.value = '';
            this.filter();
            input.focus();
        }
    },
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Expose to global
window.historyManager = historyManager;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    historyManager.render();
});