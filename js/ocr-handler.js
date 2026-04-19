/**
 * OCR Handler Module - AutoGrader
 * Mengelola Optical Character Recognition dengan Tesseract.js
 * Optimized for mobile devices
 */

const ocrHandler = {
    worker: null,
    isProcessing: false,
    
    /**
     * Inisialisasi Tesseract worker dengan error handling
     */
    async initializeWorker() {
        if (this.worker) return;
        
        try {
            // Show loading indicator if exists
            const progressText = document.getElementById('progressText');
            if (progressText) progressText.textContent = 'Menginisialisasi OCR engine...';
            
            this.worker = await Tesseract.createWorker('eng', 1, {
                logger: (m) => {
                    console.log('Tesseract:', m);
                },
                errorHandler: (err) => {
                    console.error('Tesseract error:', err);
                }
            });
            
            console.log('OCR Worker initialized successfully');
        } catch (error) {
            console.error('Failed to initialize OCR worker:', error);
            throw new Error('Gagal menginisialisasi OCR. Pastikan koneksi internet stabil dan coba refresh halaman.');
        }
    },
    
    /**
     * Terminate worker untuk cleanup memory
     */
    async terminateWorker() {
        if (this.worker) {
            try {
                await this.worker.terminate();
                this.worker = null;
                console.log('OCR Worker terminated');
            } catch (err) {
                console.error('Error terminating worker:', err);
            }
        }
    },
    
    /**
     * Proses gambar dengan OCR
     */
    async processImage() {
        if (this.isProcessing) {
            alert('Sedang memproses gambar, mohon tunggu...');
            return;
        }
        
        const img = document.getElementById('previewImage');
        if (!img || !img.src || img.src === '' || img.src === location.href) {
            alert('Silakan upload gambar terlebih dahulu');
            return;
        }
        
        this.isProcessing = true;
        
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const processBtn = document.getElementById('processBtn');
        const ocrResult = document.getElementById('ocrResult');
        
        // Show progress
        progressContainer.classList.remove('hidden');
        if (ocrResult) ocrResult.classList.add('hidden');
        if (processBtn) processBtn.disabled = true;
        
        // Reset progress
        if (progressFill) {
            progressFill.style.width = '0%';
            progressFill.textContent = '0%';
        }
        
        try {
            await this.initializeWorker();
            
            // Set progress handler
            const progressHandler = (m) => {
                this.updateProgress(m, progressFill, progressText);
            };
            
            // Process image with timeout
            const result = await Promise.race([
                this.worker.recognize(img.src, {}, {
                    logger: progressHandler
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout: OCR terlalu lama')), 60000)
                )
            ]);
            
            const text = result.data.text;
            
            // Display OCR text
            const ocrTextEl = document.getElementById('ocrText');
            if (ocrTextEl) ocrTextEl.textContent = text || '(Tidak ada teks terdeteksi)';
            
            // Extract answers
            const extractedAnswers = this.extractAnswersFromText(text);
            
            // Store in app module
            if (window.app) {
                window.app.setExtractedAnswers(extractedAnswers);
            }
            
            // Display extracted answers
            this.displayExtractedAnswers(extractedAnswers);
            
            // Show result section
            if (ocrResult) ocrResult.classList.remove('hidden');
            
            // Scroll to result on mobile
            if (window.innerWidth < 768) {
                ocrResult?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
        } catch (error) {
            console.error('OCR Error:', error);
            alert('Terjadi kesalahan saat memproses gambar: ' + error.message);
        } finally {
            this.isProcessing = false;
            progressContainer.classList.add('hidden');
            if (processBtn) processBtn.disabled = false;
        }
    },
    
    /**
     * Update progress bar dan text
     */
    updateProgress(message, progressFill, progressText) {
        if (message.status === 'recognizing text') {
            const progress = Math.round(message.progress * 100);
            if (progressFill) {
                progressFill.style.width = progress + '%';
                progressFill.textContent = progress + '%';
            }
            if (progressText) {
                progressText.textContent = `Mengenali teks... ${progress}%`;
            }
        } else {
            if (progressText) {
                // Capitalize first letter and translate common status
                const status = message.status
                    .replace('loading', 'Memuat')
                    .replace('initializing', 'Menginisialisasi')
                    .replace('loaded', 'Dimuat')
                    .replace('done', 'Selesai');
                progressText.textContent = status + '...';
            }
        }
    },
    
    /**
     * Ekstrak jawaban dari teks OCR
     */
    extractAnswersFromText(text) {
        const totalQuestions = window.app ? window.app.getTotalQuestions() : 20;
        const answers = [];
        const foundAnswers = new Map();
        
        if (!text || typeof text !== 'string') {
            // Return empty array
            for (let i = 1; i <= totalQuestions; i++) answers.push('-');
            return answers;
        }
        
        // Pattern 1: "1. A" atau "1.A" atau "1 - A" atau "1) A"
        const pattern1 = /(\d+)[\.\)\-\]]\s*([A-Ea-e])/g;
        
        // Pattern 2: "No 1: A" atau "Nomor 1: A" atau "No.1 A"
        const pattern2 = /(?:no|nomor|no\.)\s*(\d+)[:.\s]\s*([A-Ea-e])/gi;
        
        // Pattern 3: "1 A" (angka diikuti huruf dengan spasi)
        const pattern3 = /(?:^|\s)(\d{1,2})\s+([A-Ea-e])(?:\s|$|\n)/g;
        
        // Pattern 4: "1-A" atau "1/A" atau "1_A"
        const pattern4 = /(\d+)[\-\/_]([A-Ea-e])/g;
        
        // Pattern 5: "A" di awal baris dengan nomor implisit
        const lines = text.split('\n');
        let implicitNum = 1;
        
        for (let line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 1 && /[A-Ea-e]/.test(trimmed)) {
                if (implicitNum <= totalQuestions && !foundAnswers.has(implicitNum)) {
                    foundAnswers.set(implicitNum, trimmed.toUpperCase());
                }
                implicitNum++;
            }
        }
        
        // Try all patterns
        const patterns = [
            { pattern: pattern1, priority: 1 },
            { pattern: pattern2, priority: 2 },
            { pattern: pattern3, priority: 3 },
            { pattern: pattern4, priority: 4 }
        ];
        
        for (let { pattern, priority } of patterns) {
            pattern.lastIndex = 0;
            let match;
            
            while ((match = pattern.exec(text)) !== null) {
                const num = parseInt(match[1]);
                const ans = match[2].toUpperCase();
                
                if (num >= 1 && num <= totalQuestions) {
                    // Only update if not found or higher priority
                    const existing = foundAnswers.get(num);
                    if (!existing || priority < 2) {
                        foundAnswers.set(num, ans);
                    }
                }
            }
        }
        
        // Convert Map to array
        for (let i = 1; i <= totalQuestions; i++) {
            answers.push(foundAnswers.get(i) || '-');
        }
        
        console.log('OCR Extracted:', foundAnswers.size, 'answers from', totalQuestions, 'questions');
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
            html = `
                <div style="width: 100%; text-align: center; padding: var(--space-4); color: var(--text-secondary);">
                    <p>⚠️ Tidak ada jawaban terdeteksi</p>
                    <p style="font-size: var(--font-sm); margin-top: var(--space-2);">
                        Tips: Pastikan gambar jelas, coba foto ulang dengan pencahayaan lebih baik
                    </p>
                </div>
            `;
        } else {
            html += `
                <div style="width: 100%; margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--border-color); color: var(--text-secondary); font-size: var(--font-sm);">
                    Terdeteksi ${detectedCount} dari ${answers.length} jawaban
                    ${detectedCount < answers.length ? ' - Sisanya bisa diisi manual' : ' ✓'}
                </div>
            `;
        }
        
        container.innerHTML = html;
    },
    
    /**
     * Setup drag and drop events
     */
    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        
        if (!uploadArea || !fileInput) return;
        
        // Click to upload
        uploadArea.addEventListener('click', (e) => {
            if (e.target === uploadArea || uploadArea.contains(e.target)) {
                fileInput.click();
            }
        });
        
        // Keyboard accessibility
        uploadArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInput.click();
            }
        });
        
        // Drag events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('dragover');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                if (eventName === 'dragleave' && !uploadArea.contains(e.relatedTarget)) {
                    uploadArea.classList.remove('dragover');
                }
                if (eventName === 'drop') {
                    uploadArea.classList.remove('dragover');
                }
            }, false);
        });
        
        // Handle drop
        uploadArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                fileInput.files = files;
                // Trigger change event
                const event = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);
            }
        });
        
        // Handle paste from clipboard
        document.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    const file = new File([blob], 'pasted-image.png', { type: blob.type });
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    fileInput.files = dataTransfer.files;
                    
                    const event = new Event('change', { bubbles: true });
                    fileInput.dispatchEvent(event);
                    break;
                }
            }
        });
    }
};

// Setup saat DOM ready
document.addEventListener('DOMContentLoaded', () => {
    ocrHandler.setupDragAndDrop();
    
    // Pre-initialize worker untuk performa lebih baik
    setTimeout(() => {
        if (document.getElementById('studentSection') && 
            !document.getElementById('studentSection').classList.contains('hidden')) {
            ocrHandler.initializeWorker().catch(() => {
                // Silent fail, akan diinisialisasi saat diproses
            });
        }
    }, 1000);
});

// Cleanup saat unload
window.addEventListener('beforeunload', async () => {
    await ocrHandler.terminateWorker();
});

// Expose ke global
window.ocrHandler = ocrHandler;