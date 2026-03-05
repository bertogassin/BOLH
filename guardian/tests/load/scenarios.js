/**
 * k6 load scenario. Run: k6 run tests/load/scenarios.js
 * Requires running API: API_URL=http://localhost:8080 k6 run tests/load/scenarios.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'

const API_URL = __ENV.API_URL || 'http://localhost:8080'

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
}

export default function () {
  const healthRes = http.get(`${API_URL}/health`)
  check(healthRes, { 'health ok': (r) => r.status === 200 })
  sleep(0.5 + Math.random())
}
