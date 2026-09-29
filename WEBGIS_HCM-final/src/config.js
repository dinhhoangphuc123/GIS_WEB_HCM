// config.js — URL backend Flask.
// Local: không cần cấu hình (mặc định http://localhost:5000).
// Production (Vercel): đặt biến môi trường VITE_API_URL = URL của Render, ví dụ https://webgis-hcm.onrender.com
// Lưu ý: Vite nhúng biến này lúc build, đổi giá trị thì phải deploy lại.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');