#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
L-Arginine & Multi-Dimension Customs Trade Analytics Server (2020~2026)
Supports 3 Major Korea Customs OpenAPI Services:
1. 관세청_품목별 국가별 수출입실적 (nitemtrade, 2020~2026)
2. 관세청_국가별 수출입실적 (nationtrade)
3. 관세청_시군구별 품목별 수출입실적 (sigunguitemtrade / regional with Monthly Granularity)
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

PORT = 8000
DEFAULT_SERVICE_KEY = "wjKreSjBb0%2B8UXShMApi4tYPhB11tc5IuB0Udqh6DT1cbgY4Kg%2BnLqoGp%2BatqElVfcCwfmM0j4hC8%2BRX4JRNSg%3D%3D"
CACHE_DIR = os.path.join(os.path.dirname(__file__), '.cache')
os.makedirs(CACHE_DIR, exist_ok=True)

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

class CustomsProxyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/customs/trade'):
            self.handle_customs_trade(parsed.query)
        elif path.startswith('/api/customs/nation'):
            self.handle_customs_nation(parsed.query)
        elif path.startswith('/api/customs/regional'):
            self.handle_customs_regional(parsed.query)
        elif path.startswith('/api/customs/health'):
            self.handle_health(parsed.query)
        else:
            super().do_GET()

    def handle_health(self, query_str):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps({
            'status': 'ok',
            'supportedAPIs': [
                '관세청_품목별 국가별 수출입실적(GW, 2020~2026)',
                '관세청_국가별 수출입실적(GW)',
                '관세청_시군구별 품목별 수출입실적 (월별 세분화)'
            ]
        }, ensure_ascii=False).encode('utf-8'))

    # 1. API 1: 품목별 국가별 수출입실적 (nitemtrade, 2020~2026)
    def handle_customs_trade(self, query_str):
        params = urllib.parse.parse_qs(query_str)
        hs_code = params.get('hsSgn', ['292529'])[0].strip().replace('.', '').replace('-', '')
        start_year = int(params.get('startYear', ['2020'])[0])
        end_year = int(params.get('endYear', ['2026'])[0])
        service_key = params.get('serviceKey', [DEFAULT_SERVICE_KEY])[0].strip()
        force_refresh = params.get('refresh', ['false'])[0].lower() == 'true'

        cache_file = os.path.join(CACHE_DIR, f"trade_{hs_code}_{start_year}_{end_year}.json")
        if not force_refresh and os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('X-Data-Source', 'Cache')
                self.end_headers()
                self.wfile.write(json.dumps(cached_data, ensure_ascii=False).encode('utf-8'))
                return
            except Exception as e:
                print(f"[Cache Error] {e}")

        # Check pre-saved JSON if available
        preset_file = os.path.join(os.path.dirname(__file__), 'data', 'preset_trade_data.json')
        if not force_refresh and os.path.exists(preset_file):
            try:
                with open(preset_file, 'r', encoding='utf-8') as f:
                    preset_data = json.load(f)
                if hs_code in preset_data and preset_data[hs_code].get('records'):
                    recs = preset_data[hs_code]['records']
                    payload = {
                        'hsCode': hs_code,
                        'startYear': start_year,
                        'endYear': end_year,
                        'totalRecords': len(recs),
                        'errors': [],
                        'records': recs
                    }
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                    self.send_header('X-Data-Source', 'Cached-Customs-Dataset')
                    self.end_headers()
                    self.wfile.write(json.dumps(payload, ensure_ascii=False).encode('utf-8'))
                    return
            except Exception as e:
                print(f"[Preset Load Error] {e}")

        records = []
        errors = []
        for yr in range(start_year, end_year + 1):
            url = f"http://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList?serviceKey={service_key}&strtYymm={yr}01&endYymm={yr}12&hsSgn={hs_code}"
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=12) as resp:
                    content = resp.read()
                    root = ET.fromstring(content)
                    res_code = root.findtext('.//resultCode', '')
                    if res_code and res_code != '00':
                        msg = root.findtext('.//resultMsg', 'Error')
                        errors.append(f"{yr}년: [{res_code}] {msg}")
                        continue

                    items = root.findall('.//item')
                    for item in items:
                        records.append({
                            'year': item.findtext('year', ''),
                            'hsCd': item.findtext('hsCd', ''),
                            'statKor': item.findtext('statKor', ''),
                            'statCd': item.findtext('statCd', ''),
                            'country': item.findtext('statCdCntnKor1', ''),
                            'expDlr': int(item.findtext('expDlr', '0') or 0),
                            'expWgt': int(item.findtext('expWgt', '0') or 0),
                            'impDlr': int(item.findtext('impDlr', '0') or 0),
                            'impWgt': int(item.findtext('impWgt', '0') or 0),
                            'balPayments': int(item.findtext('balPayments', '0') or 0),
                        })
            except Exception as e:
                errors.append(f"{yr}년 호출 실패: {str(e)}")

        response_payload = {
            'hsCode': hs_code,
            'startYear': start_year,
            'endYear': end_year,
            'totalRecords': len(records),
            'errors': errors,
            'records': records
        }

        if records:
            try:
                with open(cache_file, 'w', encoding='utf-8') as f:
                    json.dump(response_payload, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"[Cache Write Error] {e}")

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('X-Data-Source', 'Live-API')
        self.end_headers()
        self.wfile.write(json.dumps(response_payload, ensure_ascii=False).encode('utf-8'))

    # 2. API 2: 국가별 수출입실적 (nationtrade)
    def handle_customs_nation(self, query_str):
        params = urllib.parse.parse_qs(query_str)
        start_year = int(params.get('startYear', ['2023'])[0])
        end_year = int(params.get('endYear', ['2024'])[0])
        service_key = params.get('serviceKey', [DEFAULT_SERVICE_KEY])[0].strip()
        force_refresh = params.get('refresh', ['false'])[0].lower() == 'true'

        cache_file = os.path.join(CACHE_DIR, f"nation_{start_year}_{end_year}.json")
        if not force_refresh and os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached = json.load(f)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('X-Data-Source', 'Cache')
                self.end_headers()
                self.wfile.write(json.dumps(cached, ensure_ascii=False).encode('utf-8'))
                return
            except Exception as e:
                print(f"[Nation Cache Error] {e}")

        records = []
        errors = []
        for yr in range(start_year, end_year + 1):
            url = f"http://apis.data.go.kr/1220000/nationtrade/getNationtradeList?serviceKey={service_key}&strtYymm={yr}01&endYymm={yr}12"
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=12) as resp:
                    content = resp.read()
                    root = ET.fromstring(content)
                    items = root.findall('.//item')
                    for item in items:
                        records.append({
                            'year': item.findtext('year', ''),
                            'statCd': item.findtext('statCd', ''),
                            'country': item.findtext('statCdCntnKor1', ''),
                            'expDlr': int(item.findtext('expDlr', '0') or 0),
                            'impDlr': int(item.findtext('impDlr', '0') or 0),
                            'balPayments': int(item.findtext('balPayments', '0') or 0),
                            'expCnt': int(item.findtext('expCnt', '0') or 0),
                            'impCnt': int(item.findtext('impCnt', '0') or 0),
                        })
            except Exception as e:
                errors.append(f"Nation {yr} 실패: {e}")

        payload = {
            'startYear': start_year,
            'endYear': end_year,
            'totalRecords': len(records),
            'records': records,
            'errors': errors
        }

        if records:
            try:
                with open(cache_file, 'w', encoding='utf-8') as f:
                    json.dump(payload, f, ensure_ascii=False, indent=2)
            except Exception as e:
                pass

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('X-Data-Source', 'Live-API')
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode('utf-8'))

    # 3. API 3: 시군구별 품목별 수출입실적 (시작월~종료월 기간 범위 지원)
    def handle_customs_regional(self, query_str):
        params = urllib.parse.parse_qs(query_str)
        sido_code = params.get('sido', [''])[0].strip()
        sigungu_code = params.get('sigungu', [''])[0].strip()
        selected_year = params.get('year', ['ALL'])[0].strip()
        start_month = int(params.get('startMonth', ['1'])[0])
        end_month = int(params.get('endMonth', ['12'])[0])
        min_m = min(start_month, end_month)
        max_m = max(start_month, end_month)

        data_file = os.path.join(os.path.dirname(__file__), 'data', 'regional_trade_data.json')
        if os.path.exists(data_file):
            try:
                with open(data_file, 'r', encoding='utf-8') as f:
                    raw_data = json.load(f)
                records = raw_data.get('records', [])
                
                # Filter by Year
                if selected_year != 'ALL':
                    yr_num = int(selected_year)
                    records = [r for r in records if r.get('year') == yr_num]
                
                # Filter by Month Range [min_m, max_m]
                records = [r for r in records if r.get('month', 1) >= min_m and r.get('month', 1) <= max_m]

                if sido_code:
                    records = [r for r in records if r.get('sidoCode') == sido_code]
                if sigungu_code:
                    records = [r for r in records if r.get('sigunguCode') == sigungu_code]

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('X-Data-Source', 'Customs-Regional-Engine')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'status': 'ok',
                    'totalRecords': len(records),
                    'records': records
                }, ensure_ascii=False).encode('utf-8'))
                return
            except Exception as e:
                print(f"[Regional Load Error] {e}")

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'ok', 'records': []}, ensure_ascii=False).encode('utf-8'))

def run_server():
    server = ThreadedHTTPServer(("", PORT), CustomsProxyHandler)
    print(f"=====================================================")
    print(f"🚀 L-아르기닌 관세청 무역통계 분석 서버 (2020~2026)")
    print(f"🌐 대시보드: http://localhost:{PORT}")
    print(f"=====================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n서버가 중지되었습니다.")

if __name__ == '__main__':
    run_server()
