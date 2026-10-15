import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export async function registerUiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    // If request explicitly asks for JSON, return API metadata
    const accept = request.headers.accept ?? "";
    if (accept.includes("application/json") && !accept.includes("text/html")) {
      return reply.send({
        name: "ai-business-automation",
        version: "0.1.0",
        description: "AI Business Automation Platform API",
        health: "/health",
        leads: "/api/leads",
        n8nUi: "http://localhost:5678",
      });
    }

    const html = getDashboardHtml();
    return reply
      .header("Cache-Control", "no-cache, no-store, must-revalidate")
      .header("Pragma", "no-cache")
      .header("Expires", "0")
      .type("text/html; charset=utf-8")
      .send(html);
  });
}

function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Business Automation Platform</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --purple: #8b5cf6;
      --radius: 8px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 24px;
    }
    .header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--card-border);
      gap: 16px;
    }
    .header-title h1 { font-size: 1.5rem; font-weight: 700; color: #fff; }
    .header-title p { font-size: 0.875rem; color: var(--text-muted); }
    .header-badges { display: flex; gap: 10px; align-items: center; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: #1e293b;
      border: 1px solid var(--card-border);
      text-decoration: none;
      color: var(--text);
    }
    .badge-live { background: rgba(16, 185, 129, 0.15); border-color: var(--success); color: #34d399; }
    .badge-link { background: rgba(59, 130, 246, 0.15); border-color: var(--primary); color: #60a5fa; transition: opacity 0.2s; }
    .badge-link:hover { opacity: 0.8; }
    .layout {
      display: grid;
      grid-template-columns: 420px 1fr;
      gap: 24px;
    }
    @media (max-width: 1024px) {
      .layout { grid-template-columns: 1fr; }
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      padding: 20px;
      margin-bottom: 20px;
    }
    .card-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .form-group { margin-bottom: 14px; }
    label { display: block; font-size: 0.8rem; font-weight: 500; color: var(--text-muted); margin-bottom: 6px; }
    input, textarea {
      width: 100%;
      background: #0f172a;
      border: 1px solid var(--card-border);
      color: #fff;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.875rem;
      font-family: inherit;
    }
    input:focus, textarea:focus { outline: none; border-color: var(--primary); }
    textarea { resize: vertical; min-height: 80px; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary { background: var(--primary); color: #fff; width: 100%; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-sm { padding: 4px 10px; font-size: 0.75rem; }
    .btn-action { background: #334155; color: #fff; }
    .btn-action:hover { background: #475569; }
    .btn-process { background: #0284c7; color: #fff; }
    .btn-process:hover { background: #0369a1; }
    .btn-retry { background: #d97706; color: #fff; }
    .btn-retry:hover { background: #b45309; }
    .btn-sample { background: #1e293b; border: 1px solid var(--card-border); color: var(--text-muted); }
    .btn-sample:hover { color: #fff; border-color: #475569; }
    .samples-row { display: flex; gap: 8px; margin-bottom: 14px; }
    .alert {
      padding: 12px;
      border-radius: 6px;
      font-size: 0.825rem;
      margin-top: 14px;
      display: none;
    }
    .alert-success { background: rgba(16, 185, 129, 0.15); border: 1px solid var(--success); color: #34d399; }
    .alert-warning { background: rgba(245, 158, 11, 0.15); border: 1px solid var(--warning); color: #fbbf24; }
    .alert-error { background: rgba(239, 68, 68, 0.15); border: 1px solid var(--danger); color: #f87171; }
    .table-container { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
    th { padding: 10px 12px; background: #151e2e; color: var(--text-muted); font-weight: 600; border-bottom: 1px solid var(--card-border); }
    td { padding: 12px; border-bottom: 1px solid #1e293b; vertical-align: middle; }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }
    .status-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-received { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }
    .status-classifying { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
    .status-classified { background: rgba(139, 92, 246, 0.2); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.4); }
    .status-completed { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .status-failed { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
    .fit-meter { display: flex; align-items: center; gap: 8px; }
    .meter-bar { width: 60px; height: 6px; background: #334155; border-radius: 3px; overflow: hidden; }
    .meter-fill { height: 100%; border-radius: 3px; }
    .meter-high { background: var(--success); }
    .meter-med { background: var(--warning); }
    .meter-low { background: var(--danger); }
    .actions-cell { display: flex; gap: 6px; }
    .empty-state { text-align: center; padding: 40px 20px; color: var(--text-muted); }
    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: none; align-items: center; justify-content: center;
      z-index: 1000;
    }
    .modal {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      width: 90%; max-width: 650px; max-height: 85vh;
      overflow-y: auto; padding: 24px;
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .timeline-item { padding: 12px; background: #0f172a; border-left: 3px solid var(--primary); border-radius: 4px; margin-bottom: 10px; font-size: 0.8rem; }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  </style>
</head>
<body>
  <div id="toastContainer" style="position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; max-width: 420px; pointer-events: none;"></div>

  <div class="header">
    <div class="header-title">
      <h1>AI Business Automation Platform</h1>
      <p>B2B Lead Intake, AI Fit Classification & Orchestration Engine</p>
    </div>
    <div class="header-badges">
      <span class="badge badge-live">● API Online</span>
      <a href="http://localhost:5678" target="_blank" class="badge badge-link">⚡ n8n Workflow UI (Port 5678)</a>
      <a href="/health" target="_blank" class="badge badge-link">🩺 /health</a>
    </div>
  </div>

  <div class="layout">
    <!-- Left Column: Lead Intake Form -->
    <div>
      <div class="card">
        <div class="card-title">
          <span>Submit Inbound Lead</span>
          <button type="button" class="btn btn-sm" onclick="quickTestLead()" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 700; border: none; box-shadow: 0 2px 8px rgba(16,185,129,0.3); cursor: pointer;">🚀 1-Click Test Lead</button>
        </div>

        <div class="samples-row">
          <button type="button" class="btn btn-sample btn-sm" onclick="fillSample('high')">High Fit Sample</button>
          <button type="button" class="btn btn-sample btn-sm" onclick="fillSample('med')">Medium Fit Sample</button>
        </div>

        <form id="leadForm" novalidate onsubmit="handleLeadSubmit(event)">
          <div class="form-group">
            <label for="name">Prospect Name *</label>
            <input type="text" id="name" required placeholder="e.g. Jordan Lee" value="Jordan Lee">
          </div>

          <div class="form-group">
            <label for="email">Work Email *</label>
            <input type="email" id="email" required placeholder="e.g. jordan@enterprise.com" value="jordan@enterprise.com">
          </div>

          <div class="form-group">
            <label for="company">Company Name</label>
            <input type="text" id="company" placeholder="e.g. Acme Corp" value="Acme Automations">
          </div>

          <div class="form-group">
            <label for="website">Company Website</label>
            <input type="text" id="website" placeholder="https://example.com" value="https://example.com">
          </div>

          <div class="form-group">
            <label for="message">Inquiry / Business Need *</label>
            <textarea id="message" required placeholder="Describe automation requirements...">We need help automating our customer onboarding and lead routing pipeline with AI scoring and n8n webhooks.</textarea>
          </div>

          <div class="form-group">
            <label for="idempotencyKey">Idempotency Key (Optional)</label>
            <div style="display: flex; gap: 6px;">
              <input type="text" id="idempotencyKey" placeholder="Auto-generated if empty">
              <button type="button" class="btn btn-sample btn-sm" onclick="randomizeKey()">Random</button>
            </div>
          </div>

          <div id="formAlert" class="alert" style="margin-bottom: 14px; margin-top: 0;"></div>
          <button type="submit" class="btn btn-primary" id="submitBtn">Submit Lead (POST /api/leads)</button>
        </form>
      </div>
    </div>

    <!-- Right Column: Live Pipeline -->
    <div>
      <div class="card">
        <div class="card-title">
          <span>Live Lead Automation Pipeline</span>
          <button class="btn btn-action btn-sm" onclick="loadLeads()">🔄 Refresh</button>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Prospect</th>
                <th>Status</th>
                <th>AI Classification</th>
                <th>Action Recommended</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="leadsTableBody">
              <tr>
                <td colspan="5" class="empty-state">Loading leads from PostgreSQL...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Audit Modal -->
  <div id="auditModal" class="modal-overlay" onclick="closeModal(event)">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3 id="modalTitle">Workflow Audit History</h3>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div id="modalTimeline">Loading attempts...</div>
    </div>
  </div>

  <script>
    function randomizeKey() {
      document.getElementById('idempotencyKey').value = 'key-' + Math.random().toString(36).substring(2, 10);
    }

    function fillSample(type) {
      if (type === 'high') {
        document.getElementById('name').value = 'Jordan Lee';
        document.getElementById('email').value = 'jordan@enterprise.com';
        document.getElementById('company').value = 'Global Enterprise Solutions';
        document.getElementById('message').value = 'We have 250 sales reps and urgently need an automated AI classification and lead routing engine.';
      } else {
        document.getElementById('name').value = 'Sam Rivera';
        document.getElementById('email').value = 'sam@startup.io';
        document.getElementById('company').value = 'EarlyStage Startup';
        document.getElementById('message').value = 'Just curious about your pricing and features.';
      }
      randomizeKey();
    }

    function quickTestLead() {
      const num = Math.floor(1000 + Math.random() * 9000);
      document.getElementById('name').value = 'Test Prospect ' + num;
      document.getElementById('email').value = 'prospect' + num + '@enterprise.com';
      document.getElementById('company').value = 'Enterprise AI Corp';
      document.getElementById('website').value = 'https://enterprise.example.com';
      document.getElementById('message').value = 'Urgent: We have 200 sales reps and need automated AI lead scoring and n8n webhook notifications.';
      randomizeKey();
      document.getElementById('submitBtn').click();
    }

    function showToast(title, message, type = 'success') {
      const container = document.getElementById('toastContainer');
      if (!container) return;
      const toast = document.createElement('div');
      const isWarn = type === 'warning';
      const isErr = type === 'error';
      const isInfo = type === 'info';
      const borderCol = isWarn ? '#f59e0b' : (isErr ? '#ef4444' : (isInfo ? '#3b82f6' : '#10b981'));
      const bgCol = isWarn ? 'rgba(180, 83, 9, 0.95)' : (isErr ? 'rgba(185, 28, 28, 0.95)' : (isInfo ? 'rgba(30, 41, 59, 0.95)' : 'rgba(6, 95, 70, 0.95)'));
      toast.style.cssText = \`
        background: \${bgCol};
        border: 1px solid \${borderCol};
        color: #fff;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        font-size: 0.85rem;
        display: flex;
        flex-direction: column;
        gap: 3px;
        pointer-events: auto;
        animation: slideIn 0.3s ease-out;
        transition: opacity 0.3s ease-out, transform 0.3s ease-out;
      \`;
      toast.innerHTML = \`<div style="font-weight:700; display:flex; justify-content:space-between; align-items:center;"><span>\${title}</span><button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:1rem;margin-left:8px;">&times;</button></div><div style="font-size:0.775rem; opacity:0.95;">\${message}</div>\`;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
      }, 4500);
    }

    async function handleLeadSubmit(e) {
      e.preventDefault();
      const submitBtn = document.getElementById('submitBtn');
      const alertBox = document.getElementById('formAlert');
      submitBtn.disabled = true;
      submitBtn.innerText = 'Submitting...';
      alertBox.style.display = 'none';

      const payload = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        company: document.getElementById('company').value || undefined,
        website: document.getElementById('website').value || undefined,
        message: document.getElementById('message').value
      };

      const idemKey = document.getElementById('idempotencyKey').value.trim();
      const headers = { 'Content-Type': 'application/json' };
      if (idemKey) headers['Idempotency-Key'] = idemKey;

      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok) {
          alertBox.style.display = 'block';
          if (data.isDuplicate) {
            alertBox.className = 'alert alert-warning';
            alertBox.innerHTML = '<strong>⚡ Idempotent Replay:</strong> Duplicate submission detected! Existing lead returned with 0 side-effects.';
            showToast('⚡ Duplicate Detected', 'Existing lead returned without creating duplicate database rows.', 'warning');
          } else {
            alertBox.className = 'alert alert-success';
            alertBox.innerHTML = '<strong>✅ Lead Created:</strong> Successfully persisted to PostgreSQL. Status: <code>' + data.data.status + '</code>';
            showToast('✅ Lead Created Successfully!', 'Persisted to PostgreSQL in RECEIVED status.', 'success');
          }
          alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          loadLeads();
        } else {
          alertBox.style.display = 'block';
          alertBox.className = 'alert alert-error';
          alertBox.innerText = data.error?.message || 'Error creating lead';
          showToast('❌ Submission Failed', data.error?.message || 'Error creating lead', 'error');
        }
      } catch (err) {
        alertBox.style.display = 'block';
        alertBox.className = 'alert alert-error';
        alertBox.innerText = 'Network error: ' + err.message;
        showToast('❌ Network Error', err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Submit Lead (POST /api/leads)';
      }
    }

    async function loadLeads() {
      const tbody = document.getElementById('leadsTableBody');
      try {
        const res = await fetch('/api/leads');
        const json = await res.json();
        const leads = json.data || [];

        if (leads.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No leads found in PostgreSQL. Submit a lead using the form on the left!</td></tr>';
          return;
        }

        tbody.innerHTML = leads.map(l => {
          const statusClass = 'status-' + (l.status || 'received');
          const score = l.fitScore !== undefined ? l.fitScore : null;
          const scoreColor = score >= 75 ? 'meter-high' : (score >= 40 ? 'meter-med' : 'meter-low');
          const fitHtml = score !== null
            ? \`<div class="fit-meter">
                 <div class="meter-bar"><div class="meter-fill \${scoreColor}" style="width: \${score}%"></div></div>
                 <span><strong>\${score}</strong> (\${l.category || ''})</span>
               </div>\`
            : '<span style="color: var(--text-muted)">Unclassified</span>';

          const actionHtml = l.recommendedAction
            ? \`<span class="badge" style="background:#1e293b; color:#93c5fd;">\${l.recommendedAction}</span>\`
            : '<span style="color: var(--text-muted)">-</span>';

          const canProcess = l.status !== 'completed';
          const canRetry = l.status === 'failed';

          return \`<tr>
            <td>
              <strong>\${escapeHtml(l.name)}</strong><br>
              <small style="color:var(--text-muted)">\${escapeHtml(l.email)} \${l.company ? '• ' + escapeHtml(l.company) : ''}</small>
            </td>
            <td><span class="status-pill \${statusClass}">\${l.status}</span></td>
            <td>\${fitHtml}</td>
            <td>\${actionHtml}</td>
            <td>
              <div class="actions-cell">
                \${canProcess ? \`<button class="btn btn-process btn-sm" onclick="processLead('\${l.id}')">⚡ Process</button>\` : ''}
                \${canRetry ? \`<button class="btn btn-retry btn-sm" onclick="retryLead('\${l.id}')">🔄 Retry</button>\` : ''}
                <button class="btn btn-action btn-sm" onclick="viewHistory('\${l.id}')">📜 Audit</button>
              </div>
            </td>
          </tr>\`;
        }).join('');
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state" style="color:var(--danger)">Failed to fetch leads: ' + err.message + '</td></tr>';
      }
    }

    async function processLead(id) {
      try {
        showToast('⚙️ Processing Lead...', 'Evaluating AI Fit Score and routing sales notification...', 'info');
        const res = await fetch(\`/api/leads/\${id}/process\`, { method: 'POST' });
        const json = await res.json();
        if (res.ok) {
          showToast('🎉 Lead Processed!', \`Score: \${json.data.fitScore}/100 (\${json.data.category}) • Action: \${json.data.recommendedAction}\`, 'success');
          loadLeads();
        } else {
          showToast('❌ Process Failed', json.error?.message || 'Unknown error', 'error');
        }
      } catch (err) {
        showToast('❌ Network Error', err.message, 'error');
      }
    }

    async function retryLead(id) {
      try {
        const res = await fetch(\`/api/leads/\${id}/retry\`, { method: 'POST' });
        const json = await res.json();
        if (res.ok) {
          loadLeads();
        } else {
          alert('Retry failed: ' + (json.error?.message || 'Unknown error'));
        }
      } catch (err) {
        alert('Network error: ' + err.message);
      }
    }

    async function viewHistory(id) {
      const modal = document.getElementById('auditModal');
      const timeline = document.getElementById('modalTimeline');
      modal.style.display = 'flex';
      timeline.innerHTML = 'Loading audit history...';

      try {
        const res = await fetch(\`/api/leads/\${id}/history\`);
        const json = await res.json();
        const attempts = json.data || [];

        if (attempts.length === 0) {
          timeline.innerHTML = '<p style="color:var(--text-muted)">No workflow attempts recorded for this lead yet.</p>';
          return;
        }

        timeline.innerHTML = attempts.map(a => \`
          <div class="timeline-item">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <strong>Step: \${a.step.toUpperCase()} (Attempt #\${a.attemptNumber})</strong>
              <span class="status-pill status-\${a.status}">\${a.status}</span>
            </div>
            <div style="color:var(--text-muted); font-size:0.75rem;">\${new Date(a.createdAt).toLocaleString()}</div>
            \${a.errorMessage ? \`<div style="color:var(--danger); margin-top:6px;">Error: \${escapeHtml(a.errorMessage)}</div>\` : ''}
            \${a.metadata ? \`<pre style="background:#020617; padding:6px; margin-top:6px; border-radius:4px; overflow-x:auto;">\${JSON.stringify(a.metadata, null, 2)}</pre>\` : ''}
          </div>
        \`).join('');
      } catch (err) {
        timeline.innerHTML = '<p style="color:var(--danger)">Failed to load history: ' + err.message + '</p>';
      }
    }

    function closeModal(e) {
      document.getElementById('auditModal').style.display = 'none';
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
    }

    // Initial load
    randomizeKey();
    loadLeads();
    setInterval(loadLeads, 10000);
  </script>
</body>
</html>`;
}
