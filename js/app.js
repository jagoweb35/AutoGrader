/**
 * ExamScan - Main Application Module
 * Mengelola logika aplikasi pemeriksa lembar jawaban
 */

const app = {
    // State
    answerKey: [],
    studentAnswers: [],
    extractedAnswersFromOCR: [],
    currentResult: null,
    totalQuestions: 20,
    
    /**
     * Getter untuk total questions (digunakan oleh OCR handler)
     */
    getTotalQuestions() {
        return this.totalQuestions;
    },
    
    /**
     * Setter untuk extracted answers dari OCR
     */
    setExtractedAnswers(answers) {
        this.extractedAnswersFromOCR = answers;
    },
    
    /**
     * Generate input fields untuk kunci jawaban
     */
    generateAnswerInputs() {
        this.totalQuestions = parseInt(document.getElementById('totalQuestions').value) || 20;
        const container = document.getElementById('answerKeyContainer');
        
        let html = '<div class="manual-input-grid">';
        for (let i = 1; i <= this.totalQuestions; i++) {
            html += `
                <div class="manual-input-item">
                    <label for="key_${i}">No. ${i}</label>
                    <input type="text" 
                           id="key_${i}" 
                           maxlength="1" 
                           placeholder="A-E"
                           oninput="app.validateAnswerInput(this)">
                </div>
            `;
        }
        html += '</div>';
        
        container.innerHTML = html;
        document.getElementById('saveKeyBtn').classList.remove('hidden');
    },
    
    /**
     * Validasi input jawaban (hanya A-E)
     */
    validateAnswerInput(input) {
        const valid = ['A', 'B', 'C', 'D', 'E', 'a', 'b', 'c', 'd', 'e'];
        const val = input.value;
        
        if (!valid.includes(val) && val !== '') {
            input.value = '';
            this.showAlert('Hanya boleh A, B, C, D, atau E', 'warning');
        } else {
            input.value = val.toUpperCase();
        }
    },
    
    /**
     * Show alert sederhana
     */
    showAlert(message, type = 'info') {
        alert(message);
    },
    
    /**
     * Simpan kunci jawaban dan generate form siswa
     */
    saveAnswerKey() {
        this.answerKey = [];
        let emptyCount = 0;
        
        for (let i = 1; i <= this.totalQuestions; i++) {
            const val = document.getElementById(`key_${i}`).value.toUpperCase();
            if (!val) emptyCount++;
            this.answerKey.push(val || '-');
        }
        
        if (emptyCount > 0) {
            if (!confirm(`Ada ${emptyCount} jawaban yang kosong. Lanjutkan?`)) return;
        }
        
        // Generate manual inputs untuk siswa
        this.generateStudentInputs();
        
        // Show student section
        document.getElementById('studentSection').classList.remove('hidden');
        document.getElementById('studentSection').scrollIntoView({ behavior: 'smooth' });
        
        // Initialize OCR worker di background
        if (window.ocrHandler) {
            window.ocrHandler.initializeWorker().then(() => {
                console.log('OCR Worker ready');
            });
        }
    },
    
    /**
     * Generate input fields untuk jawaban siswa (manual)
     */
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
                           placeholder="A-E"
                           oninput="app.validateAnswerInput(this)">
                </div>
            `;
        }
        html += '</div>';
        
        container.innerHTML = html;
    },
    
    /**
     * Handle file selection untuk upload gambar
     */
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('Mohon upload file gambar (JPG, PNG, GIF, BMP, WEBP)');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.getElementById('previewImage');
            img.src = e.target.result;
            document.getElementById('previewContainer').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    },
    
    /**
     * Clear gambar yang diupload
     */
    clearImage() {
        document.getElementById('fileInput').value = '';
        document.getElementById('previewContainer').classList.add('hidden');
        document.getElementById('ocrResult').classList.add('hidden');
        document.getElementById('progressContainer').classList.add('hidden');
    },
    
    /**
     * Gunakan jawaban hasil OCR
     */
    useExtractedAnswers() {
        this.studentAnswers = [...this.extractedAnswersFromOCR];
        const studentName = document.getElementById('studentNameUpload').value || 'Siswa';
        this.checkAndShowResults(studentName);
    },
    
    /**
     * Edit jawaban hasil OCR (switch ke manual)
     */
    editExtractedAnswers() {
        this.switchTab('manual');
        document.getElementById('studentNameManual').value = document.getElementById('studentNameUpload').value;
        
        // Fill manual inputs dengan hasil OCR
        this.extractedAnswersFromOCR.forEach((ans, idx) => {
            const input = document.getElementById(`manual_${idx + 1}`);
            if (input && ans !== '-') {
                input.value = ans;
            }
        });
    },
    
    /**
     * Check jawaban manual
     */
    checkManualAnswers() {
        this.studentAnswers = [];
        const studentName = document.getElementById('studentNameManual').value || 'Siswa';
        
        for (let i = 1; i <= this.totalQuestions; i++) {
            const val = document.getElementById(`manual_${i}`).value.toUpperCase();
            this.studentAnswers.push(val || '-');
        }
        
        this.checkAndShowResults(studentName);
    },
    
    /**
     * Core checking logic
     */
    checkAndShowResults(studentName) {
        let correct = 0;
        let wrong = 0;
        let empty = 0;
        const details = [];
        
        for (let i = 0; i < this.totalQuestions; i++) {
            const key = this.answerKey[i];
            const answer = this.studentAnswers[i];
            
            if (answer === '-') {
                empty++;
                details.push({ no: i + 1, key, answer, status: 'empty' });
            } else if (answer === key) {
                correct++;
                details.push({ no: i + 1, key, answer, status: 'correct' });
            } else {
                wrong++;
                details.push({ no: i + 1, key, answer, status: 'wrong' });
            }
        }
        
        const score = this.totalQuestions > 0 ? (correct / this.totalQuestions) * 100 : 0;
        
        this.currentResult = {
            name: studentName,
            correct,
            wrong,
            empty,
            score: score.toFixed(2),
            details
        };
        
        this.displayResults(studentName, score, correct, wrong, empty, details);
    },
    
    /**
     * Display hasil pemeriksaan
     */
    displayResults(name, score, correct, wrong, empty, details) {
        // Update score box
        document.getElementById('resultName').textContent = name;
        document.getElementById('scoreDisplay').textContent = score.toFixed(2);
        document.getElementById('correctCount').textContent = correct;
        document.getElementById('wrongCount').textContent = wrong;
        document.getElementById('emptyCount').textContent = empty;
        
        // Detail grid
        const grid = document.getElementById('detailGrid');
        grid.innerHTML = details.map(d => `
            <div class="answer-item ${d.status}">
                <div class="answer-number">No. ${d.no}</div>
                <div class="answer-value">${d.answer !== '-' ? d.answer : '?'}</div>
                <div class="answer-key">Kunci: ${d.key}</div>
                <div style="margin-top: 8px; font-size: 1.3em;">
                    ${d.status === 'correct' ? '✅' : d.status === 'wrong' ? '❌' : '⚠️'}
                </div>
            </div>
        `).join('');
        
        // Comparison table
        const tableBody = document.getElementById('comparisonTableBody');
        tableBody.innerHTML = details.map(d => {
            const statusClass = d.status === 'correct' ? 'badge-success' : 
                               d.status === 'wrong' ? 'badge-danger' : 'badge-warning';
            const statusText = d.status === 'correct' ? 'Benar' : 
                              d.status === 'wrong' ? 'Salah' : 'Kosong';
            const keterangan = d.status === 'correct' ? 'Jawaban sesuai kunci' :
                              d.status === 'wrong' ? `Jawaban seharusnya ${d.key}` :
                              'Tidak dijawab';
            
            return `
                <tr>
                    <td><strong>${d.no}</strong></td>
                    <td><strong>${d.key}</strong></td>
                    <td>${d.answer !== '-' ? d.answer : '<em style="color: #999;">-</em>'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${keterangan}</td>
                </tr>
            `;
        }).join('');
        
        // Show result section
        document.getElementById('resultSection').classList.remove('hidden');
        document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
    },
    
    /**
     * Reset untuk siswa baru
     */
    resetForNewStudent() {
        // Clear inputs
        document.getElementById('studentNameUpload').value = '';
        document.getElementById('studentNameManual').value = '';
        
        // Clear image
        this.clearImage();
        
        // Clear manual inputs
        for (let i = 1; i <= this.totalQuestions; i++) {
            const input = document.getElementById(`manual_${i}`);
            if (input) input.value = '';
        }
        
        // Hide result
        document.getElementById('resultSection').classList.add('hidden');
        
        // Scroll to student section
        document.getElementById('studentSection').scrollIntoView({ behavior: 'smooth' });
    },
    
    /**
     * Export hasil ke CSV
     */
    exportResults() {
        if (!this.currentResult) return;
        
        let csv = 'No,Kunci Jawaban,Jawaban Siswa,Status,Keterangan\n';
        this.currentResult.details.forEach(d => {
            const status = d.status === 'correct' ? 'Benar' : d.status === 'wrong' ? 'Salah' : 'Kosong';
            const keterangan = d.status === 'correct' ? 'Jawaban sesuai kunci' :
                              d.status === 'wrong' ? `Jawaban seharusnya ${d.key}` :
                              'Tidak dijawab';
            csv += `${d.no},${d.key},${d.answer},${status},${keterangan}\n`;
        });
        
        csv += `\nNama Siswa,${this.currentResult.name}\n`;
        csv += `Benar,${this.currentResult.correct}\n`;
        csv += `Salah,${this.currentResult.wrong}\n`;
        csv += `Kosong,${this.currentResult.empty}\n`;
        csv += `Nilai,${this.currentResult.score}\n`;
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().split('T')[0];
        link.download = `hasil_ujian_${this.currentResult.name.replace(/\s+/g, '_')}_${timestamp}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    },
    
    /**
     * Switch tab (upload/manual)
     */
    switchTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        
        if (tab === 'upload') {
            document.querySelectorAll('.tab')[0].classList.add('active');
            document.getElementById('uploadTab').classList.add('active');
        } else {
            document.querySelectorAll('.tab')[1].classList.add('active');
            document.getElementById('manualTab').classList.add('active');
        }
    }
};

// Expose to global untuk akses dari HTML
window.app = app;

// Event listener untuk file input
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => app.handleFileSelect(e));
    }
});