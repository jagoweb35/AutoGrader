/**
 * OCR Handler Module
 * Mengelola semua fungsi Optical Character Recognition menggunakan Tesseract.js
 */

const ocrHandler = {
    // Tesseract worker instance
    worker: null,
    
    /**
     * Inisialisasi Tesseract worker
     */
    async initializeWorker() {
        if (!this.worker) {
            try {
                this.worker = await Tesseract.createWorker('eng');
                console.log('OCR Worker initialized successfully');
            } catch (error) {
                console.error('Failed to initialize OCR worker:', error);
                throw new Error('Gagal menginisialisasi OCR. Pastikan internet stabil.');
            }
        }
    },
    
    /**
     * Terminate worker untuk cleanup
     */
    async terminateWorker() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            console.log('OCR Worker terminated');
        }
    },
    
    /**
     * Proses gambar dengan OCR
     */
    async processImage() {
        const img = document.getElementById('previewImage');
        if (!img || !img.src || img.src === '') {
            alert('Silakan upload gambar terlebih dahulu');
            return;
        }
        
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const processBtn = document.getElementById('processBtn');
        
        // Show progress
        progressContainer.classList.remove('hidden');
        processBtn.disabled = true;
        
        try {
            // Initialize worker if not ready
            await this.initializeWorker();
            
            // Process image
            const result = await this.worker.recognize(img.src, {}, {
                logger: (m) => {
                    this.updateProgress(m, progressFill, progressText);
                }
            });
            
            const text = result.data.text;
            
            // Display OCR text
            document.getElementById('ocrText').textContent = text;
            
            // Extract answers
            const extractedAnswers = this.extractAnswersFromText(text);
            
            // Store in app module
            if (window.app) {
                window.app.setExtractedAnswers(extractedAnswers);
            }
            
            // Display extracted answers
            this.displayExtractedAnswers(extractedAnswers);
            
            // Show result section
            document.getElementById('ocrResult').classList.remove('hidden');
            
            // Hide progress
            progressContainer.classList.add('hidden');
            
        } catch (error) {
            console.error('OCR Error:', error);
            alert('Terjadi kesalahan saat memproses gambar: ' + error.message);
            progressContainer.classList.add('hidden');
        } finally {
            processBtn.disabled = false;
        }
    },
    
    /**
     * Update progress bar dan text
     */
    updateProgress(message, progressFill, progressText) {
        if (message.status === 'recognizing text') {
            const progress = Math.round(message.progress * 100);
            progressFill.style.width = progress + '%';
            progressFill.textContent = progress + '%';
            progressText.textContent = `Mengenali teks... ${progress}%`;
        } else {
            progressText.textContent = message.status;
        }
    },
    
    /**
     * Ekstrak jawaban dari teks OCR menggunakan pattern recognition
     */
    extractAnswersFromText(text) {
        const totalQuestions = window.app ? window.app.getTotalQuestions() : 20;
        const answers = [];
        const foundAnswers = new Map();
        
        // Pattern 1: "1. A" atau "1.A" atau "1 - A"
        const pattern1 = /(\d+)[\.\)\-]?\s*([A-Ea-e])/g;
        
        // Pattern 2: "No 1: A" atau "Nomor 1: A"
        const pattern2 = /(?:no|nomor)\s*(\d+)[:.]?\s*([A-Ea-e])/gi;
        
        // Pattern 3: "1 A" (angka diikuti huruf dengan spasi)
        const pattern3 = /(?:^|\s)(\d+)\s+([A-Ea-e])(?:\s|$)/g;
        
        // Pattern 4: "1-A" atau "1/A"
        const pattern4 = /(\d+)[\-\/]([A-Ea-e])/g;
        
        let match;
        
        // Coba semua pattern
        const patterns = [pattern1, pattern2, pattern3, pattern4];
        
        patterns.forEach((pattern, index) => {
            // Reset lastIndex untuk regex global
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(text)) !== null) {
                const num = parseInt(match[1]);
                const ans = match[2].toUpperCase();
                
                // Validasi nomor soal
                if (num >= 1 && num <= totalQuestions) {
                    // Prioritaskan pattern yang lebih spesifik (index lebih rendah)
                    if (!foundAnswers.has(num) || index < 2) {
                        foundAnswers.set(num, ans);
                    }
                }
            }
        });
        
        // Convert Map ke array
        for (let i = 1; i <= totalQuestions; i++) {
            answers.push(foundAnswers.get(i) || '-');
        }
        
        console.log('Extracted answers:', answers);
        return answers;
    },
    
    /**
     * Tampilkan jawaban yang berhasil diekstrak
     */
    displayExtractedAnswers(answers) {
        const container = document.getElementById('extractedAnswers');
        
        if (!container) return;
        
        let html = '';
        let detectedCount = 0;
        
        answers.forEach((ans, idx) => {
            if (ans !== '-') {
                html += `<span class="extracted-answer">No. ${idx + 1}: ${ans}</span>`;
                detectedCount++;
            }
        });
        
        if (detectedCount === 0) {
            html = '<span style="color: #999; font-style: italic;">Tidak ada jawaban terdeteksi. Silakan input manual atau coba gambar yang lebih jelas.</span>';
        } else {
            html += `<div style="width: 100%; margin-top: 10px; color: #666; font-size: 0.9em;">
                Terdeteksi ${detectedCount} jawaban dari ${answers.length} soal
            </div>`;
        }
        
        container.innerHTML = html;
    },
    
    /**
     * Handle drag and drop events
     */
    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        
        if (!uploadArea || !fileInput) return;
        
        // Click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Drag events
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                // Trigger change event manually
                const event = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);
            }
        });
    }
};

// Setup drag and drop saat DOM ready
document.addEventListener('DOMContentLoaded', () => {
    ocrHandler.setupDragAndDrop();
});

// Cleanup saat unload
window.addEventListener('beforeunload', async () => {
    await ocrHandler.terminateWorker();
});