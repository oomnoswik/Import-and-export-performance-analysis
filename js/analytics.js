/**
 * Trade Analytics & Intelligence Engine
 * (MoM 전월비, YoY 전년동월비 정밀 연산, 시작월~종료월 기간 범위 필터, 2020~2026 통합 지원)
 */

class TradeAnalyticsEngine {
  constructor() {
    this.exchangeRate = 1380;
    this.currency = 'USD';
    this.weightUnit = 'ton';
  }

  setExchangeRate(rate) {
    this.exchangeRate = Number(rate) || 1380;
  }

  setCurrency(curr) {
    this.currency = curr;
  }

  setWeightUnit(unit) {
    this.weightUnit = unit;
  }

  /**
   * Process raw Item x Country customs records (API 1)
   * Supports Year and Month Range [startMonth, endMonth]
   */
  processRecords(rawRecords, selectedYear = 'ALL', startMonth = 1, endMonth = 12) {
    if (!rawRecords || !Array.isArray(rawRecords)) {
      return {
        summary: {},
        yearlyData: [],
        monthlyData: [],
        countryStats: [],
        seasonality: [],
        rawFiltered: []
      };
    }

    const sMonth = parseInt(startMonth, 10) || 1;
    const eMonth = parseInt(endMonth, 10) || 12;
    const minM = Math.min(sMonth, eMonth);
    const maxM = Math.max(sMonth, eMonth);

    // 1. Normalize all valid records
    const validRecords = rawRecords.filter(r => {
      const yr = String(r.year || '').trim();
      if (!yr || yr === '총계' || yr.startsWith('총') || yr === '-') return false;
      if (r.statCd === '-' && (!r.country || r.country === '-')) return false;
      return true;
    }).map(r => {
      const yearStr = String(r.year).trim();
      const parts = yearStr.split('.');
      const y = parseInt(parts[0], 10);
      const m = parts.length > 1 ? parseInt(parts[1], 10) : 1;
      return {
        ...r,
        numYear: y,
        numMonth: m,
        yearMonth: `${y}.${m < 10 ? '0' : ''}${m}`,
        expDlr: Number(r.expDlr) || 0,
        expWgt: Number(r.expWgt) || 0,
        impDlr: Number(r.impDlr) || 0,
        impWgt: Number(r.impWgt) || 0,
        balPayments: Number(r.balPayments) || 0,
        countryName: r.country || r.statCd || '기타국가',
        countryCode: r.statCd || 'XX'
      };
    });

    // 2. Filter records based on selected Year AND Month Range [minM, maxM]
    const filteredRecords = validRecords.filter(r => {
      if (selectedYear !== 'ALL' && r.numYear !== parseInt(selectedYear, 10)) return false;
      if (r.numMonth < minM || r.numMonth > maxM) return false;
      return true;
    });

    // 3. Summary metrics for filtered period
    const totalExportDlr = filteredRecords.reduce((acc, r) => acc + r.expDlr, 0);
    const totalImportDlr = filteredRecords.reduce((acc, r) => acc + r.impDlr, 0);
    const totalTradeBalanceDlr = totalExportDlr - totalImportDlr;
    const totalExportWgt = filteredRecords.reduce((acc, r) => acc + r.expWgt, 0);
    const totalImportWgt = filteredRecords.reduce((acc, r) => acc + r.impWgt, 0);

    const avgExportUnitPrice = totalExportWgt > 0 ? (totalExportDlr / totalExportWgt) : 0;
    const avgImportUnitPrice = totalImportWgt > 0 ? (totalImportDlr / totalImportWgt) : 0;
    const unitPriceSpread = avgExportUnitPrice - avgImportUnitPrice;

    // 4. Yearly Aggregation (respecting month range [minM, maxM] for fair YoY comparison)
    const yearlyMap = {};
    validRecords.filter(r => r.numMonth >= minM && r.numMonth <= maxM).forEach(r => {
      const y = r.numYear;
      if (!yearlyMap[y]) {
        yearlyMap[y] = {
          year: y,
          expDlr: 0,
          expWgt: 0,
          impDlr: 0,
          impWgt: 0,
          balance: 0,
          recordCount: 0
        };
      }
      yearlyMap[y].expDlr += r.expDlr;
      yearlyMap[y].expWgt += r.expWgt;
      yearlyMap[y].impDlr += r.impDlr;
      yearlyMap[y].impWgt += r.impWgt;
      yearlyMap[y].recordCount += 1;
    });

    const yearlyData = Object.values(yearlyMap).sort((a, b) => a.year - b.year).map((yd, idx, arr) => {
      yd.balance = yd.expDlr - yd.impDlr;
      yd.expUnitPrice = yd.expWgt > 0 ? (yd.expDlr / yd.expWgt) : 0;
      yd.impUnitPrice = yd.impWgt > 0 ? (yd.impDlr / yd.impWgt) : 0;
      yd.spread = yd.expUnitPrice - yd.impUnitPrice;

      if (idx > 0) {
        const prev = arr[idx - 1];
        yd.expYoY = prev.expDlr > 0 ? ((yd.expDlr - prev.expDlr) / prev.expDlr) * 100 : 0;
        yd.impYoY = prev.impDlr > 0 ? ((yd.impDlr - prev.impDlr) / prev.impDlr) * 100 : 0;
        yd.balYoY = prev.balance !== 0 ? ((yd.balance - prev.balance) / Math.abs(prev.balance)) * 100 : 0;
      } else {
        yd.expYoY = 0; yd.impYoY = 0; yd.balYoY = 0;
      }
      return yd;
    });

    // 5. Complete Monthly Map for MoM & YoY calculation across all history
    const allMonthlyMap = {};
    validRecords.forEach(r => {
      const ym = r.yearMonth;
      if (!allMonthlyMap[ym]) {
        allMonthlyMap[ym] = {
          yearMonth: ym,
          year: r.numYear,
          month: r.numMonth,
          expDlr: 0,
          expWgt: 0,
          impDlr: 0,
          impWgt: 0
        };
      }
      allMonthlyMap[ym].expDlr += r.expDlr;
      allMonthlyMap[ym].expWgt += r.expWgt;
      allMonthlyMap[ym].impDlr += r.impDlr;
      allMonthlyMap[ym].impWgt += r.impWgt;
    });

    const allMonthlyList = Object.values(allMonthlyMap).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    
    // Calculate MoM (전월비) and YoY (전년 동월비) with exact numeric year & month matching
    allMonthlyList.forEach((md, idx) => {
      md.balance = md.expDlr - md.impDlr;
      md.expUnitPrice = md.expWgt > 0 ? (md.expDlr / md.expWgt) : 0;
      md.impUnitPrice = md.impWgt > 0 ? (md.impDlr / md.impWgt) : 0;
      md.spread = md.expUnitPrice - md.impUnitPrice;

      // 1. MoM (전월비 % 증감)
      if (idx > 0) {
        const prevMonth = allMonthlyList[idx - 1];
        md.expMoM = prevMonth.expDlr > 0 ? ((md.expDlr - prevMonth.expDlr) / prevMonth.expDlr) * 100 : 0;
        md.impMoM = prevMonth.impDlr > 0 ? ((md.impDlr - prevMonth.impDlr) / prevMonth.impDlr) * 100 : 0;
      } else {
        md.expMoM = 0; md.impMoM = 0;
      }

      // 2. YoY (전년 동월비 % 증감 - 같은 월의 전년도 데이터 조회)
      const sameMonthPrevYear = allMonthlyList.find(item => item.year === (md.year - 1) && item.month === md.month);
      if (sameMonthPrevYear && sameMonthPrevYear.expDlr > 0) {
        md.expYoY = ((md.expDlr - sameMonthPrevYear.expDlr) / sameMonthPrevYear.expDlr) * 100;
        md.impYoY = sameMonthPrevYear.impDlr > 0 ? ((md.impDlr - sameMonthPrevYear.impDlr) / sameMonthPrevYear.impDlr) * 100 : 0;
      } else {
        md.expYoY = null;
        md.impYoY = null;
      }
    });

    // Filter monthly list based on current user selection
    const monthlyData = allMonthlyList.filter(md => {
      if (selectedYear !== 'ALL' && md.year !== parseInt(selectedYear, 10)) return false;
      if (md.month < minM || md.month > maxM) return false;
      return true;
    });

    // 6. Country Map for filtered period
    const countryMap = {};
    filteredRecords.forEach(r => {
      const cCode = r.countryCode || 'XX';
      const cName = r.countryName || cCode;
      if (!countryMap[cCode]) {
        countryMap[cCode] = {
          countryCode: cCode,
          countryName: cName,
          expDlr: 0,
          expWgt: 0,
          impDlr: 0,
          impWgt: 0
        };
      }
      countryMap[cCode].expDlr += r.expDlr;
      countryMap[cCode].expWgt += r.expWgt;
      countryMap[cCode].impDlr += r.impDlr;
      countryMap[cCode].impWgt += r.impWgt;
    });

    const countryStats = Object.values(countryMap).map(c => {
      c.balance = c.expDlr - c.impDlr;
      c.totalTrade = c.expDlr + c.impDlr;
      c.expUnitPrice = c.expWgt > 0 ? (c.expDlr / c.expWgt) : 0;
      c.impUnitPrice = c.impWgt > 0 ? (c.impDlr / c.impWgt) : 0;
      c.marginSpread = c.expUnitPrice - c.impUnitPrice;
      c.expShare = totalExportDlr > 0 ? (c.expDlr / totalExportDlr) * 100 : 0;
      c.impShare = totalImportDlr > 0 ? (c.impDlr / totalImportDlr) * 100 : 0;
      return c;
    });

    const topExportCountries = [...countryStats].sort((a, b) => b.expDlr - a.expDlr).slice(0, 10);
    const topImportCountries = [...countryStats].sort((a, b) => b.impDlr - a.impDlr).slice(0, 10);

    // 7. Seasonality
    const monthSeasonMap = {};
    for (let m = 1; m <= 12; m++) {
      monthSeasonMap[m] = { month: `${m}월`, monthNum: m, expTotal: 0, impTotal: 0, count: 0 };
    }
    validRecords.forEach(r => {
      if (r.numMonth >= 1 && r.numMonth <= 12) {
        monthSeasonMap[r.numMonth].expTotal += r.expDlr;
        monthSeasonMap[r.numMonth].impTotal += r.impDlr;
        monthSeasonMap[r.numMonth].count += 1;
      }
    });

    const seasonality = Object.values(monthSeasonMap).map(s => ({
      month: s.month,
      monthNum: s.monthNum,
      avgExp: s.count > 0 ? (s.expTotal / (yearlyData.length || 1)) : 0,
      avgImp: s.count > 0 ? (s.impTotal / (yearlyData.length || 1)) : 0
    }));

    // Period YoY summary
    let expYoY = 0;
    let impYoY = 0;
    let balYoY = 0;
    if (yearlyData.length >= 2) {
      const latest = yearlyData[yearlyData.length - 1];
      const prev = yearlyData[yearlyData.length - 2];
      expYoY = prev.expDlr > 0 ? ((latest.expDlr - prev.expDlr) / prev.expDlr) * 100 : 0;
      impYoY = prev.impDlr > 0 ? ((latest.impDlr - prev.impDlr) / prev.impDlr) * 100 : 0;
      balYoY = prev.balance !== 0 ? ((latest.balance - prev.balance) / Math.abs(prev.balance)) * 100 : 0;
    }

    const summary = {
      totalExportDlr,
      totalImportDlr,
      totalTradeBalanceDlr,
      totalExportWgt,
      totalImportWgt,
      avgExportUnitPrice,
      avgImportUnitPrice,
      unitPriceSpread,
      expYoY,
      impYoY,
      balYoY,
      selectedYear,
      startMonth: minM,
      endMonth: maxM,
      periodLabel: `${selectedYear === 'ALL' ? '전기간' : selectedYear + '년'} ${minM}월 ~ ${maxM}월`,
      recordCount: filteredRecords.length
    };

    const insights = this.generateDiagnosticInsights({
      summary,
      yearlyData,
      monthlyData,
      countryStats,
      topExportCountries,
      topImportCountries,
      seasonality
    });

    return {
      summary,
      yearlyData,
      monthlyData,
      allMonthlyList,
      countryStats,
      topExportCountries,
      topImportCountries,
      seasonality,
      insights,
      rawFiltered: filteredRecords
    };
  }

  /**
   * Process Regional & Sigungu records with Start/End Month Range
   */
  processRegionalData(allRegionalRecords, targetSigunguCode = '43110', targetYear = '2024', startMonth = 1, endMonth = 12) {
    if (!allRegionalRecords || !Array.isArray(allRegionalRecords)) {
      return {
        regionsList: [],
        selectedRegionInfo: null,
        regionalRanking: [],
        destinationStats: [],
        regionalMonthlyTrend: [],
        totalRegionalExp: 0,
        totalRegionalImp: 0,
        totalRegionalWgt: 0
      };
    }

    const sMonth = parseInt(startMonth, 10) || 1;
    const eMonth = parseInt(endMonth, 10) || 12;
    const minM = Math.min(sMonth, eMonth);
    const maxM = Math.max(sMonth, eMonth);

    // 1. Filter by Year & Month Range [minM, maxM]
    let periodRecords = allRegionalRecords;
    if (targetYear !== 'ALL') {
      const yrNum = parseInt(targetYear, 10);
      periodRecords = periodRecords.filter(r => r.year === yrNum);
    }
    periodRecords = periodRecords.filter(r => r.month >= minM && r.month <= maxM);

    // 2. Group by Sigungu
    const sigunguMap = {};
    periodRecords.forEach(r => {
      const key = r.sigunguCode || 'UNKNOWN';
      if (!sigunguMap[key]) {
        sigunguMap[key] = {
          sidoCode: r.sidoCode,
          sidoName: r.sidoName,
          sigunguCode: r.sigunguCode,
          sigunguName: r.sigunguName,
          hubType: r.hubType || '바이오 제조 거점',
          expDlr: 0,
          expWgt: 0,
          impDlr: 0,
          impWgt: 0,
        };
      }
      sigunguMap[key].expDlr += r.expDlr;
      sigunguMap[key].expWgt += r.expWgt;
      sigunguMap[key].impDlr += r.impDlr;
      sigunguMap[key].impWgt += r.impWgt;
    });

    const regionsList = Object.values(sigunguMap);
    const totalAllExp = regionsList.reduce((a, b) => a + b.expDlr, 0);

    const regionalRanking = regionsList.map(reg => ({
      ...reg,
      balance: reg.expDlr - reg.impDlr,
      expUnitPrice: reg.expWgt > 0 ? (reg.expDlr / reg.expWgt) : 0,
      share: totalAllExp > 0 ? (reg.expDlr / totalAllExp) * 100 : 0
    })).sort((a, b) => b.expDlr - a.expDlr);

    // 3. Selected Region Filter
    let targetRecords = periodRecords;
    let selectedRegionInfo = null;

    if (targetSigunguCode !== 'ALL') {
      targetRecords = periodRecords.filter(r => r.sigunguCode === targetSigunguCode);
      selectedRegionInfo = sigunguMap[targetSigunguCode] || {
        sigunguName: '선택 지역',
        hubType: '바이오 생산 거점',
        expDlr: 0, impDlr: 0, expWgt: 0, impWgt: 0
      };
    } else {
      selectedRegionInfo = {
        sigunguName: '대한민국 전국 전체 시군구',
        hubType: '전국 바이오·아미노산 수출 거점 종합',
        expDlr: regionalRanking.reduce((a, b) => a + b.expDlr, 0),
        impDlr: regionalRanking.reduce((a, b) => a + b.impDlr, 0),
        expWgt: regionalRanking.reduce((a, b) => a + b.expWgt, 0),
        impWgt: regionalRanking.reduce((a, b) => a + b.impWgt, 0),
      };
    }

    // 4. Destination Country Breakdown
    const destMap = {};
    targetRecords.forEach(r => {
      const cCode = r.countryCode || 'XX';
      const cName = r.countryName || cCode;
      if (!destMap[cCode]) {
        destMap[cCode] = {
          countryCode: cCode,
          countryName: cName,
          expDlr: 0,
          expWgt: 0,
          impDlr: 0,
          impWgt: 0
        };
      }
      destMap[cCode].expDlr += r.expDlr;
      destMap[cCode].expWgt += r.expWgt;
      destMap[cCode].impDlr += r.impDlr;
      destMap[cCode].impWgt += r.impWgt;
    });

    const regExpTotal = Object.values(destMap).reduce((a, b) => a + b.expDlr, 0);
    const regImpTotal = Object.values(destMap).reduce((a, b) => a + b.impDlr, 0);
    const regWgtTotal = Object.values(destMap).reduce((a, b) => a + b.expWgt, 0);

    const destinationStats = Object.values(destMap).map(d => ({
      ...d,
      balance: d.expDlr - d.impDlr,
      expUnitPrice: d.expWgt > 0 ? (d.expDlr / d.expWgt) : 0,
      impUnitPrice: d.impWgt > 0 ? (d.impDlr / d.impWgt) : 0,
      share: regExpTotal > 0 ? (d.expDlr / regExpTotal) * 100 : 0
    })).sort((a, b) => b.expDlr - a.expDlr);

    // 5. 12-Month Trend for selected region (with MoM & YoY)
    let regionAllYearRecords = allRegionalRecords;
    if (targetSigunguCode !== 'ALL') {
      regionAllYearRecords = regionAllYearRecords.filter(r => r.sigunguCode === targetSigunguCode);
    }
    if (targetYear !== 'ALL') {
      const yrNum = parseInt(targetYear, 10);
      regionAllYearRecords = regionAllYearRecords.filter(r => r.year === yrNum);
    }

    const monthTrendMap = {};
    for (let m = 1; m <= 12; m++) {
      monthTrendMap[m] = { month: `${m}월`, monthNum: m, expDlr: 0, impDlr: 0, expWgt: 0 };
    }
    regionAllYearRecords.forEach(r => {
      if (r.month >= 1 && r.month <= 12) {
        monthTrendMap[r.month].expDlr += r.expDlr;
        monthTrendMap[r.month].impDlr += r.impDlr;
        monthTrendMap[r.month].expWgt += r.expWgt;
      }
    });

    const regionalMonthlyTrend = Object.values(monthTrendMap).map((mt, idx, arr) => {
      mt.balance = mt.expDlr - mt.impDlr;
      mt.expUnitPrice = mt.expWgt > 0 ? (mt.expDlr / mt.expWgt) : 0;
      if (idx > 0 && arr[idx - 1].expDlr > 0) {
        mt.expMoM = ((mt.expDlr - arr[idx - 1].expDlr) / arr[idx - 1].expDlr) * 100;
      } else {
        mt.expMoM = 0;
      }
      return mt;
    });

    return {
      regionsList: regionalRanking,
      selectedRegionInfo,
      regionalRanking,
      destinationStats,
      regionalMonthlyTrend,
      totalRegionalExp: regExpTotal,
      totalRegionalImp: regImpTotal,
      totalRegionalWgt: regWgtTotal,
      startMonth: minM,
      endMonth: maxM,
      periodLabel: `${targetYear === 'ALL' ? '전기간' : targetYear + '년'} ${minM}월 ~ ${maxM}월`
    };
  }

  formatCurrency(valDlr, compact = false) {
    if (valDlr === null || valDlr === undefined || isNaN(valDlr)) return '-';
    const isKrw = this.currency === 'KRW';
    const finalVal = isKrw ? valDlr * this.exchangeRate : valDlr;

    if (compact) {
      if (isKrw) {
        if (Math.abs(finalVal) >= 1e12) return (finalVal / 1e12).toFixed(1) + '조 원';
        if (Math.abs(finalVal) >= 1e8) return (finalVal / 1e8).toFixed(1) + '억 원';
        if (Math.abs(finalVal) >= 1e4) return (finalVal / 1e4).toFixed(0) + '만 원';
        return finalVal.toLocaleString() + '원';
      } else {
        if (Math.abs(finalVal) >= 1e9) return '$' + (finalVal / 1e9).toFixed(2) + 'B';
        if (Math.abs(finalVal) >= 1e6) return '$' + (finalVal / 1e6).toFixed(2) + 'M';
        if (Math.abs(finalVal) >= 1e3) return '$' + (finalVal / 1e3).toFixed(1) + 'K';
        return '$' + finalVal.toLocaleString();
      }
    }

    if (isKrw) {
      return Math.round(finalVal).toLocaleString() + ' ₩';
    } else {
      return '$' + Math.round(finalVal).toLocaleString();
    }
  }

  formatWeight(wgtKg, compact = false) {
    if (!wgtKg || isNaN(wgtKg)) return '0 kg';
    const isTon = this.weightUnit === 'ton';
    const val = isTon ? (wgtKg / 1000) : wgtKg;
    const unit = isTon ? '톤 (t)' : 'kg';
    return `${val.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`;
  }

  formatUnitPrice(priceDlrKg) {
    if (!priceDlrKg || isNaN(priceDlrKg)) return '$0.00 / kg';
    if (this.currency === 'KRW') {
      const krwPrice = priceDlrKg * this.exchangeRate;
      return `${Math.round(krwPrice).toLocaleString()} ₩/kg`;
    }
    return `$${priceDlrKg.toFixed(2)} / kg`;
  }

  generateDiagnosticInsights(data) {
    const { summary, topExportCountries, topImportCountries, seasonality } = data;
    const insights = [];

    const isSurplus = summary.totalTradeBalanceDlr >= 0;
    const balFormatted = this.formatCurrency(Math.abs(summary.totalTradeBalanceDlr), true);
    if (isSurplus) {
      insights.push({
        type: 'positive',
        tag: '무역수지 흑자',
        title: '안정적인 무역수지 흑자 기조 달성',
        desc: `선택 기간(${summary.periodLabel}) 동안 총 <span class="insight-highlight">${balFormatted}</span> 규모의 무역수지 흑자를 기록하였습니다. 수출 경쟁력이 견고하게 유지되고 있습니다.`
      });
    } else {
      insights.push({
        type: 'warning',
        tag: '무역적자 주의',
        title: '원료 수입 의존도 및 무역적자 관리 필요',
        desc: `선택 기간(${summary.periodLabel}) 동안 <span class="insight-highlight">${balFormatted}</span> 규모의 무역수지 적자가 발생했습니다. 고부가가치 완제품 수출 전환 및 국산화 대체 검토가 요구됩니다.`
      });
    }

    const spread = summary.unitPriceSpread;
    const expPrice = this.formatUnitPrice(summary.avgExportUnitPrice);
    const impPrice = this.formatUnitPrice(summary.avgImportUnitPrice);
    if (spread > 0) {
      insights.push({
        type: 'positive',
        tag: '고부가가치 창출',
        title: `수출 단가 우위 (+${this.formatUnitPrice(spread)})`,
        desc: `수출 평균단가(<span class="insight-highlight">${expPrice}</span>)가 수입 평균단가(<span class="insight-highlight">${impPrice}</span>)보다 높아 고순도·고부가가치 제제 가공 후 수출 구조가 정착되어 있습니다.`
      });
    } else {
      insights.push({
        type: 'info',
        tag: '단가 구조',
        title: '수입 단가 상회 구조',
        desc: `수출 평균단가(<span class="insight-highlight">${expPrice}</span>) 대비 수입 단가(<span class="insight-highlight">${impPrice}</span>)가 높습니다. 고순도 특수 의약품 원료 수입과 범용 원료 수출 비중을 점검하세요.`
      });
    }

    if (topExportCountries.length > 0) {
      const top1 = topExportCountries[0];
      const top2 = topExportCountries[1] || null;
      const top1Share = top1.expShare.toFixed(1);
      insights.push({
        type: 'opportunity',
        tag: '글로벌 시장',
        title: `최대 수출국: ${top1.countryName} (${top1Share}%)`,
        desc: `최대 수출 대상국은 <span class="insight-highlight">${top1.countryName}</span>(비중 ${top1Share}%, ${this.formatCurrency(top1.expDlr, true)})이며, ${top2 ? `그 뒤를 <span class="insight-highlight">${top2.countryName}</span>(${top2.expShare.toFixed(1)}%)가 잇고 있습니다.` : '집중적인 시장 다변화 전략이 권장됩니다.'}`
      });
    }

    if (topImportCountries.length > 0) {
      const topImp1 = topImportCountries[0];
      const topImp1Share = topImp1.impShare.toFixed(1);
      insights.push({
        type: topImp1Share > 60 ? 'warning' : 'info',
        tag: '공급망 공급처',
        title: `최대 원료 공급국: ${topImp1.countryName} (${topImp1Share}%)`,
        desc: `전체 수입액의 <span class="insight-highlight">${topImp1Share}%</span>(${this.formatCurrency(topImp1.impDlr, true)})가 <span class="insight-highlight">${topImp1.countryName}</span>에 집중되어 있어, 공급망 리스크 분산 및 대체 조달처 확보가 중요합니다.`
      });
    }

    if (seasonality.length > 0) {
      const peakExpMonth = [...seasonality].sort((a, b) => b.avgExp - a.avgExp)[0];
      const peakImpMonth = [...seasonality].sort((a, b) => b.avgImp - a.avgImp)[0];
      insights.push({
        type: 'opportunity',
        tag: '계절성 패턴',
        title: `수출 성수기: ${peakExpMonth.month} / 수입 집중: ${peakImpMonth.month}`,
        desc: `연간 통계상 <span class="insight-highlight">${peakExpMonth.month}</span>에 수출 수요가 가장 높고, 원자재 수입은 <span class="insight-highlight">${peakImpMonth.month}</span>에 집중되는 경향을 보입니다. 적기 재고 확보 및 마케팅 타이밍으로 활용할 수 있습니다.`
      });
    }

    return insights;
  }
}

window.tradeAnalytics = new TradeAnalyticsEngine();
