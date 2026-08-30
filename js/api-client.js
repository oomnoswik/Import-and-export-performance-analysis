/**
 * Multi-API Client for Korea Customs Trade Statistics (2020~2026)
 * Supports live proxy when running with server.py and automatic preset fallback for static hosts (GitHub Pages)
 */

class CustomsApiClient {
  constructor() {
    this.defaultKey = "wjKreSjBb0%2B8UXShMApi4tYPhB11tc5IuB0Udqh6DT1cbgY4Kg%2BnLqoGp%2BatqElVfcCwfmM0j4hC8%2BRX4JRNSg%3D%3D";
    this.serviceKey = localStorage.getItem('customs_service_key') || this.defaultKey;
    this.isLocalServer = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  getServiceKey() {
    return this.serviceKey;
  }

  setServiceKey(key) {
    this.serviceKey = key.trim();
    localStorage.setItem('customs_service_key', this.serviceKey);
  }

  /**
   * 1. Fetch Item & Country Trade Data (2020~2026)
   */
  async fetchTradeData(hsCode = '292529', startYear = 2020, endYear = 2026, forceRefresh = false) {
    const cleanHs = hsCode.replace(/[^0-9]/g, '');

    if (this.isLocalServer) {
      try {
        const url = `/api/customs/trade?hsSgn=${cleanHs}&startYear=${startYear}&endYear=${endYear}&serviceKey=${encodeURIComponent(this.serviceKey)}&refresh=${forceRefresh}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data && data.records && data.records.length > 0) {
            return {
              source: response.headers.get('X-Data-Source') || 'API',
              hsCode: cleanHs,
              records: data.records,
              errors: data.errors || []
            };
          }
        }
      } catch (err) {
        console.warn('Local proxy call failed, falling back to preset', err);
      }
    }

    // Static Hosting / GitHub Pages Fallback
    if (window.PRESET_TRADE_DATA && window.PRESET_TRADE_DATA[cleanHs]) {
      return {
        source: 'Pre-fetched Customs Dataset (2020~2026)',
        hsCode: cleanHs,
        records: window.PRESET_TRADE_DATA[cleanHs].records,
        errors: []
      };
    }

    throw new Error('데이터를 가져올 수 없습니다.');
  }

  /**
   * 2. Fetch Macro National Trade Data
   */
  async fetchNationTrade(startYear = 2023, endYear = 2024, forceRefresh = false) {
    if (this.isLocalServer) {
      try {
        const url = `/api/customs/nation?startYear=${startYear}&endYear=${endYear}&serviceKey=${encodeURIComponent(this.serviceKey)}&refresh=${forceRefresh}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          return data.records || [];
        }
      } catch (e) {
        console.warn('Nation trade fetch error:', e);
      }
    }
    return [];
  }

  /**
   * 3. Fetch Regional & Sigungu Item Trade Data (2020~2026)
   */
  async fetchRegionalTrade(hsCode = '292529', sido = '', sigungu = '', year = 'ALL', month = 'ALL') {
    if (this.isLocalServer) {
      try {
        const url = `/api/customs/regional?hsSgn=${hsCode}&sido=${sido}&sigungu=${sigungu}&year=${year}&month=${month}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.records && data.records.length > 0) {
            return data.records;
          }
        }
      } catch (e) {
        console.warn('Regional trade fetch error:', e);
      }
    }

    // Static Hosting / GitHub Pages Fallback
    if (window.REGIONAL_TRADE_DATA) {
      let recs = window.REGIONAL_TRADE_DATA;
      if (year !== 'ALL') {
        const yrNum = parseInt(year, 10);
        recs = recs.filter(r => r.year === yrNum);
      }
      if (month !== 'ALL') {
        const mNum = parseInt(month, 10);
        recs = recs.filter(r => r.month === mNum);
      }
      if (sido) {
        recs = recs.filter(r => r.sidoCode === sido);
      }
      if (sigungu) {
        recs = recs.filter(r => r.sigunguCode === sigungu);
      }
      return recs;
    }

    return [];
  }
}

window.customsApi = new CustomsApiClient();
