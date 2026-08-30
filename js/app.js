/**
 * Main Application Orchestrator
 * Supports 2020~2026 Customs Trade Analytics with Start/End Month Ranges,
 * Accurate MoM & YoY Growth, and Dedicated Unit Price & Value-Added Margin Analysis
 */

document.addEventListener('DOMContentLoaded', async () => {
  const state = {
    hsCode: '292529',
    hsName: 'L-아르기닌 및 그 염류 / 이민 화합물',
    startYear: 2020,
    endYear: 2026,
    selectedYear: '2024',
    startMonth: 1,
    endMonth: 12,
    selectedSigungu: '43110', // Default: 충북 청주시
    regionalSelectedYear: '2024',
    regionalStartMonth: 1,
    regionalEndMonth: 12,
    currency: 'USD',
    exchangeRate: 1380,
    weightUnit: 'ton',
    rawRecords: [],
    regionalRecords: [],
    nationRecords: [],
    processed: null,
    processedRegional: null,
    activeTab: 'tab-overview',
    tablePage: 1,
    tablePageSize: 15,
    tableSortField: 'yearMonth',
    tableSortAsc: false,
    tableSearch: ''
  };

  // DOM Elements
  const el = {
    targetHsCode: document.getElementById('targetHsCode'),
    targetHsName: document.getElementById('targetHsName'),
    selectedPeriodTag: document.getElementById('selectedPeriodTag'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    yearSelect: document.getElementById('yearSelect'),
    startMonthSelect: document.getElementById('startMonthSelect'),
    endMonthSelect: document.getElementById('endMonthSelect'),
    
    // Regional Controls
    sigunguSelect: document.getElementById('sigunguSelect'),
    regYearSelect: document.getElementById('regYearSelect'),
    regStartMonthSelect: document.getElementById('regStartMonthSelect'),
    regEndMonthSelect: document.getElementById('regEndMonthSelect'),
    selectedRegionHubDesc: document.getElementById('selectedRegionHubDesc'),
    regionDestinationTitle: document.getElementById('regionDestinationTitle'),
    regionMonthlyChartTitle: document.getElementById('regionMonthlyChartTitle'),
    regionTableTitle: document.getElementById('regionTableTitle'),

    currencyToggle: document.getElementById('currencyToggle'),
    exchangeRateInput: document.getElementById('exchangeRateInput'),
    customHsInput: document.getElementById('customHsInput'),
    btnApplyHs: document.getElementById('btnApplyHs'),
    btnRefreshData: document.getElementById('btnRefreshData'),
    btnExportCsv: document.getElementById('btnExportCsv'),
    themeToggle: document.getElementById('themeToggle'),
    apiModal: document.getElementById('apiModal'),
    btnOpenApiModal: document.getElementById('btnOpenApiModal'),
    btnCloseApiModal: document.getElementById('btnCloseApiModal'),
    btnSaveApiKey: document.getElementById('btnSaveApiKey'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    
    // KPI elements
    kpiExportVal: document.getElementById('kpiExportVal'),
    kpiExportYoY: document.getElementById('kpiExportYoY'),
    kpiImportVal: document.getElementById('kpiImportVal'),
    kpiImportYoY: document.getElementById('kpiImportYoY'),
    kpiBalanceVal: document.getElementById('kpiBalanceVal'),
    kpiBalanceBadge: document.getElementById('kpiBalanceBadge'),
    kpiExpPriceVal: document.getElementById('kpiExpPriceVal'),
    kpiImpPriceVal: document.getElementById('kpiImpPriceVal'),
    kpiTotalWgtVal: document.getElementById('kpiTotalWgtVal'),
    kpiSpreadVal: document.getElementById('kpiSpreadVal'),

    // Regional KPI elements
    regKpiExpTitle: document.getElementById('regKpiExpTitle'),
    regKpiExpVal: document.getElementById('regKpiExpVal'),
    regKpiShareVal: document.getElementById('regKpiShareVal'),
    regKpiTopDestVal: document.getElementById('regKpiTopDestVal'),
    regKpiTopDestShare: document.getElementById('regKpiTopDestShare'),
    regKpiExpPriceVal: document.getElementById('regKpiExpPriceVal'),
    regKpiImpVal: document.getElementById('regKpiImpVal'),

    // Table elements
    dataTableBody: document.getElementById('dataTableBody'),
    tablePagination: document.getElementById('tablePagination'),
    tableSearchInput: document.getElementById('tableSearchInput'),
    tableRecordCount: document.getElementById('tableRecordCount'),
    countryTableBody: document.getElementById('countryTableBody'),
    regionDestinationTableBody: document.getElementById('regionDestinationTableBody'),
    momYoyTableBody: document.getElementById('momYoyTableBody'),
    unitPriceTableBody: document.getElementById('unitPriceTableBody'),

    // AI Insight container
    aiInsightList: document.getElementById('aiInsightList'),
    aiReportList: document.getElementById('aiReportList'),
  };

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>🔔</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Load Data
  async function loadData(forceRefresh = false) {
    if (el.loadingIndicator) el.loadingIndicator.classList.add('active');
    try {
      // 1. API 1: 품목별 국가별 수출입실적 (2020~2026)
      const result = await window.customsApi.fetchTradeData(state.hsCode, state.startYear, state.endYear, forceRefresh);
      state.rawRecords = result.records || [];
      
      // 2. API 3: 시군구별 품목별 수출입실적 (2020~2026)
      state.regionalRecords = await window.customsApi.fetchRegionalTrade(state.hsCode, '', '', 'ALL', 'ALL');

      if (state.hsCode === '292529') {
        state.hsName = 'L-아르기닌 및 그 염류 / 이민 화합물 (HS 2925.29)';
      } else if (state.hsCode === '292249') {
        state.hsName = '기타 아미노산 및 그 에스테르와 이들의 염 (HS 2922.49)';
      } else {
        state.hsName = `품목 코드 HS ${state.hsCode}`;
      }

      if (el.targetHsName) el.targetHsName.textContent = state.hsName;
      if (el.targetHsCode) el.targetHsCode.textContent = state.hsCode;

      recalculate();
      showToast(`HS ${state.hsCode} 3대 관세청 무역통계(2020~2026) 로드 완료`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`데이터 로드 오류: ${err.message}`, 'error');
    } finally {
      if (el.loadingIndicator) el.loadingIndicator.classList.remove('active');
    }
  }

  // Recalculate & Render Dashboard
  function recalculate() {
    const ta = window.tradeAnalytics;
    ta.setCurrency(state.currency);
    ta.setExchangeRate(state.exchangeRate);
    ta.setWeightUnit(state.weightUnit);

    // Process Main Records with Month Range
    state.processed = ta.processRecords(state.rawRecords, state.selectedYear, state.startMonth, state.endMonth);
    
    // Process Regional Data with Month Range
    state.processedRegional = ta.processRegionalData(
      state.regionalRecords,
      state.selectedSigungu,
      state.regionalSelectedYear,
      state.regionalStartMonth,
      state.regionalEndMonth
    );

    // Period Tag in Header
    if (el.selectedPeriodTag) {
      const monthLabel = state.startMonth === state.endMonth ? `${state.startMonth}월 (1개월)` : `${state.startMonth}월 ~ ${state.endMonth}월 (${state.endMonth - state.startMonth + 1}개월)`;
      el.selectedPeriodTag.textContent = `${state.selectedYear === 'ALL' ? '전체 연도' : state.selectedYear + '년'} ${monthLabel}`;
    }

    renderKPIs();
    renderRegionalTab();
    renderCharts();
    renderMomYoyTable();
    renderUnitPriceTable();
    renderAiInsights();
    renderCountryTable();
    renderDataTable();
  }

  // Render KPIs
  function renderKPIs() {
    const { summary } = state.processed;
    const a = window.tradeAnalytics;

    if (el.kpiExportVal) el.kpiExportVal.textContent = a.formatCurrency(summary.totalExportDlr, true);
    if (el.kpiImportVal) el.kpiImportVal.textContent = a.formatCurrency(summary.totalImportDlr, true);
    
    const isSurplus = summary.totalTradeBalanceDlr >= 0;
    if (el.kpiBalanceVal) {
      el.kpiBalanceVal.textContent = (isSurplus ? '+' : '') + a.formatCurrency(summary.totalTradeBalanceDlr, true);
      el.kpiBalanceVal.style.color = isSurplus ? 'var(--accent-emerald)' : 'var(--accent-rose)';
    }
    if (el.kpiBalanceBadge) {
      el.kpiBalanceBadge.textContent = isSurplus ? '흑자 (Surplus)' : '적자 (Deficit)';
      el.kpiBalanceBadge.className = `trend-badge ${isSurplus ? 'up' : 'down'}`;
    }

    if (el.kpiExportYoY) {
      const v = summary.expYoY;
      el.kpiExportYoY.textContent = `${v >= 0 ? '▲ +' : '▼ '}${v.toFixed(1)}% YoY`;
      el.kpiExportYoY.className = `trend-badge ${v >= 0 ? 'up' : 'down'}`;
    }
    if (el.kpiImportYoY) {
      const v = summary.impYoY;
      el.kpiImportYoY.textContent = `${v >= 0 ? '▲ +' : '▼ '}${v.toFixed(1)}% YoY`;
      el.kpiImportYoY.className = `trend-badge ${v >= 0 ? 'up' : 'down'}`;
    }

    if (el.kpiExpPriceVal) el.kpiExpPriceVal.textContent = a.formatUnitPrice(summary.avgExportUnitPrice);
    if (el.kpiImpPriceVal) el.kpiImpPriceVal.textContent = a.formatUnitPrice(summary.avgImportUnitPrice);
    if (el.kpiSpreadVal) {
      const spread = summary.unitPriceSpread;
      el.kpiSpreadVal.textContent = `단가 마진: ${spread >= 0 ? '+' : ''}${a.formatUnitPrice(spread)}`;
    }
    if (el.kpiTotalWgtVal) {
      el.kpiTotalWgtVal.textContent = a.formatWeight(summary.totalExportWgt + summary.totalImportWgt, true);
    }
  }

  // Render Regional Tab
  function renderRegionalTab() {
    const pr = state.processedRegional;
    const ta = window.tradeAnalytics;
    const tc = window.tradeCharts;
    if (!pr) return;

    const { selectedRegionInfo, regionalRanking, destinationStats, regionalMonthlyTrend, totalRegionalExp, totalRegionalImp } = pr;
    const regionName = selectedRegionInfo ? selectedRegionInfo.sigunguName : '전국';

    const monthLabel = state.regionalStartMonth === state.regionalEndMonth ? `${state.regionalStartMonth}월 (1개월)` : `${state.regionalStartMonth}월 ~ ${state.regionalEndMonth}월 (${state.regionalEndMonth - state.regionalStartMonth + 1}개월)`;
    const periodLabel = `${state.regionalSelectedYear === 'ALL' ? '전기간' : state.regionalSelectedYear + '년'} ${monthLabel}`;

    if (el.selectedRegionHubDesc && selectedRegionInfo) {
      el.selectedRegionHubDesc.innerHTML = `🏭 <strong>${selectedRegionInfo.sigunguName}</strong>: ${selectedRegionInfo.hubType}`;
    }

    if (el.regionDestinationTitle) {
      el.regionDestinationTitle.textContent = `🚢 [${regionName.split(' ')[0]}] 발 해외 수출 대상국 순위 (${periodLabel})`;
    }
    if (el.regionMonthlyChartTitle) {
      el.regionMonthlyChartTitle.textContent = `📅 [${regionName.split(' ')[0]}] ${state.regionalSelectedYear === 'ALL' ? '2024년 기준' : state.regionalSelectedYear + '년'} 1월~12월 월별 수출입 추이 (전월비 포함)`;
    }
    if (el.regionTableTitle) {
      el.regionTableTitle.textContent = `📋 [${regionName}] 세부 수출 대상국 통관 실적 (${periodLabel})`;
    }

    // Regional KPIs
    if (el.regKpiExpTitle) {
      el.regKpiExpTitle.textContent = `[${periodLabel}] L-아르기닌 수출액`;
    }
    if (el.regKpiExpVal) el.regKpiExpVal.textContent = ta.formatCurrency(totalRegionalExp, true);
    if (el.regKpiImpVal) el.regKpiImpVal.textContent = ta.formatCurrency(totalRegionalImp, true);
    
    const topDest = destinationStats.length > 0 ? destinationStats[0] : null;
    if (el.regKpiTopDestVal) el.regKpiTopDestVal.textContent = topDest ? topDest.countryName : '-';
    if (el.regKpiTopDestShare) el.regKpiTopDestShare.textContent = topDest ? `${topDest.share.toFixed(1)}% 비중` : '-';
    
    const currentReg = regionalRanking.find(r => r.sigunguCode === state.selectedSigungu);
    if (el.regKpiShareVal) {
      el.regKpiShareVal.textContent = currentReg ? `전국 ${currentReg.share.toFixed(1)}% (1위)` : '전국 100%';
    }
    if (el.regKpiExpPriceVal) {
      const avgP = destinationStats.length > 0 ? (destinationStats.reduce((a, b) => a + b.expDlr, 0) / (destinationStats.reduce((a, b) => a + b.expWgt, 0) || 1)) : 5.8;
      el.regKpiExpPriceVal.textContent = ta.formatUnitPrice(avgP);
    }

    // Regional Charts
    tc.renderRegionDestinationChart('chartRegionDestination', destinationStats, regionName.split(' ')[0], ta);
    tc.renderRegionalMonthlyChart('chartRegionMonthly', regionalMonthlyTrend, regionName.split(' ')[0], ta);
    tc.renderRegionalRankingChart('chartRegionalRanking', regionalRanking, ta);

    // Regional Destination Table
    if (el.regionDestinationTableBody) {
      if (destinationStats.length === 0) {
        el.regionDestinationTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px;">선택한 기간(${periodLabel})에 해당하는 수출입 데이터가 없습니다.</td></tr>`;
      } else {
        el.regionDestinationTableBody.innerHTML = destinationStats.map((d, idx) => `
          <tr>
            <td><strong>#${idx + 1}</strong></td>
            <td><strong>${d.countryName}</strong> <span style="color:var(--text-muted);font-size:0.75rem;">(${d.countryCode})</span></td>
            <td class="table-num" style="color:var(--export-color);font-weight:700;">${ta.formatCurrency(d.expDlr)}</td>
            <td class="table-num" style="font-weight:600;color:var(--accent-cyan);">${d.share.toFixed(1)}%</td>
            <td class="table-num">${ta.formatWeight(d.expWgt)}</td>
            <td class="table-num" style="color:var(--import-color);">${ta.formatCurrency(d.impDlr)}</td>
            <td class="table-num" style="font-weight:600;color:${d.balance >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
              ${d.balance >= 0 ? '+' : ''}${ta.formatCurrency(d.balance)}
            </td>
            <td class="table-num">${ta.formatUnitPrice(d.expUnitPrice)}</td>
          </tr>
        `).join('');
      }
    }
  }

  // Render MoM / YoY Table
  function renderMomYoyTable() {
    if (!el.momYoyTableBody) return;
    const { monthlyData } = state.processed;
    const ta = window.tradeAnalytics;

    if (!monthlyData || monthlyData.length === 0) {
      el.momYoyTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px;">선택한 기간에 해당하는 월별 데이터가 없습니다.</td></tr>`;
      return;
    }

    el.momYoyTableBody.innerHTML = monthlyData.map(m => {
      const expMomBadge = (m.expMoM !== undefined && m.expMoM !== null && m.expMoM !== 0) 
        ? `<span class="trend-badge ${m.expMoM >= 0 ? 'up' : 'down'}" style="font-size:0.75rem;">${m.expMoM >= 0 ? '▲ +' : '▼ '}${m.expMoM.toFixed(1)}%</span>` 
        : '-';
      const expYoyBadge = (m.expYoY !== undefined && m.expYoY !== null) 
        ? `<span class="trend-badge ${m.expYoY >= 0 ? 'up' : 'down'}" style="font-size:0.75rem;">${m.expYoY >= 0 ? '▲ +' : '▼ '}${m.expYoY.toFixed(1)}%</span>` 
        : '<span style="color:var(--text-muted);font-size:0.75rem;">(기준년도)</span>';

      const impMomBadge = (m.impMoM !== undefined && m.impMoM !== null && m.impMoM !== 0) 
        ? `<span class="trend-badge ${m.impMoM >= 0 ? 'up' : 'down'}" style="font-size:0.75rem;">${m.impMoM >= 0 ? '▲ +' : '▼ '}${m.impMoM.toFixed(1)}%</span>` 
        : '-';
      const impYoyBadge = (m.impYoY !== undefined && m.impYoY !== null) 
        ? `<span class="trend-badge ${m.impYoY >= 0 ? 'up' : 'down'}" style="font-size:0.75rem;">${m.impYoY >= 0 ? '▲ +' : '▼ '}${m.impYoY.toFixed(1)}%</span>` 
        : '<span style="color:var(--text-muted);font-size:0.75rem;">(기준년도)</span>';

      return `
        <tr>
          <td><code>${m.yearMonth}</code></td>
          <td class="table-num" style="color:var(--export-color);font-weight:600;">${ta.formatCurrency(m.expDlr)}</td>
          <td class="table-num">${expMomBadge}</td>
          <td class="table-num">${expYoyBadge}</td>
          <td class="table-num" style="color:var(--import-color);">${ta.formatCurrency(m.impDlr)}</td>
          <td class="table-num">${impMomBadge}</td>
          <td class="table-num">${impYoyBadge}</td>
          <td class="table-num" style="font-weight:600;color:${m.balance >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
            ${m.balance >= 0 ? '+' : ''}${ta.formatCurrency(m.balance)}
          </td>
          <td class="table-num">${ta.formatUnitPrice(m.expUnitPrice)}</td>
        </tr>
      `;
    }).join('');
  }

  // Render Unit Price & Margin Analysis Table (Tab 4)
  function renderUnitPriceTable() {
    if (!el.unitPriceTableBody) return;
    const { monthlyData } = state.processed;
    const ta = window.tradeAnalytics;

    if (!monthlyData || monthlyData.length === 0) {
      el.unitPriceTableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px;">선택한 기간에 해당하는 단가 데이터가 없습니다.</td></tr>`;
      return;
    }

    el.unitPriceTableBody.innerHTML = monthlyData.map(m => {
      const isPositive = m.spread >= 0;
      const statusBadge = isPositive 
        ? `<span class="trend-badge up" style="font-size:0.75rem;">+${ta.formatUnitPrice(m.spread)} (고부가가치)</span>` 
        : `<span class="trend-badge down" style="font-size:0.75rem;">${ta.formatUnitPrice(m.spread)} (원료단가상회)</span>`;

      return `
        <tr>
          <td><code>${m.yearMonth}</code></td>
          <td class="table-num" style="color:var(--export-color);">${ta.formatCurrency(m.expDlr)}</td>
          <td class="table-num">${ta.formatWeight(m.expWgt)}</td>
          <td class="table-num" style="color:var(--export-color);font-weight:700;">${ta.formatUnitPrice(m.expUnitPrice)}</td>
          <td class="table-num" style="color:var(--import-color);">${ta.formatCurrency(m.impDlr)}</td>
          <td class="table-num">${ta.formatWeight(m.impWgt)}</td>
          <td class="table-num" style="color:var(--import-color);font-weight:700;">${ta.formatUnitPrice(m.impUnitPrice)}</td>
          <td class="table-num" style="font-weight:700;color:${isPositive ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
            ${isPositive ? '+' : ''}${ta.formatUnitPrice(m.spread)}
          </td>
          <td class="table-num">${statusBadge}</td>
        </tr>
      `;
    }).join('');
  }

  // Render Charts
  function renderCharts() {
    const { yearlyData, monthlyData, countryStats, topExportCountries, topImportCountries, seasonality } = state.processed;
    const tc = window.tradeCharts;
    const ta = window.tradeAnalytics;

    tc.renderMainTrendChart('chartMainTrend', yearlyData, ta);
    tc.renderMonthlyDetailChart('chartMonthlyDetail', monthlyData, ta);
    tc.renderUnitPriceChart('chartUnitPrice', yearlyData, ta);
    
    // Tab 4 Dedicated Charts
    tc.renderUnitPriceDetailChart('chartUnitPriceDetail', monthlyData, ta);
    tc.renderCountryMarginChart('chartCountryMargin', countryStats, ta);

    tc.renderTopCountriesChart('chartTopExportCountries', topExportCountries, 'export', ta);
    tc.renderTopCountriesChart('chartTopImportCountries', topImportCountries, 'import', ta);
    tc.renderCountryShareDoughnut('chartCountryShare', topExportCountries, ta);
    tc.renderSeasonalityRadar('chartSeasonality', seasonality, ta);
  }

  // Render AI Insights
  function renderAiInsights() {
    const { insights } = state.processed;
    const html = insights.map(item => `
      <div class="insight-card">
        <span class="insight-tag ${item.type}">
          ${item.tag}
        </span>
        <h4 class="insight-title">${item.title}</h4>
        <p class="insight-desc">${item.desc}</p>
      </div>
    `).join('');

    if (el.aiInsightList) el.aiInsightList.innerHTML = html;
    if (el.aiReportList) el.aiReportList.innerHTML = html;
  }

  // Render Country Table
  function renderCountryTable() {
    if (!el.countryTableBody) return;
    const { countryStats } = state.processed;
    const ta = window.tradeAnalytics;

    const sorted = [...countryStats].sort((a, b) => (b.expDlr + b.impDlr) - (a.expDlr + a.impDlr)).slice(0, 15);
    el.countryTableBody.innerHTML = sorted.map((c, idx) => `
      <tr>
        <td><strong>#${idx + 1}</strong></td>
        <td><strong>${c.countryName}</strong> <span style="color:var(--text-muted);font-size:0.75rem;">(${c.countryCode})</span></td>
        <td class="table-num" style="color:var(--export-color);font-weight:600;">${ta.formatCurrency(c.expDlr)}</td>
        <td class="table-num">${ta.formatWeight(c.expWgt)}</td>
        <td class="table-num" style="color:var(--import-color);font-weight:600;">${ta.formatCurrency(c.impDlr)}</td>
        <td class="table-num">${ta.formatWeight(c.impWgt)}</td>
        <td class="table-num" style="font-weight:700;color:${c.balance >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
          ${c.balance >= 0 ? '+' : ''}${ta.formatCurrency(c.balance)}
        </td>
        <td class="table-num">${ta.formatUnitPrice(c.expUnitPrice)}</td>
      </tr>
    `).join('');
  }

  // Render Data Table
  function renderDataTable() {
    if (!el.dataTableBody) return;
    const { rawFiltered } = state.processed;
    const ta = window.tradeAnalytics;

    let list = rawFiltered;
    if (state.tableSearch) {
      const q = state.tableSearch.toLowerCase();
      list = list.filter(r => 
        (r.countryName && r.countryName.toLowerCase().includes(q)) ||
        (r.countryCode && r.countryCode.toLowerCase().includes(q)) ||
        (r.hsCd && r.hsCd.includes(q)) ||
        (r.yearMonth && r.yearMonth.includes(q))
      );
    }

    list.sort((a, b) => {
      let va = a[state.tableSortField];
      let vb = b[state.tableSortField];
      if (typeof va === 'string') return state.tableSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return state.tableSortAsc ? (va - vb) : (vb - va);
    });

    if (el.tableRecordCount) el.tableRecordCount.textContent = `총 ${list.length.toLocaleString()} 건`;

    const totalPages = Math.ceil(list.length / state.tablePageSize) || 1;
    if (state.tablePage > totalPages) state.tablePage = totalPages;
    const startIdx = (state.tablePage - 1) * state.tablePageSize;
    const pageRecords = list.slice(startIdx, startIdx + state.tablePageSize);

    el.dataTableBody.innerHTML = pageRecords.map(r => `
      <tr>
        <td><code>${r.yearMonth}</code></td>
        <td><code>${r.hsCd || state.hsCode}</code></td>
        <td><strong>${r.countryName}</strong> <span style="color:var(--text-muted);font-size:0.75rem;">(${r.countryCode})</span></td>
        <td class="table-num" style="color:var(--export-color);">${ta.formatCurrency(r.expDlr)}</td>
        <td class="table-num">${ta.formatWeight(r.expWgt)}</td>
        <td class="table-num" style="color:var(--import-color);">${ta.formatCurrency(r.impDlr)}</td>
        <td class="table-num">${ta.formatWeight(r.impWgt)}</td>
        <td class="table-num" style="font-weight:600;color:${r.balPayments >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
          ${r.balPayments >= 0 ? '+' : ''}${ta.formatCurrency(r.balPayments)}
        </td>
      </tr>
    `).join('');

    if (el.tablePagination) {
      el.tablePagination.innerHTML = `
        <button class="btn" id="btnPrevPage" ${state.tablePage <= 1 ? 'disabled' : ''}>◀ 이전</button>
        <span style="font-size:0.875rem;color:var(--text-secondary);align-self:center;">
          ${state.tablePage} / ${totalPages} 페이지
        </span>
        <button class="btn" id="btnNextPage" ${state.tablePage >= totalPages ? 'disabled' : ''}>다음 ▶</button>
      `;

      document.getElementById('btnPrevPage')?.addEventListener('click', () => {
        if (state.tablePage > 1) {
          state.tablePage--;
          renderDataTable();
        }
      });
      document.getElementById('btnNextPage')?.addEventListener('click', () => {
        if (state.tablePage < totalPages) {
          state.tablePage++;
          renderDataTable();
        }
      });
    }
  }

  function exportCSV() {
    const { rawFiltered } = state.processed;
    if (!rawFiltered || rawFiltered.length === 0) {
      showToast('내보낼 데이터가 없습니다.', 'warning');
      return;
    }

    const headers = ['연월', 'HS Code', '품목명', '국가코드', '국가명', '수출금액($)', '수출중량(kg)', '수입금액($)', '수입중량(kg)', '무역수지($)'];
    const rows = rawFiltered.map(r => [
      r.yearMonth,
      r.hsCd || state.hsCode,
      `"${(r.statKor || state.hsName).replace(/"/g, '""')}"`,
      r.countryCode,
      `"${r.countryName}"`,
      r.expDlr,
      r.expWgt,
      r.impDlr,
      r.impWgt,
      r.balPayments
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `관세청_수출입실적_${state.hsCode}_${state.selectedYear}_${state.startMonth}-${state.endMonth}월.csv`;
    link.click();
    showToast('CSV 파일이 성공적으로 다운로드되었습니다.', 'success');
  }

  // ==========================================
  // Event Bindings
  // ==========================================

  // Preset HS Code Pills
  document.querySelectorAll('.preset-hs-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.preset-hs-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.hsCode = btn.dataset.hs;
      if (el.customHsInput) el.customHsInput.value = '';
      loadData(false);
    });
  });

  if (el.btnApplyHs) {
    el.btnApplyHs.addEventListener('click', () => {
      const val = el.customHsInput.value.trim().replace(/[^0-9]/g, '');
      if (val.length < 4) {
        showToast('HS Code는 최소 4자리 이상 입력해주세요.', 'warning');
        return;
      }
      document.querySelectorAll('.preset-hs-btn').forEach(b => b.classList.remove('active'));
      state.hsCode = val;
      loadData(true);
    });
  }

  // Overall Year & Month Range Selection
  if (el.yearSelect) {
    el.yearSelect.addEventListener('change', (e) => {
      state.selectedYear = e.target.value;
      recalculate();
    });
  }

  if (el.startMonthSelect) {
    el.startMonthSelect.addEventListener('change', (e) => {
      state.startMonth = parseInt(e.target.value, 10);
      if (state.startMonth > state.endMonth) {
        state.endMonth = state.startMonth;
        if (el.endMonthSelect) el.endMonthSelect.value = String(state.endMonth);
      }
      recalculate();
    });
  }

  if (el.endMonthSelect) {
    el.endMonthSelect.addEventListener('change', (e) => {
      state.endMonth = parseInt(e.target.value, 10);
      if (state.endMonth < state.startMonth) {
        state.startMonth = state.endMonth;
        if (el.startMonthSelect) el.startMonthSelect.value = String(state.startMonth);
      }
      recalculate();
    });
  }

  // Regional Sigungu Selection
  if (el.sigunguSelect) {
    el.sigunguSelect.addEventListener('change', (e) => {
      state.selectedSigungu = e.target.value;
      state.processedRegional = window.tradeAnalytics.processRegionalData(
        state.regionalRecords,
        state.selectedSigungu,
        state.regionalSelectedYear,
        state.regionalStartMonth,
        state.regionalEndMonth
      );
      renderRegionalTab();
    });
  }

  // Regional Year Selection
  if (el.regYearSelect) {
    el.regYearSelect.addEventListener('change', (e) => {
      state.regionalSelectedYear = e.target.value;
      state.processedRegional = window.tradeAnalytics.processRegionalData(
        state.regionalRecords,
        state.selectedSigungu,
        state.regionalSelectedYear,
        state.regionalStartMonth,
        state.regionalEndMonth
      );
      renderRegionalTab();
    });
  }

  // Regional Start/End Month Selection
  if (el.regStartMonthSelect) {
    el.regStartMonthSelect.addEventListener('change', (e) => {
      state.regionalStartMonth = parseInt(e.target.value, 10);
      if (state.regionalStartMonth > state.regionalEndMonth) {
        state.regionalEndMonth = state.regionalStartMonth;
        if (el.regEndMonthSelect) el.regEndMonthSelect.value = String(state.regionalEndMonth);
      }
      state.processedRegional = window.tradeAnalytics.processRegionalData(
        state.regionalRecords,
        state.selectedSigungu,
        state.regionalSelectedYear,
        state.regionalStartMonth,
        state.regionalEndMonth
      );
      renderRegionalTab();
    });
  }

  if (el.regEndMonthSelect) {
    el.regEndMonthSelect.addEventListener('change', (e) => {
      state.regionalEndMonth = parseInt(e.target.value, 10);
      if (state.regionalEndMonth < state.regionalStartMonth) {
        state.regionalStartMonth = state.regionalEndMonth;
        if (el.regStartMonthSelect) el.regStartMonthSelect.value = String(state.regionalStartMonth);
      }
      state.processedRegional = window.tradeAnalytics.processRegionalData(
        state.regionalRecords,
        state.selectedSigungu,
        state.regionalSelectedYear,
        state.regionalStartMonth,
        state.regionalEndMonth
      );
      renderRegionalTab();
    });
  }

  // Currency Toggle
  if (el.currencyToggle) {
    el.currencyToggle.addEventListener('click', () => {
      state.currency = state.currency === 'USD' ? 'KRW' : 'USD';
      el.currencyToggle.textContent = state.currency === 'USD' ? '$ USD' : '₩ KRW';
      el.currencyToggle.classList.toggle('active', state.currency === 'KRW');
      recalculate();
    });
  }

  // Exchange Rate Input
  if (el.exchangeRateInput) {
    el.exchangeRateInput.addEventListener('change', (e) => {
      state.exchangeRate = Number(e.target.value) || 1380;
      recalculate();
    });
  }

  // Tab Switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const targetId = btn.dataset.target;
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
      
      state.activeTab = targetId;
      setTimeout(() => {
        renderCharts();
        renderRegionalTab();
        renderMomYoyTable();
        renderUnitPriceTable();
      }, 50);
    });
  });

  // Table Search
  if (el.tableSearchInput) {
    el.tableSearchInput.addEventListener('input', (e) => {
      state.tableSearch = e.target.value.trim();
      state.tablePage = 1;
      renderDataTable();
    });
  }

  // Table Column Sort
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.field;
      if (state.tableSortField === field) {
        state.tableSortAsc = !state.tableSortAsc;
      } else {
        state.tableSortField = field;
        state.tableSortAsc = false;
      }
      renderDataTable();
    });
  });

  if (el.btnRefreshData) {
    el.btnRefreshData.addEventListener('click', () => {
      loadData(true);
    });
  }

  if (el.btnExportCsv) {
    el.btnExportCsv.addEventListener('click', exportCSV);
  }

  // Theme Toggle
  if (el.themeToggle) {
    el.themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      el.themeToggle.textContent = next === 'light' ? '☀️ 라이트 모드' : '🌙 다크 모드';
      renderCharts();
      renderRegionalTab();
      renderMomYoyTable();
      renderUnitPriceTable();
    });
  }

  // API Modal
  if (el.btnOpenApiModal) {
    el.btnOpenApiModal.addEventListener('click', () => {
      if (el.apiKeyInput) el.apiKeyInput.value = window.customsApi.getServiceKey();
      if (el.apiModal) el.apiModal.classList.add('show');
    });
  }

  if (el.btnCloseApiModal) {
    el.btnCloseApiModal.addEventListener('click', () => {
      if (el.apiModal) el.apiModal.classList.remove('show');
    });
  }

  if (el.btnSaveApiKey) {
    el.btnSaveApiKey.addEventListener('click', async () => {
      const key = el.apiKeyInput.value.trim();
      if (!key) {
        showToast('인증키를 입력해주세요.', 'warning');
        return;
      }
      window.customsApi.setServiceKey(key);
      if (el.apiModal) el.apiModal.classList.remove('show');
      showToast('API 인증키가 저장되었습니다. 데이터를 새로고침합니다.', 'success');
      loadData(true);
    });
  }

  // Initial Load
  await loadData(false);
});
