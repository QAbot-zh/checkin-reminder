// Cloudflare Worker：页面 + API 一体
// 环境变量：DB (D1), ADMIN_TOKEN (secret), TIMEZONE, RETENTION_DAYS

const INDEX_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
  <title>每日签到汇总</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✅</text></svg>">
  <script src="https://cdn.tailwindcss.com/3.4.1"></script>
  <script>tailwind.config = { corePlugins: { preflight: false } }</script>
  <style>
    :root {
        --bg-primary:   #FFF7E6;
        --bg-secondary: #FFEBC2;
        --bg-card:      #FFFBF2;
        --text-primary: #1C2746;
        --text-secondary:#33415C;
        --border: #E6C78F;
        --shadow: rgba(28, 39, 70, 0.08);
        --accent:       #E07A5F;
        --accent-hover: #C9654E;
        --accent-light: #FFE8DE;
        --success:      #79C1B8;
        --success-dark: #173B3F;
        --warning:      #E6B422;
        --warning-dark: #1C2746;
    }
    [data-theme="dark"] {
        --bg-primary:   #0E1A2A;
        --bg-secondary: #15283D;
        --bg-card:      #122238;
        --text-primary: #FFF6E0;
        --text-secondary:#E7D9BD;
        --border: #2E3D55;
        --shadow: rgba(0, 0, 0, 0.45);
        --accent:       #E07A5F;
        --accent-hover: #F18A6C;
        --accent-light: #1B2A38;
        --success:      #6DCCB8;
        --success-dark: #0E1A2A;
        --warning:      #F2C350;
        --warning-dark: #0E1A2A;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 18px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.5;
    }
    .sticky-top { position: sticky; top: 0; z-index: 60; }
    .sticky-filters { position: sticky; top: calc(var(--topBarH, 0px) + 6px); z-index: 50; }
    body.modal-open .sticky-top, body.modal-open .sticky-filters { position: static !important; }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      box-shadow: 0 2px 6px var(--shadow);
    }
    .entry-row {
      padding: 0.6rem 0;
      border-bottom: 1px solid var(--border);
    }
    .entry-row:last-child { border-bottom: none; }

    .chip {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--border);
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 15px;
      background: var(--bg-card);
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.15s;
      position: relative;
    }
    .chip:hover { background: var(--accent-light); }
    .chip.active { background: var(--accent); color: white; border-color: var(--accent); }
    .chip.exclude { background: #dc2626; color: white; border-color: #dc2626; }
    .chip-removable { padding-right: 22px; }
    .chip-remove {
      position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
      width: 14px; height: 14px; border-radius: 50%;
      background: rgba(239, 68, 68, 0.9); color: white;
      display: none; align-items: center; justify-content: center;
      font-size: 10px; font-weight: bold; cursor: pointer;
    }
    .chip-removable:hover .chip-remove { display: flex; }

    .btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 5px 12px; border: 1px solid var(--border); border-radius: 6px;
      font-size: 16px; font-weight: 500; cursor: pointer; transition: all 0.15s;
      white-space: nowrap;
    }
    .btn:hover { box-shadow: 0 2px 4px var(--shadow); }
    .btn-ghost { background: var(--bg-card); color: var(--text-primary); }
    .btn-ghost:hover { background: var(--accent-light); border-color: var(--accent); }
    .btn-dark { background: var(--accent); color: white; border-color: var(--accent); }
    .btn-dark:hover { background: var(--accent-hover); }

    .icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border: 1px solid var(--border); border-radius: 6px;
      background: var(--bg-card); cursor: pointer; transition: all 0.15s;
    }
    .icon-btn:hover { background: var(--accent); color: white; border-color: var(--accent); }
    .icon-btn svg { width: 20px; height: 20px; }

    .modal-mask {
      position: fixed; inset: 0; background: rgba(0, 24, 88, 0.6);
      backdrop-filter: blur(4px); display: none; align-items: center;
      justify-content: center; z-index: 100; padding: 12px;
    }
    .modal {
      background: var(--bg-card); border: 2px solid var(--accent); border-radius: 10px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
      width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto;
    }

    input, select, textarea {
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-primary); border-radius: 6px;
      padding: 7px 10px; font-size: 16px; transition: all 0.15s;
      width: 100%; min-width: 0;
    }
    input:focus, select:focus, textarea:focus {
      outline: none; border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(224, 122, 95, 0.2);
    }
    input::placeholder { color: var(--text-secondary); opacity: 0.6; }

    .badge {
      display: inline-block; padding: 3px 8px; border-radius: 9999px;
      font-size: 14px; font-weight: 600; white-space: nowrap;
    }
    .badge-success { background: var(--success); color: var(--success-dark); }
    .badge-warning { background: var(--warning); color: var(--warning-dark); }

    .tag-input-wrapper {
      display: flex; flex-wrap: wrap; gap: 5px; padding: 5px 8px;
      border: 1px solid var(--border); border-radius: 6px;
      background: var(--bg-card); min-height: 36px; align-items: center;
    }
    .tag-input-wrapper input {
      border: none; padding: 2px 4px; flex: 1; min-width: 80px;
    }
    .tag-input-wrapper input:focus { box-shadow: none; }

    h1 { font-size: 24px; font-weight: 700; }
    h2 { font-size: 18px; font-weight: 600; }
    h3 { font-size: 17px; font-weight: 600; }

    .header-actions { display: flex; align-items: center; gap: 12px; }

    @media (max-width: 640px) {
      h1 { font-size: 21px; }
      .icon-btn { width: 30px; height: 30px; }
      .icon-btn svg { width: 17px; height: 17px; }
      .btn { padding: 4px 10px; font-size: 15px; }
      .header-actions { gap: 8px; }
      .is-collapsed .collapse-body { display: none; }
      #topBar.is-collapsed .card { padding: 8px 12px !important; }
      #topBar.is-collapsed h1 { font-size: 18px; }
      #topBar.is-collapsed #today { display: none; }
      #filters.is-collapsed .card { padding: 8px 12px !important; }
      #filtersBody { max-height: 50vh; overflow-y: auto; }
      .group-select-wrapper { display: flex; align-items: center; gap: 5px; flex: 1; min-width: 0; }
      #groupSelect { min-width: 60px; max-width: 120px; }
      #clearFilters { padding: 4px 8px; font-size: 14px; }
    }

    #chevHeader, #chevFilters { transition: transform .2s ease; }
    [aria-expanded="false"] #chevHeader, [aria-expanded="false"] #chevFilters { transform: rotate(-180deg); }

    .group-dropdown {
      max-height: 120px; overflow-y: auto; border: 1px solid var(--border);
      border-radius: 6px; box-shadow: 0 4px 12px var(--shadow);
      z-index: 60; background: var(--bg-card); margin-top: 2px;
    }
    .group-dropdown div {
      padding: 5px 10px; cursor: pointer; font-size: 16px;
      color: var(--text-primary); border-bottom: 1px solid var(--border);
      background: var(--bg-card); transition: background 0.1s;
    }
    .group-dropdown div:last-child { border-bottom: none; }
    .group-dropdown div:hover { background: var(--bg-secondary); }
    .group-dropdown .bg-blue-50 { background: var(--accent-light) !important; font-weight: 500; }
    .group-dropdown div.text-red-600 { color: #dc2626 !important; }

    .form-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .form-row label { width: 65px; flex-shrink: 0; font-size: 16px; color: var(--text-secondary); }
    .form-row .form-input { flex: 1; min-width: 0; }
  </style>
</head>
<body>
  <div class="max-w-4xl mx-auto p-3 sm:p-4">
    <header id="topBar" class="mb-4 sticky-top">
      <div class="card p-3">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <h1 class="text-ellipsis overflow-hidden whitespace-nowrap">每日签到汇总</h1>
            <div id="today" class="text-xs mt-1" style="color: var(--text-secondary)">加载中...</div>
          </div>
          <div class="header-actions flex-shrink-0">
            <button id="undoBtn" class="hidden btn btn-ghost">撤销</button>
            <button id="openAdminModal" class="icon-btn" title="管理口令">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </button>
            <button id="openAddModal" class="icon-btn" title="新增签到项">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </button>
            <button id="themeToggle" class="icon-btn" title="切换主题">
              <svg id="sunIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
              <svg id="moonIcon" style="display:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </button>
            <button id="collapseHeaderBtn" class="icon-btn sm:hidden" title="收起/展开顶部" aria-expanded="true">
              <svg id="chevHeader" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- 筛选 -->
    <section id="filters" class="mb-3 card p-3 sticky-filters">
      <div class="flex items-center justify-between gap-2">
        <div class="group-select-wrapper flex items-center gap-2 flex-1 min-w-0">
          <label class="text-sm font-medium shrink-0" style="color: var(--text-primary)">分组</label>
          <select id="groupSelect" class="flex-1 min-w-0" style="max-width:160px">
            <option value="">全部</option>
            <option value="__unchecked__">仅未签到</option>
          </select>
          <button id="clearFilters" class="btn btn-ghost">清空</button>
        </div>
        <button id="collapseFiltersBtn" class="icon-btn" title="收起/展开筛选" aria-expanded="true">
          <svg id="chevFilters" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>
      <div id="filtersBody" class="collapse-body mt-3">
        <div class="space-y-3">
          <div>
            <div class="text-xs font-medium mb-2" style="color: var(--text-secondary)">签到类型</div>
            <div id="checkinTypeChips" class="flex flex-wrap gap-1.5"></div>
          </div>
          <div>
            <div class="text-xs font-medium mb-2" style="color: var(--text-secondary)">包含标签</div>
            <div id="tagChips" class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto"></div>
          </div>
          <div>
            <div class="text-xs font-medium mb-2" style="color: var(--text-secondary)">排除标签</div>
            <div id="excludeTagChips" class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- 列表 -->
    <section class="card p-3 sm:p-4">
      <div class="flex items-center justify-between pb-2 mb-2" style="border-bottom: 1px solid var(--border)">
        <h2 style="color: var(--text-primary)">我的签到项</h2>
        <button id="refreshBtn" class="btn btn-ghost">刷新</button>
      </div>
      <div id="list"></div>
      <div id="empty" class="text-sm py-4 hidden" style="color: var(--text-secondary)">还没有条目，点击右上角 ➕ 添加一个吧。</div>
    </section>
  </div>

  <!-- 管理口令弹窗 -->
  <div id="adminModal" class="modal-mask">
    <div class="modal p-4">
      <h3 class="mb-3">管理口令</h3>
      <div class="flex gap-2 items-center mb-3">
        <div class="relative flex-1">
          <input id="adminToken" type="password" placeholder="输入管理口令" class="pr-10" />
          <button id="togglePwd" class="absolute right-1 top-1/2 -translate-y-1/2 icon-btn" style="width:28px;height:28px;border:none" title="显示/隐藏">
            <svg id="eyeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
        <button id="saveTokenBtn" class="btn btn-dark">保存</button>
        <button id="clearTokenBtn" class="btn btn-ghost">清除</button>
      </div>
      <p class="text-xs" style="color: var(--text-secondary)">口令仅保存在本地，调用 API 时作为 X-Admin-Token 发送。</p>
      <div class="mt-4 flex justify-end">
        <button id="closeAdminModal" class="btn btn-ghost">关闭</button>
      </div>
    </div>
  </div>

  <!-- 新增条目弹窗 -->
  <div id="addModal" class="modal-mask">
    <div class="modal p-4">
      <h3 class="mb-3">新增签到条目</h3>
      <form id="addForm">
        <div class="form-row">
          <label>名称</label>
          <input name="name" required placeholder="签到项名称" class="form-input" autocomplete="off" />
        </div>
        <div class="form-row">
          <label>签到网址</label>
          <input name="signUrl" required placeholder="https://..." class="form-input" autocomplete="off" />
        </div>
        <div class="form-row">
          <label>兑换网址</label>
          <input name="redeemUrl" placeholder="可选" class="form-input" autocomplete="off" />
        </div>
        <div class="form-row">
          <label>分组</label>
          <div class="form-input relative">
            <input name="groupName" id="addGroupInput" placeholder="选择或输入" autocomplete="off" />
            <div id="addGroupDropdown" class="group-dropdown absolute top-full left-0 w-full hidden"></div>
          </div>
        </div>
        <div class="form-row">
          <label>签到类型</label>
          <div class="form-input flex gap-2">
            <select name="checkinType" id="addCheckinType" class="flex-1">
              <option value="daily">每日</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
              <option value="quarterly">每季度</option>
              <option value="yearly">每年</option>
              <option value="custom">自定义</option>
            </select>
            <input name="checkinInterval" id="addCheckinInterval" type="number" placeholder="天数" style="display:none;width:80px" min="1" />
          </div>
        </div>
        <div class="form-row" style="align-items:flex-start">
          <label class="pt-2">标签</label>
          <div class="form-input">
            <div class="tag-input-wrapper" id="addTagsWrapper">
              <input id="addTagInput" type="text" placeholder="输入后回车" />
            </div>
            <div class="mt-2">
              <span class="text-xs" style="color: var(--text-secondary)">已有标签：</span>
              <div id="addTagSuggestions" class="flex flex-wrap gap-1 mt-1"></div>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" id="closeAddModal" class="btn btn-ghost">取消</button>
          <button class="btn btn-dark">添加</button>
        </div>
      </form>
      <div id="addMsg" class="text-sm mt-2"></div>
    </div>
  </div>

  <!-- 编辑弹窗 -->
  <div id="editModal" class="modal-mask">
    <div class="modal p-4">
      <h3 class="mb-3">编辑签到项</h3>
      <form id="editForm">
        <input name="id" type="hidden" />
        <div class="form-row">
          <label>名称</label>
          <input name="name" required placeholder="签到项名称" class="form-input" autocomplete="off" />
        </div>
        <div class="form-row">
          <label>签到网址</label>
          <input name="signUrl" required placeholder="https://..." class="form-input" autocomplete="off" />
        </div>
        <div class="form-row">
          <label>兑换网址</label>
          <input name="redeemUrl" placeholder="可选" class="form-input" autocomplete="off" />
        </div>
        <div class="form-row">
          <label>分组</label>
          <div class="form-input relative">
            <input name="groupName" id="editGroupInput" placeholder="选择或输入" autocomplete="off" />
            <div id="editGroupDropdown" class="group-dropdown absolute top-full left-0 w-full hidden"></div>
          </div>
        </div>
        <div class="form-row">
          <label>签到类型</label>
          <div class="form-input flex gap-2">
            <select name="checkinType" id="editCheckinType" class="flex-1">
              <option value="daily">每日</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
              <option value="quarterly">每季度</option>
              <option value="yearly">每年</option>
              <option value="custom">自定义</option>
            </select>
            <input name="checkinInterval" id="editCheckinInterval" type="number" placeholder="天数" style="width:80px" min="1" />
          </div>
        </div>
        <div class="form-row" style="align-items:flex-start">
          <label class="pt-2">标签</label>
          <div class="form-input">
            <div class="tag-input-wrapper" id="editTagsWrapper">
              <input id="editTagInput" type="text" placeholder="输入后回车" />
            </div>
            <div class="mt-2">
              <span class="text-xs" style="color: var(--text-secondary)">已有标签：</span>
              <div id="editTagSuggestions" class="flex flex-wrap gap-1 mt-1"></div>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" id="editCancel" class="btn btn-ghost">取消</button>
          <button class="btn btn-dark">保存</button>
        </div>
      </form>
    </div>
  </div>

  <template id="row-tpl">
    <div class="entry-row flex flex-col sm:flex-row sm:items-center gap-1.5">
      <div class="flex-1 min-w-0">
        <div class="font-semibold name"></div>
        <div class="text-sm group-line" style="color: var(--text-secondary)"></div>
        <div class="mt-1 flex flex-wrap gap-1.5 tag-badges"></div>
      </div>
      <div class="flex items-center gap-2.5 action-wrap flex-wrap"></div>
    </div>
  </template>

  <script>
    const $ = (sel, el=document) => el.querySelector(sel);
    const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

    const getCheckinTypeLabel = (checkinType) => {
      const labels = {
        'daily': '每日签到',
        'weekly': '每周签到',
        'monthly': '每月签到',
        'quarterly': '每季度签到',
        'yearly': '每年签到',
        'custom': '自定义间隔'
      };
      return labels[checkinType] || '每日签到';
    };

    const getDaysUntilNextCheckin = (entry, today) => {
      if (!entry.last_checkin_date) return 0;

      const last = new Date(entry.last_checkin_date);
      const now = new Date(today);
      const diffTime = now - last;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      switch(entry.checkin_type) {
        case 'daily':
          return Math.max(0, 1 - diffDays);
        case 'weekly':
          return Math.max(0, 7 - diffDays);
        case 'monthly':
          return Math.max(0, 30 - diffDays);
        case 'quarterly':
          return Math.max(0, 90 - diffDays);
        case 'yearly':
          return Math.max(0, 365 - diffDays);
        case 'custom':
          return Math.max(0, (entry.checkin_interval || 1) - diffDays);
        default:
          return 0;
      }
    };

    const state = {
      adminToken: localStorage.getItem('adminToken') || '',
      adminOK: false,
      theme: localStorage.getItem('theme') || 'light',
      timezone: '',
      today: '',
      allEntries: [],  // 全量数据缓存
      entries: [],     // 筛选后的数据
      groups: [],
      allTags: [],
      checkinTypes: [],
      selectedGroup: '',
      selectedTags: ['有效'],
      excludedTags: [],
      selectedCheckinType: '',
      lastAutoCheckinId: null,
      addTags: [],
      editTags: [],
      clicks: {},
      collapseHeader: JSON.parse(localStorage.getItem('collapseHeader') || 'false'),
      collapseFilters: JSON.parse(localStorage.getItem('collapseFilters') || 'true'),
      modalOpen: false,
    };

    
    function setModalOpen(isOpen) {
      state.modalOpen = isOpen;
      document.body.classList.toggle('modal-open', isOpen);
      if (!isOpen) {
        updateStickyOffsets();
      }
    }

    function updateStickyOffsets(){
        const h = $('#topBar')?.offsetHeight || 0;
        document.documentElement.style.setProperty('--topBarH', h + 'px');
    }
    window.addEventListener('resize', updateStickyOffsets);

    (async function init() {
      applyTheme();
      $('#adminToken').value = state.adminToken || '';
      bindEvents();
      applyCollapse(); // 初始化根据本地状态应用折叠
      window.addEventListener('resize', applyCollapse); // 横竖屏/断点切换时同步

      // Initialize modal state
      setModalOpen(false);

      await loadToday();
      gcLocalClicks({ retentionDays: 10, maxDays: 30 });
      await verifyAdminToken();
      if (state.adminOK) {
        await loadAllData();
        renderFilters();
      }
      render();
      updateStickyOffsets();
    })();

    async function verifyAdminToken() {
        if (!state.adminToken) { state.adminOK = false; updateAdminUI(); return; }
        try {
            const res = await fetch('/api/admin/ping', { headers: { 'X-Admin-Token': state.adminToken } });
            state.adminOK = res.ok;
        } catch { state.adminOK = false; }
        updateAdminUI();
    }

    function updateAdminUI() {
        const locked = !state.adminOK;

        // 新增按钮禁用
        const addBtn = $('#openAddModal');
        if (addBtn) {
            addBtn.style.opacity = locked ? '0.5' : '';
            addBtn.style.pointerEvents = locked ? 'none' : '';
            addBtn.title = locked ? '需正确管理口令才能新增签到项' : '新增签到项';
        }

        // 筛选区整体禁用
        const filters = $('#filters');
        if (filters) {
            filters.style.opacity = locked ? '0.5' : '';
            filters.style.pointerEvents = locked ? 'none' : '';
        }

        // 未授权时隐藏列表，显示提示
        if (locked) {
            $('#list').innerHTML = '';
            const empty = $('#empty');
            if (empty) {
            empty.textContent = '🔒 请输入正确管理口令后可查看签到列表';
            empty.classList.remove('hidden');
            }
        }
    }

    function applyTheme() {
      document.documentElement.setAttribute('data-theme', state.theme);
      if (state.theme === 'dark') {
        $('#sunIcon').style.display = 'none';
        $('#moonIcon').style.display = 'block';
      } else {
        $('#sunIcon').style.display = 'block';
        $('#moonIcon').style.display = 'none';
      }
    }

    function bindEvents() {
      // 主题切换
      $('#themeToggle').onclick = () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', state.theme);
        applyTheme();
      };

      // 弹窗控制
      $('#openAdminModal').onclick = () => { $('#adminModal').style.display = 'flex'; setModalOpen(true); };
      $('#closeAdminModal').onclick = () => { $('#adminModal').style.display = 'none'; setModalOpen(false); };
      $('#openAddModal').onclick = async () => {
        if (!state.adminOK) { alert('请先点击右上角🔒输入并保存正确的管理口令'); return; }

        // Ensure meta data is loaded
        if (state.groups.length === 0 || state.allTags.length === 0) {
          await loadAllData();
        }

        state.addTags = ['有效'];
        renderTagInput('addTagsWrapper', 'addTags');
        renderAddTagSuggestions();
        $('#addForm').reset();
        $('#addMsg').textContent = '';
        $('#addModal').style.display = 'flex';
        setModalOpen(true);
        // Setup group dropdown after DOM is rendered
        setTimeout(() => {
          setupGroupDropdown('addGroupInput', 'addGroupDropdown');
        }, 100);
      };
      $('#closeAddModal').onclick = () => { $('#addModal').style.display = 'none'; setModalOpen(false); };

      // 点击遮罩关闭
      ['#adminModal', '#addModal', '#editModal'].forEach(id => {
        $(id).onclick = (e) => {
          if (e.target === $(id)) {
            $(id).style.display = 'none';
            setModalOpen(false);
          }
        };
      });

      // 口令
      $('#togglePwd').onclick = () => {
        const input = $('#adminToken');
        const isPw = input.type === 'password';
        input.type = isPw ? 'text' : 'password';
        $('#eyeIcon').style.opacity = isPw ? '0.6' : '1';
      };
      $('#saveTokenBtn').onclick = async () => {
        const v = $('#adminToken').value.trim();
        state.adminToken = v;
        if (v) localStorage.setItem('adminToken', v);
        else localStorage.removeItem('adminToken');
        $('#adminModal').style.display = 'none';
        setModalOpen(false);
        await verifyAdminToken();
        if (state.adminOK) { await loadAllData(); renderFilters(); }
        render();
      };
      $('#clearTokenBtn').onclick = () => {
        $('#adminToken').value = '';
        state.adminToken = '';
        state.adminOK = false;
        localStorage.removeItem('adminToken');
        $('#adminModal').style.display = 'none';
        setModalOpen(false);
        updateAdminUI();
        render();
      };

      $('#undoBtn').onclick = async () => {
        if (!state.lastAutoCheckinId) return;
        try {
          const id = state.lastAutoCheckinId;
          const res = await fetch('/api/checkin/' + id, { method: 'DELETE', headers: { 'X-Admin-Token': state.adminToken } });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          state.lastAutoCheckinId = null;
          $('#undoBtn').classList.add('hidden');
          await loadAllData();
          render();
          clearClicks(id);
        } catch (e) { alert('撤销失败：' + e.message); }
      };

      $('#refreshBtn').onclick = async () => {
        if (!state.adminOK) { alert('请先输入正确的管理口令'); return; }
        await loadAllData(); renderFilters(); render();
      };

      // 新增表单 - 标签输入
      setupTagInput('addTagInput', 'addTagsWrapper', 'addTags');
      
      // 签到类型切换事件
      $('#addCheckinType').addEventListener('change', (e) => {
        const intervalInput = $('#addCheckinInterval');
        if (e.target.value === 'custom') {
          intervalInput.style.display = 'block';
          intervalInput.required = true;
        } else {
          intervalInput.style.display = 'none';
          intervalInput.required = false;
          intervalInput.value = '';
        }
      });

      $('#addForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const checkinType = fd.get('checkinType')?.toString().trim() || 'daily';
        const checkinInterval = checkinType === 'custom' ? parseInt(fd.get('checkinInterval')?.toString().trim() || '0') : null;

        if (checkinType === 'custom' && (!checkinInterval || checkinInterval < 1)) {
          $('#addMsg').textContent = '❌ 自定义间隔必须设置大于0的天数';
          $('#addMsg').style.color = '#dc2626';
          return;
        }

        const body = {
          name: fd.get('name')?.toString().trim(),
          signUrl: fd.get('signUrl')?.toString().trim(),
          redeemUrl: fd.get('redeemUrl')?.toString().trim() || null,
          groupName: fd.get('groupName')?.toString().trim() || null,
          tags: state.addTags,
          checkinType: checkinType,
          checkinInterval: checkinInterval
        };
        $('#addMsg').textContent = '';
        try {
          const res = await fetch('/api/entries', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(state.adminToken ? {'X-Admin-Token': state.adminToken} : {})
            },
            body: JSON.stringify(body)
          });
          if (!res.ok) { const t = await res.text(); throw new Error(t || ('HTTP ' + res.status)); }
          e.target.reset();
          state.addTags = [];
          renderTagInput('addTagsWrapper', 'addTags');
          $('#addCheckinInterval').style.display = 'none';
          await loadAllData(); renderFilters(); render();
          $('#addMsg').textContent = '✅ 已添加';
          $('#addMsg').style.color = '#16a34a';
          setTimeout(() => { $('#addModal').style.display = 'none'; setModalOpen(false); }, 1500);
        } catch (err) {
          $('#addMsg').textContent = '❌ 添加失败：' + err.message;
          $('#addMsg').style.color = '#dc2626';
        }
      });

      $('#clearFilters').onclick = async () => {
        state.selectedGroup = ''; state.selectedTags = []; state.excludedTags = []; state.selectedCheckinType = '';
        $('#groupSelect').value = '';
        await loadEntries(); renderFilters(); render();
      };

      // 编辑弹窗
      setupTagInput('editTagInput', 'editTagsWrapper', 'editTags');
      $('#editCancel').onclick = closeEditModal;
      $('#editForm').addEventListener('submit', onEditSubmit);

      // 顶部折叠按钮
      const chb = $('#collapseHeaderBtn');
      if (chb) {
        chb.onclick = () => {
          state.collapseHeader = !state.collapseHeader;
          localStorage.setItem('collapseHeader', JSON.stringify(state.collapseHeader));
          applyCollapse();
        };
      }

      // 筛选折叠按钮
      const cfb = $('#collapseFiltersBtn');
      if (cfb) {
        cfb.onclick = () => {
          state.collapseFilters = !state.collapseFilters;
          localStorage.setItem('collapseFilters', JSON.stringify(state.collapseFilters));
          applyCollapse();
        };
      }
    }

    function setupTagInput(inputId, wrapperId, stateKey) {
      const input = $('#' + inputId);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = input.value.trim();
          if (val && !state[stateKey].includes(val)) {
            state[stateKey].push(val);
            renderTagInput(wrapperId, stateKey);
            input.value = '';
          }
        }
      });
    }
    function applyCollapse() {
      const isMobile = window.matchMedia('(max-width:640px)').matches;

      // 顶部 - 只在移动端应用折叠
      const topBar = $('#topBar');
      const hb = $('#collapseHeaderBtn');
      if (isMobile) {
        topBar.classList.toggle('is-collapsed', !!state.collapseHeader);
        if (hb) hb.setAttribute('aria-expanded', String(!state.collapseHeader));
      } else {
        topBar.classList.remove('is-collapsed');
        if (hb) hb.setAttribute('aria-expanded', 'true');
      }

      // 筛选 - 在所有屏幕尺寸应用折叠
      const filters = $('#filters');
      const fb = $('#collapseFiltersBtn');
      const body = $('#filtersBody');
      filters.classList.toggle('is-collapsed', !!state.collapseFilters);
      if (body) body.style.display = state.collapseFilters ? 'none' : 'block';
      if (fb) fb.setAttribute('aria-expanded', String(!state.collapseFilters));

      // 折叠会改变粘顶高度，需重新计算
      updateStickyOffsets();
    }
    function renderTagInput(wrapperId, stateKey) {
      const wrapper = $('#' + wrapperId);
      const input = wrapper.querySelector('input');
      const existingTags = wrapper.querySelectorAll('.chip');
      existingTags.forEach(t => t.remove());
      
      state[stateKey].forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'chip chip-removable';
        chip.textContent = tag;
        
        const removeBtn = document.createElement('span');
        removeBtn.className = 'chip-remove';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => {
          const idx = state[stateKey].indexOf(tag);
          if (idx > -1) state[stateKey].splice(idx, 1);
          renderTagInput(wrapperId, stateKey);
        };
        
        chip.appendChild(removeBtn);
        wrapper.insertBefore(chip, input);
      });
    }

    async function loadToday() {
      const res = await fetch('/api/today');
      const data = await res.json();
      state.today = data.date; state.timezone = data.timezone;
      $('#today').textContent = '今天：' + state.today + '（时区：' + state.timezone + '）';
      try {
        state.clicks = JSON.parse(localStorage.getItem('clicks-' + state.today)) || {};
      } catch { state.clicks = {}; }
    }

    // 合并加载：一次请求获取 entries + meta
    async function loadAllData() {
      if (!state.adminOK) { state.allEntries = []; state.entries = []; return; }
      const res = await fetch('/api/data', {
        headers: { 'X-Admin-Token': state.adminToken }
      });
      const data = await res.json();
      state.allEntries = data.entries || [];
      state.groups = data.groups || [];
      state.allTags = data.tags || [];
      state.checkinTypes = data.checkinTypes || [];
      filterEntries();
    }

    // 本地筛选，不请求服务器
    function filterEntries() {
      let filtered = state.allEntries;

      // 分组筛选
      if (state.selectedGroup === '__unchecked__') {
        filtered = filtered.filter(e => e.can_checkin);
      } else if (state.selectedGroup) {
        filtered = filtered.filter(e => e.group_name === state.selectedGroup);
      }

      // 签到类型筛选
      if (state.selectedCheckinType) {
        filtered = filtered.filter(e => e.checkin_type === state.selectedCheckinType);
      }

      // 标签筛选（包含）
      if (state.selectedTags.length) {
        filtered = filtered.filter(e => {
          const tags = e.tags || [];
          return state.selectedTags.every(t => tags.includes(t));
        });
      }

      // 标签筛选（排除）
      if (state.excludedTags.length) {
        filtered = filtered.filter(e => {
          const tags = e.tags || [];
          return !state.excludedTags.some(t => tags.includes(t));
        });
      }

      state.entries = filtered;
    }

    // 兼容旧代码：loadEntries 现在只做本地筛选
    async function loadEntries() {
      filterEntries();
    }

    function renderFilters() {
      const sel = $('#groupSelect'); const keep = sel.value;
      sel.innerHTML = '<option value="">全部分组</option><option value="__unchecked__">仅未签到</option>' +
        state.groups.map(g => '<option value="'+escapeHtml(g)+'">'+escapeHtml(g)+'</option>').join('');
      sel.value = state.selectedGroup || keep || '';
      sel.onchange = async () => { state.selectedGroup = sel.value; await loadEntries(); render(); };

      const checkinTypeWrap = $('#checkinTypeChips'); checkinTypeWrap.innerHTML = '';
      const checkinTypeOption = document.createElement('button');
      checkinTypeOption.type = 'button'; checkinTypeOption.className = 'chip'; checkinTypeOption.textContent = '全部类型';
      if (!state.selectedCheckinType) checkinTypeOption.classList.add('active');
      checkinTypeOption.onclick = async () => {
        // 学习标签处理方式：直接操作DOM，不重新渲染整个过滤器
        // 移除所有签到类型按钮的active类
        checkinTypeWrap.querySelectorAll('.chip').forEach(btn => btn.classList.remove('active'));
        // 给当前按钮添加active类
        checkinTypeOption.classList.add('active');
        state.selectedCheckinType = '';
        await loadEntries(); render();
      };
      checkinTypeWrap.appendChild(checkinTypeOption);

      state.checkinTypes.forEach(type => {
        const chip = document.createElement('button');
        chip.type = 'button'; chip.className = 'chip'; chip.textContent = getCheckinTypeLabel(type);
        chip.setAttribute('checkin-type', type);
        if (state.selectedCheckinType === type) chip.classList.add('active');
        chip.onclick = async () => {
          // 学习标签处理方式：直接操作DOM，不重新渲染整个过滤器
          // 移除所有签到类型按钮的active类
          checkinTypeWrap.querySelectorAll('.chip').forEach(btn => btn.classList.remove('active'));
          // 给当前按钮添加active类
          chip.classList.add('active');
          state.selectedCheckinType = type;
          await loadEntries(); render();
        };
        checkinTypeWrap.appendChild(chip);
      });

      const wrap = $('#tagChips'); wrap.innerHTML = '';
      const excludeWrap = $('#excludeTagChips'); excludeWrap.innerHTML = '';
      state.allTags.forEach(t => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.textContent = t;
        b.setAttribute('chip-tag', t);
        if (state.selectedTags.includes(t)) b.classList.add('active');
        b.onclick = async () => {
          const i = state.selectedTags.indexOf(t);
          if (i >= 0) {
            state.selectedTags.splice(i, 1);
            b.classList.remove('active');
          } else {
            state.selectedTags.push(t);
            b.classList.add('active');
            // 互斥逻辑：如果在包含标签中选择，则从排除标签中移除
            const excludeIndex = state.excludedTags.indexOf(t);
            if (excludeIndex >= 0) {
              state.excludedTags.splice(excludeIndex, 1);
              const excludeChip = $('#excludeTagChips').querySelector('[chip-tag="' + t + '"]');
              if (excludeChip) excludeChip.classList.remove('exclude');
            }
          }
          await loadEntries(); render();
        };
        wrap.appendChild(b);

        const excludeB = document.createElement('button');
        excludeB.type = 'button'; excludeB.className = 'chip'; excludeB.textContent = t;
        excludeB.setAttribute('chip-tag', t);
        if (state.excludedTags.includes(t)) excludeB.classList.add('exclude');
        excludeB.onclick = async () => {
          const i = state.excludedTags.indexOf(t);
          if (i >= 0) {
            state.excludedTags.splice(i, 1);
            excludeB.classList.remove('exclude');
          } else {
            state.excludedTags.push(t);
            excludeB.classList.add('exclude');
            // 互斥逻辑：如果在排除标签中选择，则从包含标签中移除
            const includeIndex = state.selectedTags.indexOf(t);
            if (includeIndex >= 0) {
              state.selectedTags.splice(includeIndex, 1);
              const includeChip = $('#tagChips').querySelector('[chip-tag="' + t + '"]');
              if (includeChip) includeChip.classList.remove('active');
            }
          }
          await loadEntries(); render();
        };
        excludeWrap.appendChild(excludeB);
      });
    }

    function render() {
      const list = $('#list'); list.innerHTML = '';
      const isAdmin = !!state.adminOK;
      if (!isAdmin) {
        $('#empty').classList.remove('hidden');
        $('#empty').textContent = '🔒 请输入正确管理口令后可查看签到列表';
        return;
      }
      if (!state.entries.length) { $('#empty').classList.remove('hidden'); return; }
      $('#empty').classList.add('hidden');

      const tpl = $('#row-tpl');
      state.entries.forEach(item => {
        const node = tpl.content.cloneNode(true);
        $('.name', node).textContent = item.name;
        const groupText = item.group_name ? ('分组：' + item.group_name) : '';
        const typeText = item.checkin_type ? getCheckinTypeLabel(item.checkin_type) : '';
        const groupLine = $('.group-line', node);
        if (groupText && typeText) {
          groupLine.textContent = groupText + ' · ' + typeText;
        } else if (groupText || typeText) {
          groupLine.textContent = groupText || typeText;
        } else {
          groupLine.style.display = 'none';
        }

        const badgeWrap = $('.tag-badges', node);
        (item.tags || []).forEach(t => {
          const span = document.createElement('span');
          span.className = 'chip chip-removable';
          span.textContent = t;
          
          if (isAdmin) {
            const removeBtn = document.createElement('span');
            removeBtn.className = 'chip-remove';
            removeBtn.textContent = '×';
            removeBtn.onclick = async (e) => {
              e.stopPropagation();
              if (!confirm('确认从【' + item.name + '】中移除标签"' + t + '"？')) return;
              try {
                const newTags = (item.tags || []).filter(tag => tag !== t);
                const res = await fetch('/api/entries/' + item.id, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Token': state.adminToken
                  },
                  body: JSON.stringify({
                    name: item.name,
                    signUrl: item.sign_url,
                    redeemUrl: item.redeem_url,
                    groupName: item.group_name,
                    tags: newTags
                  })
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                await loadAllData(); renderFilters(); render();
              } catch (err) {
                alert('移除标签失败：' + err.message);
              }
            };
            span.appendChild(removeBtn);
          }
          
          badgeWrap.appendChild(span);
        });

        const actionWrap = $('.action-wrap', node);

        const badge = document.createElement('span');
        if (item.checked_today) {
          badge.className = 'badge badge-success';
          badge.textContent = '今日已签';
        } else if (item.can_checkin) {
          badge.className = 'badge badge-warning';
          badge.textContent = '可签到';
        } else {
          badge.className = 'badge';
          badge.style.background = 'var(--text-secondary)';
          badge.style.color = 'white';
          const daysLeft = getDaysUntilNextCheckin(item, state.today);
          badge.textContent = daysLeft > 0 ? '还有' + daysLeft + '天' : '不可签';
        }
        actionWrap.appendChild(badge);

        const makeAnchorBtn = (label, href, kind, extraClass='btn-ghost') => {
          const a = document.createElement('a');
          a.href = href; a.target = '_blank'; a.rel = 'noopener';
          a.className = 'btn ' + extraClass;
          a.textContent = label;
          a.addEventListener('click', () => markClicked(item.id, kind), { passive: true });
          return a;
        };

        if (item.redeem_url) {
          actionWrap.appendChild(makeAnchorBtn('领取 $', item.sign_url, 'sign', 'btn-dark'));
          actionWrap.appendChild(makeAnchorBtn('前往兑换', item.redeem_url, 'redeem', 'btn-ghost'));
        } else {
          actionWrap.appendChild(makeAnchorBtn('签到', item.sign_url, 'sign', 'btn-dark'));
        }

        if (item.checked_today) {
          const unBtn = document.createElement('button');
          unBtn.className = 'btn btn-ghost';
          unBtn.textContent = '撤销';
          unBtn.onclick = async () => {
            try {
              const res = await fetch('/api/checkin/' + item.id, { method: 'DELETE', headers: { 'X-Admin-Token': state.adminToken } });
              if (!res.ok) throw new Error('HTTP ' + res.status);
              if (state.lastAutoCheckinId === item.id) {
                state.lastAutoCheckinId = null;
                $('#undoBtn').classList.add('hidden');
                clearClicks(item.id);
              }
              await loadAllData(); render();
            } catch (e) { alert('撤销失败：' + e.message); }
          };
          actionWrap.appendChild(unBtn);
        }

        if (isAdmin) {
          const editBtn = document.createElement('button');
          editBtn.className = 'btn btn-ghost';
          editBtn.textContent = '编辑';
          editBtn.onclick = () => openEditModal(item);
          actionWrap.appendChild(editBtn);

          const delBtn = document.createElement('button');
          delBtn.className = 'btn btn-ghost';
          delBtn.style.color = '#dc2626';
          delBtn.textContent = '删除';
          delBtn.onclick = async () => {
            if (!confirm('确认删除【' + item.name + '】及其历史签到记录？')) return;
            try {
              const res = await fetch('/api/entries/' + item.id, { 
                method: 'DELETE', 
                headers: { 'X-Admin-Token': state.adminToken } 
              });
              if (!res.ok) throw new Error('HTTP ' + res.status);
              await loadAllData(); renderFilters(); render();
            } catch (e) { alert('删除失败：' + e.message); }
          };
          actionWrap.appendChild(delBtn);
        }

        list.appendChild(node);
        updateStickyOffsets();
      });
    }

    async function openEditModal(item) {
      if (!state.adminOK) {
        alert('请先点击 🔒 图标输入并保存管理口令');
        return;
      }

      // Ensure meta data is loaded
      if (state.groups.length === 0 || state.allTags.length === 0) {
        await loadAllData();
      }

      const mask = $('#editModal');
      const form = $('#editForm');
      form.id.value = item.id;
      form.name.value = item.name || '';
      form.signUrl.value = item.sign_url || '';
      form.redeemUrl.value = item.redeem_url || '';
      form.groupName.value = item.group_name || '';
      form.checkinType.value = item.checkin_type || 'daily';
      form.checkinInterval.value = item.checkin_interval || '';

      // 显示/隐藏自定义间隔输入框
      const intervalInput = $('#editCheckinInterval');
      if (item.checkin_type === 'custom') {
        intervalInput.style.display = 'block';
      } else {
        intervalInput.style.display = 'none';
      }

      state.editTags = [...(item.tags || [])];
      renderTagInput('editTagsWrapper', 'editTags');
      renderEditTagSuggestions();

      mask.style.display = 'flex';
      setModalOpen(true);
      // Setup group dropdown after DOM is rendered
      setTimeout(() => {
        setupGroupDropdown('editGroupInput', 'editGroupDropdown');
      }, 100);
    }
    
    function closeEditModal() {
      $('#editModal').style.display = 'none';
      setModalOpen(false);
      state.editTags = [];
    }
    function renderEditTagSuggestions() {
      const suggestionsContainer = $('#editTagSuggestions');
      suggestionsContainer.innerHTML = '';

      if (!state.allTags || state.allTags.length === 0) return;

      state.allTags.forEach(tag => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.textContent = tag;

        if (state.editTags.includes(tag)) {
          chip.classList.add('active');
        }

        chip.onclick = () => {
          if (state.editTags.includes(tag)) {
            const index = state.editTags.indexOf(tag);
            if (index > -1) {
              state.editTags.splice(index, 1);
            }
          } else {
            state.editTags.push(tag);
          }
          renderTagInput('editTagsWrapper', 'editTags');
          renderEditTagSuggestions();
        };

        suggestionsContainer.appendChild(chip);
      });
    }

    function renderAddTagSuggestions() {
      const suggestionsContainer = $('#addTagSuggestions');
      suggestionsContainer.innerHTML = '';

      if (!state.allTags || state.allTags.length === 0) return;

      state.allTags.forEach(tag => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.textContent = tag;

        if (state.addTags.includes(tag)) {
          chip.classList.add('active');
        }

        chip.onclick = () => {
          if (state.addTags.includes(tag)) {
            const index = state.addTags.indexOf(tag);
            if (index > -1) {
              state.addTags.splice(index, 1);
            }
          } else {
            state.addTags.push(tag);
          }
          renderTagInput('addTagsWrapper', 'addTags');
          renderAddTagSuggestions();
        };

        suggestionsContainer.appendChild(chip);
      });
    }

    // Group dropdown functions
    function renderGroupDropdown(inputId, dropdownId) {
      const input = $('#' + inputId);
      const dropdown = $('#' + dropdownId);

      if (!input || !dropdown) {
        return;
      }

      const currentValue = input.value;
      dropdown.innerHTML = '';

      // Add existing groups as options
      state.groups.forEach(group => {
        const option = document.createElement('div');
        option.className = 'px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm';
        option.textContent = group;
        option.onclick = () => {
          input.value = group;
          dropdown.classList.add('hidden');
        };

        // Highlight exact match
        if (group === currentValue) {
          option.classList.add('bg-blue-50', 'font-medium');
        }

        dropdown.appendChild(option);
      });

      // Add "clear" option if there's a value
      if (currentValue) {
        const clearOption = document.createElement('div');
        clearOption.className = 'px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm text-red-600 border-t';
        clearOption.textContent = '清除分组';
        clearOption.onclick = () => {
          input.value = '';
          dropdown.classList.add('hidden');
        };
        dropdown.appendChild(clearOption);
      }

      // Show/hide dropdown based on content
      if (state.groups.length > 0) {
        dropdown.classList.remove('hidden');
      } else {
        dropdown.classList.add('hidden');
      }
    }

    function setupGroupDropdown(inputId, dropdownId) {
      const input = $('#' + inputId);
      const dropdown = $('#' + dropdownId);

      if (!input || !dropdown) {
        return;
      }

      // Handle input focus
      input.addEventListener('focus', () => {
        renderGroupDropdown(inputId, dropdownId);
      });

      // Handle input click (prevent closing when clicking input)
      input.addEventListener('click', (e) => {
        renderGroupDropdown(inputId, dropdownId);
        e.stopPropagation();
      });

      // Handle input typing - filter groups
      input.addEventListener('input', () => {
        renderGroupDropdown(inputId, dropdownId);
      });

      // Handle blur with delay to allow click on dropdown items
      input.addEventListener('blur', () => {
        setTimeout(() => {
          dropdown.classList.add('hidden');
        }, 200);
      });

      // Handle keyboard navigation
      input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('div');
        const activeItem = dropdown.querySelector('.bg-blue-50');
        let activeIndex = Array.from(items).indexOf(activeItem);

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (activeIndex < items.length - 1) {
            if (activeItem) activeItem.classList.remove('bg-blue-50', 'font-medium');
            items[activeIndex + 1].classList.add('bg-blue-50', 'font-medium');
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (activeIndex > 0) {
            if (activeItem) activeItem.classList.remove('bg-blue-50', 'font-medium');
            items[activeIndex - 1].classList.add('bg-blue-50', 'font-medium');
          }
        } else if (e.key === 'Enter') {
          if (activeItem && !activeItem.textContent.includes('清除')) {
            e.preventDefault();
            input.value = activeItem.textContent;
            dropdown.classList.add('hidden');
          }
        } else if (e.key === 'Escape') {
          dropdown.classList.add('hidden');
        }
      });
    }

    async function onEditSubmit(e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const id = Number(fd.get('id'));
      const body = {
        name: fd.get('name')?.toString().trim(),
        signUrl: fd.get('signUrl')?.toString().trim(),
        redeemUrl: fd.get('redeemUrl')?.toString().trim() || null,
        groupName: fd.get('groupName')?.toString().trim() || null,
        tags: state.editTags
      };
      try {
        const res = await fetch('/api/entries/' + id, {
          method: 'PUT',
          headers: {
            'Content-Type':'application/json', 
            'X-Admin-Token': state.adminToken
          },
          body: JSON.stringify(body)
        });
        if (!res.ok) { 
          const t = await res.text(); 
          throw new Error(t || ('HTTP ' + res.status)); 
        }
        closeEditModal(); 
        await loadAllData(); 
        await loadEntries(); 
        renderFilters(); 
        render();
      } catch (err) { 
        alert('保存失败：' + err.message); 
      }
    }
    function saveClicks() {
        try { localStorage.setItem('clicks-' + state.today, JSON.stringify(state.clicks || {})); } catch {}
    }

    function clearClicks(id) {
        if (state.clicks && state.clicks[id]) { delete state.clicks[id]; saveClicks(); }
    }

    // 仅保留最近 retentionDays 天的 clicks-YYYY-MM-DD 记录，并可选限制最多保留 maxDays 个
    function gcLocalClicks({ retentionDays = 10, maxDays = 30 } = {}) {
        // 计算 UTC 下的截止日期（和 today 的 YYYY-MM-DD 一样可按字典序比较）
        const cutoffYMD = new Date(Date.now() - retentionDays * 86400000)
            .toISOString().slice(0, 10);

        // 找出所有 clicks-YYYY-MM-DD 的 key
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('clicks-')) {
            const ymd = k.slice(7);
            if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) keys.push({ k, ymd });
            }
        }
        // 1) 先删掉早于 cutoff 的
        keys.filter(x => x.ymd < cutoffYMD).forEach(x => localStorage.removeItem(x.k));

        // 2) 如仍超过 maxDays，就按日期旧到新排序，多的继续删
        const rest = keys.filter(x => x.ymd >= cutoffYMD).sort((a, b) => a.ymd.localeCompare(b.ymd));
        const over = rest.length - maxDays;
        if (over > 0) {
            for (let i = 0; i < over; i++) localStorage.removeItem(rest[i].k);
        }
    }


    async function doCheckin(id) {
      try {
        const res = await fetch('/api/checkin/' + id, {
          method: 'POST',
          keepalive: true,
          headers: { 'X-Admin-Token': state.adminToken }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        state.lastAutoCheckinId = id;
        $('#undoBtn').classList.remove('hidden');
        await loadAllData(); render();
      } catch (e) { alert('签到失败：' + e.message); }
    }

    function markClicked(id, kind /* 'sign' | 'redeem' */) {
        if (!state.clicks) state.clicks = {};
        const rec = state.clicks[id] || { sign: false, redeem: false };
        rec[kind] = true;
        state.clicks[id] = rec;
        saveClicks();

        // 有兑换链接：需要 sign+redeem 都点过才 checkin；没有兑换链接：点 sign 就 checkin
        const entry = state.entries.find(e => e.id === id);
        if (!entry) return;
        if (entry.redeem_url) {
            if (rec.sign && rec.redeem) doCheckin(id);
        } else {
            if (rec.sign) doCheckin(id);
        }
    }
    function escapeHtml(s) {
      return s.replace(/[&<>"']/g, c => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      }[c]));
    }
  </script>
</body>
</html>`;

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=UTF-8", ...(init.headers || {}) }
  });
}
function text(msg, status = 200, headers = {}) { return new Response(msg, { status, headers }); }

function ymdInTZ(date, tz = "UTC") {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function daysAgoYMD(n, tz) { const d = new Date(Date.now() - n*86400000); return ymdInTZ(d, tz); }

async function requireAdmin(request, env) {
  const token = request.headers.get("X-Admin-Token") || "";
  const ok = !!env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
  if (!ok) throw new Response("Unauthorized", { status: 401 });
}

function normalizeTags(input) {
  let arr = [];
  if (Array.isArray(input)) arr = input;
  else if (typeof input === "string") arr = input.split(",").map(s => s.trim());
  arr = arr.map(s => s.trim()).filter(Boolean);
  return Array.from(new Set(arr));
}
function parseTagsFromRow(tagsText) {
  if (!tagsText) return [];
  try { const v = JSON.parse(tagsText); if (Array.isArray(v)) return v.map(s => String(s)).filter(Boolean); } catch {}
  return String(tagsText).split(",").map(s => s.trim()).filter(Boolean);
}

function canCheckin(entry, today) {
  if (!entry.last_checkin_date) return true;  // 从未签到

  const last = new Date(entry.last_checkin_date);
  const now = new Date(today);

  switch(entry.checkin_type) {
    case 'daily':
      return today !== entry.last_checkin_date;  // 今天没签过

    case 'weekly':
      return (now - last) >= 7 * 24 * 60 * 60 * 1000;

    case 'monthly':
      // 同号或间隔30天
      return now.getDate() === last.getDate() ||
             (now - last) >= 30 * 24 * 60 * 60 * 1000;

    case 'quarterly':
      return (now - last) >= 90 * 24 * 60 * 60 * 1000;

    case 'yearly':
      return (now - last) >= 365 * 24 * 60 * 60 * 1000;

    case 'custom':
      return (now - last) >= entry.checkin_interval * 24 * 60 * 60 * 1000;

    default:
      return today !== entry.last_checkin_date;
  }
}

function getCheckinTypeLabel(checkinType) {
  const labels = {
    'daily': '每日签到',
    'weekly': '每周签到',
    'monthly': '每月签到',
    'quarterly': '每季度签到',
    'yearly': '每年签到',
    'custom': '自定义间隔'
  };
  return labels[checkinType] || '每日签到';
}
function includesAllTags(rowTags, filterTags) {
  if (!filterTags?.length) return true;
  if (!rowTags?.length) return false;
  const set = new Set(rowTags);
  return filterTags.every(t => set.has(t));
}
function excludesAnyTags(rowTags, excludeTags) {
  if (!excludeTags?.length) return true;
  if (!rowTags?.length) return true;
  const set = new Set(rowTags);
  return !excludeTags.some(t => set.has(t));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method.toUpperCase();

    if (method === "GET" && (pathname === "/" || pathname === "/index.html")) {
      return new Response(INDEX_HTML, { headers: { "content-type": "text/html; charset=UTF-8" } });
    }
    if (method === "GET" && pathname === "/api/today") {
      const tz = env.TIMEZONE || "UTC";
      const today = ymdInTZ(new Date(), tz);
      return json({ date: today, timezone: tz });
    }

    try { await requireAdmin(request, env); } catch (e) { return e; }
    if (method === "GET" && pathname === "/api/admin/ping") {
      return text("OK", 200);
    }

    // 合并的数据接口：一次查询返回 entries + meta
    if (method === "GET" && pathname === "/api/data") {
      const tz = env.TIMEZONE || "UTC";
      const today = ymdInTZ(new Date(), tz);

      const sql = `
        SELECT e.id, e.name, e.sign_url, e.redeem_url, e.group_name, e.tags, e.checkin_type, e.checkin_interval, e.last_checkin_date,
               CASE WHEN c.id IS NULL THEN 0 ELSE 1 END AS checked_today
        FROM entries e
        LEFT JOIN checkins c ON c.entry_id = e.id AND c.date = ?
        ORDER BY e.group_name IS NULL, e.group_name, e.id ASC
      `;
      const { results } = await env.DB.prepare(sql).bind(today).all();

      // 从 entries 中提取 groups 和 tags
      const groupSet = new Set();
      const tagSet = new Set();
      const entries = (results || []).map(row => {
        if (row.group_name && row.group_name.trim()) groupSet.add(row.group_name);
        const tags = parseTagsFromRow(row.tags);
        tags.forEach(t => tagSet.add(t));
        return {
          ...row,
          tags,
          can_checkin: canCheckin(row, today)
        };
      });

      const checkinTypes = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'];

      return json({
        entries,
        groups: Array.from(groupSet).sort((a, b) => a.localeCompare(b, 'zh')),
        tags: Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh')),
        checkinTypes,
        today
      });
    }

    if (method === "GET" && pathname === "/api/meta") {
      const gsql = `SELECT DISTINCT group_name AS g FROM entries WHERE group_name IS NOT NULL AND TRIM(group_name) <> '' ORDER BY g COLLATE NOCASE`;
      const [gRes, tRes] = await Promise.all([
        env.DB.prepare(gsql).all(),
        env.DB.prepare(`SELECT tags FROM entries`).all()
      ]);
      const groups = (gRes.results || []).map(r => r.g);

      const tSet = new Set();
      (tRes.results || []).forEach(r => { parseTagsFromRow(r.tags).forEach(t => tSet.add(t)); });

      const checkinTypes = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'];

      return json({ groups, tags: Array.from(tSet).sort((a,b)=>a.localeCompare(b,'zh')), checkinTypes });
    }

    if (method === "GET" && pathname === "/api/entries") {
      const tz = env.TIMEZONE || "UTC";
      const today = ymdInTZ(new Date(), tz);
      const group = (url.searchParams.get("group") || "").trim();
      const filterTags = normalizeTags(url.searchParams.get("tags") || "");
      const excludeTags = normalizeTags(url.searchParams.get("excludeTags") || "");
      const checkinType = (url.searchParams.get("checkinType") || "").trim();

      const base = `
        SELECT e.id, e.name, e.sign_url, e.redeem_url, e.group_name, e.tags, e.checkin_type, e.checkin_interval, e.last_checkin_date,
               CASE WHEN c.id IS NULL THEN 0 ELSE 1 END AS checked_today
        FROM entries e
        LEFT JOIN checkins c
          ON c.entry_id = e.id AND c.date = ?
      `;
      const where = []; const bind = [today];
      if (group) { where.push(`e.group_name = ?`); bind.push(group); }
      if (checkinType) { where.push(`e.checkin_type = ?`); bind.push(checkinType); }
      const sql = base + (where.length ? ` WHERE ${where.join(' AND ')}` : '') + ` ORDER BY e.group_name IS NULL, e.group_name, e.id ASC`;
      const { results } = await env.DB.prepare(sql).bind(...bind).all();

      const filtered = (results || []).filter(row => {
        const rowTags = parseTagsFromRow(row.tags);
        return includesAllTags(rowTags, filterTags) && excludesAnyTags(rowTags, excludeTags);
      }).map(row => ({
        ...row,
        tags: parseTagsFromRow(row.tags),
        can_checkin: canCheckin(row, today)
      }));

      return json(filtered);
    }

    if (method === "POST" && pathname === "/api/entries") {
      try { await requireAdmin(request, env); } catch (e) { return e; }
      let body = {}; try { body = await request.json(); } catch { return text("Bad JSON", 400); }
      const name = (body.name || "").trim();
      const signUrl = (body.signUrl || "").trim();
      const redeemUrl = (body.redeemUrl || "").trim() || null;
      const groupName = (body.groupName || "").trim() || null;
      const tags = normalizeTags(body.tags);
      const checkinType = (body.checkinType || "daily").trim();
      const checkinInterval = body.checkinInterval ? parseInt(body.checkinInterval) : null;

      if (!name || !/^https?:\/\//i.test(signUrl)) return text("参数不合法：name 必填，signUrl 必须是 http(s) 链接", 400);
      if (!['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'].includes(checkinType)) return text("参数不合法：checkinType 必须是 daily/weekly/monthly/quarterly/yearly/custom 之一", 400);
      if (checkinType === 'custom' && (!checkinInterval || checkinInterval < 1)) return text("参数不合法：custom 类型必须设置 checkinInterval >= 1", 400);

      const now = new Date().toISOString();
      const stmt = `
        INSERT INTO entries (name, sign_url, redeem_url, group_name, tags, checkin_type, checkin_interval, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const { lastRowId } = await env.DB.prepare(stmt).bind(name, signUrl, redeemUrl, groupName, JSON.stringify(tags), checkinType, checkinInterval, now, now).run();
      return json({ id: lastRowId, name, sign_url: signUrl, redeem_url: redeemUrl, group_name: groupName, tags, checkin_type: checkinType, checkin_interval: checkinInterval }, { status: 201 });
    }

    if (method === "PUT" && pathname.startsWith("/api/entries/")) {
      try { await requireAdmin(request, env); } catch (e) { return e; }
      const id = Number(pathname.split("/").pop()); if (!Number.isFinite(id)) return text("Bad id", 400);
      let body = {}; try { body = await request.json(); } catch { return text("Bad JSON", 400); }

      const name = (body.name || "").trim();
      const signUrl = (body.signUrl || "").trim();
      const redeemUrl = (body.redeemUrl || "").trim() || null;
      const groupName = (body.groupName || "").trim() || null;
      const tags = normalizeTags(body.tags);
      const checkinType = (body.checkinType || "daily").trim();
      const checkinInterval = body.checkinInterval ? parseInt(body.checkinInterval) : null;

      if (!name || !/^https?:\/\//i.test(signUrl)) return text("参数不合法：name 必填，signUrl 必须是 http(s) 链接", 400);
      if (!['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'].includes(checkinType)) return text("参数不合法：checkinType 必须是 daily/weekly/monthly/quarterly/yearly/custom 之一", 400);
      if (checkinType === 'custom' && (!checkinInterval || checkinInterval < 1)) return text("参数不合法：custom 类型必须设置 checkinInterval >= 1", 400);

      const now = new Date().toISOString();
      const sql = `
        UPDATE entries
           SET name = ?, sign_url = ?, redeem_url = ?, group_name = ?, tags = ?, checkin_type = ?, checkin_interval = ?, updated_at = ?
         WHERE id = ?
      `;
      const { success } = await env.DB.prepare(sql).bind(name, signUrl, redeemUrl, groupName, JSON.stringify(tags), checkinType, checkinInterval, now, id).run();
      if (!success) return text("Not Modified", 304);
      return text("OK", 200);
    }

    if (method === "DELETE" && pathname.startsWith("/api/entries/")) {
      try { await requireAdmin(request, env); } catch (e) { return e; }
      const id = Number(pathname.split("/").pop()); if (!Number.isFinite(id)) return text("Bad id", 400);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM checkins WHERE entry_id = ?").bind(id),
        env.DB.prepare("DELETE FROM entries WHERE id = ?").bind(id)
      ]);
      return text("OK", 200);
    }

    if (pathname.startsWith("/api/checkin/")) {
      const id = Number(pathname.split("/").pop()); if (!Number.isFinite(id)) return text("Bad id", 400);
      const tz = env.TIMEZONE || "UTC"; const today = ymdInTZ(new Date(), tz);
      if (method === "POST") {
        // 先获取条目信息，检查是否可以签到
        const entryRes = await env.DB.prepare(`SELECT checkin_type, checkin_interval, last_checkin_date FROM entries WHERE id = ?`).bind(id).first();
        if (!entryRes) return text("条目不存在", 404);

        // 检查是否满足签到条件
        if (!canCheckin(entryRes, today)) {
          return text("还未到签到时间", 400);
        }

        const sql = `
          INSERT INTO checkins (entry_id, date, created_at)
          VALUES (?, ?, ?)
          ON CONFLICT(entry_id, date) DO NOTHING
        `;
        await env.DB.prepare(sql).bind(id, today, new Date().toISOString()).run();

        // 更新条目的最后签到日期
        await env.DB.prepare(`UPDATE entries SET last_checkin_date = ? WHERE id = ?`).bind(today, id).run();

        return text("OK", 200);
      } else if (method === "DELETE") {
        await env.DB.prepare(`DELETE FROM checkins WHERE entry_id = ? AND date = ?`).bind(id, today).run();

        // 删除签到记录时，更新条目的最后签到日期为最近一次的签到日期
        const lastCheckin = await env.DB.prepare(`SELECT date FROM checkins WHERE entry_id = ? ORDER BY date DESC LIMIT 1`).bind(id).first();
        const lastDate = lastCheckin ? lastCheckin.date : null;
        await env.DB.prepare(`UPDATE entries SET last_checkin_date = ? WHERE id = ?`).bind(lastDate, id).run();

        return text("OK", 200);
      }
    }

    return text("Not Found", 404);
  },

  async scheduled(event, env, ctx) {
    const tz = env.TIMEZONE || "UTC";
    const keepDays = parseInt(env.RETENTION_DAYS || "90", 10);
    const cutoff = daysAgoYMD(keepDays, tz);
    await env.DB.prepare(`DELETE FROM checkins WHERE date < ?`).bind(cutoff).run();
  }
};

