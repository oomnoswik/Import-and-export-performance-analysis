/**
 * Chart.js Visualizations Manager
 * Enhanced with MoM & YoY Growth Indicators and Dedicated Unit Price / Margin Analysis
 */

class TradeChartsManager {
  constructor() {
    this.charts = {};
  }

  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
      textColor: isDark ? '#94a3b8' : '#475569',
      headingColor: isDark ? '#f8fafc' : '#0f172a',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.98)',
      tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
      tooltipText: isDark ? '#f8fafc' : '#0f172a',
      exportColor: isDark ? '#38bdf8' : '#0284c7',
      exportGradient: isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.35)',
      importColor: isDark ? '#f43f5e' : '#e11d48',
      importGradient: isDark ? 'rgba(244, 63, 94, 0.35)' : 'rgba(225, 29, 72, 0.35)',
      balanceColor: isDark ? '#10b981' : '#059669',
      balanceFill: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(5, 150, 105, 0.15)',
      accentAmber: isDark ? '#fbbf24' : '#d97706',
      accentViolet: isDark ? '#a78bfa' : '#7c3aed',
      accentCyan: isDark ? '#06b6d4' : '#0891b2',
    };
  }

  destroyChart(id) {
    if (this.charts[id]) {
      this.charts[id].destroy();
      delete this.charts[id];
    }
  }

  destroyAll() {
    Object.keys(this.charts).forEach(id => this.destroyChart(id));
  }

  /**
   * 1. Main Time Series Combo Trend Chart
   */
  renderMainTrendChart(canvasId, yearlyData, analyticsEngine) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !yearlyData || yearlyData.length === 0) return;

    const colors = this.getThemeColors();
    const labels = yearlyData.map(d => `${d.year}년`);
    const exportValues = yearlyData.map(d => analyticsEngine.currency === 'KRW' ? (d.expDlr * analyticsEngine.exchangeRate) / 1e8 : d.expDlr / 1e3);
    const importValues = yearlyData.map(d => analyticsEngine.currency === 'KRW' ? (d.impDlr * analyticsEngine.exchangeRate) / 1e8 : d.impDlr / 1e3);
    const balanceValues = yearlyData.map(d => analyticsEngine.currency === 'KRW' ? (d.balance * analyticsEngine.exchangeRate) / 1e8 : d.balance / 1e3);

    const unitLabel = analyticsEngine.currency === 'KRW' ? '억원' : '천 달러 ($K)';

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: `무역수지 (${unitLabel})`,
            data: balanceValues,
            borderColor: colors.balanceColor,
            backgroundColor: colors.balanceFill,
            borderWidth: 3,
            tension: 0.3,
            fill: false,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: colors.balanceColor,
            yAxisID: 'y',
            order: 1
          },
          {
            type: 'bar',
            label: `수출액 (${unitLabel})`,
            data: exportValues,
            backgroundColor: colors.exportColor,
            borderRadius: 6,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
            order: 2
          },
          {
            type: 'bar',
            label: `수입액 (${unitLabel})`,
            data: importValues,
            backgroundColor: colors.importColor,
            borderRadius: 6,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
            order: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: colors.textColor, font: { family: 'Pretendard', size: 12 }, usePointStyle: true }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (ctx) => {
                const yd = yearlyData[ctx.dataIndex];
                if (ctx.datasetIndex === 1) {
                  const yoy = (yd.expYoY !== undefined && yd.expYoY !== 0) ? ` (전년비 ${yd.expYoY >= 0 ? '▲ +' : '▼ '}${yd.expYoY.toFixed(1)}%)` : '';
                  return ` 수출액: ${ctx.raw.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unitLabel}${yoy}`;
                } else if (ctx.datasetIndex === 2) {
                  const yoy = (yd.impYoY !== undefined && yd.impYoY !== 0) ? ` (전년비 ${yd.impYoY >= 0 ? '▲ +' : '▼ '}${yd.impYoY.toFixed(1)}%)` : '';
                  return ` 수입액: ${ctx.raw.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unitLabel}${yoy}`;
                }
                return ` ${ctx.dataset.label}: ${ctx.raw.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unitLabel}`;
              }
            }
          }
        },
        scales: {
          x: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor } },
          y: {
            grid: { color: colors.gridColor },
            ticks: {
              color: colors.textColor,
              font: { family: 'JetBrains Mono', size: 11 },
              callback: (val) => `${val.toLocaleString()} ${unitLabel.split(' ')[0]}`
            }
          }
        }
      }
    });
  }

  /**
   * 2. Monthly Detail Chart with Explicit MoM & YoY Tooltips
   */
  renderMonthlyDetailChart(canvasId, monthlyData, analyticsEngine) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !monthlyData || monthlyData.length === 0) return;

    const colors = this.getThemeColors();
    const labels = monthlyData.map(d => d.yearMonth);
    const exportValues = monthlyData.map(d => analyticsEngine.currency === 'KRW' ? (d.expDlr * analyticsEngine.exchangeRate) / 1e6 : d.expDlr / 1e3);
    const importValues = monthlyData.map(d => analyticsEngine.currency === 'KRW' ? (d.impDlr * analyticsEngine.exchangeRate) / 1e6 : d.impDlr / 1e3);
    const unitLabel = analyticsEngine.currency === 'KRW' ? '백만원' : '천 달러 ($K)';

    this.charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: `월별 수출액 (${unitLabel})`,
            data: exportValues,
            borderColor: colors.exportColor,
            backgroundColor: colors.exportGradient,
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 7
          },
          {
            label: `월별 수입액 (${unitLabel})`,
            data: importValues,
            borderColor: colors.importColor,
            backgroundColor: colors.importGradient,
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { color: colors.textColor, usePointStyle: true } },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 14,
            callbacks: {
              title: (items) => `📅 [${items[0].label}] 통관 실적 상세`,
              label: (ctx) => {
                const md = monthlyData[ctx.dataIndex];
                if (ctx.datasetIndex === 0) {
                  const momStr = (md.expMoM !== undefined && md.expMoM !== null) ? ` [전월비 ${md.expMoM >= 0 ? '▲ +' : '▼ '}${md.expMoM.toFixed(1)}%]` : '';
                  const yoyStr = (md.expYoY !== undefined && md.expYoY !== null) ? ` [전년비 ${md.expYoY >= 0 ? '▲ +' : '▼ '}${md.expYoY.toFixed(1)}%]` : ' [전년비: -]';
                  return ` 수출: ${ctx.raw.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unitLabel}${momStr}${yoyStr}`;
                } else {
                  const momStr = (md.impMoM !== undefined && md.impMoM !== null) ? ` [전월비 ${md.impMoM >= 0 ? '▲ +' : '▼ '}${md.impMoM.toFixed(1)}%]` : '';
                  const yoyStr = (md.impYoY !== undefined && md.impYoY !== null) ? ` [전년비 ${md.impYoY >= 0 ? '▲ +' : '▼ '}${md.impYoY.toFixed(1)}%]` : ' [전년비: -]';
                  return ` 수입: ${ctx.raw.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unitLabel}${momStr}${yoyStr}`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: colors.gridColor },
            ticks: { color: colors.textColor, maxRotation: 45, autoSkip: true, maxTicksLimit: 14 }
          },
          y: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor, font: { family: 'JetBrains Mono' } } }
        }
      }
    });
  }

  /**
   * 3. Overview Unit Price & Spread Chart
   */
  renderUnitPriceChart(canvasId, yearlyData, analyticsEngine) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !yearlyData || yearlyData.length === 0) return;

    const colors = this.getThemeColors();
    const labels = yearlyData.map(d => `${d.year}년`);
    const expPrices = yearlyData.map(d => analyticsEngine.currency === 'KRW' ? (d.expUnitPrice * analyticsEngine.exchangeRate) : d.expUnitPrice);
    const impPrices = yearlyData.map(d => analyticsEngine.currency === 'KRW' ? (d.impUnitPrice * analyticsEngine.exchangeRate) : d.impUnitPrice);
    const spreads = yearlyData.map(d => analyticsEngine.currency === 'KRW' ? (d.spread * analyticsEngine.exchangeRate) : d.spread);

    const priceUnit = analyticsEngine.currency === 'KRW' ? '원/kg' : '$/kg';

    this.charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'bar',
            label: `단가 스프레드 (마진)`,
            data: spreads,
            backgroundColor: (ctx) => (ctx.raw || 0) >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
            borderColor: (ctx) => (ctx.raw || 0) >= 0 ? colors.balanceColor : colors.importColor,
            borderWidth: 1,
            borderRadius: 4,
            order: 3
          },
          {
            type: 'line',
            label: `수출 평균단가 (${priceUnit})`,
            data: expPrices,
            borderColor: colors.exportColor,
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: colors.exportColor,
            tension: 0.2,
            order: 1
          },
          {
            type: 'line',
            label: `수입 평균단가 (${priceUnit})`,
            data: impPrices,
            borderColor: colors.importColor,
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: colors.importColor,
            tension: 0.2,
            order: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { color: colors.textColor, usePointStyle: true } },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${priceUnit}`
            }
          }
        },
        scales: {
          x: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor } },
          y: {
            grid: { color: colors.gridColor },
            ticks: { color: colors.textColor, callback: (val) => `${val.toLocaleString()} ${priceUnit}` }
          }
        }
      }
    });
  }

  /**
   * 4. Dedicated Full Unit Price & Margin Detail Chart (Tab 4: 단가 부가가치 마진분석)
   */
  renderUnitPriceDetailChart(canvasId, monthlyData, analyticsEngine) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !monthlyData || monthlyData.length === 0) return;

    const colors = this.getThemeColors();
    const labels = monthlyData.map(d => d.yearMonth);
    const expPrices = monthlyData.map(d => analyticsEngine.currency === 'KRW' ? (d.expUnitPrice * analyticsEngine.exchangeRate) : d.expUnitPrice);
    const impPrices = monthlyData.map(d => analyticsEngine.currency === 'KRW' ? (d.impUnitPrice * analyticsEngine.exchangeRate) : d.impUnitPrice);
    const spreads = monthlyData.map(d => analyticsEngine.currency === 'KRW' ? (d.spread * analyticsEngine.exchangeRate) : d.spread);

    const priceUnit = analyticsEngine.currency === 'KRW' ? '원/kg' : '$/kg';

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: `수출 평균단가 (${priceUnit})`,
            data: expPrices,
            borderColor: colors.exportColor,
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: colors.exportColor,
            tension: 0.2,
            order: 1
          },
          {
            type: 'line',
            label: `수입 평균단가 (${priceUnit})`,
            data: impPrices,
            borderColor: colors.importColor,
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: colors.importColor,
            tension: 0.2,
            order: 2
          },
          {
            type: 'bar',
            label: `부가가치 마진 스프레드 (${priceUnit})`,
            data: spreads,
            backgroundColor: (ctx) => (ctx.raw || 0) >= 0 ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)',
            borderColor: (ctx) => (ctx.raw || 0) >= 0 ? colors.balanceColor : colors.importColor,
            borderWidth: 1.5,
            borderRadius: 4,
            order: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { color: colors.textColor, font: { family: 'Pretendard', size: 12 }, usePointStyle: true } },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${priceUnit}`
            }
          }
        },
        scales: {
          x: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor, maxRotation: 45 } },
          y: {
            grid: { color: colors.gridColor },
            ticks: { color: colors.textColor, callback: (v) => `${v.toLocaleString()} ${priceUnit}` }
          }
        }
      }
    });
  }

  /**
   * 5. Country Unit Price / High-Value Ranking Chart (Tab 4)
   */
  renderCountryMarginChart(canvasId, countryStats, analyticsEngine) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !countryStats || countryStats.length === 0) return;

    const colors = this.getThemeColors();
    const sorted = [...countryStats].filter(c => c.expDlr > 10000 && c.expUnitPrice > 0).sort((a, b) => b.expUnitPrice - a.expUnitPrice).slice(0, 8);
    const labels = sorted.map(c => c.countryName);
    const values = sorted.map(c => analyticsEngine.currency === 'KRW' ? (c.expUnitPrice * analyticsEngine.exchangeRate) : c.expUnitPrice);
    const priceUnit = analyticsEngine.currency === 'KRW' ? '원/kg' : '$/kg';

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: `국가별 수출 평균단가 (${priceUnit})`,
          data: values,
          backgroundColor: colors.accentAmber,
          borderRadius: 6,
          barPercentage: 0.6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const c = sorted[ctx.dataIndex];
                return [
                  ` 수출단가: ${analyticsEngine.formatUnitPrice(c.expUnitPrice)}`,
                  ` 총 수출액: ${analyticsEngine.formatCurrency(c.expDlr, true)}`,
                  ` 수출중량: ${analyticsEngine.formatWeight(c.expWgt)}`
                ];
              }
            }
          }
        },
        scales: {
          x: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor } },
          y: { grid: { display: false }, ticks: { color: colors.textColor, font: { weight: 600 } } }
        }
      }
    });
  }

  /**
   * 6. Top Countries Bar Chart
   */
  renderTopCountriesChart(canvasId, countries, type = 'export', analyticsEngine) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !countries || countries.length === 0) return;

    const colors = this.getThemeColors();
    const isExport = type === 'export';
    const topList = countries.slice(0, 8);
    const labels = topList.map(c => c.countryName);
    const values = topList.map(c => {
      const dlr = isExport ? c.expDlr : c.impDlr;
      return analyticsEngine.currency === 'KRW' ? (dlr * analyticsEngine.exchangeRate) / 1e8 : dlr / 1e3;
    });

    const mainColor = isExport ? colors.exportColor : colors.importColor;
    const unitLabel = analyticsEngine.currency === 'KRW' ? '억원' : '천 달러 ($K)';

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: isExport ? `수출액 (${unitLabel})` : `수입액 (${unitLabel})`,
          data: values,
          backgroundColor: mainColor,
          borderRadius: 6,
          barPercentage: 0.65
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unitLabel}`
            }
          }
        },
        scales: {
          x: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor } },
          y: { grid: { display: false }, ticks: { color: colors.textColor, font: { weight: 500 } } }
        }
      }
    });
  }

  /**
   * 7. Country Share Doughnut Chart
   */
  renderCountryShareDoughnut(canvasId, countries, analyticsEngine) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !countries || countries.length === 0) return;

    const colors = this.getThemeColors();
    const top5 = countries.slice(0, 5);
    const otherSum = countries.slice(5).reduce((acc, c) => acc + c.expDlr, 0);

    const labels = [...top5.map(c => c.countryName), '기타 국가'];
    const data = [...top5.map(c => c.expDlr), otherSum];
    const palette = ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#64748b'];

    this.charts[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: palette,
          borderWidth: 2,
          borderColor: colors.tooltipBg
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { position: 'right', labels: { color: colors.textColor, usePointStyle: true } },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw;
                const total = data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${analyticsEngine.formatCurrency(val, true)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * 8. Seasonality Radar Chart
   */
  renderSeasonalityRadar(canvasId, seasonality, analyticsEngine) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !seasonality || seasonality.length === 0) return;

    const colors = this.getThemeColors();
    const labels = seasonality.map(s => s.month);
    const expData = seasonality.map(s => s.avgExp / 1e3);
    const impData = seasonality.map(s => s.avgImp / 1e3);

    this.charts[canvasId] = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '월평균 수출액 ($K)',
            data: expData,
            borderColor: colors.exportColor,
            backgroundColor: colors.exportGradient,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: colors.exportColor
          },
          {
            label: '월평균 수입액 ($K)',
            data: impData,
            borderColor: colors.importColor,
            backgroundColor: colors.importGradient,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: colors.importColor
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: colors.textColor, usePointStyle: true } },
          tooltip: { backgroundColor: colors.tooltipBg, titleColor: colors.tooltipText, bodyColor: colors.tooltipText }
        },
        scales: {
          r: {
            grid: { color: colors.gridColor },
            angleLines: { color: colors.gridColor },
            pointLabels: { color: colors.textColor, font: { size: 11, weight: 600 } },
            ticks: { display: false }
          }
        }
      }
    });
  }

  /**
   * 9. Regional Export Ranking Bar Chart
   */
  renderRegionalRankingChart(canvasId, regionalRanking, analyticsEngine) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !regionalRanking || regionalRanking.length === 0) return;

    const colors = this.getThemeColors();
    const labels = regionalRanking.map(r => r.sigunguName.split(' ')[0]);
    const values = regionalRanking.map(r => analyticsEngine.currency === 'KRW' ? (r.expDlr * analyticsEngine.exchangeRate) / 1e8 : r.expDlr / 1e6);
    const unitLabel = analyticsEngine.currency === 'KRW' ? '억원' : '백만 달러 ($M)';

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: `지역별 L-아르기닌 수출액 (${unitLabel})`,
          data: values,
          backgroundColor: [
            '#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'
          ],
          borderRadius: 6,
          barPercentage: 0.6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const reg = regionalRanking[ctx.dataIndex];
                return [
                  ` 수출액: ${analyticsEngine.formatCurrency(reg.expDlr, true)} (비중: ${reg.share.toFixed(1)}%)`,
                  ` 거점특징: ${reg.hubType}`
                ];
              }
            }
          }
        },
        scales: {
          x: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor } },
          y: {
            grid: { color: colors.gridColor },
            ticks: { color: colors.textColor, callback: (v) => `${v.toLocaleString()} ${unitLabel.split(' ')[0]}` }
          }
        }
      }
    });
  }

  /**
   * 10. Selected Region -> Destination Country Export Breakdown
   */
  renderRegionDestinationChart(canvasId, destinationStats, regionName, analyticsEngine) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !destinationStats || destinationStats.length === 0) return;

    const colors = this.getThemeColors();
    const topDest = destinationStats.slice(0, 7);
    const labels = topDest.map(d => d.countryName);
    const values = topDest.map(d => analyticsEngine.currency === 'KRW' ? (d.expDlr * analyticsEngine.exchangeRate) / 1e8 : d.expDlr / 1e6);
    const unitLabel = analyticsEngine.currency === 'KRW' ? '억원' : '백만 달러 ($M)';

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: `${regionName} 발 수출액 (${unitLabel})`,
          data: values,
          backgroundColor: colors.accentCyan,
          borderRadius: 6,
          barPercentage: 0.65
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const dest = topDest[ctx.dataIndex];
                return [
                  ` 수출액: ${analyticsEngine.formatCurrency(dest.expDlr, true)} (${dest.share.toFixed(1)}%)`,
                  ` 수출중량: ${analyticsEngine.formatWeight(dest.expWgt)}`,
                  ` 평균단가: ${analyticsEngine.formatUnitPrice(dest.expUnitPrice)}`
                ];
              }
            }
          }
        },
        scales: {
          x: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor } },
          y: { grid: { display: false }, ticks: { color: colors.textColor, font: { weight: 600 } } }
        }
      }
    });
  }

  /**
   * 11. Regional Monthly Trend Chart with MoM indicator
   */
  renderRegionalMonthlyChart(canvasId, regionalMonthlyTrend, regionName, analyticsEngine) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx || !regionalMonthlyTrend || regionalMonthlyTrend.length === 0) return;

    const colors = this.getThemeColors();
    const labels = regionalMonthlyTrend.map(d => d.month);
    const exportValues = regionalMonthlyTrend.map(d => analyticsEngine.currency === 'KRW' ? (d.expDlr * analyticsEngine.exchangeRate) / 1e8 : d.expDlr / 1e6);
    const importValues = regionalMonthlyTrend.map(d => analyticsEngine.currency === 'KRW' ? (d.impDlr * analyticsEngine.exchangeRate) / 1e8 : d.impDlr / 1e6);
    const unitLabel = analyticsEngine.currency === 'KRW' ? '억원' : '백만 달러 ($M)';

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: `수출액 (${unitLabel})`,
            data: exportValues,
            backgroundColor: colors.exportColor,
            borderRadius: 4,
            barPercentage: 0.6
          },
          {
            label: `수입액 (${unitLabel})`,
            data: importValues,
            backgroundColor: colors.importColor,
            borderRadius: 4,
            barPercentage: 0.6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { color: colors.textColor, usePointStyle: true } },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const mt = regionalMonthlyTrend[ctx.dataIndex];
                if (ctx.datasetIndex === 0) {
                  const mom = (mt.expMoM !== undefined && mt.expMoM !== null && mt.expMoM !== 0) ? ` [전월비 ${mt.expMoM >= 0 ? '▲ +' : '▼ '}${mt.expMoM.toFixed(1)}%]` : '';
                  return ` 수출액: ${ctx.raw.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unitLabel}${mom}`;
                }
                return ` 수입액: ${ctx.raw.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unitLabel}`;
              }
            }
          }
        },
        scales: {
          x: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor } },
          y: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor } }
        }
      }
    });
  }
}

window.tradeCharts = new TradeChartsManager();
