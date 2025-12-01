// Cloudflare Worker：页面 + API 一体
// 环境变量：DB (D1), ADMIN_TOKEN (secret), TIMEZONE, RETENTION_DAYS

const INDEX_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
  <title>每日签到汇总</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
        /* Paper / Ink 基础 */
        --bg-primary:   #FFF7E6;  /* 主背景：温暖纸黄 */
        --bg-secondary: #FFEBC2;  /* 次级背景：浅杏色，区块分层 */
        --bg-card:      #FFFBF2;  /* 卡片：更接近纸面 */
        --text-primary: #1C2746;  /* 墨蓝主文 */
        --text-secondary:#33415C; /* 次级文字：低对比墨蓝 */

        /* 结构与层次 */
        --border: #E6C78F;                     /* 纸色系边框 */
        --shadow: rgba(28, 39, 70, 0.08);      /* 墨蓝阴影，低不透明度 */

        /* 强调色（暖陶土色，和纸黄更和谐） */
        --accent:       #E07A5F;  /* terracotta */
        --accent-hover: #C9654E;
        --accent-light: #FFE8DE;  /* 强调色的浅背景，用于badge/hover */

        /* 语义色（柔和、偏暖，避免突兀） */
        --success:      #79C1B8;  /* 柔和青绿 */
        --success-dark: #173B3F;  /* success 上的深色文字 */
        --warning:      #E6B422;  /* 日式金，暖调警告 */
        --warning-dark: #1C2746;  /* warning 上的文字（与 text-primary 一致） */
    }

    /* 暗色主题：维持“墨蓝 + 暖纸色文字”的对比关系 */
    [data-theme="dark"] {
        --bg-primary:   #0E1A2A;  /* 深墨蓝 */
        --bg-secondary: #15283D;  /* 稍亮一档用于分区 */
        --bg-card:      #122238;  /* 卡片略提亮，保持分层 */
        --text-primary: #FFF6E0;  /* 暖白文字（纸色调） */
        --text-secondary:#E7D9BD; /* 次级文字：暖沙色 */

        --border: #2E3D55;                    /* 低对比冷边框 */
        --shadow: rgba(0, 0, 0, 0.45);

        --accent:       #E07A5F;  /* 与亮色一致，品牌统一 */
        --accent-hover: #F18A6C;
        --accent-light: #1B2A38;  /* 深背景下的浅强调背景 */

        --success:      #6DCCB8;
        --success-dark: #0E1A2A;
        --warning:      #F2C350;
        --warning-dark: #0E1A2A;
    }
    
    * {
      transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
    }
    
    body {
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 17px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
    }
    
    /* --- sticky blocks --- */
    .sticky-top{ position: sticky; top: 0; z-index: 60; }
    .sticky-filters{ position: sticky; top: calc(var(--topBarH, 0px) + 12px); z-index: 50; }
    /* 让粘顶区块滚动时不透明叠在内容之上 */
    .sticky-top, .sticky-filters{ backdrop-filter: none; }

    /* Disable sticky positioning when modal is open */
    body.modal-open .sticky-top,
    body.modal-open .sticky-filters {
      position: static !important;
    }

    .card {
      background: var(--bg-card);
      border: 2px solid var(--border);
      border-radius: 24px;
      box-shadow: 0 8px 24px var(--shadow);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .card:hover {
      box-shadow: 0 12px 36px var(--shadow);
      transform: translateY(-2px);
    }
    
    .chip {
      border: 2px solid var(--border);
      padding: 8px 16px;
      border-radius: 9999px;
      font-size: 15px;
      background: var(--bg-card);
      color: var(--text-primary);
      transition: all 0.2s;
      position: relative;
      font-weight: 500;
    }
    
    .chip:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px var(--shadow);
      background: var(--accent-light);
    }
    
    .chip.active {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }

    .chip.exclude {
      background: #dc2626;
      color: white;
      border-color: #dc2626;
    }

    .chip.exclude:hover {
      background: #b91c1c;
      border-color: #b91c1c;
    }
    
    .chip-removable {
      padding-right: 36px;
    }
    
    .chip-remove {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.9);
      color: white;
      display: none;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
    }
    
    .chip-removable:hover .chip-remove {
      display: flex;
    }
    
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border: 2px solid var(--border);
      border-radius: 16px;
      font-size: 16px;
      font-weight: 600;
      transition: all 0.2s;
      cursor: pointer;
    }
    
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px var(--shadow);
    }
    
    .btn-ghost {
      background: var(--bg-card);
      color: var(--text-primary);
    }
    
    .btn-ghost:hover {
      background: var(--accent-light);
      border-color: var(--accent);
    }
    
    .btn-dark {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }
    
    .btn-dark:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }
    
    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border: 2px solid var(--border);
      border-radius: 16px;
      background: var(--bg-card);
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .icon-btn:hover {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
      transform: scale(1.08);
    }
    
    .modal-mask {
      position: fixed;
      inset: 0;
      background: rgba(0, 24, 88, 0.7);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 50;
      padding: 20px;
    }
    
    .modal {
      background: var(--bg-card);
      border: 3px solid var(--accent);
      border-radius: 28px;
      box-shadow: 0 24px 72px rgba(0, 0, 0, 0.4);
      width: 100%;
      max-width: 680px;
      max-height: 90vh;
      overflow-y: auto;
    }
    
    input, select, textarea {
      background: var(--bg-card);
      border: 2px solid var(--border);
      color: var(--text-primary);
      border-radius: 14px;
      padding: 14px 18px;
      font-size: 16px;
      transition: all 0.2s;
      min-height: 48px;
    }
    
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 4px rgba(245, 130, 174, 0.15);
    }
    
    input::placeholder {
      color: var(--text-secondary);
      opacity: 0.6;
    }
    
    .badge {
      padding: 8px 18px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    
    .badge-success {
      background: var(--success);
      color: var(--success-dark);
    }
    
    .badge-warning {
      background: var(--warning);
      color: var(--warning-dark);
    }
    
    .tag-input-wrapper {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      padding: 12px;
      border: 2px solid var(--border);
      border-radius: 14px;
      background: var(--bg-card);
      min-height: 56px;
      align-items: center;
    }
    
    .tag-input-wrapper input {
      border: none;
      padding: 6px 10px;
      flex: 1;
      min-width: 140px;
      min-height: auto;
    }
    
    .tag-input-wrapper input:focus {
      box-shadow: none;
    }
    
    h1 { 
      font-size: 36px; 
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    h2 { 
      font-size: 22px; 
      font-weight: 700;
    }
    h3 { 
      font-size: 20px; 
      font-weight: 700;
    }
    
    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* 移动端标题优化 */
    @media (max-width: 640px) {
      .header-actions {
        gap: 6px;
      }
      #topBar h1 {
        max-width: calc(100vw - 180px);
      }
    }
    
    .divider {
      height: 2px;
      background: var(--border);
      margin: 24px 0;
      border-radius: 2px;
    }
    
    @media (max-width: 640px) {
      h1 { font-size: 22px; }
      .icon-btn { width: 40px; height: 40px; }
      .btn { padding: 10px 18px; font-size: 15px; }

      /* 移动端汇总栏优化 */
      .header-actions { gap: 8px; }
      .icon-btn svg { width: 20px; height: 20px; }
      #topBar .flex-wrap { gap: 8px; }
    }
    /* ===== Mobile Collapsible ===== */
    @media (max-width: 640px) {
      /* 通用：折叠时隐藏主体 */
      .is-collapsed .collapse-body { display: none; }

      /* 顶部卡片：收起时压缩内边距、字号，隐藏副标题行 */
      #topBar.is-collapsed .card { padding-top: 10px !important; padding-bottom: 10px !important; }
      #topBar.is-collapsed h1 { font-size: 18px; }
      #topBar.is-collapsed #today { display: none; }

      /* 筛选卡片：收起时压缩内边距 */
      #filters.is-collapsed .card { padding-top: 8px !important; padding-bottom: 8px !important; }

      /* 移动端优化：筛选区域可滚动 */
      #filtersBody {
        max-height: 60vh;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }

      /* 移动端分组选择器优化 */
      #groupSelect {
        min-width: 0;
        width: auto;
      }
      #clearFilters {
        padding: 8px 12px;
        font-size: 14px;
      }
      /* 移动端分组标签和下拉列表同行显示 */
      @media (max-width: 640px) {
        .group-select-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }
        #groupSelect {
          min-width: 80px;
          max-width: 160px;
        }
      }

      /* 移动端小屏幕优化 */
      .sticky-filters { top: calc(var(--topBarH, 0px) + 8px); }
      .sticky-top { top: 0; }
    }

    /* 小小的图标旋转过渡（箭头指示开/合） */
    #chevHeader, #chevFilters { transition: transform .2s ease; }
    [aria-expanded="false"] #chevHeader,
    [aria-expanded="false"] #chevFilters { transform: rotate(-180deg); }
  </style>
</head>
<body>
  <div class="max-w-6xl mx-auto p-4 sm:p-6">
    <header id="topBar" class="mb-8 sticky-top">
      <div class="card p-4 sm:p-6">
        <div class="flex items-center justify-between gap-2 sm:gap-4">
          <div class="min-w-0 flex-1">
            <h1 class="font-extrabold text-ellipsis overflow-hidden whitespace-nowrap">每日签到汇总</h1>
            <div id="today" class="text-base mt-2" style="color: var(--text-secondary)">加载中...</div>
          </div>
          <div class="header-actions flex-shrink-0">
            <button id="undoBtn" class="hidden btn btn-ghost">重置刚才的签到</button>
            <button id="openAdminModal" class="icon-btn" title="管理口令">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </button>
            <button id="openAddModal" class="icon-btn" title="新增签到项">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </button>
            <button id="themeToggle" class="icon-btn" title="切换主题">
              <svg id="sunIcon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
              <svg id="moonIcon" style="display:none" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </button>
            <button id="collapseHeaderBtn" class="icon-btn sm:hidden" title="收起/展开顶部" aria-expanded="true">
              <svg id="chevHeader" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- 筛选 -->
    <section id="filters" class="mb-6 card p-4 sm:p-6 sticky-filters">
      <div class="flex items-center justify-between mb-2">
        <div class="group-select-wrapper flex items-center gap-2 flex-1">
          <label class="text-base font-bold shrink-0" style="color: var(--text-primary)">分组：</label>
          <select id="groupSelect" class="flex-1 min-w-0 sm:max-w-xs">
            <option value="">全部分组</option>
            <option value="__unchecked__">仅未签到</option>
          </select>
          <button id="clearFilters" class="btn btn-ghost shrink-0 px-3 py-2 text-sm ml-2">清空</button>
        </div>
        <button id="collapseFiltersBtn" class="icon-btn" style="width:32px;height:32px" title="收起/展开筛选" aria-expanded="true">
          <svg id="chevFilters" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>
      <div id="filtersBody" class="collapse-body">
        <div class="grid gap-5">
          <div>
            <div class="flex items-center justify-between mb-4">
              <span class="text-sm font-semibold" style="color: var(--text-secondary)">标签筛选</span>
            </div>
            <div class="mb-4 max-h-40 overflow-y-auto">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-semibold" style="color: var(--text-secondary)">包含标签：</span>
              </div>
              <div id="tagChips" class="flex flex-wrap gap-3"></div>
            </div>
            <div class="max-h-40 overflow-y-auto">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-semibold" style="color: var(--text-secondary)">排除标签：</span>
              </div>
              <div id="excludeTagChips" class="flex flex-wrap gap-3"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 列表 -->
    <section class="card p-6 sm:p-8">
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-base font-bold" style="color: var(--text-primary)">我的签到项</h2>
        <button id="refreshBtn" class="btn btn-ghost">刷新</button>
      </div>
      <div id="list"></div>
      <div id="empty" class="text-base hidden" style="color: var(--text-secondary)">还没有条目，点击右上角 ➕ 添加一个吧。</div>
    </section>
  </div>

  <!-- 管理口令弹窗 -->
  <div id="adminModal" class="modal-mask">
    <div class="modal p-6 sm:p-8">
      <h3 class="mb-5">管理口令</h3>
      <div class="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        <div class="relative flex-1">
          <input id="adminToken" type="password" placeholder="输入管理口令以新增/删除/编辑条目" class="w-full pr-16" />
          <button id="togglePwd" class="absolute right-2 top-1/2 -translate-y-1/2 icon-btn" style="width:40px;height:40px" title="显示/隐藏口令">
            <svg id="eyeIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
        <button id="saveTokenBtn" class="btn btn-dark">保存口令</button>
        <button id="clearTokenBtn" class="btn btn-ghost">清除</button>
      </div>
      <p class="text-sm mt-4" style="color: var(--text-secondary)">口令仅保存在本地；调用新增/删除/编辑 API 时作为 <code>X-Admin-Token</code> 发送。</p>
      <div class="mt-6 flex justify-end">
        <button id="closeAdminModal" class="btn btn-ghost">关闭</button>
      </div>
    </div>
  </div>

  <!-- 新增条目弹窗 -->
  <div id="addModal" class="modal-mask">
    <div class="modal p-6 sm:p-8">
      <h3 class="mb-5">新增签到条目</h3>
      <form id="addForm" class="grid sm:grid-cols-2 gap-5">
        <input name="name" required placeholder="名称（必填）" />
        <input name="signUrl" required placeholder="签到网址（https://...）" />
        <input name="redeemUrl" placeholder="兑换码网址（可选）" class="sm:col-span-2" />
        <input name="groupName" placeholder="分组（可选）" />
        <div class="sm:col-span-2">
          <label class="text-sm mb-2 block font-semibold" style="color: var(--text-secondary)">标签</label>
          <div class="tag-input-wrapper" id="addTagsWrapper">
            <input id="addTagInput" type="text" placeholder="输入标签后按 Enter" />
          </div>
        </div>
        <div class="sm:col-span-2 flex justify-end gap-3 mt-2">
          <button type="button" id="closeAddModal" class="btn btn-ghost">取消</button>
          <button class="btn btn-dark">添加</button>
        </div>
      </form>
      <div id="addMsg" class="text-base mt-4"></div>
    </div>
  </div>

  <!-- 编辑弹窗 -->
  <div id="editModal" class="modal-mask">
    <div class="modal p-6 sm:p-8">
      <h3 class="mb-5">编辑签到项</h3>
      <form id="editForm" class="grid sm:grid-cols-2 gap-5">
        <input name="id" type="hidden" />
        <input name="name" required placeholder="名称（必填）" class="sm:col-span-2" />
        <input name="signUrl" required placeholder="签到网址（https://...）" class="sm:col-span-2" />
        <input name="redeemUrl" placeholder="兑换码网址（可选）" class="sm:col-span-2" />
        <input name="groupName" placeholder="分组（可选）" />
        <div class="sm:col-span-2">
          <label class="text-sm mb-2 block font-semibold" style="color: var(--text-secondary)">标签</label>
          <div class="tag-input-wrapper" id="editTagsWrapper">
            <input id="editTagInput" type="text" placeholder="输入标签后按 Enter" />
          </div>
          <div class="mt-3">
            <span class="text-sm font-semibold" style="color: var(--text-secondary)">所有标签（点击插入）：</span>
            <div id="editTagSuggestions" class="flex flex-wrap gap-2 mt-2"></div>
          </div>
        </div>
        <div class="sm:col-span-2 flex justify-end gap-3 mt-2">
          <button type="button" id="editCancel" class="btn btn-ghost">取消</button>
          <button class="btn btn-dark">保存</button>
        </div>
      </form>
    </div>
  </div>

  <template id="row-tpl">
    <div class="flex flex-col sm:flex-row sm:items-center gap-4 py-5 border-b-2 last:border-b-0" style="border-color: var(--border)">
      <div class="flex-1">
        <div class="font-bold text-xl name"></div>
        <div class="text-sm mt-2 group-line" style="color: var(--text-secondary)"></div>
        <div class="mt-3 flex flex-wrap gap-2 tag-badges"></div>
      </div>
      <div class="flex items-center gap-3 action-wrap flex-wrap"></div>
    </div>
  </template>

  <script>
    const $ = (sel, el=document) => el.querySelector(sel);
    const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

    const state = {
      adminToken: localStorage.getItem('adminToken') || '',
      adminOK: false,
      theme: localStorage.getItem('theme') || 'light',
      timezone: '',
      today: '',
      entries: [],
      groups: [],
      allTags: [],
      selectedGroup: '',
      selectedTags: [],
      excludedTags: [],
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
        await loadMeta();
        await loadEntries();
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
      $('#openAddModal').onclick = () => {
        if (!state.adminOK) { alert('请先点击右上角🔒输入并保存正确的管理口令'); return; }
        state.addTags = ['有效'];
        renderTagInput('addTagsWrapper', 'addTags');
        $('#addForm').reset();
        $('#addMsg').textContent = '';
        $('#addModal').style.display = 'flex';
        setModalOpen(true);
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
        if (state.adminOK) { await loadMeta(); await loadEntries(); renderFilters(); }
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
          await loadEntries();
          render();
          clearClicks(id);
        } catch (e) { alert('撤销失败：' + e.message); }
      };

      $('#refreshBtn').onclick = async () => {
        if (!state.adminOK) { alert('请先输入正确的管理口令'); return; }
        await loadMeta(); await loadEntries(); renderFilters(); render();
      };

      // 新增表单 - 标签输入
      setupTagInput('addTagInput', 'addTagsWrapper', 'addTags');
      
      $('#addForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const body = {
          name: fd.get('name')?.toString().trim(),
          signUrl: fd.get('signUrl')?.toString().trim(),
          redeemUrl: fd.get('redeemUrl')?.toString().trim() || null,
          groupName: fd.get('groupName')?.toString().trim() || null,
          tags: state.addTags
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
          await loadMeta(); await loadEntries(); renderFilters(); render();
          $('#addMsg').textContent = '✅ 已添加';
          $('#addMsg').style.color = '#16a34a';
          setTimeout(() => { $('#addModal').style.display = 'none'; setModalOpen(false); }, 1500);
        } catch (err) {
          $('#addMsg').textContent = '❌ 添加失败：' + err.message;
          $('#addMsg').style.color = '#dc2626';
        }
      });

      $('#clearFilters').onclick = async () => {
        state.selectedGroup = ''; state.selectedTags = []; state.excludedTags = [];
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
    
    async function loadMeta() {
      const res = await fetch('/api/meta', { headers: { 'X-Admin-Token': state.adminToken } });
      const data = await res.json();
      state.groups = data.groups || []; state.allTags = data.tags || [];
    }
    
    async function loadEntries() {
      if (!state.adminOK) { state.entries = []; return; }
      const params = new URLSearchParams();
      if (state.selectedGroup && state.selectedGroup !== '__unchecked__') {
        params.set('group', state.selectedGroup);
      }
      if (state.selectedTags.length) params.set('tags', state.selectedTags.join(','));
      if (state.excludedTags.length) params.set('excludeTags', state.excludedTags.join(','));
      const res = await fetch('/api/entries' + (params.toString() ? ('?' + params) : ''), {
        headers: { 'X-Admin-Token': state.adminToken }
      });
      let entries = await res.json();
      
      if (state.selectedGroup === '__unchecked__') {
        entries = entries.filter(e => !e.checked_today);
      }
      
      state.entries = entries;
    }

    function renderFilters() {
      const sel = $('#groupSelect'); const keep = sel.value;
      sel.innerHTML = '<option value="">全部分组</option><option value="__unchecked__">仅未签到</option>' + 
        state.groups.map(g => '<option value="'+escapeHtml(g)+'">'+escapeHtml(g)+'</option>').join('');
      sel.value = state.selectedGroup || keep || '';
      sel.onchange = async () => { state.selectedGroup = sel.value; await loadEntries(); render(); };

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
        $('.group-line', node).textContent = item.group_name ? ('分组：' + item.group_name) : '';

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
                await loadMeta(); await loadEntries(); renderFilters(); render();
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
        badge.className = 'badge ' + (item.checked_today ? 'badge-success' : 'badge-warning');
        badge.textContent = item.checked_today ? '今日已签' : '今日未签';
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
              await loadEntries(); render();
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
              await loadMeta(); await loadEntries(); renderFilters(); render();
            } catch (e) { alert('删除失败：' + e.message); }
          };
          actionWrap.appendChild(delBtn);
        }

        list.appendChild(node);
        updateStickyOffsets();
      });
    }

    function openEditModal(item) {
      if (!state.adminOK) {
        alert('请先点击 🔒 图标输入并保存管理口令');
        return;
      }
      const mask = $('#editModal');
      const form = $('#editForm');
      form.id.value = item.id;
      form.name.value = item.name || '';
      form.signUrl.value = item.sign_url || '';
      form.redeemUrl.value = item.redeem_url || '';
      form.groupName.value = item.group_name || '';

      state.editTags = [...(item.tags || [])];
      renderTagInput('editTagsWrapper', 'editTags');
      renderEditTagSuggestions();

      mask.style.display = 'flex';
      setModalOpen(true);
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
        await loadMeta(); 
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
        await loadEntries(); render();
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
    if (method === "GET" && pathname === "/api/meta") {
      const gsql = `SELECT DISTINCT group_name AS g FROM entries WHERE group_name IS NOT NULL AND TRIM(group_name) <> '' ORDER BY g COLLATE NOCASE`;
      const gRes = await env.DB.prepare(gsql).all();
      const groups = (gRes.results || []).map(r => r.g);

      const tRes = await env.DB.prepare(`SELECT tags FROM entries`).all();
      const tSet = new Set();
      (tRes.results || []).forEach(r => { parseTagsFromRow(r.tags).forEach(t => tSet.add(t)); });

      return json({ groups, tags: Array.from(tSet).sort((a,b)=>a.localeCompare(b,'zh')) });
    }

    if (method === "GET" && pathname === "/api/entries") {
      const tz = env.TIMEZONE || "UTC";
      const today = ymdInTZ(new Date(), tz);
      const group = (url.searchParams.get("group") || "").trim();
      const filterTags = normalizeTags(url.searchParams.get("tags") || "");
      const excludeTags = normalizeTags(url.searchParams.get("excludeTags") || "");

      const base = `
        SELECT e.id, e.name, e.sign_url, e.redeem_url, e.group_name, e.tags,
               CASE WHEN c.id IS NULL THEN 0 ELSE 1 END AS checked_today
        FROM entries e
        LEFT JOIN checkins c
          ON c.entry_id = e.id AND c.date = ?
      `;
      const where = []; const bind = [today];
      if (group) { where.push(`e.group_name = ?`); bind.push(group); }
      const sql = base + (where.length ? ` WHERE ${where.join(' AND ')}` : '') + ` ORDER BY e.group_name IS NULL, e.group_name, e.id ASC`;
      const { results } = await env.DB.prepare(sql).bind(...bind).all();

      const filtered = (results || []).filter(row => {
        const rowTags = parseTagsFromRow(row.tags);
        return includesAllTags(rowTags, filterTags) && excludesAnyTags(rowTags, excludeTags);
      }).map(row => ({ ...row, tags: parseTagsFromRow(row.tags) }));

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
      if (!name || !/^https?:\/\//i.test(signUrl)) return text("参数不合法：name 必填，signUrl 必须是 http(s) 链接", 400);

      const now = new Date().toISOString();
      const stmt = `
        INSERT INTO entries (name, sign_url, redeem_url, group_name, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const { lastRowId } = await env.DB.prepare(stmt).bind(name, signUrl, redeemUrl, groupName, JSON.stringify(tags), now, now).run();
      return json({ id: lastRowId, name, sign_url: signUrl, redeem_url: redeemUrl, group_name: groupName, tags }, { status: 201 });
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
      if (!name || !/^https?:\/\//i.test(signUrl)) return text("参数不合法：name 必填，signUrl 必须是 http(s) 链接", 400);

      const now = new Date().toISOString();
      const sql = `
        UPDATE entries
           SET name = ?, sign_url = ?, redeem_url = ?, group_name = ?, tags = ?, updated_at = ?
         WHERE id = ?
      `;
      const { success } = await env.DB.prepare(sql).bind(name, signUrl, redeemUrl, groupName, JSON.stringify(tags), now, id).run();
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
        const sql = `
          INSERT INTO checkins (entry_id, date, created_at)
          VALUES (?, ?, ?)
          ON CONFLICT(entry_id, date) DO NOTHING
        `;
        await env.DB.prepare(sql).bind(id, today, new Date().toISOString()).run();
        return text("OK", 200);
      } else if (method === "DELETE") {
        await env.DB.prepare(`DELETE FROM checkins WHERE entry_id = ? AND date = ?`).bind(id, today).run();
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

