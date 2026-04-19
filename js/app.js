/**
 * AutoGrader - Main Application Module
 * Pemeriksa lembar jawaban ujian dengan OCR
 * Fully responsive, mobile-optimized
 */

const app = {
    // State
    answerKey: [],
    studentAnswers: [],
    extractedAnswersFromOCR: [],
    currentResult: null,
    totalQuestions: 20,
    
    /**
     * Getter untuk total questions
     */
    getTotalQuestions() {
        return this.totalQuestions;
    },
    
    /**
     * Setter untuk extracted answers dari OCR
     */
    setExtractedAnswers(answers) {
        this.extractedAnswersFromOCR = Array.isArray(answers) ? answers : [];
    },
    
    /**
     * Generate input fields untuk kunci jawaban
     */
    generateAnswerInputs() {
        this.totalQuestions = parseInt(document.getElementById('totalQuestions').value) || 20;
        
        if (this.totalQuestions < 1 || this.totalQuestions > 200) {
            alert('Jumlah soal harus antara 1-200');
            return;
        }
        
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
                           inputmode="text"
                           autocomplete="off"
                           oninput="app.validateAnswerInput(this)"
                           onkeydown="app.handleKeyNavigation(event, ${i}, 'key')">
                </div>
            `;
        }
        html += '</div>';
        
        container.innerHTML = html;
        document.getElementById('saveKeyBtn').classList.remove('hidden');
        
        // Focus first input
        setTimeout(() => {
            const firstInput = document.getElementById('key_1');
            if (firstInput) firstInput.focus();
        }, 100);
    },
    
    /**
     * Validasi input jawaban (hanya A-E)
     */
    validateAnswerInput(input) {
        const valid = ['A', 'B', 'C', 'D', 'E', 'a', 'b', 'c', 'd', 'e'];
        const val = input.value;
        
        if (!valid.includes(val) && val !== '') {
            input.value = '';
            // Haptic feedback jika tersedia
            if (navigator.vibrate) navigator.vibrate(50);
        } else {
            input.value = val.toUpperCase();
            
            // Auto-advance to next input
            const currentId = input.id;
            const match = currentId.match(/(\d+)$/);
            if (match) {
                const currentNum = parseInt(match[1]);
                const nextInput = document.getElementById(currentId.replace(/\d+$/, '') + (currentNum + 1));
                if (nextInput && val !== '') {
                    setTimeout(() => nextInput.focus(), 50);
                }
            }
        }
    },
    
    /**
     * Handle keyboard navigation
     */
    handleKeyNavigation(event, currentNum, prefix) {
        let nextNum = null;
        
        if (event.key === 'ArrowRight' || event.key === 'Enter') {
            nextNum = currentNum + 1;
        } else if (event.key === 'ArrowLeft') {
            nextNum = currentNum - 1;
        } else if (event.key === 'ArrowDown') {
            // Estimate row size based on screen width
            const rowSize = window.innerWidth < 576 ? 2 : window.innerWidth < 768 ? 3 : 4;
            nextNum = currentNum + rowSize;
        } else if (event.key === 'ArrowUp') {
            const rowSize = window.innerWidth < 576 ? 2 : window.innerWidth < 768 ? 3 : 4;
            nextNum = currentNum - rowSize;
        }
        
        if (nextNum !== null && nextNum >= 1 && nextNum <= this.totalQuestions) {
            const nextInput = document.getElementById(`${prefix}_${nextNum}`);
            if (nextInput) {
                event.preventDefault();
                nextInput.focus();
            }
        }
    },
    
    /**
     * Simpan kunci jawaban dan generate form siswa
     */
    saveAnswerKey() {
        this.answerKey = [];
        let emptyCount = 0;
        
        for (let i = 1; i <= this.totalQuestions; i++) {
            const input = document.getElementById(`key_${i}`);
            const val = input ? input.value.toUpperCase() : '';
            if (!val) emptyCount++;
            this.answerKey.push(val || '-');
        }
        
        if (emptyCount > 0) {
            if (!confirm(`Ada ${emptyCount} jawaban yang kosong. Lanjutkan?`)) return;
        }
        
        // Generate manual inputs untuk siswa
        this.generateStudentInputs();
        
        // Show student section dengan animasi
        const studentSection = document.getElementById('studentSection');
        studentSection.classList.remove('hidden');
        
        // Scroll dengan offset untuk mobile
        setTimeout(() => {
            const offset = window.innerWidth < 768 ? 80 : 100;
            const top = studentSection.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }, 100);
        
        // Initialize OCR worker di background
        if (window.ocrHandler) {
            window.ocrHandler.initializeWorker().catch(() => {
                // Silent fail
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
                           inputmode="text"
                           autocomplete="off"
                           oninput="app.validateAnswerInput(this)"
                           onkeydown="app.handleKeyNavigation(event, ${i}, 'manual')">
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
        
        // Validasi file type
        if (!file.type.startsWith('image/')) {
            alert('Mohon upload file gambar (JPG, PNG, GIF, BMP, WEBP)');
            return;
        }
        
        // Validasi file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('Ukuran file terlalu besar. Maksimal 10MB.');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                console.log('Loading image:', percent + '%');
            }
        };
        
        reader.onload = (e) => {
            const img = document.getElementById('previewImage');
            img.src = e.target.result;
            img.onload = () => {
                document.getElementById('previewContainer').classList.remove('hidden');
                
                // Scroll ke preview di mobile
                if (window.innerWidth < 768) {
                    setTimeout(() => {
                        document.getElementById('previewContainer').scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'nearest' 
                        });
                    }, 100);
                }
            };
        };
        
        reader.onerror = () => {
            alert('Gagal membaca file. Coba file lain.');
        };
        
        reader.readAsDataURL(file);
    },
    
    /**
     * Clear gambar yang diupload
     */
    clearImage() {
        const fileInput = document.getElementById('fileInput');
        const previewContainer = document.getElementById('previewContainer');
        const ocrResult = document.getElementById('ocrResult');
        const progressContainer = document.getElementById('progressContainer');
        const previewImage = document.getElementById('previewImage');
        
        if (fileInput) fileInput.value = '';
        if (previewContainer) previewContainer.classList.add('hidden');
        if (ocrResult) ocrResult.classList.add('hidden');
        if (progressContainer) progressContainer.classList.add('hidden');
        if (previewImage) previewImage.src = '';
        
        this.extractedAnswersFromOCR = [];
    },
    
    /**
     * Gunakan jawaban hasil OCR
     */
    useExtractedAnswers() {
        this.studentAnswers = [...this.extractedAnswersFromOCR];
        const studentName = document.getElementById('studentNameUpload').value.trim() || 'Siswa';
        
        if (!studentName || studentName === 'Siswa') {
            // Scroll ke nama input
            document.getElementById('studentNameUpload').focus();
            return;
        }
        
        this.checkAndShowResults(studentName);
    },
    
    /**
     * Edit jawaban hasil OCR (switch ke manual)
     */
    editExtractedAnswers() {
        this.switchTab('manual');
        
        const uploadName = document.getElementById('studentNameUpload').value;
        document.getElementById('studentNameManual').value = uploadName;
        
        // Fill manual inputs dengan hasil OCR
        this.extractedAnswersFromOCR.forEach((ans, idx) => {
            const input = document.getElementById(`manual_${idx + 1}`);
            if (input && ans !== '-') {
                input.value = ans;
            }
        });
        
        // Scroll ke form
        setTimeout(() => {
            document.getElementById('manualInputsContainer').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
    },
    
    /**
     * Check jawaban manual
     */
    checkManualAnswers() {
        this.studentAnswers = [];
        const studentName = document.getElementById('studentNameManual').value.trim() || 'Siswa';
        
        for (let i = 1; i <= this.totalQuestions; i++) {
            const input = document.getElementById(`manual_${i}`);
            const val = input ? input.value.toUpperCase() : '';
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
            details,
            timestamp: new Date().toISOString()
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
            <div class="answer-item ${d.status}" onclick="app.scrollToTableRow(${d.no})">
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
                              d.status === 'wrong' ? `Seharusnya ${d.key}` :
                              'Tidak dijawab';
            
            return `
                <tr id="row-${d.no}">
                    <td><strong>${d.no}</strong></td>
                    <td><strong>${d.key}</strong></td>
                    <td>${d.answer !== '-' ? d.answer : '<em style="color: #999;">-</em>'}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${keterangan}</td>
                </tr>
            `;
        }).join('');
        
        // Show result section
        const resultSection = document.getElementById('resultSection');
        resultSection.classList.remove('hidden');
        
        // Scroll dengan offset untuk mobile
        setTimeout(() => {
            const offset = window.innerWidth < 768 ? 60 : 80;
            const top = resultSection.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }, 100);
    },
    
    /**
     * Scroll ke row tertentu di tabel
     */
    scrollToTableRow(rowNum) {
        const row = document.getElementById(`row-${rowNum}`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.style.background = '#e0e7ff';
            setTimeout(() => {
                row.style.background = '';
            }, 2000);
        }
    },
    
    /**
     * Reset untuk siswa baru
     */
    resetForNewStudent() {
        // Clear inputs
        const nameUpload = document.getElementById('studentNameUpload');
        const nameManual = document.getElementById('studentNameManual');
        if (nameUpload) nameUpload.value = '';
        if (nameManual) nameManual.value = '';
        
        // Clear image
        this.clearImage();
        
        // Clear manual inputs
        for (let i = 1; i <= this.totalQuestions; i++) {
            const input = document.getElementById(`manual_${i}`);
            if (input) input.value = '';
        }
        
        // Hide result
        document.getElementById('resultSection').classList.add('hidden');
        
        // Reset tabs ke upload
        this.switchTab('upload');
        
        // Scroll ke student section
        setTimeout(() => {
            const offset = window.innerWidth < 768 ? 60 : 80;
            const section = document.getElementById('studentSection');
            const top = section.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }, 100);
    },
    
    /**
     * Export hasil ke CSV
     */
    exportResults() {
        if (!this.currentResult) {
            alert('Tidak ada hasil untuk diexport');
            return;
        }
        
        let csv = '\uFEFF'; // BOM for Excel UTF-8
        
        // Header
        csv += 'No,Kunci Jawaban,Jawaban Siswa,Status,Keterangan\n';
        
        // Data
        this.currentResult.details.forEach(d => {
            const status = d.status === 'correct' ? 'Benar' : d.status === 'wrong' ? 'Salah' : 'Kosong';
            const keterangan = d.status === 'correct' ? 'Jawaban sesuai kunci' :
                              d.status === 'wrong' ? `Jawaban seharusnya ${d.key}` :
                              'Tidak dijawab';
            csv += `${d.no},${d.key},${d.answer},${status},${keterangan}\n`;
        });
        
        // Summary
        csv += `\nNama Siswa,${this.currentResult.name}\n`;
        csv += `Benar,${this.currentResult.correct}\n`;
        csv += `Salah,${this.currentResult.wrong}\n`;
        csv += `Kosong,${this.currentResult.empty}\n`;
        csv += `Nilai,${this.currentResult.score}\n`;
        csv += `Tanggal,${new Date().toLocaleString('id-ID')}\n`;
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        const timestamp = new Date().toISOString().split('T')[0];
        const safeName = this.currentResult.name.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
        link.download = `ExamScan_${safeName}_${timestamp}.csv`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Feedback
        if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
    },
    
    /**
     * Switch tab (upload/manual)
     */
    switchTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        
        if (tab === 'upload') {
            document.querySelectorAll('.tab')[0]?.classList.add('active');
            document.getElementById('uploadTab')?.classList.add('active');
        } else {
            document.querySelectorAll('.tab')[1]?.classList.add('active');
            document.getElementById('manualTab')?.classList.add('active');
        }
    }
};

// Expose to global
window.app = app;

// Event listeners saat DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // File input handler
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => app.handleFileSelect(e));
    }
    
    // Handle visibility change untuk pause/resume OCR
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && window.ocrHandler) {
            // Pause processing if needed
            console.log('Tab hidden, OCR processing paused');
        }
    });
    
    // Handle online/offline
    window.addEventListener('online', () => {
        console.log('Connection restored');
    });
    
    window.addEventListener('offline', () => {
        alert('Koneksi internet terputus. Beberapa fitur mungkin tidak berfungsi.');
    });
});