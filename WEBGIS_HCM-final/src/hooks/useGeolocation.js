// hooks/useGeolocation.js
// Wrap navigator.geolocation thành Promise-based hook.
// TODO: Thay bằng IP-based geolocation API nếu cần độ chính xác cao hơn.

import { useState, useCallback } from 'react';

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const getCurrentPosition = useCallback(() => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setError('Trình duyệt không hỗ trợ Geolocation');
        resolve({ label: 'Trung tâm TP.HCM (mặc định)', lat: 10.7769, lng: 106.7009 });
        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLoading(false);
          resolve({
            label: 'Vị trí của bạn',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          setLoading(false);
          setError(err.message);
          // Graceful fallback — trung tâm TPHCM
          resolve({ label: 'Trung tâm TP.HCM (mặc định)', lat: 10.7769, lng: 106.7009 });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }, []);

  return { getCurrentPosition, loading, error };
}
