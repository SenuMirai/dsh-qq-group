window.__ModuleLoader__.load({
  id: 'dsh-qq-group',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const BASE = '/dsh-qq-group';
    const DEFAULT_VOICE = 'zh-CN-XiaoyiNeural';
    const BUILTIN_VOICES = [
      { id: 'zh-CN-XiaoyiNeural', label: '晓伊 · 活泼少女' },
      { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓 · 温柔女声' },
      { id: 'zh-CN-XiaochenNeural', label: '晓辰 · 随性女声' },
      { id: 'zh-CN-XiaohanNeural', label: '晓涵 · 知性女声' },
      { id: 'zh-CN-XiaomengNeural', label: '晓梦 · 甜美女声' },
      { id: 'zh-CN-XiaomoNeural', label: '晓墨 · 沉稳女声' },
      { id: 'zh-CN-XiaoruiNeural', label: '晓睿 · 成熟女声' },
      { id: 'zh-CN-XiaoshuangNeural', label: '晓双 · 童声' },
      { id: 'zh-CN-YunxiNeural', label: '云希 · 少年音' },
      { id: 'zh-CN-YunjianNeural', label: '云健 · 运动男声' },
      { id: 'zh-CN-YunyangNeural', label: '云扬 · 新闻男声' },
      { id: 'zh-CN-liaoning-XiaobeiNeural', label: '晓北 · 东北话' },
      { id: 'zh-CN-shaanxi-XiaoniNeural', label: '晓妮 · 陕西话' },
    ];

    const s = {
      card: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '12px', padding: '16px', marginTop: '12px' },
      row: { display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' },
      label: { minWidth: '110px', fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' },
      input: {
        flex: '1 1 160px',
        minWidth: '120px',
        padding: '7px 9px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-1)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: '13px',
      },
      area: {
        width: '100%',
        minHeight: '100px',
        padding: '8px 10px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-1)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: '13px',
        boxSizing: 'border-box',
      },
      note: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)', margin: '6px 0 0' },
      btn: { padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l2)', cursor: 'pointer' },
      primary: { background: 'var(--dsw-alias-state-business-primary)', color: '#fff', border: 'none' },
      bad: { color: 'var(--dsw-alias-state-error-primary)' },
      good: { color: 'var(--dsw-alias-state-success-primary)' },
    };

    function Row(props) {
      return h('div', { style: s.row }, h('span', { style: s.label, children: props.label }), props.children);
    }

    function mapText(map) {
      return Object.entries(map || {})
        .map(function (entry) {
          return entry[0] + '=' + Math.round(Number(entry[1]) * 100);
        })
        .join('\n');
    }

    function parseMap(text) {
      const out = {};
      String(text || '')
        .split(/\r?\n/)
        .forEach(function (line) {
          const m = /^(.+?)[=:：]\s*(\d{1,3})\s*%?$/.exec(line.trim());
          if (m) out[m[1].trim()] = Math.min(100, Number(m[2])) / 100;
        });
      return out;
    }

    function localMonth() {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    function fmtNum(n) {
      const v = Number(n) || 0;
      if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
      if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
      return String(Math.round(v));
    }

    function fmtCredits(n) {
      return (Number(n) || 0).toFixed(2);
    }

    function monthMeta(month) {
      const parts = String(month || localMonth()).split('-');
      const year = Number(parts[0]);
      const m = Number(parts[1]);
      const first = new Date(year, m - 1, 1).getDay();
      const last = new Date(year, m, 0).getDate();
      return { first, last };
    }

    function statusText(st) {
      if (!st) return '…';
      if (!st.running) return '未启动';
      const link = st.link || {};
      if (link.status === 'online') return '在线' + (st.selfQq ? '（' + st.selfQq + '）' : '');
      if (link.status === 'reconnecting') return '重连中（第 ' + (link.attempt || 1) + ' 次：' + (link.reason || '未知') + '）';
      return String(link.status || '连接中');
    }

    function Page() {
      const [cfg, setCfg] = React.useState(null);
      const [settings, setSettings] = React.useState({ persona: '', mode: 'passive', model: { provider: '', model: '' }, stickerSave: false, autoStart: true, autoLaunchNapcat: true, napcatLauncher: 'C:\\DSHwork\\start-napcat.bat', whitelist: [], whitelistFloor: 95, blacklist: [], blacklistCeil: 5, nightDnd: { enabled: true, startHour: 23, endHour: 8 } });
      const [providers, setProviders] = React.useState([]);
      const [efforts, setEfforts] = React.useState([]);
      const [status, setStatus] = React.useState(null);
      const [stickers, setStickers] = React.useState([]);
      const [stickerItems, setStickerItems] = React.useState([]);
      const [stickerDir, setStickerDir] = React.useState('');
      const [preview, setPreview] = React.useState(null);
      const [usage, setUsage] = React.useState(null);
      const [usageOpen, setUsageOpen] = React.useState(false);
      const [usageScope, setUsageScope] = React.useState('current');
      const [usageMonth, setUsageMonth] = React.useState(localMonth());
      const [usageDay, setUsageDay] = React.useState('');
      const [rateInput, setRateInput] = React.useState('');
      const [balanceInput, setBalanceInput] = React.useState('');
      const [diary, setDiary] = React.useState([]);
      const [members, setMembers] = React.useState([]);
      const [diaryGroup, setDiaryGroup] = React.useState('');
      const [diaryUser, setDiaryUser] = React.useState('');
      const [diaryFrom, setDiaryFrom] = React.useState('');
      const [diaryTo, setDiaryTo] = React.useState('');
      const [diaryOrder, setDiaryOrder] = React.useState('desc');
      const [groupId, setGroupId] = React.useState('');
      const [newGroupId, setNewGroupId] = React.useState('');
      const [policy, setPolicy] = React.useState(null);
      const [check, setCheck] = React.useState(null);
      const [message, setMessage] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [tab, setTab] = React.useState('status');

      const loadConfig = React.useCallback(async function () {
        const data = await (await fetch(BASE + '/config', { cache: 'no-store' })).json();
        setCfg(data);
        setSettings(data.settings || {});
        const groups = (data.qq && data.qq.config && data.qq.config.groups) || {};
        const ids = Object.keys(groups);
        const id = groupId && groups[groupId] ? groupId : ids[0] || '';
        setGroupId(id);
        setDiaryGroup(function (prev) { return prev === '' ? id : prev; });
        setPolicy(id ? groups[id] : (data.qq && data.qq.config && data.qq.config.defaultGroup) || null);
      }, [groupId]);

      const loadStatus = React.useCallback(async function () {
        try {
          setStatus(await (await fetch(BASE + '/status', { cache: 'no-store' })).json());
        } catch {
          /* 忽略 */
        }
      }, []);

      const loadStickers = React.useCallback(async function () {
        try {
          const data = await (await fetch(BASE + '/stickers', { cache: 'no-store' })).json();
          setStickers(data.stickers || []);
          setStickerItems(data.items || []);
          setStickerDir(data.dir || '');
        } catch {
          /* 忽略 */
        }
      }, []);

      const openStickerDir = async function () {
        try {
          const data = await (await fetch(BASE + '/stickers/open', { method: 'POST' })).json();
          if (data.ok === false) setMessage(data.message || '打开失败');
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const previewVoice = async function () {
        setPreview({ loading: true });
        try {
          const tts = (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts) || {};
          const data = await (await fetch(BASE + '/voice-preview', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ voice: tts.voice, rate: tts.rate, pitch: tts.pitch, volume: tts.volume }),
          })).json();
          if (data.ok === true) {
            setPreview({ url: 'data:audio/wav;base64,' + data.base64 });
          } else {
            setPreview(null);
            setMessage('试听失败：' + (data.message || '未知错误'));
          }
        } catch (e) {
          setPreview(null);
          setMessage(String((e && e.message) || e));
        }
      };

      const setTts = function (patch) {
        setCfg({
          ...cfg,
          qq: {
            ...cfg.qq,
            config: {
              ...cfg.qq.config,
              tts: { ...((cfg.qq.config && cfg.qq.config.tts) || {}), ...patch },
            },
          },
        });
      };

      const loadUsage = React.useCallback(async function (scope, month) {
        try {
          const data = await (await fetch(
            BASE + '/usage?scope=' + encodeURIComponent(scope) + '&month=' + encodeURIComponent(month),
            { cache: 'no-store' },
          )).json();
          setUsage(data);
          if (data && data.model) setRateInput(String(data.model.rate || 0));
        } catch {
          /* 忽略 */
        }
      }, []);

      const saveRate = async function () {
        if (!usage || !usage.model) return;
        const rate = Number(rateInput);
        if (!Number.isFinite(rate) || rate < 0) {
          setMessage('单价必须是非负数字');
          return;
        }
        const data = await (await fetch(BASE + '/usage/rate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key: usage.model.key, rate }),
        })).json();
        if (data.ok !== true) setMessage(data.message || '保存失败');
        else {
          setMessage('单价已保存');
          await loadUsage(usageScope, usageMonth);
        }
      };

      const saveRateFor = async function (key, value) {
        const rate = Number(value);
        if (!Number.isFinite(rate) || rate < 0) {
          setMessage('单价必须是非负数字');
          return;
        }
        const data = await (await fetch(BASE + '/usage/rate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key, rate }),
        })).json();
        if (data.ok !== true) setMessage(data.message || '保存失败');
        else {
          setMessage('单价已保存');
          await loadUsage(usageScope, usageMonth);
        }
      };

      const saveBalance = async function () {
        const credits = Number(balanceInput);
        if (!Number.isFinite(credits) || credits < 0) {
          setMessage('余额必须是非负数字');
          return;
        }
        const data = await (await fetch(BASE + '/usage/balance', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ credits }),
        })).json();
        if (data.ok !== true) setMessage(data.message || '保存失败');
        else {
          setMessage('余额已记录，从刚才起开始估算消耗');
          setBalanceInput('');
          await loadUsage(usageScope, usageMonth);
        }
      };

      const shiftUsageMonth = function (delta) {
        const parts = usageMonth.split('-').map(Number);
        const d = new Date(parts[0], parts[1] - 1 + delta, 1);
        setUsageMonth(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
        setUsageDay('');
      };

      const voiceList = BUILTIN_VOICES.concat(settings.customVoices || []);

      const importVoices = function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          try {
            const text = String(reader.result || '');
            let raw = [];
            try {
              const parsed = JSON.parse(text);
              raw = Array.isArray(parsed) ? parsed : parsed.voices || [];
            } catch {
              raw = text
                .split(/\r?\n/)
                .map(function (line) {
                  const parts = line.split(/[=,\t，]/);
                  return { id: (parts[0] || '').trim(), label: (parts[1] || parts[0] || '').trim() };
                })
                .filter(function (v) { return v.id !== ''; });
            }
            const valid = raw
              .map(function (v) {
                return typeof v === 'string'
                  ? { id: v.trim(), label: v.trim() }
                  : { id: String(v.id || '').trim(), label: String(v.label || v.id || '').trim() };
              })
              .filter(function (v) { return v.id !== ''; });
            const merged = (settings.customVoices || []).slice();
            valid.forEach(function (v) {
              if (!merged.some(function (x) { return x.id === v.id; })) merged.push(v);
            });
            setSettings({ ...settings, customVoices: merged });
            setMessage('已导入 ' + valid.length + ' 个音色，点「保存全部」后生效');
          } catch (err) {
            setMessage('导入失败：' + String((err && err.message) || err));
          } finally {
            e.target.value = '';
          }
        };
        reader.readAsText(file);
      };

      const exportVoices = function () {
        const blob = new Blob([JSON.stringify({ voices: voiceList }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'qq-voices.json';
        a.click();
        URL.revokeObjectURL(url);
      };

      const deleteVoice = function () {
        const current = (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts && cfg.qq.config.tts.voice) || '';
        const custom = settings.customVoices || [];
        if (!custom.some(function (v) { return v.id === current; })) {
          setMessage('内置音色不能删除；只有导入的音色可以删');
          return;
        }
        setSettings({ ...settings, customVoices: custom.filter(function (v) { return v.id !== current; }) });
        setTts({ voice: DEFAULT_VOICE });
        setMessage('已删除该导入音色，保存后生效');
      };

      const loadDiary = React.useCallback(async function (group, user) {
        try {
          const gid = group === undefined ? diaryGroup : group;
          const uid = user === undefined ? diaryUser : user;
          const q = new URLSearchParams({ limit: '50' });
          if (gid) q.set('groupId', gid);
          if (uid) q.set('userId', uid);
          if (diaryFrom) q.set('from', String(new Date(diaryFrom + 'T00:00:00').getTime()));
          if (diaryTo) q.set('to', String(new Date(diaryTo + 'T23:59:59.999').getTime()));
          q.set('order', diaryOrder);
          const data = await (await fetch(BASE + '/diary?' + q.toString(), { cache: 'no-store' })).json();
          setDiary(data.entries || []);
        } catch {
          /* 忽略 */
        }
      }, [diaryGroup, diaryUser, diaryFrom, diaryTo, diaryOrder]);

      const loadMembers = React.useCallback(async function (group) {
        try {
          const gid = group === undefined ? diaryGroup : group;
          const data = await (await fetch(BASE + '/diary/members?groupId=' + encodeURIComponent(gid), { cache: 'no-store' })).json();
          setMembers(data.members || []);
        } catch {
          /* 忽略 */
        }
      }, [diaryGroup]);

      React.useEffect(function () {
        void (async function () {
          await loadConfig();
          try {
            const models = await (await fetch(BASE + '/models', { cache: 'no-store' })).json();
            setProviders(models.providers || []);
          } catch {
            /* 忽略 */
          }
          await Promise.all([loadStatus(), loadStickers()]);
        })();
      }, [loadConfig, loadStatus, loadStickers]);

      React.useEffect(function () {
        void loadMembers(diaryGroup);
        void loadDiary(diaryGroup, diaryUser);
      }, [diaryGroup, diaryUser, loadMembers, loadDiary]);

      React.useEffect(function () {
        const timer = setInterval(function () {
          void loadStatus();
        }, 3000);
        return function () {
          clearInterval(timer);
        };
      }, [loadStatus]);

      React.useEffect(function () {
        void (async function () {
          try {
            const data = await (await fetch(BASE + '/reasoning', { cache: 'no-store' })).json();
            setEfforts((data.reasoning && data.reasoning.efforts) || []);
          } catch {
            setEfforts([]);
          }
        })();
      }, [settings.model && settings.model.provider, settings.model && settings.model.model]);

      React.useEffect(function () {
        if (usageOpen) void loadUsage(usageScope, usageMonth);
      }, [usageOpen, usageScope, usageMonth, loadUsage]);

      React.useEffect(function () {
        if (usageOpen) void loadUsage(usageScope, usageMonth);
      }, [settings.model && settings.model.provider, settings.model && settings.model.model]);

      React.useEffect(function () {
        if (usageOpen) void loadUsage(usageScope, usageMonth);
      }, [status && status.model && status.model.provider, status && status.model && status.model.model]);

      const groups = (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.groups) || {};
      const groupIds = Object.keys(groups);

      const pickGroup = function (id) {
        setGroupId(id);
        setPolicy(id ? groups[id] : (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.defaultGroup) || null);
      };

      const setP = function (field, value) {
        setPolicy(function (prev) {
          return prev ? { ...prev, [field]: value } : prev;
        });
      };
      const setNested = function (parent, field, value) {
        setPolicy(function (prev) {
          return prev ? { ...prev, [parent]: { ...prev[parent], [field]: value } } : prev;
        });
      };

      const addGroup = async function () {
        const id = newGroupId.trim();
        if (!/^\d{5,12}$/.test(id)) {
          setMessage('群号格式不对（5~12 位数字）');
          return;
        }
        const base = (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.defaultGroup) || {};
        const created = { ...base, enabled: true };
        setBusy(true);
        setMessage('');
        try {
          await fetch(BASE + '/config', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ qq: { groups: { [id]: created } } }),
          });
          setNewGroupId('');
          await loadConfig();
          setGroupId(id);
          setPolicy(created);
          setMessage('已添加群 ' + id);
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setBusy(false);
        }
      };

      const save = async function () {
        setBusy(true);
        setMessage('');
        try {
          const groupsPatch = groupId && policy ? { [groupId]: policy } : {};
          // 发送完整 qq.config（含 tts），只额外带上当前群的策略补丁；
          // 之前只发了 url/token/selfName/ownerQq，导致音色等设置保存后被丢掉。
          const qq = {
            ...((cfg && cfg.qq && cfg.qq.config) || {}),
            ...(Object.keys(groupsPatch).length > 0 ? { groups: groupsPatch } : {}),
          };
          const res = await fetch(BASE + '/config', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ qq, settings: settings }),
          });
          const data = await res.json();
          if (data.ok === false) setMessage('保存失败：' + (data.message || '未知错误'));
          else {
            setMessage('已保存');
            await loadConfig();
            await loadStickers();
          }
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setBusy(false);
        }
      };

      const start = async function () {
        setBusy(true);
        try {
          const data = await (await fetch(BASE + '/start', { method: 'POST' })).json();
          const napNote = data.napcat && data.napcat.message ? '（' + data.napcat.message + '）' : '';
          setMessage(data.ok === false ? '启动失败：' + (data.message || '未知错误') : '已启动，正在连接…' + napNote);
          await loadStatus();
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setBusy(false);
        }
      };

      const launchNapcat = async function () {
        setBusy(true);
        setMessage('正在启动 NapCat…');
        try {
          const data = await (await fetch(BASE + '/launch-napcat', { method: 'POST' })).json();
          setMessage(data.message || '已处理');
          await loadStatus();
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setBusy(false);
        }
      };

      const stop = async function () {
        setBusy(true);
        try {
          await fetch(BASE + '/stop', { method: 'POST' });
          setMessage('已停止');
          await loadStatus();
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setBusy(false);
        }
      };

      const testModel = async function () {
        setCheck({ running: true });
        try {
          setCheck(await (await fetch(BASE + '/model-check', { method: 'POST' })).json());
        } catch (e) {
          setCheck({ ok: false, error: String((e && e.message) || e) });
        }
      };

      const deleteDiary = async function () {
        const scope = diaryUser ? '这个人的' : diaryGroup ? '这个群的' : '全部';
        if (!window.confirm('删除' + scope + '日记？')) return;
        const body = diaryUser
          ? { groupId: diaryGroup, userId: diaryUser }
          : diaryGroup
            ? { groupId: diaryGroup }
            : { clear: true };
        await fetch(BASE + '/diary/delete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        await loadDiary(diaryGroup, diaryUser);
      };

      const deleteEntry = async function (ts) {
        if (!window.confirm('删除这条日记？')) return;
        await fetch(BASE + '/diary/delete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ts }),
        });
        await loadDiary(diaryGroup, diaryUser);
      };

      const exportDiary = async function () {
        const q = new URLSearchParams();
        if (diaryGroup) q.set('groupId', diaryGroup);
        if (diaryUser) q.set('userId', diaryUser);
        if (diaryFrom) q.set('from', String(new Date(diaryFrom + 'T00:00:00').getTime()));
        if (diaryTo) q.set('to', String(new Date(diaryTo + 'T23:59:59.999').getTime()));
        const data = await (await fetch(BASE + '/diary/export?' + q.toString(), { cache: 'no-store' })).json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'whale-girl-diary.json';
        a.click();
        URL.revokeObjectURL(url);
      };

      const pickDiaryGroup = function (gid) {
        setDiaryGroup(gid);
        setDiaryUser('');
      };

      const provider = providers.find(function (p) {
        return p.provider === settings.model.provider;
      });
      const fallbackRef = settings.fallbackModel || { provider: '', model: '' };
      const fallbackProvider = providers.find(function (p) {
        return p.provider === fallbackRef.provider;
      });
      const running = status && status.running === true;
      const modelInfo = status && status.model ? status.model : null;
      const usageDayMap = {};
      if (usage && Array.isArray(usage.days)) {
        usage.days.forEach(function (d) { usageDayMap[d.day] = d; });
      }
      const selectedUsageDay = usageDayMap[usageDay];
      const usageMeta = monthMeta(usageMonth);

      return h('div', null,
        h('h2', { style: { fontSize: '16px', margin: '0 0 4px' }, children: 'QQ 群聊（独立插件）' }),
        h('p', { style: s.note, children: '独立数据目录与记忆，不共享桌宠的 memory.json。' }),

        h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '10px 0 2px' } },
          [
            { id: 'status', label: '运行状态' },
            { id: 'basic', label: '人设 / 模型' },
            { id: 'chat', label: '接话（按群）' },
            { id: 'stickers', label: '表情包' },
            { id: 'voice', label: '语音' },
            { id: 'diary', label: '日记' },
            { id: 'lists', label: '名单' },
            { id: 'night', label: '夜间' },
            { id: 'connect', label: '连接' },
          ].map(function (item) {
            return h('button', {
              key: item.id,
              style: tab === item.id ? { ...s.btn, ...s.primary } : s.btn,
              onClick: function () { setTab(item.id); },
              children: item.label,
            });
          }),
        ),

        h('div', { style: { ...s.card, display: tab === 'status' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '运行状态' }),
          h(Row, { label: '连接' },
            h('span', { style: running ? s.good : s.note, children: statusText(status) }),
            h('button', { style: s.btn, disabled: busy || running, onClick: start, children: '启动' }),
            h('button', { style: s.btn, disabled: busy || !running, onClick: stop, children: '停止' }),
            h('button', { style: s.btn, onClick: function () { void loadStatus(); }, children: '刷新' }),
          ),
          h(Row, { label: '群' },
            h('span', { children: String(Object.keys(groups).length) + ' 个' }),
          ),
          status && status.lastError ? h('p', { style: { ...s.note, ...s.bad }, children: '最近错误：' + status.lastError }) : null,
          status && status.configProblem ? h('p', { style: { ...s.note, ...s.bad }, children: '配置问题：' + status.configProblem }) : null,
          status && status.running && status.link && status.link.status === 'reconnecting'
            ? h('p', { style: s.note, children: '一直重连？点「启动 NapCat」或直接点上面的「启动」（会自动拉起 NapCat）；再检查 access_token 与 NapCat 的 onebot11 配置是否一致。' })
            : null,
          h(Row, { label: 'NapCat' },
            h('span', { style: status && status.napcat && status.napcat.reachable ? s.good : s.note, children: status && status.napcat ? (status.napcat.reachable ? '端口可达' : '未启动') : '—' }),
            h('button', { style: s.btn, disabled: busy, onClick: launchNapcat, children: '启动 NapCat' }),
          ),
          h(Row, { label: '当前模型' },
            h('span', { children: modelInfo ? modelInfo.provider + ' / ' + modelInfo.model + (modelInfo.source === 'settings' ? '（设置）' : '（跟随会话）') : '—' }),
            h('button', { style: s.btn, disabled: check && check.running, onClick: testModel, children: check && check.running ? '测试中…' : '测试模型' }),
          ),
          check && !check.running
            ? h('p', { style: check.ok ? { ...s.note, ...s.good } : { ...s.note, ...s.bad }, children: check.ok ? '模型可用（' + check.latencyMs + ' ms）：' + (check.reply || '') : '模型调用失败：' + (check.error || '未知错误') })
            : null,
        ),

        h('div', { style: { ...s.card, display: tab === 'basic' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '人设与搭话' }),
          h('div', { style: s.row },
            h('span', { style: s.label, children: '人设/性格' }),
            h('textarea', { style: s.area, value: settings.persona, placeholder: '你是群里的鲸鱼娘……（留空用默认）', onChange: function (e) { setSettings({ ...settings, persona: e.target.value }); } }),
          ),
          h(Row, { label: '搭话模式' },
            h('select', { style: s.input, value: settings.mode, onChange: function (e) { setSettings({ ...settings, mode: e.target.value }); } },
              h('option', { value: 'passive', children: '被动（只回 @ / 叫名字）' }),
              h('option', { value: 'proactive', children: '主动（会插话、会主动开口）' }),
            ),
          ),
          h(Row, { label: '群聊模型' },
            h('select', { style: s.input, value: settings.model.provider, onChange: function (e) {
              const p = providers.find(function (x) { return x.provider === e.target.value; });
              setSettings({ ...settings, model: { provider: e.target.value, model: p && p.models[0] ? p.models[0].id : '' } });
            } },
              h('option', { value: '', children: '跟随当前会话模型' }),
              providers.map(function (p) { return h('option', { key: p.provider, value: p.provider, children: p.name || p.provider }); }),
            ),
            h('select', { style: s.input, value: settings.model.model, disabled: !provider, onChange: function (e) { setSettings({ ...settings, model: { provider: settings.model.provider, model: e.target.value } }); } },
              (provider ? provider.models : []).map(function (m) { return h('option', { key: m.id, value: m.id, children: m.name || m.id }); }),
            ),
          ),
          h(Row, { label: '推理档位' },
            h('select', { style: s.input, value: settings.reasoningEffort || '', onChange: function (e) { setSettings({ ...settings, reasoningEffort: e.target.value }); } },
              h('option', { value: '', children: '自动（模型默认）' }),
              efforts.map(function (eff) {
                return h('option', { key: eff.id, value: eff.id, children: eff.name + (eff.description ? ' · ' + eff.description : '') });
              }),
            ),
            h('span', { style: s.note, children: efforts.length > 0 ? '可选：' + efforts.map(function (x) { return x.id; }).join(' / ') : '当前模型没有可调档位' }),
          ),
          h(Row, { label: '备用模型' },
            h('select', { style: s.input, value: fallbackRef.provider, onChange: function (e) {
              const p = providers.find(function (x) { return x.provider === e.target.value; });
              setSettings({ ...settings, fallbackModel: { provider: e.target.value, model: p && p.models[0] ? p.models[0].id : '' } });
            } },
              h('option', { value: '', children: '不设备用' }),
              providers.map(function (p) { return h('option', { key: p.provider, value: p.provider, children: p.name || p.provider }); }),
            ),
            h('select', { style: s.input, value: fallbackRef.model, disabled: !fallbackProvider, onChange: function (e) { setSettings({ ...settings, fallbackModel: { provider: fallbackRef.provider, model: e.target.value } }); } },
              (fallbackProvider ? fallbackProvider.models : []).map(function (m) { return h('option', { key: m.id, value: m.id, children: m.name || m.id }); }),
            ),
            h('span', { style: s.note, children: '主模型空回复/只回 reasoning 时自动切一次' }),
          ),
        ),

        h('div', { style: { ...s.card, display: tab === 'basic' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '模型用量与积分' }),
          h('p', { style: s.note, children: '按 DSH 每次调用返回的 token 统计；积分按你填的单价估算，不是官方余额。' }),
          h(Row, { label: '统计范围' },
            h('select', { style: s.input, value: usageScope, onChange: function (e) { setUsageScope(e.target.value); setUsageDay(''); } },
              h('option', { value: 'current', children: '当前模型' }),
              h('option', { value: 'all', children: '全部模型' }),
            ),
            h('button', { style: s.btn, onClick: function () { void loadUsage(usageScope, usageMonth); }, children: '刷新' }),
            usage && usage.model ? h('span', { style: s.note, children: usage.model.key }) : null,
          ),
          usage ? h('div', null,
            h('p', { style: s.note, children: '今日：' + usage.totals.today.calls + ' 次 · ' + fmtNum(usage.totals.today.totalTokens) + ' tokens · ' + fmtCredits(usage.totals.today.credits) + ' 积分' }),
            h('p', { style: s.note, children: '近 7 天：' + usage.totals.week.calls + ' 次 · ' + fmtNum(usage.totals.week.totalTokens) + ' tokens · ' + fmtCredits(usage.totals.week.credits) + ' 积分' }),
            h('p', { style: s.note, children: '本月：' + usage.totals.month.calls + ' 次 · ' + fmtNum(usage.totals.month.totalTokens) + ' tokens · ' + fmtCredits(usage.totals.month.credits) + ' 积分' }),
            h('p', { style: s.note, children: '累计：' + usage.totals.all.calls + ' 次 · ' + fmtNum(usage.totals.all.totalTokens) + ' tokens · ' + fmtCredits(usage.totals.all.credits) + ' 积分' }),
            h(Row, { label: '积分单价' },
              h('input', { style: s.input, value: rateInput, placeholder: '每百万 token 积分', onChange: function (e) { setRateInput(e.target.value); } }),
              h('button', { style: s.btn, onClick: saveRate, children: '保存单价' }),
              h('span', { style: s.note, children: '只影响估算，不改历史 token' }),
            ),
            h(Row, { label: '余额' },
              h('input', { style: s.input, value: balanceInput, placeholder: '当前剩余积分', onChange: function (e) { setBalanceInput(e.target.value); } }),
              h('button', { style: s.btn, onClick: saveBalance, children: '记录余额' }),
              h('span', { style: s.note, children: usage.balance ? '剩余 ' + fmtCredits(usage.balance.remaining) + ' · 已用 ' + fmtCredits(usage.balance.consumedSince) + '（自 ' + new Date(usage.balance.setAt).toLocaleString() + ' 起）' : '未记录余额' }),
            ),
            h('div', { style: s.row },
              h('button', { style: s.btn, onClick: function () { setUsageOpen(!usageOpen); }, children: usageOpen ? '收起统计日历' : '展开统计日历' }),
              usageOpen ? h('button', { style: s.btn, onClick: function () { shiftUsageMonth(-1); }, children: '‹ 上月' }) : null,
              usageOpen ? h('span', { style: { fontSize: '13px' }, children: usageMonth }) : null,
              usageOpen ? h('button', { style: s.btn, onClick: function () { shiftUsageMonth(1); }, children: '下月 ›' }) : null,
            ),
            usageOpen ? h('div', { style: { marginTop: '8px' } },
              h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' } },
                ['日', '一', '二', '三', '四', '五', '六'].map(function (w) {
                  return h('div', { key: 'w' + w, style: { fontSize: '11px', textAlign: 'center', opacity: 0.6 } }, w);
                }),
                Array.from({ length: usageMeta.first }, function (_, i) { return h('div', { key: 'e' + i }); }),
                Array.from({ length: usageMeta.last }, function (_, i) {
                  const day = i + 1;
                  const key = usageMonth + '-' + String(day).padStart(2, '0');
                  const item = usageDayMap[key];
                  return h('div', {
                    key,
                    onClick: function () { setUsageDay(key); },
                    style: {
                      border: '1px solid var(--dsw-alias-border-l2)',
                      borderRadius: '6px',
                      padding: '4px',
                      minHeight: '38px',
                      cursor: 'pointer',
                      background: item ? 'rgba(80,140,255,0.18)' : 'transparent',
                    },
                  },
                    h('div', { style: { fontSize: '11px' }, children: String(day) }),
                    item ? h('div', { style: { fontSize: '10px', opacity: 0.8 }, children: fmtCredits(item.credits) }) : null,
                  );
                }),
              ),
              selectedUsageDay ? h('div', { style: { marginTop: '8px', fontSize: '12px' } },
                h('div', { children: selectedUsageDay.day + '：' + selectedUsageDay.calls + ' 次 · ' + fmtNum(selectedUsageDay.totalTokens) + ' tokens · ' + fmtCredits(selectedUsageDay.credits) + ' 积分' }),
                Object.entries(selectedUsageDay.purposes || {}).map(function (pair) {
                  return h('div', { key: pair[0], style: s.note, children: pair[0] + '：' + pair[1].calls + ' 次 · ' + fmtNum(pair[1].totalTokens) + ' tokens · ' + fmtCredits(pair[1].credits) + ' 积分' });
                }),
              ) : null,
            ) : null,
            usageScope === 'all' && usage.byModel.length > 0 ? h('div', { style: { marginTop: '8px' } },
              h('div', { style: s.note, children: '按模型：' }),
              usage.byModel.map(function (m) {
                return h('div', { key: m.key, style: { ...s.row, marginTop: '4px' } },
                  h('span', { style: { flex: '1 1 220px', fontSize: '12px' }, children: m.key + '：' + m.calls + ' 次 · ' + fmtNum(m.totalTokens) + ' tokens · ' + fmtCredits(m.credits) + ' 积分' }),
                  h('input', { style: { ...s.input, maxWidth: '120px' }, defaultValue: String((usage.rates && usage.rates[m.key]) || 0), onBlur: function (e) { void saveRateFor(m.key, e.target.value); } }),
                  h('span', { style: s.note, children: '积分/百万 token' }),
                );
              }),
            ) : null,
          ) : h('p', { style: s.note, children: '还没有用量记录；等下一次模型调用后刷新。' }),
        ),

        h('div', { style: { ...s.card, display: tab === 'chat' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '聊天频率（按群设置）' }),
          h(Row, { label: '添加群' },
            h('input', { style: s.input, placeholder: '群号（5~12 位数字）', value: newGroupId, onChange: function (e) { setNewGroupId(e.target.value); } }),
            h('button', { style: s.btn, disabled: busy, onClick: addGroup, children: '添加' }),
          ),
          h(Row, { label: '群' },
            h('select', { style: s.input, value: groupId, onChange: function (e) { pickGroup(e.target.value); } },
              groupIds.map(function (id) { return h('option', { key: id, value: id, children: (groups[id] && groups[id].name ? groups[id].name : id) + '（' + id + '）' }); }),
              groupIds.length === 0 ? h('option', { value: '', children: '（还没有群）' }) : null,
            ),
          ),
          policy ? h('div', null,
            h(Row, { label: '评分阈值' },
              h('input', { style: s.input, type: 'number', min: '0', max: '100', value: policy.scoreThreshold || 0, onChange: function (e) { setP('scoreThreshold', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '0~100：分数达到阈值才进入候选；真正概率 = 分数/100' }),
            ),
            h(Row, { label: '关键词接话' },
              h('textarea', {
                style: { ...s.area, minHeight: '68px' },
                value: mapText(policy.keywordChances),
                placeholder: 'deepseek=85\n鲸鱼=90\n大肥鱼=90',
                onChange: function (e) { setP('keywordChances', parseMap(e.target.value)); },
              }),
            ),
            h(Row, { label: '成员接话' },
              h('textarea', {
                style: { ...s.area, minHeight: '52px' },
                value: mapText(policy.memberChances),
                placeholder: '123456789=80（QQ号=概率%）',
                onChange: function (e) { setP('memberChances', parseMap(e.target.value)); },
              }),
            ),
            h(Row, { label: '兴奋期' },
              h('input', { style: s.input, type: 'number', min: '0', max: '100', value: Math.round((policy.engagedChance || 0) * 100), onChange: function (e) { setP('engagedChance', Number(e.target.value) / 100); } }),
              h('span', { style: s.note, children: '% / 持续' }),
              h('input', { style: s.input, type: 'number', min: '1', value: policy.engageMinutes || 10, onChange: function (e) { setP('engageMinutes', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '分钟（刚被 @/叫名字后）' }),
            ),
            h(Row, { label: '模型接话判断' },
              h('input', { type: 'checkbox', checked: policy.llmGate !== false, onChange: function (e) { setP('llmGate', e.target.checked); } }),
              h('span', { style: s.note, children: '闲聊命中后，让模型读最近聊天再决定插不插（v2 闸门，多一次调用）' }),
            ),
            h(Row, { label: '冷却（秒）' },
              h('input', { style: s.input, type: 'number', min: '0', value: Math.round((policy.cooldownMs || 0) / 1000), onChange: function (e) { setP('cooldownMs', Number(e.target.value) * 1000); } }),
            ),
            h(Row, { label: '10 分钟上限' },
              h('input', { style: s.input, type: 'number', min: '0', value: policy.maxRepliesPer10Min || 0, onChange: function (e) { setP('maxRepliesPer10Min', Number(e.target.value)); } }),
            ),
            h(Row, { label: '直接回复上限' },
              h('input', { style: s.input, type: 'number', min: '0', value: policy.maxDirectRepliesPer10Min || 0, onChange: function (e) { setP('maxDirectRepliesPer10Min', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '10 分钟；@/叫名字/引用/接着聊单独计数' }),
            ),
            h(Row, { label: '连发条数' },
              h('input', { style: s.input, type: 'number', min: '1', value: (policy.burst && policy.burst.min) || 1, onChange: function (e) { setNested('burst', 'min', Number(e.target.value)); } }),
              h('span', { children: '~' }),
              h('input', { style: s.input, type: 'number', min: '1', value: (policy.burst && policy.burst.max) || 1, onChange: function (e) { setNested('burst', 'max', Number(e.target.value)); } }),
            ),
            h(Row, { label: '连发间隔（毫秒）' },
              h('input', { style: s.input, type: 'number', min: '0', value: (policy.burst && policy.burst.gapMs && policy.burst.gapMs[0]) || 0, onChange: function (e) { setNested('burst', 'gapMs', [Number(e.target.value), (policy.burst && policy.burst.gapMs && policy.burst.gapMs[1]) || Number(e.target.value)]); } }),
              h('span', { children: '~' }),
              h('input', { style: s.input, type: 'number', min: '0', value: (policy.burst && policy.burst.gapMs && policy.burst.gapMs[1]) || 0, onChange: function (e) { setNested('burst', 'gapMs', [(policy.burst && policy.burst.gapMs && policy.burst.gapMs[0]) || 0, Number(e.target.value)]); } }),
            ),
            h(Row, { label: '冷场主动开口' },
              h('input', { type: 'checkbox', checked: !!(policy.proactive && policy.proactive.enabled), onChange: function (e) { setNested('proactive', 'enabled', e.target.checked); } }),
              h('span', { style: s.note, children: '安静多少分钟算冷场' }),
              h('input', { style: s.input, type: 'number', min: '1', value: Math.round(((policy.proactive && policy.proactive.minIdleMs) || 0) / 60000), onChange: function (e) { setNested('proactive', 'minIdleMs', Number(e.target.value) * 60000); } }),
            ),
            h(Row, { label: '首次延迟（分钟）' },
              h('input', { style: s.input, type: 'number', min: '1', value: Math.round(((policy.proactive && policy.proactive.firstDelayMs) || 0) / 60000), onChange: function (e) { setNested('proactive', 'firstDelayMs', Number(e.target.value) * 60000); } }),
              h('span', { style: s.note, children: '冷场后第一次主动开口的等待时间' }),
            ),
            h(Row, { label: '连续冷场增长' },
              h('input', { style: s.input, type: 'number', min: '1', step: '0.05', value: (policy.proactive && policy.proactive.growth) || 1.2, onChange: function (e) { setNested('proactive', 'growth', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '每次主动没人理，下次等待 × 这个倍数' }),
            ),
            h(Row, { label: '最长间隔（分钟）' },
              h('input', { style: s.input, type: 'number', min: '1', value: Math.round(((policy.proactive && policy.proactive.maxDelayMs) || 0) / 60000), onChange: function (e) { setNested('proactive', 'maxDelayMs', Number(e.target.value) * 60000); } }),
            ),
            h(Row, { label: '主动上限（次/天）' },
              h('input', { style: s.input, type: 'number', min: '0', value: (policy.proactive && policy.proactive.maxPerDay) || 0, onChange: function (e) { setNested('proactive', 'maxPerDay', Number(e.target.value)); } }),
            ),
            h(Row, { label: '语音/唱歌概率' },
              h('input', { style: s.input, type: 'number', min: '0', max: '100', value: Math.round((policy.voiceChance || 0) * 100), onChange: function (e) { setP('voiceChance', Number(e.target.value) / 100); } }),
              h('input', { style: s.input, type: 'number', min: '0', max: '100', value: Math.round((policy.singChance || 0) * 100), onChange: function (e) { setP('singChance', Number(e.target.value) / 100); } }),
            ),
            h(Row, { label: '表情包' },
              h('input', { type: 'checkbox', checked: !!policy.imageEnabled, onChange: function (e) { setP('imageEnabled', e.target.checked); } }),
              h('span', { style: s.note, children: '允许发；概率' }),
              h('input', { style: s.input, type: 'number', min: '0', max: '100', value: Math.round((policy.imageChance || 0) * 100), onChange: function (e) { setP('imageChance', Number(e.target.value) / 100); } }),
              h('span', { style: s.note, children: '%' }),
            ),
          ) : h('p', { style: s.note, children: '这个群还没有策略。' }),
        ),

        h('div', { style: { ...s.card, display: tab === 'stickers' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '表情包' }),
          h(Row, { label: '看图策略' },
            h('select', { style: s.input, value: (policy && policy.imageView) || 'custom', onChange: function (e) { setP('imageView', e.target.value); } },
              h('option', { value: 'off', children: '关闭（所有图都不看，省 token）' }),
              h('option', { value: 'custom', children: '自定义（下面多选）' }),
              h('option', { value: 'all', children: '所有图片都看（最耗 token）' }),
            ),
          ),
          policy && policy.imageView === 'custom' ? h(Row, { label: '看图条件' },
            [['at', '@ / 叫名字 / 引用她'], ['context', '强相关上下文'], ['question', '文字里问她看法']].map(function (item) {
              const modes = policy.imageViewModes || [];
              return h('label', { key: item[0], style: { display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '10px', fontSize: '13px' } },
                h('input', {
                  type: 'checkbox',
                  checked: modes.indexOf(item[0]) >= 0,
                  onChange: function (e) {
                    const next = e.target.checked
                      ? Array.from(new Set(modes.concat(item[0])))
                      : modes.filter(function (m) { return m !== item[0]; });
                    setP('imageViewModes', next);
                  },
                }),
                item[1],
              );
            }),
          ) : null,
          h(Row, { label: '自动保存群友表情包' },
            h('input', { type: 'checkbox', checked: settings.stickerSave === true, onChange: function (e) { setSettings({ ...settings, stickerSave: e.target.checked }); } }),
            h('span', { style: s.note, children: '打开后，群友发的图片会存进本地素材库；关掉就完全不下载' }),
          ),
          h(Row, { label: '最多保留' },
            h('input', { style: s.input, type: 'number', min: '20', max: '2000', value: settings.stickerMax || 300, onChange: function (e) { setSettings({ ...settings, stickerMax: Number(e.target.value) }); } }),
            h('span', { style: s.note, children: '张' }),
            h('input', { style: s.input, type: 'number', min: '20', max: '5000', value: settings.stickerMaxMB || 200, onChange: function (e) { setSettings({ ...settings, stickerMaxMB: Number(e.target.value) }); } }),
            h('span', { style: s.note, children: 'MB（超过删最旧的；单张 ≤2 MB）' }),
          ),
          h('p', { style: s.note, children: '素材库：' + stickers.length + ' 张' + (stickers.length > 0 ? '（' + stickers.slice(0, 8).join('、') + (stickers.length > 8 ? '…' : '') + '）' : '') }),
          stickerItems.length > 0 ? h('div', { style: { marginTop: '6px' } },
            stickerItems.slice(0, 8).map(function (item) {
              return h('div', { key: item.file, style: { fontSize: '12px', opacity: 0.85 } },
                item.file + ' · ' + (item.description || '未分类') + (item.tags && item.tags.length > 0 ? '（' + item.tags.join('/') + '）' : ''),
              );
            }),
          ) : null,
          h('p', { style: s.note, children: '新保存的表情包会根据当时的聊天上下文猜含义，并按「时间-含义-hash」重命名；猜不出含义的「未分类」不会被拿去乱发。' }),
          h(Row, { label: '素材库文件夹' },
            h('span', { style: s.note, children: stickerDir || '（加载中）' }),
            h('button', { style: s.btn, onClick: openStickerDir, children: '打开文件夹' }),
            h('button', { style: s.btn, onClick: function () { void loadStickers(); }, children: '刷新' }),
          ),
          h('p', { style: s.note, children: '所有群共用这一个表情包仓库；你可以直接在里面增删文件，刷新后生效。' }),
        ),

        h('div', { style: { ...s.card, display: tab === 'voice' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '语音（edge-tts，无需显卡）' }),
          h('p', { style: s.note, children: '回复/主动开口时把文字合成 QQ 语音；音色和参数是全局的，概率按群。' }),
          h(Row, { label: '群' },
            h('select', { style: s.input, value: groupId, onChange: function (e) { pickGroup(e.target.value); } },
              groupIds.map(function (id) { return h('option', { key: id, value: id, children: (groups[id] && groups[id].name ? groups[id].name : id) + '（' + id + '）' }); }),
            ),
          ),
          h(Row, { label: '音色' },
            h('select', { style: s.input, value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts && cfg.qq.config.tts.voice) || DEFAULT_VOICE, onChange: function (e) { setTts({ voice: e.target.value }); } },
              voiceList.map(function (v) { return h('option', { key: v.id, value: v.id, children: v.label + '（' + v.id + '）' }); }),
            ),
            h('button', { style: s.btn, onClick: exportVoices, children: '导出' }),
            h('label', { style: { ...s.btn, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' } },
              '导入',
              h('input', { type: 'file', accept: '.json,.txt', style: { display: 'none' }, onChange: importVoices }),
            ),
            h('button', { style: s.btn, onClick: deleteVoice, children: '删除当前' }),
          ),
          h('p', { style: s.note, children: '内置音色不可删除；导入的是 edge-tts 音色条目（JSON 或一行一个 id=名称），导入后点保存生效。' }),
          h(Row, { label: '语速 / 音调 / 音量' },
            h('input', { style: s.input, value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts && cfg.qq.config.tts.rate) || '', placeholder: '+0%', onChange: function (e) { setTts({ rate: e.target.value }); } }),
            h('input', { style: s.input, value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts && cfg.qq.config.tts.pitch) || '', placeholder: '+0Hz', onChange: function (e) { setTts({ pitch: e.target.value }); } }),
            h('input', { style: s.input, value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts && cfg.qq.config.tts.volume) || '', placeholder: '+0%', onChange: function (e) { setTts({ volume: e.target.value }); } }),
          ),
          h(Row, { label: '语气预设' },
            h('button', { style: s.btn, onClick: function () { setTts({ rate: '+0%', pitch: '+0Hz', volume: '+0%' }); }, children: '自然' }),
            h('button', { style: s.btn, onClick: function () { setTts({ rate: '+8%', pitch: '+15Hz', volume: '+0%' }); }, children: '开心' }),
            h('button', { style: s.btn, onClick: function () { setTts({ rate: '-5%', pitch: '+25Hz', volume: '-5%' }); }, children: '撒娇' }),
            h('button', { style: s.btn, onClick: function () { setTts({ rate: '-12%', pitch: '-10Hz', volume: '-5%' }); }, children: '低落' }),
          ),
          h(Row, { label: '试听' },
            h('button', { style: s.btn, disabled: preview && preview.loading, onClick: previewVoice, children: preview && preview.loading ? '合成中…' : '试听这段' }),
            preview && preview.url ? h('audio', { controls: true, src: preview.url, style: { height: '30px', maxWidth: '260px' } }) : null,
            h('span', { style: s.note, children: '用当前未保存的参数试听；先保存后群聊才会用' }),
          ),
          policy ? h('div', null,
            h(Row, { label: '回复语音概率' },
              h('input', { style: s.input, type: 'number', min: '0', max: '100', value: Math.round((policy.voiceChance || 0) * 100), onChange: function (e) { setP('voiceChance', Number(e.target.value) / 100); } }),
              h('span', { style: s.note, children: '%（模型选择发语音时真的发）' }),
            ),
            h(Row, { label: '主动语音概率' },
              h('input', { style: s.input, type: 'number', min: '0', max: '100', value: Math.round((policy.proactiveVoiceChance || 0) * 100), onChange: function (e) { setP('proactiveVoiceChance', Number(e.target.value) / 100); } }),
              h('span', { style: s.note, children: '%（主动开口时改成语音）' }),
            ),
          ) : h('p', { style: s.note, children: '先在上面选一个群。' }),
        ),

        h('div', { style: { ...s.card, display: tab === 'diary' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '鲸鱼娘的日记' }),
          h('p', { style: s.note, children: '群聊记忆与内心吐槽（模型的 thought，不会发到群里）；带评分、熟识度、好感度。' }),
          h(Row, { label: '群' },
            h('select', { style: s.input, value: diaryGroup, onChange: function (e) { pickDiaryGroup(e.target.value); } },
              h('option', { value: '', children: '全部群' }),
              groupIds.map(function (id) { return h('option', { key: id, value: id, children: (groups[id] && groups[id].name ? groups[id].name : id) + '（' + id + '）' }); }),
            ),
          ),
          h(Row, { label: '成员' },
            h('select', { style: s.input, value: diaryUser, onChange: function (e) { setDiaryUser(e.target.value); } },
              h('option', { value: '', children: '全部成员' }),
              members.map(function (m) {
                return h('option', { key: m.qq, value: m.qq, children: (m.name || m.qq) + ' · 熟识 ' + m.familiarity + ' · 好感 ' + m.affinity });
              }),
            ),
          ),
          h(Row, { label: '日期' },
            h('input', { style: s.input, type: 'date', value: diaryFrom, onChange: function (e) { setDiaryFrom(e.target.value); } }),
            h('span', { style: s.note, children: '到' }),
            h('input', { style: s.input, type: 'date', value: diaryTo, onChange: function (e) { setDiaryTo(e.target.value); } }),
            h('select', { style: s.input, value: diaryOrder, onChange: function (e) { setDiaryOrder(e.target.value); } },
              h('option', { value: 'desc', children: '最新在前' }),
              h('option', { value: 'asc', children: '最早在前' }),
            ),
          ),
          h('div', { style: s.row },
            h('button', { style: s.btn, onClick: function () { void loadDiary(diaryGroup, diaryUser); }, children: '刷新' }),
            h('button', { style: s.btn, onClick: function () { void exportDiary(); }, children: '导出' }),
            h('button', { style: s.btn, onClick: deleteDiary, children: '删除当前筛选' }),
            h('span', { style: s.note, children: '共 ' + diary.length + ' 条' }),
          ),
          diary.length === 0 ? h('p', { style: s.note, children: '还没有记录。' }) : h('div', null,
            diary.map(function (entry) {
              const meta = [new Date(entry.ts).toLocaleString(), entry.groupId || '', entry.user || '']
                .filter(function (x) { return x !== ''; })
                .join(' · ');
              const stats = [
                typeof entry.score === 'number' ? '评分 ' + entry.score : '',
                typeof entry.familiarity === 'number' ? '熟识 ' + Math.round(entry.familiarity) : '',
                typeof entry.affinity === 'number' ? '好感 ' + Math.round(entry.affinity) : '',
              ].filter(function (x) { return x !== ''; }).join(' · ');
              return h('div', { key: String(entry.ts) + entry.reply.slice(0, 8), style: { padding: '10px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)', fontSize: '13px', lineHeight: '20px' } },
                h('div', { style: s.note, children: meta + (stats ? ' · ' + stats : '') }),
                entry.incoming ? h('div', { children: '群友：' + entry.incoming }) : null,
                entry.context ? h('div', { style: s.note, children: '上下文：' + entry.context.slice(-240) }) : null,
                h('div', { children: '她：' + entry.reply }),
                h('div', { style: { ...s.note, color: 'var(--dsw-alias-label-secondary)' }, children: '内心：' + entry.thought }),
                Array.isArray(entry.reasons) && entry.reasons.length > 0
                  ? h('div', { style: s.note, children: '评分理由：' + entry.reasons.join('；') })
                  : null,
                h('button', { style: { ...s.btn, fontSize: '11px', padding: '3px 8px', marginTop: '6px' }, onClick: function () { void deleteEntry(entry.ts); }, children: '删除这条' }),
              );
            }),
          ),
        ),

        h('div', { style: { ...s.card, display: tab === 'lists' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '名单与主人' }),
          h('p', { style: s.note, children: '按 QQ 号，一行一个。白名单把价值评分至少抬到下限；黑名单把评分压到上限。主人和白名单的初始好感分别是 +60 / +20。' }),
          h(Row, { label: '主人 QQ' },
            h('input', { style: s.input, value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.ownerQq) || '', placeholder: '主人的 QQ 号', onChange: function (e) { setCfg({ ...cfg, qq: { ...cfg.qq, config: { ...cfg.qq.config, ownerQq: e.target.value } } }); } }),
            h('span', { style: s.note, children: '用来识别主人，初始好感 +60' }),
          ),
          h(Row, { label: '白名单' },
            h('textarea', { style: { ...s.area, minHeight: '60px' }, value: (settings.whitelist || []).join('\n'), placeholder: 'QQ号，一行一个', onChange: function (e) { setSettings({ ...settings, whitelist: e.target.value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean) }); } }),
            h('span', { style: s.note, children: '下限' }),
            h('input', { style: s.input, type: 'number', min: '0', max: '100', value: settings.whitelistFloor || 0, onChange: function (e) { setSettings({ ...settings, whitelistFloor: Number(e.target.value) }); } }),
          ),
          h(Row, { label: '黑名单' },
            h('textarea', { style: { ...s.area, minHeight: '60px' }, value: (settings.blacklist || []).join('\n'), placeholder: 'QQ号，一行一个', onChange: function (e) { setSettings({ ...settings, blacklist: e.target.value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean) }); } }),
            h('span', { style: s.note, children: '上限' }),
            h('input', { style: s.input, type: 'number', min: '0', max: '100', value: settings.blacklistCeil || 0, onChange: function (e) { setSettings({ ...settings, blacklistCeil: Number(e.target.value) }); } }),
          ),
          h(Row, { label: '被怼时扣好感' },
            h('input', { type: 'checkbox', checked: settings.hostilityJudge !== false, onChange: function (e) { setSettings({ ...settings, hostilityJudge: e.target.checked }); } }),
            h('span', { style: s.note, children: '让模型判断嘲讽/阴阳/辱骂；轻度 -2，明确辱骂 -4' }),
          ),
        ),

        h('div', { style: { ...s.card, display: tab === 'night' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '夜间免打扰' }),
          h('p', { style: s.note, children: '命中时段时，接话价值评分 -20；不是完全禁言，避免错过点名。' }),
          h(Row, { label: '夜间免打扰' },
            h('input', { type: 'checkbox', checked: !!(settings.nightDnd && settings.nightDnd.enabled), onChange: function (e) { setSettings({ ...settings, nightDnd: { ...(settings.nightDnd || {}), enabled: e.target.checked } }); } }),
            h('input', { style: s.input, type: 'number', min: '0', max: '23', value: (settings.nightDnd && settings.nightDnd.startHour) || 23, onChange: function (e) { setSettings({ ...settings, nightDnd: { ...(settings.nightDnd || {}), startHour: Number(e.target.value) } }); } }),
            h('span', { style: s.note, children: '点到' }),
            h('input', { style: s.input, type: 'number', min: '0', max: '23', value: (settings.nightDnd && settings.nightDnd.endHour) || 8, onChange: function (e) { setSettings({ ...settings, nightDnd: { ...(settings.nightDnd || {}), endHour: Number(e.target.value) } }); } }),
            h('span', { style: s.note, children: '点（跨午夜也支持）' }),
          ),
          h(Row, { label: '命中扣分' },
            h('input', { style: s.input, type: 'number', min: '0', max: '100', value: settings.nightPenalty === undefined ? 20 : settings.nightPenalty, onChange: function (e) { setSettings({ ...settings, nightPenalty: Number(e.target.value) }); } }),
            h('span', { style: s.note, children: '分（0 = 命中也不扣分）' }),
          ),
        ),

        h('div', { style: { ...s.card, display: tab === 'connect' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '连接（OneBot / NapCat）' }),
          h(Row, { label: 'WebSocket' }, h('input', { style: s.input, value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.url) || '', onChange: function (e) { setCfg({ ...cfg, qq: { ...cfg.qq, config: { ...cfg.qq.config, url: e.target.value } } }); } })),
          h(Row, { label: 'access_token' }, h('input', { style: s.input, value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.token) || '', onChange: function (e) { setCfg({ ...cfg, qq: { ...cfg.qq, config: { ...cfg.qq.config, token: e.target.value } } }); } })),
          cfg && cfg.qq && cfg.qq.config && cfg.qq.config.token === ''
            ? h('p', { style: { ...s.note, ...s.bad }, children: 'access_token 为空：NapCat 配了 token 时会一直重连（从 NapCat 的 onebot11 配置里复制过来）。' })
            : null,
          h(Row, { label: '机器人自称' }, h('input', { style: s.input, value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.selfName) || '', onChange: function (e) { setCfg({ ...cfg, qq: { ...cfg.qq, config: { ...cfg.qq.config, selfName: e.target.value } } }); } })),
          h(Row, { label: '自动连接' },
            h('input', { type: 'checkbox', checked: settings.autoStart !== false, onChange: function (e) { setSettings({ ...settings, autoStart: e.target.checked }); } }),
            h('span', { style: s.note, children: 'DSH 启动时自动连 NapCat；关掉就只在你点「启动」时连' }),
          ),
          h(Row, { label: 'NapCat 脚本' },
            h('input', { style: s.input, value: settings.napcatLauncher || '', onChange: function (e) { setSettings({ ...settings, napcatLauncher: e.target.value }); } }),
          ),
          h(Row, { label: '自动拉起 NapCat' },
            h('input', { type: 'checkbox', checked: settings.autoLaunchNapcat !== false, onChange: function (e) { setSettings({ ...settings, autoLaunchNapcat: e.target.checked }); } }),
            h('span', { style: s.note, children: '点「启动」时如果端口不通，就运行上面的脚本并等它就绪' }),
          ),
          h(Row, { label: '退出后清理 Cookie' },
            h('input', { type: 'checkbox', checked: settings.cookieWatch !== false, onChange: function (e) { setSettings({ ...settings, cookieWatch: e.target.checked }); } }),
            h('span', { style: s.note, children: 'DSH 完全退出后，若 127.0.0.1 的认证 cookie ≥20 条就自动清理（Windows）' }),
          ),
        ),

        h('div', { style: { ...s.row, marginTop: '16px' } },
          h('button', { style: { ...s.btn, ...s.primary }, disabled: busy, onClick: save, children: '保存全部' }),
          message ? h('span', { style: s.note, children: message }) : null,
        ),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('settings.section', function* () {
          yield ctx.slots.register(
            { name: 'settings.section', id: 'dsh-qq-group', order: 31, label: function () { return 'QQ 群聊'; } },
            Page,
          );
        });
      },
    };
  },
});
