/**
 * AutoGrader - Main Application
 */

const app = {
    answerKey: [],
    studentAnswers: [],
    extractedAnswersFromOCR: [],
    currentResult: null,
    totalQuestions: 20,
    examConfig: {},
    
    getTotalQuestions() {
        return this.totalQuestions;
    },
    
    setExtractedAnswers(answers) {
        this.extractedAnswersFromOCR = Array.isArray(answers) ? answers : [];
    },
    
    /**
     * Show page (grading/history)
     */
    showPage(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        
        document.getElementById(`page-${page}`)?.classList.add('active');
        document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
        
        if (page === 'history') {
            historyManager.render();
        }
    },
    
    /**
     * Generate answer key inputs - FIXED GRID
     */
    generateAnswerInputs() {
        this.totalQuestions = parseInt(document.getElementById('totalQuestions').value) || 20;
        
        if (this.totalQuestions < 1 || this.totalQuestions > 200) {
            this.showToast('Jumlah soal harus 1-200', 'error');
            return;
        }
        
        const container = document.getElementById('answerKeyContainer');
        
        let html = '<div class="answer-key-grid">';
        for (let i = 1; i <= this.totalQuestions; i++) {
            html += `
                <div class="answer-key-item">
                    <label for="key_${i}">No. ${i}</label>
                    <input type="text" 
                           id="key_${i}" 
                           maxlength="1" 
                           placeholder="?"
                           inputmode="text"
                           autocomplete="off"
                           oninput="app.validateAnswerInput(this)"
                           onkeydown="app.handleKeyNav(event, ${i}, 'key')">
                </div>
            `;
        }
        html += '</div>';
        
        container.innerHTML = html;
        document.getElementById('keyActions').classList.remove('hidden');
        
        // Focus first
        setTimeout(() => document.getElementById('key_1')?.focus(), 100);
    },
    
    validateAnswerInput(input) {
        const valid = ['A', 'B', 'C', 'D', 'E'];
        const val = input.value.toUpperCase();
        
        if (!valid.includes(val) && val !== '') {
            input.value = '';
            if (navigator.vibrate) navigator.vibrate(50);
        } else {
            input.value = val;
            // Auto advance
            const match = input.id.match(/(\d+)$/);
            if (match && val) {
                const next = document.getElementById(input.id.replace(/\d+$/, '') + (parseInt(match[1]) + 1));
                if (next) setTimeout(() => next.focus(), 50);
            }
        }
    },
    
    handleKeyNav(e, num, prefix) {
        let next = null;
        const cols = window.innerWidth >= 1280 ? 10 : window.innerWidth >= 1024 ? 8 : window.innerWidth >= 768 ? 5 : 2;
        
        if (e.key === 'ArrowRight' || e.key === 'Enter') next = num + 1;
        else if (e.key === 'ArrowLeft') next = num - 1;
        else if (e.key === 'ArrowDown') next = num + cols;
        else if (e.key === 'ArrowUp') next = num - cols;
        
        if (next && next >= 1 && next <= this.totalQuestions) {
            e.preventDefault();
            document.getElementById(`${prefix}_${next}`)?.focus();
        }
    },
    
    /**
     * Save answer key
     */
    saveAnswerKey() {
        this.answerKey = [];
        let empty = 0;
        
        for (let i = 1; i <= this.totalQuestions; i++) {
            const val = document.getElementById(`key_${i}`)?.value.toUpperCase() || '';
            if (!val) empty++;
            this.answerKey.push(val || '-');
        }
        
        if (empty > 0 && !confirm(`Ada ${empty} jawaban kosong. Lanjutkan?`)) return;
        
        // Save exam config
        this.examConfig = {
            type: document.getElementById('examType')?.value || 'Lainnya',
            subject: document.getElementById('subject')?.value || 'Tanpa Mapel',
            totalQuestions: this.totalQuestions
        };
        
        // Update UI
        document.getElementById('keyStatus').textContent = `${this.totalQuestions} Soal • ${this.examConfig.type}`;
        document.getElementById('keyStatus').classList.add('active');
        document.getElementById('examInfoDisplay').textContent = `${this.examConfig.type} • ${this.examConfig.subject}`;
        
        // Generate student inputs
        this.generateStudentInputs();
        
        // Show student section
        document.getElementById('studentSection').classList.remove('hidden');
        setTimeout(() => {
            const offset = window.innerWidth < 768 ? 80 : 100;
            const top = document.getElementById('studentSection').getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }, 100);
        
        // Pre-init OCR
        if (window.ocrHandler) {
            ocrHandler.initializeWorker().catch(() => {});
        }
    },
    
    clearAnswerKey() {
        document.getElementById('answerKeyContainer').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <p>Atur jumlah soal dan klik "Generate Form"</p>
            </div>
        `;
        document.getElementById('keyActions').classList.add('hidden');
        document.getElementById('keyStatus').textContent = 'Belum diatur';
        document.getElementById('keyStatus').classList.remove('active');
        this.answerKey = [];
    },
    
    generateStudentInputs() {
        const container = document.getElementById('manualInputsContainer');
        let html = '<div class="manual-input-grid">';
        for (let i = 1; i <= this.totalQuestions; i++) {
            html += `
                <div class="manual-input-item">
                    <label for="manual_${i}">No. ${i}</label>
                    <input type="text" 
                           id="manual_${i}" 
                           maxlength="1" 
                           placeholder="?"
                           inputmode="text"
                           autocomplete="off"
                           oninput="app.validateAnswerInput(this)"
                           onkeydown="app.handleKeyNav(event, ${i}, 'manual')">
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
    },
    
    /**
     * File handling
     */
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            this.showToast('File harus gambar!', 'error');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            this.showToast('Maksimal 10MB', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.getElementById('previewImage');
            img.src = e.target.result;
            img.onload = () => {
                document.getElementById('previewContainer').classList.remove('hidden');
            };
        };
        reader.readAsDataURL(file);
    },
    
    clearImage() {
        document.getElementById('fileInput').value = '';
        document.getElementById('previewContainer').classList.add('hidden');
        document.getElementById('ocrResult').classList.add('hidden');
        document.getElementById('progressContainer').classList.add('hidden');
        this.extractedAnswersFromOCR = [];
    },
    
    useExtractedAnswers() {
        this.studentAnswers = [...this.extractedAnswersFromOCR];
        const name = document.getElementById('studentNameUpload').value.trim();
        if (!name) {
            document.getElementById('studentNameUpload').focus();
            this.showToast('Isi nama siswa!', 'warning');
            return;
        }
        this.checkAndShowResults(name, document.getElementById('studentClassUpload').value);
    },
    
    editExtractedAnswers() {
        this.switchTab('manual');
        document.getElementById('studentNameManual').value = document.getElementById('studentNameUpload').value;
        document.getElementById('studentClassManual').value = document.getElementById('studentClassUpload').value;
        
        this.extractedAnswersFromOCR.forEach((ans, i) => {
            const input = document.getElementById(`manual_${i + 1}`);
            if (input && ans !== '-') input.value = ans;
        });
    },
    
    checkManualAnswers() {
        this.studentAnswers = [];
        const name = document.getElementById('studentNameManual').value.trim();
        
        for (let i = 1; i <= this.totalQuestions; i++) {
            const val = document.getElementById(`manual_${i}`)?.value.toUpperCase() || '';
            this.studentAnswers.push(val || '-');
        }
        
        this.checkAndShowResults(name, document.getElementById('studentClassManual').value);
    },
    
    /**
     * Core check logic
     */
    checkAndShowResults(name, studentClass) {
        if (!name) {
            this.showToast('Nama siswa wajib diisi!', 'error');
            return;
        }
        
        let correct = 0, wrong = 0, empty = 0;
        const details = [];
        
        for (let i = 0; i < this.totalQuestions; i++) {
            const key = this.answerKey[i];
            const ans = this.studentAnswers[i];
            
            if (ans === '-') {
                empty++;
                details.push({ no: i + 1, key, answer: ans, status: 'empty' });
            } else if (ans === key) {
                correct++;
                details.push({ no: i + 1, key, answer: ans, status: 'correct' });
            } else {
                wrong++;
                details.push({ no: i + 1, key, answer: ans, status: 'wrong' });
            }
        }
        
        const score = this.totalQuestions > 0 ? (correct / this.totalQuestions) * 100 : 0;
        
        this.currentResult = {
            name,
            class: studentClass || '-',
            correct, wrong, empty,
            score: score.toFixed(2),
            details,
            examType: this.examConfig.type,
            subject: this.examConfig.subject,
            totalQuestions: this.totalQuestions
        };
        
        // Save to history
        historyManager.add({...this.currentResult});
        
        this.displayResults(score, correct, wrong, empty, details);
    },
    
    displayResults(score, correct, wrong, empty, details) {
        document.getElementById('resultName').textContent = this.currentResult.name;
        document.getElementById('resultClass').textContent = `${this.currentResult.class} • ${this.currentResult.subject}`;
        document.getElementById('resultExamType').textContent = this.currentResult.examType;
        document.getElementById('scoreDisplay').textContent = score.toFixed(1);
        document.getElementById('correctCount').textContent = correct;
        document.getElementById('wrongCount').textContent = wrong;
        document.getElementById('emptyCount').textContent = empty;
        
        // Animate score circle
        const circle = document.getElementById('scoreCircle');
        const circumference = 2 * Math.PI * 54;
        const offset = circumference - (score / 100) * circumference;
        setTimeout(() => {
            circle.style.strokeDashoffset = offset;
        }, 100);
        
        // Grid
        document.getElementById('detailGrid').innerHTML = details.map(d => `
            <div class="answer-item ${d.status}" onclick="app.scrollToRow(${d.no})">
                <div class="answer-number">No. ${d.no}</div>
                <div class="answer-value">${d.answer !== '-' ? d.answer : '?'}</div>
                <div class="answer-key">K: ${d.key}</div>
            </div>
        `).join('');
        
        // Table
        document.getElementById('comparisonTableBody').innerHTML = details.map(d => `
            <tr id="row-${d.no}">
                <td><strong>${d.no}</strong></td>
                <td>${d.key}</td>
                <td>${d.answer !== '-' ? d.answer : '<em>-</em>'}</td>
                <td><span class="status-badge ${d.status}">${d.status === 'correct' ? 'Benar' : d.status === 'wrong' ? 'Salah' : 'Kosong'}</span></td>
                <td>${d.status === 'correct' ? '✓ Sesuai' : d.status === 'wrong' ? `✗ Seharusnya ${d.key}` : '− Tidak dijawab'}</td>
            </tr>
        `).join('');
        
        document.getElementById('resultSection').classList.remove('hidden');
        setTimeout(() => {
            const offset = window.innerWidth < 768 ? 60 : 80;
            const top = document.getElementById('resultSection').getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }, 100);
    },
    
    scrollToRow(no) {
        const row = document.getElementById(`row-${no}`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.style.background = '#e0e7ff';
            setTimeout(() => row.style.background = '', 1500);
        }
    },
    
    resetForNewStudent() {
        document.getElementById('studentNameUpload').value = '';
        document.getElementById('studentNameManual').value = '';
        document.getElementById('studentClassUpload').value = '';
        document.getElementById('studentClassManual').value = '';
        this.clearImage();
        
        for (let i = 1; i <= this.totalQuestions; i++) {
            const input = document.getElementById(`manual_${i}`);
            if (input) input.value = '';
        }
        
        document.getElementById('resultSection').classList.add('hidden');
        this.switchTab('upload');
        
        setTimeout(() => {
            const offset = window.innerWidth < 768 ? 60 : 80;
            const top = document.getElementById('studentSection').getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }, 100);
    },
    
    exportResults() {
        if (!this.currentResult) return;
        
        let csv = '\uFEFF';
        csv += 'No,Kunci,Jawaban,Status,Keterangan\n';
        this.currentResult.details.forEach(d => {
            const status = d.status === 'correct' ? 'Benar' : d.status === 'wrong' ? 'Salah' : 'Kosong';
            const ket = d.status === 'correct' ? 'Sesuai kunci' : d.status === 'wrong' ? `Seharusnya ${d.key}` : 'Tidak dijawab';
            csv += `${d.no},${d.key},${d.answer},${status},${ket}\n`;
        });
        
        csv += `\nNama,${this.currentResult.name}\n`;
        csv += `Kelas,${this.currentResult.class}\n`;
        csv += `Jenis Ujian,${this.currentResult.examType}\n`;
        csv += `Mapel,${this.currentResult.subject}\n`;
        csv += `Benar,${this.currentResult.correct}\n`;
        csv += `Salah,${this.currentResult.wrong}\n`;
        csv += `Kosong,${this.currentResult.empty}\n`;
        csv += `Nilai,${this.currentResult.score}\n`;
        csv += `Tanggal,${new Date().toLocaleString('id-ID')}\n`;
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `AutoGrader_${this.currentResult.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        this.showToast('File CSV berhasil diunduh!', 'success');
    },
    
    switchTab(tab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        
        if (tab === 'upload') {
            document.querySelectorAll('.tab')[0]?.classList.add('active');
            document.getElementById('uploadTab')?.classList.add('active');
        } else {
            document.querySelectorAll('.tab')[1]?.classList.add('active');
            document.getElementById('manualTab')?.classList.add('active');
        }
    },
    
    switchOcrTab(tab) {
        document.querySelectorAll('.ocr-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.ocr-tab-content').forEach(t => t.classList.remove('active'));
        
        if (tab === 'answers') {
            document.querySelectorAll('.ocr-tab')[0]?.classList.add('active');
            document.getElementById('ocrTabAnswers')?.classList.add('active');
        } else {
            document.querySelectorAll('.ocr-tab')[1]?.classList.add('active');
            document.getElementById('ocrTabText')?.classList.add('active');
        }
    },
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.background = type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : type === 'warning' ? '#d97706' : '#1f2937';
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

window.app = app;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fileInput')?.addEventListener('change', (e) => app.handleFileSelect(e));
});