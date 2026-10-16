// Kopieert OCR-bestanden (Tesseract worker, core en NL/EN taaldata) naar public/ocr,
// zodat de app niet afhankelijk is van een externe CDN.
import { cpSync, mkdirSync } from 'node:fs'

const out = 'public/ocr'
mkdirSync(`${out}/lang`, { recursive: true })
cpSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`)
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js']) cpSync(`node_modules/tesseract.js-core/${f}`, `${out}/${f}`)
for (const l of ['nld', 'eng']) cpSync(`node_modules/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`, `${out}/lang/${l}.traineddata.gz`)
console.log('OCR-bestanden gekopieerd naar', out)
