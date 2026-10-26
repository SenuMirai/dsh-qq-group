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
      grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px 12px', marginTop: '8px' },
      field: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minHeight: '34px', padding: '5px 8px', borderRadius: '8px', background: 'rgba(127,127,127,.055)' },
      fieldLabel: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', flex: '1 1 auto', lineHeight: '1.35' },
      unit: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)', whiteSpace: 'nowrap' },
      fieldInput: { width: '82px', flex: '0 0 82px', boxSizing: 'border-box', padding: '5px 6px', borderRadius: '6px', border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-1)', color: 'var(--dsw-alias-label-primary)', fontSize: '12px', textAlign: 'center' },
      fieldInputWide: { width: '140px', flex: '0 0 140px', boxSizing: 'border-box', padding: '5px 6px', borderRadius: '6px', border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-1)', color: 'var(--dsw-alias-label-primary)', fontSize: '12px' },
      section: { marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--dsw-alias-border-l2)' },
      sectionTitle: { fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--dsw-alias-label-primary)' },
      sectionNote: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)', margin: '3px 0 0' },
      infoCard: { marginTop: '10px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(127,127,127,.07)', fontSize: '12px', lineHeight: '1.7', color: 'var(--dsw-alias-label-secondary)' },
      btn: { padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l2)', cursor: 'pointer' },
      primary: { background: 'var(--dsw-alias-state-business-primary)', color: '#fff', border: 'none' },
      bad: { color: 'var(--dsw-alias-state-error-primary)' },
      good: { color: 'var(--dsw-alias-state-success-primary)' },
    };

    function Row(props) {
      return h('div', { style: s.row }, h('span', { style: s.label, children: props.label }), props.children);
    }

    /** 紧凑数字字段：标签 + 小输入框 + 单位，避免整行拉满 */
    function NumberField(props) {
      return h('label', { style: s.field },
        h('span', { style: s.fieldLabel, children: props.label }),
        h('input', {
          style: props.wide ? s.fieldInputWide : s.fieldInput,
          type: 'number',
          ...(props.min === undefined ? {} : { min: String(props.min) }),
          ...(props.max === undefined ? {} : { max: String(props.max) }),
          ...(props.step === undefined ? {} : { step: String(props.step) }),
          value: props.value,
          onChange: function (e) { props.onChange(Number(e.target.value)); },
        }),
        props.unit ? h('span', { style: s.unit, children: props.unit }) : null,
      );
    }

    function Section(props, children) {
      const content = children === undefined ? props.children : children;
      return h('div', { style: s.section },
        h('h4', { style: s.sectionTitle, children: props.title }),
        props.note ? h('p', { style: s.sectionNote, children: props.note }) : null,
        h('div', { style: s.grid }, content),
      );
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
      const [settings, setSettings] = React.useState({ persona: '', personas: [], groupPersonaIds: {}, activePersonaId: '', mode: 'passive', model: { provider: '', model: '' }, stickerSave: false, autoStart: false, autoLaunchNapcat: true, napcatLauncher: 'C:\\DSHwork\\start-napcat.bat', whitelist: [], whitelistFloor: 95, blacklist: [], blacklistCeil: 5, nightDnd: { enabled: true, startHour: 23, endHour: 8 } });
      const [providers, setProviders] = React.useState([]);
      const [efforts, setEfforts] = React.useState([]);
      const [status, setStatus] = React.useState(null);
      const [modelWindow, setModelWindow] = React.useState(null);
      const [stickers, setStickers] = React.useState([]);
      const [stickerItems, setStickerItems] = React.useState([]);
      const [selfies, setSelfies] = React.useState([]);
      const [selfieDir, setSelfieDir] = React.useState('');
      const [selfieUploading, setSelfieUploading] = React.useState(false);
      const [rvcModels, setRvcModels] = React.useState([]);
      const [rvcDir, setRvcDir] = React.useState('');
      const [stickerDir, setStickerDir] = React.useState('');
      const [stickerRepos, setStickerRepos] = React.useState([]);
      const [stickerSelected, setStickerSelected] = React.useState([]);
      const [stickerTarget, setStickerTarget] = React.useState('');
      const [memoryData, setMemoryData] = React.useState(null);
      const [moodData, setMoodData] = React.useState(null);
      const [preview, setPreview] = React.useState(null);
      const [previewText, setPreviewText] = React.useState('主人，我是鲸鱼娘，今天也要开心呀。');
      const [ttsHealth, setTtsHealth] = React.useState(null);
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
      const [diaryHasMore, setDiaryHasMore] = React.useState(false);
      const [diaryLoadingMore, setDiaryLoadingMore] = React.useState(false);
      const [qzoneData, setQzoneData] = React.useState(null);
      const [qzoneDraft, setQzoneDraft] = React.useState('');
      const [qzoneBusy, setQzoneBusy] = React.useState(false);
      const [qzoneFrom, setQzoneFrom] = React.useState('');
      const [qzoneTo, setQzoneTo] = React.useState('');
      const [qzoneOrder, setQzoneOrder] = React.useState('desc');
      const [qzoneHasMore, setQzoneHasMore] = React.useState(false);
      const [qzoneLoadingMore, setQzoneLoadingMore] = React.useState(false);
      const [qzoneImages, setQzoneImages] = React.useState([]);
      const [qzoneRemote, setQzoneRemote] = React.useState(null);
      const [qzoneRemoteBusy, setQzoneRemoteBusy] = React.useState(false);
      const [qzoneRemoteUin, setQzoneRemoteUin] = React.useState('');
      const [hostVersion, setHostVersion] = React.useState(null);
      const [sessionNames, setSessionNames] = React.useState({ groups: {}, privates: {} });
      const [qrNonce, setQrNonce] = React.useState(0);
      const [qrError, setQrError] = React.useState('');
      const [groupId, setGroupId] = React.useState('');
      const [newGroupId, setNewGroupId] = React.useState('');
      const [newPrivateId, setNewPrivateId] = React.useState('');
      const [sessionToolsOpen, setSessionToolsOpen] = React.useState(false);
      const [memoryDraft, setMemoryDraft] = React.useState('');
      const [memoryEditing, setMemoryEditing] = React.useState(null);
      const [summaryDraft, setSummaryDraft] = React.useState('');
      const [permanentData, setPermanentData] = React.useState(null);
      const [permanentDraft, setPermanentDraft] = React.useState('');
      const [permanentSelected, setPermanentSelected] = React.useState([]);
      const [permanentBusy, setPermanentBusy] = React.useState(false);
      const [permanentScope, setPermanentScope] = React.useState('session');
      const [permanentPrivate, setPermanentPrivate] = React.useState(false);
      const [policy, setPolicy] = React.useState(null);
      const [check, setCheck] = React.useState(null);
      const [message, setMessage] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [tab, setTab] = React.useState('status');

      const loadConfig = React.useCallback(async function () {
        const [data, version] = await Promise.all([
          (await fetch(BASE + '/config', { cache: 'no-store' })).json(),
          fetch(BASE + '/version', { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return null; }),
        ]);
        setHostVersion(version);
        setCfg(data);
        setSettings(data.settings || {});
        const groups = (data.qq && data.qq.config && data.qq.config.groups) || {};
        const privates = (data.qq && data.qq.config && data.qq.config.privates) || {};
        // 会话列表 = 群 + 私聊。私聊在内部用 p:<QQ号> 作 key（与后端命名空间一致），
        // 这样所有「按当前会话取策略」的地方不用分两套逻辑。
        const ids = Object.keys(groups);
        const privateIds = Object.keys(privates).map(function (qq) { return 'p:' + qq; });
        const allIds = ids.concat(privateIds);
        const id = groupId && allIds.indexOf(groupId) >= 0 ? groupId : allIds[0] || '';
        setGroupId(id);
        setDiaryGroup(function (prev) { return prev === '' ? id : prev; });
        if (id.indexOf('p:') === 0) {
          setPolicy(privates[id.slice(2)] || null);
        } else {
          setPolicy(id ? groups[id] : (data.qq && data.qq.config && data.qq.config.defaultGroup) || null);
        }
      }, [groupId]);

      const loadSessionNames = React.useCallback(async function () {
        try {
          const data = await (await fetch(BASE + '/session-names', { cache: 'no-store' })).json();
          if (data.ok === true) {
            setSessionNames({ groups: data.groups || {}, privates: data.privates || {} });
          }
        } catch {
          /* NapCat 离线时忽略，保留现有名称 */
        }
      }, []);

      const loadStatus = React.useCallback(async function () {
        try {
          setStatus(await (await fetch(BASE + '/status', { cache: 'no-store' })).json());
        } catch {
          /* 忽略 */
        }
      }, []);

      const loadModelWindow = async function () {
        try {
          const sel = (settings.model && settings.model.provider) ? settings.model : ((status && status.model) || {});
          if (!sel.provider || !sel.model) {
            setModelWindow(null);
            return;
          }
          const data = await (await fetch(BASE + '/model-info?provider=' + encodeURIComponent(sel.provider) + '&model=' + encodeURIComponent(sel.model), { cache: 'no-store' })).json();
          const win = data && data.info && data.info.context && data.info.context.contextWindow;
          setModelWindow(typeof win === 'number' ? win : null);
        } catch {
          setModelWindow(null);
        }
      };

      const loadStickers = React.useCallback(async function () {
        try {
          const data = await (await fetch(BASE + '/stickers', { cache: 'no-store' })).json();
          setStickers(data.stickers || []);
          setStickerItems(data.items || []);
          setStickerDir(data.dir || '');
          setStickerRepos(data.repos || []);
          setStickerTarget(function (prev) {
            const list = data.repos || [];
            return prev && list.some(function (r) { return r.id === prev; }) ? prev : (list[0] && list[0].id) || '';
          });
        } catch {
          /* 忽略 */
        }
      }, []);

      const loadSelfies = React.useCallback(async function () {
        try {
          const data = await (await fetch(BASE + '/selfies', { cache: 'no-store' })).json();
          setSelfies(Array.isArray(data.items) ? data.items : []);
          setSelfieDir(data.dir || '');
        } catch {
          /* 忽略 */
        }
      }, []);

      const loadRvcModels = async function () {
        try {
          const data = await (await fetch(BASE + '/rvc/models', { cache: 'no-store' })).json();
          setRvcModels(Array.isArray(data.models) ? data.models : []);
          setRvcDir(data.dir || '');
          if (data.ok === false) setMessage(data.message || 'RVC 模型目录不可用');
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const openRvcDir = async function () {
        try {
          const data = await (await fetch(BASE + '/rvc/open', { method: 'POST' })).json();
          if (!data.ok) setMessage(data.message || '打开失败');
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const chooseRvcModel = function (id) {
        const item = rvcModels.find(function (model) { return model.id === id; });
        if (!item) return;
        const device = (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.rvc && cfg.qq.config.rvc.device) || 'auto';
        const useOnnx = device !== 'cpu' && item.onnx;
        setRvc({ modelPath: useOnnx ? item.onnx : (item.pth || item.onnx || ''), indexPath: item.index || '' });
      };

      const chooseRvcDevice = function (device) {
        const current = (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.rvc && cfg.qq.config.rvc.modelPath) || '';
        const item = rvcModels.find(function (model) { return model.pth === current || model.onnx === current; });
        if (!item) {
          setRvc({ device });
          return;
        }
        setRvc({
          device,
          modelPath: device === 'cpu' ? (item.pth || item.onnx || current) : (item.onnx || item.pth || current),
        });
      };

      const uploadSelfies = async function (fileList) {
        const files = Array.from(fileList || []);
        if (files.length === 0) return;
        setSelfieUploading(true);
        try {
          for (const file of files) {
            const data = await new Promise(function (resolve, reject) {
              const reader = new FileReader();
              reader.onload = function () { resolve(String(reader.result || '')); };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            const res = await fetch(BASE + '/selfies/upload', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ name: file.name, data }),
            });
            const json = await res.json();
            if (!json.ok) setMessage(json.message || '上传失败');
          }
          await loadSelfies();
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setSelfieUploading(false);
        }
      };

      const loadMemory = async function (gid) {
        if (!gid) {
          setMemoryData(null);
          return;
        }
        try {
          const data = await (await fetch(BASE + '/memory?groupId=' + encodeURIComponent(gid), { cache: 'no-store' })).json();
          setMemoryData(data);
          setSummaryDraft(String(data.summary || ''));
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const loadPermanent = async function (gid) {
        if (!gid) {
          setPermanentData(null);
          return;
        }
        try {
          const data = await (await fetch(BASE + '/memory/permanent?groupId=' + encodeURIComponent(gid), { cache: 'no-store' })).json();
          setPermanentData(data);
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const addPermanentDraft = async function () {
        const text = permanentDraft.trim();
        if (text === '' || !groupId) return;
        setPermanentBusy(true);
        try {
          const data = await (await fetch(BASE + '/memory/permanent', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'add', groupId, text, scope: permanentScope, sensitivity: permanentScope === 'global' && permanentPrivate ? 'private' : 'normal' }),
          })).json();
          if (data.ok === true) {
            setPermanentDraft('');
            setMessage('已写入永久记忆');
            await loadPermanent(groupId);
          } else {
            setMessage(data.message || '写入永久记忆失败');
          }
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setPermanentBusy(false);
        }
      };

      const removePermanent = async function (id) {
        if (!groupId) return;
        setPermanentBusy(true);
        try {
          const data = await (await fetch(BASE + '/memory/permanent', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'delete', groupId, id, scope: permanentScope }),
          })).json();
          if (data.ok === true) {
            await loadPermanent(groupId);
          } else {
            setMessage(data.message || '删除失败');
          }
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setPermanentBusy(false);
        }
      };

      const promotePermanentItem = async function (id) {
        if (!groupId) return;
        setPermanentBusy(true);
        try {
          const data = await (await fetch(BASE + '/memory/permanent', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'promote', groupId, id }),
          })).json();
          if (data.ok === true) {
            setMessage('已提升为全局主人记忆');
            await loadPermanent(groupId);
          } else {
            setMessage(data.message || '提升失败');
          }
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setPermanentBusy(false);
        }
      };

      const mergePermanent = async function () {
        if (!groupId || permanentSelected.length < 2) return;
        setPermanentBusy(true);
        try {
          const data = await (await fetch(BASE + '/memory/permanent', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'merge', groupId, ids: permanentSelected, scope: permanentScope }),
          })).json();
          if (data.ok === true) {
            setPermanentSelected([]);
            setMessage('永久记忆已合并');
            await loadPermanent(groupId);
          } else {
            setMessage(data.message || '合并失败');
          }
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setPermanentBusy(false);
        }
      };

      const loadMood = async function (gid) {
        if (!gid) {
          setMoodData(null);
          return;
        }
        try {
          setMoodData(await (await fetch(BASE + '/mood?groupId=' + encodeURIComponent(gid), { cache: 'no-store' })).json());
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const resetMoodNow = async function () {
        if (!groupId) return;
        try {
          const data = await (await fetch(BASE + '/mood', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'reset', groupId }),
          })).json();
          if (data.ok === false) setMessage(data.message || '重置失败');
          else setMoodData(data);
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const saveKeyMemories = async function (list) {
        if (!groupId) return;
        try {
          const data = await (await fetch(BASE + '/memory', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'set', groupId: groupId, keyMemories: list }),
          })).json();
          if (data.ok === false) setMessage(data.message || '保存关键记忆失败');
          else setMessage('关键记忆已保存');
          await loadMemory(groupId);
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const compressMemory = async function () {
        if (!groupId) return;
        setMessage('正在压缩记忆……');
        try {
          const data = await (await fetch(BASE + '/memory', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'compress', groupId: groupId }),
          })).json();
          if (data.ok === false) setMessage(data.message || '压缩失败');
          else {
            setMessage('记忆已压缩');
            setMemoryData(data);
          }
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const addKeyMemoryPrompt = function () {
        if (!memoryData || !Array.isArray(memoryData.keyMemories)) return;
        const text = window.prompt('新增关键记忆（长期事实/偏好/关系/梗）');
        if (!text || !text.trim()) return;
        const list = memoryData.keyMemories.concat([{ id: 'manual-' + Date.now().toString(36), kind: 'fact', text: text.trim(), confidence: 0.9, pinned: true, createdAt: Date.now(), updatedAt: Date.now() }]);
        void saveKeyMemories(list);
      };

      const removeKeyMemory = function (id) {
        if (!memoryData || !Array.isArray(memoryData.keyMemories)) return;
        void saveKeyMemories(memoryData.keyMemories.filter(function (m) { return m.id !== id; }));
      };

      const postMemoryV3 = async function (payload) {
        if (!groupId) return null;
        try {
          const data = await (await fetch(BASE + '/memory', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...payload, groupId }),
          })).json();
          if (data.ok === false) setMessage(data.message || '记忆操作失败');
          else {
            setMessage('记忆已更新');
            await loadMemory(groupId);
          }
          return data;
        } catch (e) {
          setMessage(String((e && e.message) || e));
          return null;
        }
      };

      const saveSummary = function () {
        if (!memoryData) return;
        void postMemoryV3({ action: 'summary', text: summaryDraft });
      };

      const addMemoryDraft = function () {
        const text = memoryDraft.trim();
        if (text === '') {
          setMessage('先输入记忆内容');
          return;
        }
        void postMemoryV3({ action: 'v3add', text, category: 'stable_profile', importance: 0.8, factKey: '' });
        setMemoryDraft('');
      };

      const addKeyMemoryDraft = function () {
        const text = memoryDraft.trim();
        if (!memoryData || text === '') {
          setMessage('先输入记忆内容');
          return;
        }
        const list = (memoryData.keyMemories || []).concat([{ id: 'manual-' + Date.now().toString(36), kind: 'fact', text, confidence: 0.9, pinned: true, createdAt: Date.now(), updatedAt: Date.now() }]);
        void saveKeyMemories(list);
        setMemoryDraft('');
      };

      const startEditMemory = function (item) {
        setMemoryEditing({ id: item.id, text: item.text || '', category: item.category || 'stable_profile', importance: item.importance === undefined ? 0.8 : item.importance, factKey: item.factKey || '' });
      };

      const saveEditingMemory = function () {
        if (!memoryEditing) return;
        void postMemoryV3({
          action: 'v3update',
          id: memoryEditing.id,
          text: memoryEditing.text,
          category: memoryEditing.category,
          importance: Number(memoryEditing.importance),
          factKey: memoryEditing.factKey,
        });
        setMemoryEditing(null);
      };

      const removeMemoryV3 = function (item) {
        void postMemoryV3({ action: 'v3delete', id: item.id });
      };

      const openStickerDir = async function () {
        try {
          const data = await (await fetch(BASE + '/stickers/open', { method: 'POST' })).json();
          if (data.ok === false) setMessage(data.message || '打开失败');
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const persistStickerRepos = async function (next) {
        try {
          const data = await (await fetch(BASE + '/stickers/repos', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ repos: next }),
          })).json();
          if (data.ok === false) {
            setMessage(data.message || '保存仓库失败');
            return;
          }
          setMessage('表情包仓库已保存');
          await loadStickers();
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const openSelfieDir = async function () {
        try {
          const data = await (await fetch(BASE + '/selfies/open', { method: 'POST' })).json();
          if (!data.ok) setMessage(data.message || '打开失败');
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const deleteSelfieFile = async function (name) {
        if (!window.confirm('删除这张鲸鱼娘自拍照？')) return;
        try {
          await fetch(BASE + '/selfies/delete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name }),
          });
          await loadSelfies();
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const saveStickerRepos = function () {
        return persistStickerRepos(stickerRepos);
      };

      const addStickerRepo = function () {
        const name = window.prompt('新仓库名称（例如：猫猫、反应图）');
        if (!name || !name.trim()) return;
        const id = 'repo-' + Date.now().toString(36);
        setStickerRepos(function (prev) {
          return prev.concat([{ id: id, name: name.trim(), weight: 20, saveTarget: false, enabled: true, maxItems: 500, maxMB: 100, autoAnalyze: false, createdAt: Date.now() }]);
        });
      };

      const toggleSticker = function (file) {
        setStickerSelected(function (prev) {
          return prev.indexOf(file) >= 0 ? prev.filter(function (x) { return x !== file; }) : prev.concat([file]);
        });
      };

      const moveSelectedStickers = async function () {
        if (stickerSelected.length === 0 || !stickerTarget) return;
        try {
          const data = await (await fetch(BASE + '/stickers/move', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ files: stickerSelected, repoId: stickerTarget }),
          })).json();
          setMessage(data.ok === false ? (data.message || '移动失败') : ('已移动 ' + data.moved + ' 张'));
          setStickerSelected([]);
          await loadStickers();
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const deleteSelectedStickers = async function () {
        if (stickerSelected.length === 0) return;
        if (!window.confirm('删除选中的 ' + stickerSelected.length + ' 张表情包？不可恢复。')) return;
        try {
          const data = await (await fetch(BASE + '/stickers/delete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ files: stickerSelected }),
          })).json();
          setMessage(data.ok === false ? (data.message || '删除失败') : ('已删除 ' + data.deleted + ' 张'));
          setStickerSelected([]);
          await loadStickers();
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const editSticker = async function (item) {
        const value = window.prompt('这张表情包的含义/使用场景（留空则回到未分类）', item.description === '未分类' ? '' : (item.description || ''));
        if (value === null) return;
        try {
          const data = await (await fetch(BASE + '/stickers/update', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ file: item.file, description: value }),
          })).json();
          if (data.ok === false) setMessage(data.message || '保存失败');
          await loadStickers();
        } catch (e) {
          setMessage(String((e && e.message) || e));
        }
      };

      const checkTtsHealth = async function () {
        try {
          const data = await (await fetch(BASE + '/tts-health', { cache: 'no-store' })).json();
          setTtsHealth(data);
        } catch (e) {
          setTtsHealth({ ok: false, message: String((e && e.message) || e) });
        }
      };

      const previewVoice = async function () {
        setPreview({ loading: true });
        try {
          const tts = (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts) || {};
          const rvc = (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.rvc) || {};
          const data = await (await fetch(BASE + '/voice-preview', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: previewText, voice: tts.voice, rate: tts.rate, pitch: tts.pitch, volume: tts.volume, style: tts.style, tts: tts, rvc: rvc }),
          })).json();
          if (data.ok === true) {
            setPreview({ url: 'data:audio/wav;base64,' + data.base64 });
            if (data.rvcWarning) setMessage('RVC 试听失败，播放原音：' + data.rvcWarning);
            else if (data.rvc) setMessage('试听已应用 RVC');
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

      const setRvc = function (patch) {
        setCfg({
          ...cfg,
          qq: {
            ...cfg.qq,
            config: {
              ...cfg.qq.config,
              rvc: { ...((cfg.qq.config && cfg.qq.config.rvc) || {}), ...patch },
            },
          },
        });
      };

      const personaCards = Array.isArray(settings.personas) ? settings.personas : [];
      const activePersonaCard = personaCards.find(function (card) { return card.id === settings.activePersonaId; });
      const applyPersonaCards = function (cards, activeId) {
        const active = cards.find(function (card) { return card.id === activeId; });
        setSettings({ ...settings, personas: cards, activePersonaId: activeId, persona: active ? active.text : settings.persona });
      };
      const addPersonaCard = function () {
        const id = 'persona-' + Date.now().toString(36);
        const cards = personaCards.concat([{ id: id, name: '新人设', text: activePersonaCard ? '' : (settings.persona || '') }]);
        applyPersonaCards(cards, id);
      };
      const removePersonaCard = function () {
        if (!activePersonaCard) return;
        const cards = personaCards.filter(function (card) { return card.id !== activePersonaCard.id; });
        const next = cards[0];
        const bindings = { ...(settings.groupPersonaIds || {}) };
        for (const group of Object.keys(bindings)) {
          if (bindings[group] === activePersonaCard.id) delete bindings[group];
        }
        const active = next;
        setSettings({ ...settings, personas: cards, groupPersonaIds: bindings, activePersonaId: active ? active.id : '', persona: active ? active.text : settings.persona });
      };
      const bindGroupPersona = function (gid, cardId, checked) {
        const bindings = { ...(settings.groupPersonaIds || {}) };
        if (checked) bindings[gid] = cardId;
        else delete bindings[gid];
        setSettings({ ...settings, groupPersonaIds: bindings });
      };
      const updateActivePersona = function (patch) {
        if (!activePersonaCard) {
          setSettings({ ...settings, persona: typeof patch.text === 'string' ? patch.text : settings.persona });
          return;
        }
        const cards = personaCards.map(function (card) {
          return card.id === activePersonaCard.id ? { ...card, ...patch } : card;
        });
        applyPersonaCards(cards, activePersonaCard.id);
      };

      const loadUsage = React.useCallback(async function (scope, month) {
        try {
          const data = await (await fetch(
            BASE + '/usage?scope=' + encodeURIComponent(scope) + '&month=' + encodeURIComponent(month),
            { cache: 'no-store' },
          )).json();
          setUsage(data);
          if (data && data.model) {
            const saved = data.rates && typeof data.rates[data.model.key] === 'number'
              ? data.rates[data.model.key]
              : data.model.rate;
            setRateInput(String(saved || 0));
          }
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
          setSettings({ ...settings, usageRates: { ...(settings.usageRates || {}), [usage.model.key]: rate } });
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

      const voiceProvider =
        (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts && cfg.qq.config.tts.provider) || 'edge';
      const voiceList =
        voiceProvider === 'gpt-sovits'
          ? (settings.customVoices && settings.customVoices.length > 0
              ? settings.customVoices
              : [{ id: '三月七', label: '三月七 · v2ProPlus' }, { id: '银狼', label: '银狼 · v2ProPlus' }])
          : BUILTIN_VOICES;

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

      const setQzone = function (patch) {
        setSettings({ ...settings, qzone: { ...(settings.qzone || {}), ...patch } });
      };

      const loadQzone = React.useCallback(async function () {
        try {
          const q = new URLSearchParams({ limit: '50', order: qzoneOrder });
          if (qzoneFrom) q.set('from', String(new Date(qzoneFrom + 'T00:00:00').getTime()));
          if (qzoneTo) q.set('to', String(new Date(qzoneTo + 'T23:59:59.999').getTime()));
          const data = await (await fetch(BASE + '/qzone?' + q.toString(), { cache: 'no-store' })).json();
          setQzoneData(data);
          setQzoneHasMore(data.hasMore === true);
        } catch {
          /* 忽略 */
        }
      }, [qzoneFrom, qzoneTo, qzoneOrder]);

      const loadMoreQzone = React.useCallback(async function () {
        if (!qzoneHasMore || qzoneLoadingMore) return;
        const entries = (qzoneData && qzoneData.entries) || [];
        if (entries.length === 0) return;
        const oldest = entries[entries.length - 1];
        setQzoneLoadingMore(true);
        try {
          const q = new URLSearchParams({ limit: '50', order: qzoneOrder, before: String(oldest.ts) });
          if (qzoneFrom) q.set('from', String(new Date(qzoneFrom + 'T00:00:00').getTime()));
          if (qzoneTo) q.set('to', String(new Date(qzoneTo + 'T23:59:59.999').getTime()));
          const data = await (await fetch(BASE + '/qzone?' + q.toString(), { cache: 'no-store' })).json();
          const next = data.entries || [];
          setQzoneData(function (prev) {
            if (!prev) return data;
            const seen = new Set((prev.entries || []).map(function (e) { return e.tid || e.ts; }));
            return { ...prev, entries: (prev.entries || []).concat(next.filter(function (e) { return !seen.has(e.tid || e.ts); })) };
          });
          setQzoneHasMore(data.hasMore === true);
        } catch {
          /* 忽略 */
        } finally {
          setQzoneLoadingMore(false);
        }
      }, [qzoneData, qzoneHasMore, qzoneLoadingMore, qzoneFrom, qzoneTo, qzoneOrder]);

      const generateQzone = async function () {
        setQzoneBusy(true);
        setMessage('');
        try {
          const data = await (await fetch(BASE + '/qzone', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'generate' }),
          })).json();
          if (data.ok === true) {
            setQzoneDraft(data.content || '');
            setQzoneImages(Array.isArray(data.images) ? data.images : []);
            setMessage('草稿已生成（配图 ' + ((data.images || []).length) + ' 张），确认后再发布');
          } else {
            setMessage('生成失败：' + (data.message || '未知错误'));
          }
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setQzoneBusy(false);
        }
      };

      const publishQzone = async function () {
        const text = qzoneDraft.trim();
        if (text === '') {
          setMessage('说说正文为空');
          return;
        }
        setQzoneBusy(true);
        setMessage('');
        try {
          const q = (settings && settings.qzone) || {};
          const data = await (await fetch(BASE + '/qzone', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'publish', content: text, ugcRight: q.ugcRight, images: qzoneImages }),
          })).json();
          if (data.ok === true) {
            setMessage('已发布到 QQ空间');
            setQzoneDraft('');
            setQzoneImages([]);
            await loadQzone();
          } else {
            setMessage('发布失败：' + (data.message || '未知错误'));
          }
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setQzoneBusy(false);
        }
      };

      const loadQzoneRemote = async function (uin) {
        setQzoneRemoteBusy(true);
        setQzoneRemote(null);
        try {
          const q = new URLSearchParams({ limit: '10' });
          if (uin) q.set('uin', uin);
          const data = await (await fetch(BASE + '/qzone/remote?' + q.toString(), { cache: 'no-store' })).json();
          setQzoneRemote(data);
        } catch (e) {
          setQzoneRemote({ ok: false, message: String((e && e.message) || e) });
        } finally {
          setQzoneRemoteBusy(false);
        }
      };

      const deleteQzone = async function (tid) {
        if (!tid) return;
        setQzoneBusy(true);
        try {
          const data = await (await fetch(BASE + '/qzone', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'delete', tid: tid }),
          })).json();
          if (data.ok === true) {
            setMessage('已删除该说说');
            await loadQzone();
          } else {
            setMessage('删除失败：' + (data.message || '未知错误'));
          }
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setQzoneBusy(false);
        }
      };

      const loadDiary = React.useCallback(async function (group, user) {
        try {
          const gid = group === undefined ? diaryGroup : group;
          const uid = user === undefined ? diaryUser : user;
          const q = new URLSearchParams({ limit: '200' });
          if (gid) q.set('groupId', gid);
          if (uid) q.set('userId', uid);
          if (diaryFrom) q.set('from', String(new Date(diaryFrom + 'T00:00:00').getTime()));
          if (diaryTo) q.set('to', String(new Date(diaryTo + 'T23:59:59.999').getTime()));
          q.set('order', diaryOrder);
          const data = await (await fetch(BASE + '/diary?' + q.toString(), { cache: 'no-store' })).json();
          setDiary(data.entries || []);
          setDiaryHasMore(data.hasMore === true);
        } catch {
          /* 忽略 */
        }
      }, [diaryGroup, diaryUser, diaryFrom, diaryTo, diaryOrder]);

      const loadMoreDiary = React.useCallback(async function () {
        if (!diaryHasMore || diaryLoadingMore || diary.length === 0) return;
        setDiaryLoadingMore(true);
        try {
          const oldest = diaryOrder === 'asc' ? diary[diary.length - 1] : diary[diary.length - 1];
          const q = new URLSearchParams({ limit: '200', before: String(oldest.ts) });
          if (diaryGroup) q.set('groupId', diaryGroup);
          if (diaryUser) q.set('userId', diaryUser);
          if (diaryFrom) q.set('from', String(new Date(diaryFrom + 'T00:00:00').getTime()));
          if (diaryTo) q.set('to', String(new Date(diaryTo + 'T23:59:59.999').getTime()));
          q.set('order', diaryOrder);
          const data = await (await fetch(BASE + '/diary?' + q.toString(), { cache: 'no-store' })).json();
          const next = data.entries || [];
          setDiary(function (prev) {
            const seen = new Set(prev.map(function (e) { return e.ts; }));
            return prev.concat(next.filter(function (e) { return !seen.has(e.ts); }));
          });
          setDiaryHasMore(data.hasMore === true);
        } catch {
          /* 忽略 */
        } finally {
          setDiaryLoadingMore(false);
        }
      }, [diary, diaryHasMore, diaryLoadingMore, diaryGroup, diaryUser, diaryFrom, diaryTo, diaryOrder]);

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
          await Promise.all([loadStatus(), loadStickers(), loadSelfies(), loadSessionNames()]);
        })();
      }, [loadConfig, loadStatus, loadStickers, loadSelfies, loadSessionNames]);

      React.useEffect(function () {
        void loadMembers(diaryGroup);
        void loadDiary(diaryGroup, diaryUser);
      }, [diaryGroup, diaryUser, loadMembers, loadDiary]);

      React.useEffect(function () {
        if (tab === 'qzone') void loadQzone();
      }, [tab, loadQzone]);

      React.useEffect(function () {
        if (tab === 'memory') { void loadMemory(groupId); void loadPermanent(groupId); }
        if (tab === 'chat') void loadMood(groupId);
        if (tab === 'voice') void loadRvcModels();
        if (tab === 'basic') void loadUsage(usageScope, usageMonth);
      }, [tab, groupId]);

      React.useEffect(function () {
        if (tab !== 'diary') return;
        const timer = setInterval(function () {
          void loadDiary(diaryGroup, diaryUser);
        }, 5000);
        return function () {
          clearInterval(timer);
        };
      }, [tab, diaryGroup, diaryUser, loadDiary]);

      React.useEffect(function () {
        const timer = setInterval(function () {
          void loadStatus();
        }, 3000);
        return function () {
          clearInterval(timer);
        };
      }, [loadStatus]);

      React.useEffect(function () {
        const linkStatus = status && status.link ? status.link.status : 'idle';
        if (linkStatus === 'online') void loadSessionNames();
      }, [status && status.link ? status.link.status : 'idle', loadSessionNames]);

      React.useEffect(function () {
        const linkStatus = status && status.link ? status.link.status : 'idle';
        if (linkStatus === 'online') return;
        setQrNonce(Date.now());
        const timer = setInterval(function () { setQrNonce(Date.now()); }, 5000);
        return function () { clearInterval(timer); };
      }, [status && status.link ? status.link.status : 'idle']);

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
      const privateSession = groupId.indexOf('p:') === 0;
      const privates = (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.privates) || {};
      const privateIds = Object.keys(privates);
      /** 会话 key 列表（群号 + 'p:<QQ号>'） */
      const sessionIds = groupIds.concat(privateIds.map(function (qq) { return 'p:' + qq; }));
      /** 会话的显示名 */
      const sessionLabel = function (id) {
        if (id.indexOf('p:') === 0) {
          const qq = id.slice(2);
          const name = (sessionNames.privates && sessionNames.privates[qq]) || (privates[qq] && privates[qq].name) || qq;
          return name + '（私聊 ' + qq + '）';
        }
        const groupName = (sessionNames.groups && sessionNames.groups[id]) || (groups[id] && groups[id].name) || id;
        return groupName + '（' + id + '）';
      };

      const pickGroup = function (id) {
        setGroupId(id);
        if (id.indexOf('p:') === 0) {
          setPolicy(privates[id.slice(2)] || null);
        } else {
          setPolicy(id ? groups[id] : (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.defaultGroup) || null);
        }
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

      // 模型选择改完立即落盘：不再等顶部“保存全部”，避免旧状态覆盖/重启回滚。
      const persistModelSettings = function (next) {
        setSettings(next);
        setMessage('');
        void (async function () {
          try {
            const qq = (cfg && cfg.qq && cfg.qq.config) || {};
            const res = await fetch(BASE + '/config', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ qq: qq, settings: next }),
            });
            const data = await res.json();
            if (data.ok === false) setMessage('模型保存失败：' + (data.message || '未知错误'));
            else setMessage('模型已自动保存');
          } catch (e) {
            setMessage('模型保存失败：' + String((e && e.message) || e));
          }
        })();
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

      const toggleGroupEnabled = async function (id, enabled) {
        const current = groups[id];
        if (!current) return;
        setBusy(true);
        try {
          await fetch(BASE + '/config', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ qq: { groups: { [id]: { ...current, enabled } } } }),
          });
          await loadConfig();
          setMessage(enabled ? '已恢复群 ' + id : '已暂停群 ' + id);
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setBusy(false);
        }
      };

      const addPrivate = async function () {
        const qq = newPrivateId.trim();
        if (!/^\d{5,12}$/.test(qq)) {
          setMessage('QQ 号格式不对（5~12 位数字）');
          return;
        }
        if (privates[qq]) {
          setMessage('这个号已经在列表里了');
          return;
        }
        const base = (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.defaultPrivate) || {};
        const created = { ...base, enabled: true, name: '' };
        setBusy(true);
        setMessage('');
        try {
          await fetch(BASE + '/config', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ qq: { privates: { [qq]: created } } }),
          });
          setNewPrivateId('');
          await loadConfig();
          setGroupId('p:' + qq);
          setPolicy(created);
          setMessage('已添加私聊 ' + qq);
        } catch (e) {
          setMessage(String((e && e.message) || e));
        } finally {
          setBusy(false);
        }
      };

      const togglePrivateEnabled = async function (qq, enabled) {
        const current = privates[qq];
        if (!current) return;
        setBusy(true);
        try {
          await fetch(BASE + '/config', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ qq: { privates: { [qq]: { ...current, enabled } } } }),
          });
          await loadConfig();
          setMessage(enabled ? '已恢复私聊 ' + qq : '已暂停私聊 ' + qq);
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
          // 私聊的会话 key 是 p:<QQ号>，要写回 privates 而不是 groups——
          // 写错地方后端会当成「群号等于 p:xxx」，直接配置校验失败。
          const isPrivate = groupId.indexOf('p:') === 0;
          const groupsPatch = !isPrivate && groupId && policy ? { [groupId]: policy } : {};
          const privatesPatch = isPrivate && policy ? { [groupId.slice(2)]: policy } : {};
          // 发送完整 qq.config（含 tts），只额外带上当前会话的策略补丁；
          // 之前只发了 url/token/selfName/ownerQq，导致音色等设置保存后被丢掉。
          const qq = {
            ...((cfg && cfg.qq && cfg.qq.config) || {}),
            ...(Object.keys(groupsPatch).length > 0 ? { groups: groupsPatch } : {}),
            ...(Object.keys(privatesPatch).length > 0 ? { privates: privatesPatch } : {}),
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

      const ctxSel = settings.model && settings.model.provider ? settings.model : (status && status.model) || {};
      const ctxKey = ctxSel.provider && ctxSel.model ? ctxSel.provider + '/' + ctxSel.model : '';
      const scoreWeights = settings.scoreWeights || {};
      const setScoreWeight = function (key, value) {
        setSettings({ ...settings, scoreWeights: { ...(settings.scoreWeights || {}), [key]: Number(value) } });
      };
      const profileRules = settings.profileRules || {};
      const pr = function (key, fallback) {
        return typeof profileRules[key] === 'number' ? profileRules[key] : fallback;
      };
      const setProfileRule = function (key, value) {
        setSettings({ ...settings, profileRules: { ...(settings.profileRules || {}), [key]: Number(value) } });
      };
      return h('div', null,
        h('h2', { style: { fontSize: '16px', margin: '0 0 4px' }, children: 'QQ 群聊（独立插件）' }),
        h('p', { style: s.note, children: '独立数据目录与记忆，不共享桌宠的 memory.json。' }),

        h('div', { style: { ...s.card, marginTop: '10px', border: '1px solid var(--dsw-alias-border-l2)' } },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', cursor: 'pointer' }, onClick: function () { setSessionToolsOpen(function (v) { return !v; }); } },
            h('h3', { style: { fontSize: '14px', margin: 0 }, children: '新增群聊 / 私聊' }),
            h('span', { style: s.note, children: sessionToolsOpen ? '收起 ▲' : '已添加 ' + groupIds.length + ' 群 / ' + privateIds.length + ' 私聊 · 展开 ▼' }),
          ),
          sessionToolsOpen ? h('div', null,
          h('p', { style: s.note, children: '置顶入口，任何页签都能添加。群和私聊都是「加进列表才会理」——没加的群不接，没加的人私聊也不回。' }),
          h(Row, { label: '群号' },
            h('input', { style: s.input, placeholder: '5~12 位数字', value: newGroupId, onChange: function (e) { setNewGroupId(e.target.value); } }),
            h('button', { style: s.btn, disabled: busy, onClick: addGroup, children: '添加群聊' }),
            h('span', { style: s.note, children: '当前已添加 ' + groupIds.length + ' 个群' }),
          ),
          h(Row, { label: 'QQ 号' },
            h('input', { style: s.input, placeholder: '5~12 位数字', value: newPrivateId, onChange: function (e) { setNewPrivateId(e.target.value); } }),
            h('button', { style: s.btn, disabled: busy, onClick: addPrivate, children: '添加私聊' }),
            h('span', { style: s.note, children: '当前已添加 ' + privateIds.length + ' 个私聊' }),
          ),
          h('div', { style: { marginTop: '8px' } },
            h('div', { style: { fontSize: '12px', opacity: 0.8, marginBottom: '4px' }, children: '会话开关（关闭后完全不接该会话的消息，也不主动开口）' }),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
              groupIds.map(function (id) {
                const item = groups[id] || {};
                return h('label', { key: id, style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' } },
                  h('input', {
                    type: 'checkbox',
                    checked: item.enabled !== false,
                    disabled: busy,
                    onChange: function (e) { void toggleGroupEnabled(id, e.target.checked); },
                  }),
                  h('span', { children: '群 ' + (item.name || id) + '（' + id + '）' }),
                );
              }),
              privateIds.map(function (qq) {
                const item = privates[qq] || {};
                return h('label', { key: 'p:' + qq, style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' } },
                  h('input', {
                    type: 'checkbox',
                    checked: item.enabled !== false,
                    disabled: busy,
                    onChange: function (e) { void togglePrivateEnabled(qq, e.target.checked); },
                  }),
                  h('span', { children: '私聊 ' + (item.name || qq) + '（' + qq + '）' }),
                );
              }),
            ),
          ),
          ) : null,
        ),

        h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '10px 0 2px' } },
          [
            { id: 'status', label: '运行状态' },
            { id: 'persona', label: '人设' },
            { id: 'basic', label: '模型 / 其他' },
            { id: 'proactive', label: '主动搭话' },
            { id: 'chat', label: '接话（按群）' },
            { id: 'memory', label: '记忆' },
            { id: 'stickers', label: '表情包' },
            { id: 'file', label: '文件' },
            { id: 'voice', label: '语音' },
            { id: 'diary', label: '日记' },
            { id: 'qzone', label: 'QQ空间' },
            { id: 'lists', label: '用户画像' },
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

        h('div', {
          style: {
            position: 'sticky',
            top: 0,
            zIndex: 20,
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            padding: '6px 0',
            margin: '4px 0 8px',
            background: 'var(--dsw-alias-bg-base, #10131a)',
            borderBottom: '1px solid var(--dsw-alias-border-l2)',
          },
        },
          h('button', { style: { ...s.btn, ...s.primary }, disabled: busy, onClick: save, children: busy ? '保存中…' : '保存全部' }),
          message ? h('span', { style: s.note, children: message }) : null,
        ),

        hostVersion && hostVersion.stale === true
          ? h('div', {
              style: {
                padding: '8px 10px',
                margin: '6px 0 10px',
                borderRadius: '6px',
                background: 'rgba(255, 170, 0, 0.12)',
                border: '1px solid rgba(255, 170, 0, 0.35)',
                fontSize: '12px',
                color: 'var(--dsw-alias-label-primary)',
              },
            }, '运行宿主还是 ' + (hostVersion.version || '?') + '，磁盘已经是 ' + (hostVersion.diskVersion || '?') + '：请重启 DSH，否则新字段保存后可能被旧宿主丢弃。')
          : null,

        h('div', { style: { ...s.card, display: tab === 'status' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '运行状态' }),
          h(Row, { label: '连接' },
            h('span', { style: running ? s.good : s.note, children: statusText(status) }),
            h('button', { style: s.btn, disabled: busy || running, onClick: start, children: '启动' }),
            h('button', { style: s.btn, disabled: busy || !running, onClick: stop, children: '停止' }),
            h('button', { style: s.btn, onClick: function () { void loadStatus(); }, children: '刷新' }),
          ),
          h(Row, { label: '会话' },
            h('span', { children: '群 ' + String(Object.keys(groups).length) + ' 个 / 私聊 ' + String(Object.keys(privates).length) + ' 个' }),
          ),
          h(Row, { label: '名单' },
            h('span', { style: s.note, children: '只有加进列表的群和人才会回话；没加的一律不理。' }),
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
          status && (!status.link || status.link.status !== 'online')
            ? h('div', { style: { marginTop: '8px', padding: '10px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '8px' } },
                h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
                  h('strong', { children: 'QQ 登录二维码' }),
                  h('button', { style: s.btn, onClick: function () { setQrError(''); setQrNonce(Date.now()); }, children: '刷新二维码' }),
                  h('span', { style: s.note, children: '二维码过期就点刷新；仍无效时可点「启动 NapCat」重新生成' }),
                ),
                qrError
                  ? h('p', { style: { ...s.note, ...s.bad }, children: qrError })
                  : h('img', {
                      alt: 'QQ 登录二维码',
                      src: BASE + '/qr?t=' + qrNonce,
                      style: { display: 'block', width: '240px', height: 'auto', marginTop: '8px', padding: '6px', background: '#fff', borderRadius: '6px' },
                      onError: function () { setQrError('二维码还没生成或已失效：先启动 NapCat，再点刷新'); },
                    }),
              )
            : null,
          h(Row, { label: '当前模型' },
            h('span', { children: modelInfo ? '主：' + modelInfo.provider + ' / ' + modelInfo.model + (modelInfo.source === 'settings' ? '（设置）' : '（跟随会话）') : '主：—' }),
            h('span', { style: s.note, children: '备：' + (settings.fallbackModel && settings.fallbackModel.provider ? settings.fallbackModel.provider + ' / ' + settings.fallbackModel.model : '未设置') }),
            h('button', { style: s.btn, disabled: check && check.running, onClick: testModel, children: check && check.running ? '测试中…' : '测试两个模型' }),
          ),
          check && !check.running
            ? h('div', null,
                check.primary
                  ? h('p', { style: check.primary.ok ? { ...s.note, ...s.good } : { ...s.note, ...s.bad } },
                      '主模型 ' + check.primary.provider + ' / ' + check.primary.model + '：' +
                      (check.primary.ok ? '可用（' + check.primary.latencyMs + ' ms）：' + (check.primary.reply || '') : '失败（' + check.primary.latencyMs + ' ms）：' + (check.primary.error || '未知错误')))
                  : null,
                check.primary && check.fallback
                  ? (check.fallback.skipped
                      ? h('p', { style: s.note, children: '备用模型与主模型相同，已跳过测试：' + check.fallback.provider + ' / ' + check.fallback.model })
                      : h('p', { style: check.fallback.ok ? { ...s.note, ...s.good } : { ...s.note, ...s.bad } },
                          '备用模型 ' + check.fallback.provider + ' / ' + check.fallback.model + '：' +
                          (check.fallback.ok ? '可用（' + check.fallback.latencyMs + ' ms）：' + (check.fallback.reply || '') : '失败（' + check.fallback.latencyMs + ' ms）：' + (check.fallback.error || '未知错误'))))
                  : (check.primary ? h('p', { style: s.note, children: '未设置备用模型' }) : null),
                check.primary
                  ? h('p', { style: check.ok ? { ...s.note, ...s.good } : { ...s.note, ...s.bad } },
                      '实际可用：' + (check.active === 'primary' ? '主模型' : check.active === 'fallback' ? '备用模型' : '两个都不可用'))
                  : h('p', { style: check.ok ? { ...s.note, ...s.good } : { ...s.note, ...s.bad }, children: check.ok ? '模型可用（' + check.latencyMs + ' ms）：' + (check.reply || '') : '模型调用失败：' + (check.error || '未知错误') }),
              )
            : null,
        ),

        h('div', { style: { ...s.card, display: tab === 'persona' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '人设卡片' }),
          h('p', { style: s.note, children: '左侧选卡片，右侧编辑内容并勾选使用该人设的群；同一张卡可以绑多个群，未勾选的群跟随全局。' }),
          h('div', { style: { display: 'flex', gap: '18px', alignItems: 'flex-start', flexWrap: 'wrap' } },
            h('div', { style: { flex: '0 0 250px', minWidth: '210px' } },
              h('div', { style: { display: 'flex', gap: '6px', marginBottom: '8px' } },
                h('button', { type: 'button', style: s.btn, onClick: addPersonaCard, children: '新增' }),
                h('button', { type: 'button', style: s.btn, disabled: !activePersonaCard || personaCards.length <= 1, onClick: removePersonaCard, children: '删除' }),
              ),
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                personaCards.length === 0 ? h('p', { style: s.note, children: '还没有卡片，点「新增」' }) : null,
                personaCards.map(function (card) {
                  return h('button', {
                    key: card.id,
                    type: 'button',
                    style: { ...s.btn, textAlign: 'left', ...(card.id === settings.activePersonaId ? s.primary : {}) },
                    onClick: function () { setSettings({ ...settings, activePersonaId: card.id, persona: card.text }); },
                    children: (card.name || '未命名') + '（' + card.text.length + ' 字）',
                  });
                }),
              ),
            ),
            h('div', { style: { flex: '1 1 420px', minWidth: '320px' } },
              activePersonaCard ? h('div', { style: s.row },
                h('span', { style: s.label, children: '卡片名' }),
                h('input', { style: s.input, value: activePersonaCard.name, onChange: function (e) { updateActivePersona({ name: e.target.value }); } }),
              ) : h('p', { style: s.note, children: '当前是旧版单段人设；点「新增」会把它复制成卡片。' }),
              h('div', { style: s.row },
                h('span', { style: s.label, children: '人设内容' }),
                h('textarea', { style: { ...s.area, minHeight: '320px' }, value: activePersonaCard ? activePersonaCard.text : settings.persona, onChange: function (e) {
                  if (activePersonaCard) updateActivePersona({ text: e.target.value });
                  else setSettings({ ...settings, persona: e.target.value });
                } }),
              ),
              h('h4', { style: { fontSize: '13px', margin: '14px 0 4px' }, children: '绑定群聊' }),
              h('p', { style: s.note, children: activePersonaCard ? '勾选后该群使用当前卡片；取消勾选则跟随全局。' : '先选一张卡片。' }),
              h('p', { style: s.note, children: '当前群生效：' + (function () {
                const boundId = settings.groupPersonaIds && settings.groupPersonaIds[groupId];
                const card = personaCards.find(function (item) { return item.id === (boundId || settings.activePersonaId); });
                return card ? card.name + '（' + card.text.length + ' 字）' : '未设置';
              })() }),
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '260px', overflow: 'auto' } },
                sessionIds.map(function (id) {
                  const bound = activePersonaCard !== undefined && (settings.groupPersonaIds && settings.groupPersonaIds[id]) === activePersonaCard.id;
                  return h('label', { key: id, style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' } },
                    h('input', {
                      type: 'checkbox',
                      checked: bound,
                      disabled: !activePersonaCard,
                      onChange: function (e) { if (activePersonaCard) bindGroupPersona(id, activePersonaCard.id, e.target.checked); },
                    }),
                    h('span', { children: sessionLabel(id) }),
                  );
                }),
              ),
              h('div', { style: s.row },
                h('span', { style: s.label, children: '主人优先级' }),
                h('textarea', {
                  style: { ...s.area, minHeight: '150px' },
                  value: settings.ownerPriorityPrompt || '',
                  placeholder: '留空使用默认；可用 {{ownerQq}} 代表主人QQ',
                  onChange: function (e) { setSettings({ ...settings, ownerPriorityPrompt: e.target.value }); },
                }),
              ),
              h('p', { style: s.note, children: '这段会放在人设之后、记忆之前；冲突时优先于人设和记忆。可用 {{ownerQq}} 占位。' }),
            ),
          ),
        ),

        h('div', { style: { ...s.card, display: tab === 'basic' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '模型' }),
          h(Row, { label: '群聊模型' },
            h('select', { style: s.input, value: settings.model.provider, onChange: function (e) {
              const p = providers.find(function (x) { return x.provider === e.target.value; });
              persistModelSettings({ ...settings, model: { provider: e.target.value, model: p && p.models[0] ? p.models[0].id : '' } });
            } },
              h('option', { value: '', children: '跟随当前会话模型' }),
              providers.map(function (p) { return h('option', { key: p.provider, value: p.provider, children: p.name || p.provider }); }),
            ),
            h('select', { style: s.input, value: settings.model.model, disabled: !provider, onChange: function (e) { persistModelSettings({ ...settings, model: { provider: settings.model.provider, model: e.target.value } }); } },
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
          h(Row, { label: '上下文长度' },
            h('input', {
              style: s.input,
              type: 'number',
              min: '1000',
              max: '2000000',
              placeholder: modelWindow ? '自动：' + modelWindow : '自动（点右侧读取）',
              value: (settings.contextWindows && ctxKey && settings.contextWindows[ctxKey]) || '',
              disabled: !ctxKey,
              onChange: function (e) {
                const next = { ...(settings.contextWindows || {}) };
                if (e.target.value) next[ctxKey] = Number(e.target.value);
                else delete next[ctxKey];
                setSettings({ ...settings, contextWindows: next });
              },
            }),
            h('button', { style: s.btn, disabled: !ctxKey, onClick: function () { void loadModelWindow(); }, children: '读取模型' }),
            h('button', { style: s.btn, disabled: !ctxKey, onClick: function () { const next = { ...(settings.contextWindows || {}) }; delete next[ctxKey]; setSettings({ ...settings, contextWindows: next }); }, children: '恢复自动' }),
            h('span', { style: s.note, children: modelWindow ? '模型能力：' + modelWindow + ' tokens' : '未读取到模型能力时可手动填' }),
          ),
          h(Row, { label: '备用模型' },
            h('select', { style: s.input, value: fallbackRef.provider, onChange: function (e) {
              const p = providers.find(function (x) { return x.provider === e.target.value; });
              persistModelSettings({ ...settings, fallbackModel: { provider: e.target.value, model: p && p.models[0] ? p.models[0].id : '' } });
            } },
              h('option', { value: '', children: '不设备用' }),
              providers.map(function (p) { return h('option', { key: p.provider, value: p.provider, children: p.name || p.provider }); }),
            ),
            h('select', { style: s.input, value: fallbackRef.model, disabled: !fallbackProvider, onChange: function (e) { persistModelSettings({ ...settings, fallbackModel: { provider: fallbackRef.provider, model: e.target.value } }); } },
              (fallbackProvider ? fallbackProvider.models : []).map(function (m) { return h('option', { key: m.id, value: m.id, children: m.name || m.id }); }),
            ),
            h('span', { style: s.note, children: (fallbackRef.provider !== '' && fallbackRef.provider === settings.model.provider && fallbackRef.model === settings.model.model) ? '与主模型相同，等于没有备用；建议换一个' : '主模型空回复/只回 reasoning 时自动切一次' }),
          ),
          h('div', { style: s.section },
            h('h4', { style: s.sectionTitle, children: '省 token / 上下文' }),
            h('p', { style: s.sectionNote, children: '按群生效；这些开关直接影响模型调用量和上下文长度。' }),
            policy ? h('div', null,
              h(Row, { label: '上下文策略' },
                h('select', { style: s.input, value: policy.contextMode || 'adaptive', onChange: function (e) { setP('contextMode', e.target.value); } },
                  h('option', { value: 'adaptive', children: '自适应（自包含短句少读，指代/追问读全量）' }),
                  h('option', { value: 'full', children: '总是读全量' }),
                ),
              ),
              h(Row, { label: '全量上下文条数' },
                h('input', { style: s.input, type: 'number', min: '1', max: '100', value: policy.contextTurns || 24, onChange: function (e) { setP('contextTurns', Number(e.target.value)); } }),
                h('span', { style: s.note, children: '条；实际至少 32，并会额外保留关键旧消息' }),
              ),
              h(Row, { label: '自适应最少条数' },
                h('input', { style: s.input, type: 'number', min: '1', max: '50', value: policy.adaptiveMinTurns || 4, onChange: function (e) { setP('adaptiveMinTurns', Number(e.target.value)); } }),
                h('span', { style: s.note, children: '实际至少 8' }),
              ),
              h(Row, { label: '情绪判断' },
                h('input', { type: 'checkbox', checked: policy.moodJudge !== false, onChange: function (e) { setP('moodJudge', e.target.checked); } }),
                h('span', { style: s.note, children: '关掉后每次直接回复少一次 mood 模型调用' }),
              ),
              h(Row, { label: '记忆注入条数' },
                h('input', { style: s.input, type: 'number', min: '1', max: '20', value: policy.memoryV3MaxItems || 6, onChange: function (e) { setP('memoryV3MaxItems', Number(e.target.value)); } }),
                h('span', { style: s.note, children: '记忆 v3 每次最多注入几条' }),
              ),
            ) : h('p', { style: s.note, children: '先选一个群。' }),
            h(Row, { label: '敌意判断' },
              h('input', { type: 'checkbox', checked: settings.hostilityJudge !== false, onChange: function (e) { setSettings({ ...settings, hostilityJudge: e.target.checked }); } }),
              h('span', { style: s.note, children: '全局；关掉后少一次 hostility 模型调用' }),
            ),
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
            h('p', { style: s.note, children: '今日：' + usage.totals.today.calls + ' 次 · ' + fmtNum(usage.totals.today.totalTokens) + ' tokens · ' + fmtCredits(usage.totals.today.credits) + ' 积分 · 估算 ' + (usage.totals.today.estimatedCalls || 0) + ' 次 · 图片 ' + (usage.totals.today.imageCalls || 0) + ' 次' }),
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
            usage.byGroup && usage.byGroup.length > 0 ? h('div', { style: { marginTop: '8px' } },
              h('div', { style: s.note, children: '按群（本月）：' }),
              usage.byGroup.map(function (g) {
                return h('div', { key: g.groupId, style: { ...s.row, marginTop: '4px' } },
                  h('span', { style: { flex: '1 1 220px', fontSize: '12px' }, children: (groups[g.groupId] && groups[g.groupId].name ? groups[g.groupId].name + '（' + g.groupId + '）' : g.groupId) + '：' + g.calls + ' 次 · ' + fmtNum(g.totalTokens) + ' tokens · ' + fmtCredits(g.credits) + ' 积分 · 估算 ' + (g.estimatedCalls || 0) + ' · 图片 ' + (g.imageCalls || 0) }),
                );
              }),
            ) : null,
            usage.byPurpose && usage.byPurpose.length > 0 ? h('div', { style: { marginTop: '8px' } },
              h('div', { style: s.note, children: '按用途（本月）：' }),
              usage.byPurpose.map(function (p) {
                return h('div', { key: p.purpose, style: { ...s.row, marginTop: '4px' } },
                  h('span', { style: { flex: '1 1 220px', fontSize: '12px' }, children: p.purpose + '：' + p.calls + ' 次 · ' + fmtNum(p.totalTokens) + ' tokens · ' + fmtCredits(p.credits) + ' 积分' }),
                );
              }),
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

        h('div', { style: { ...s.card, display: tab === 'proactive' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '主动搭话' }),
          h('p', { style: s.note, children: '所有主动开口相关设置集中在这里；按群生效。' }),
          h(Row, { label: '群' },
            h('select', { style: s.input, value: groupId, onChange: function (e) { pickGroup(e.target.value); } },
              sessionIds.map(function (id) { return h('option', { key: id, value: id, children: sessionLabel(id) }); }),
            ),
          ),
          h(Row, { label: '搭话模式' },
            h('select', {
              style: s.input,
              disabled: !policy,
              value: !policy ? 'passive' : (policy.activeChat && policy.proactive && policy.proactive.enabled ? 'proactive' : (!policy.activeChat && !(policy.proactive && policy.proactive.enabled) ? 'passive' : 'mixed')),
              onChange: function (e) {
                var v = e.target.value;
                if (v === 'passive') {
                  setP('activeChat', false);
                  setNested('proactive', 'enabled', false);
                } else if (v === 'proactive') {
                  setP('activeChat', true);
                  setNested('proactive', 'enabled', true);
                }
              },
            },
              h('option', { value: 'passive', children: '被动（只回 @ / 叫名字）' }),
              h('option', { value: 'proactive', children: '主动（会插话、会主动开口）' }),
              h('option', { value: 'mixed', disabled: true, children: '自定义（插话与冷场分开）' }),
            ),
            h('span', { style: s.note, children: privateSession ? '私聊可主动搭话；主动 @主人 仍仅群聊可用' : '只对当前会话生效：主动 = 允许插话 + 冷场主动开口' }),
          ),
          policy ? h('div', null,
            h(Row, { label: '主动语音概率' },
              h('input', { style: s.input, type: 'number', min: '0', max: '100', value: Math.round((policy.proactiveVoiceChance || 0) * 100), onChange: function (e) { setP('proactiveVoiceChance', Number(e.target.value) / 100); } }),
              h('span', { style: s.note, children: '%（主动开口时改成语音）' }),
            ),
            h(Row, { label: '冷场主动开口' },
              h('input', { type: 'checkbox', checked: !!(policy.proactive && policy.proactive.enabled), onChange: function (e) { setNested('proactive', 'enabled', e.target.checked); } }),
              h('span', { style: s.note, children: '安静多少分钟算冷场' }),
              h('input', { style: s.fieldInput, type: 'number', min: '1', value: Math.round(((policy.proactive && policy.proactive.minIdleMs) || 0) / 60000), onChange: function (e) { setNested('proactive', 'minIdleMs', Number(e.target.value) * 60000); } }),
            ),
            h(Row, { label: '主动搭话模式' },
              h('select', { style: s.input, value: (policy.proactive && policy.proactive.mode) || 'dice', onChange: function (e) { setNested('proactive', 'mode', e.target.value); } },
                h('option', { value: 'dice', children: '概率命中线（推荐）' }),
                h('option', { value: 'legacy', children: '旧版固定退避' }),
              ),
              h('input', { type: 'checkbox', checked: !!(policy.proactive && policy.proactive.trial), onChange: function (e) { setNested('proactive', 'trial', e.target.checked); } }),
              h('span', { style: s.note, children: '试运行（只记账，不发送）' }),
            ),
            h(Row, { label: '主动 @主人' },
              h('input', {
                type: 'checkbox',
                disabled: privateSession,
                checked: !privateSession && !!(policy.proactive && policy.proactive.ownerMentionEnabled),
                onChange: function (e) { setNested('proactive', 'ownerMentionEnabled', e.target.checked); },
              }),
              h('span', { style: s.note, children: privateSession ? '仅群聊生效；私聊不可勾选' : '偶尔在群聊里 @你，向你吐槽、分享趣事或告状' }),
            ),
            (policy.proactive && policy.proactive.ownerMentionEnabled && !privateSession) ? h('div', { style: s.section },
              h('h4', { style: s.sectionTitle, children: '@主人 详细设置' }),
              h('p', { style: s.sectionNote, children: '冷场主动开口或普通接话时都可能触发；每次命中还要过概率、冷却和每日上限，不会每条都 @。' }),
              h('div', { style: s.grid },
                NumberField({ label: '命中概率', value: Math.round(((policy.proactive.ownerMentionChance || 0) * 100)), min: 0, max: 100, unit: '%', onChange: function (v) { setNested('proactive', 'ownerMentionChance', v / 100); } }),
                NumberField({ label: '每日保底', value: (policy.proactive.ownerMentionMinPerDay === undefined ? 1 : policy.proactive.ownerMentionMinPerDay), min: 0, max: 50, unit: '次', onChange: function (v) { setNested('proactive', 'ownerMentionMinPerDay', v); } }),
                NumberField({ label: '最小间隔', value: Math.round(((policy.proactive.ownerMentionCooldownMs || 0) / 60000)), min: 0, max: 1440, unit: '分钟', onChange: function (v) { setNested('proactive', 'ownerMentionCooldownMs', v * 60000); } }),
                NumberField({ label: '每日上限', value: (policy.proactive.ownerMentionMaxPerDay === undefined ? 3 : policy.proactive.ownerMentionMaxPerDay), min: 0, max: 50, unit: '次', onChange: function (v) { setNested('proactive', 'ownerMentionMaxPerDay', v); } }),
              ),
              h('p', { style: s.note, children: '每日保底：当天次数未达到该值时不看概率，达到后按命中概率；仍受每日上限和间隔约束。' }),
            ) : null,
            (policy.proactive && policy.proactive.mode !== 'legacy') ? h('div', { style: s.section },
              h('h4', { style: s.sectionTitle, children: '概率与峰谷' }),
              h('p', { style: s.sectionNote, children: '命中线 = 峰/谷基础线 × 时机因子 + 没中加成；掷 0~100 小于命中线才开口。' }),
              h('div', { style: s.grid },
                NumberField({ label: '尝试间隔', value: Math.round(((policy.proactive && policy.proactive.intervalMs) || 0) / 60000), min: 1, max: 1440, unit: '分钟', onChange: function (v) { setNested('proactive', 'intervalMs', v * 60000); } }),
                NumberField({ label: '峰时命中线', value: (policy.proactive && policy.proactive.peakLine) || 0, min: 0, max: 100, unit: '%', onChange: function (v) { setNested('proactive', 'peakLine', v); } }),
                NumberField({ label: '谷时命中线', value: (policy.proactive && policy.proactive.offPeakLine) || 0, min: 0, max: 100, unit: '%', onChange: function (v) { setNested('proactive', 'offPeakLine', v); } }),
                NumberField({ label: '近时机阈值', value: (policy.proactive && policy.proactive.nearMinutes) || 0, min: 0, max: 100000, unit: '分钟', onChange: function (v) { setNested('proactive', 'nearMinutes', v); } }),
                NumberField({ label: '近因子', value: (policy.proactive && policy.proactive.nearFactor) || 0, min: 0, max: 100, step: 0.05, onChange: function (v) { setNested('proactive', 'nearFactor', v); } }),
                NumberField({ label: '远时机阈值', value: (policy.proactive && policy.proactive.farMinutes) || 0, min: 0, max: 100000, unit: '分钟', onChange: function (v) { setNested('proactive', 'farMinutes', v); } }),
                NumberField({ label: '远因子', value: (policy.proactive && policy.proactive.farFactor) || 0, min: 0, max: 100, step: 0.05, onChange: function (v) { setNested('proactive', 'farFactor', v); } }),
                NumberField({ label: '没中加成', value: (policy.proactive && policy.proactive.missBonus) || 0, min: 0, max: 100, unit: '%/次', onChange: function (v) { setNested('proactive', 'missBonus', v); } }),
                NumberField({ label: '加成上限', value: (policy.proactive && policy.proactive.missBonusMax) || 0, min: 0, max: 100, unit: '%', onChange: function (v) { setNested('proactive', 'missBonusMax', v); } }),
                NumberField({ label: '主动冷却', value: Math.round(((policy.proactive && policy.proactive.cooldownMs) || 0) / 60000), min: 0, max: 1440, unit: '分钟', onChange: function (v) { setNested('proactive', 'cooldownMs', v * 60000); } }),
                NumberField({ label: '每日上限', value: (policy.proactive && policy.proactive.maxPerDay) || 0, min: 0, max: 1000, unit: '次', onChange: function (v) { setNested('proactive', 'maxPerDay', v); } }),
                NumberField({ label: '安静时段起', value: (policy.proactive && policy.proactive.quietStart) || 0, min: 0, max: 23, unit: '点', onChange: function (v) { setNested('proactive', 'quietStart', v); } }),
                NumberField({ label: '安静时段止', value: (policy.proactive && policy.proactive.quietEnd) || 0, min: 0, max: 23, unit: '点', onChange: function (v) { setNested('proactive', 'quietEnd', v); } }),
              ),
            ) : h('div', null,
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
            ),
          ) : h('p', { style: s.note, children: '这个群还没有策略。' }),
        ),

        h('div', { style: { ...s.card, display: tab === 'chat' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '聊天频率（按群设置）' }),
          h(Row, { label: '群' },
            h('select', { style: s.input, value: groupId, onChange: function (e) { pickGroup(e.target.value); } },
              sessionIds.map(function (id) { return h('option', { key: id, value: id, children: sessionLabel(id) }); }),
              groupIds.length === 0 ? h('option', { value: '', children: '（还没有群）' }) : null,
            ),
          ),
          policy ? h('div', null,
            Section({ title: '红包', note: '识别到红包时用模型发一句感谢。当前 NapCat 没有领取接口，不能保证抢到；不会伪造“已领取”。' }, [
              h('label', { style: { ...s.field, gridColumn: '1 / -1' } },
                h('span', { style: s.fieldLabel, children: '启用红包识别与感谢' }),
                h('input', { type: 'checkbox', checked: !!(policy && policy.redPacketEnabled), onChange: function (e) { setP('redPacketEnabled', e.target.checked); } }),
              ),
              NumberField({ label: '感谢概率', value: Math.round(((policy && policy.redPacketThanksChance) === undefined ? 1 : policy.redPacketThanksChance) * 100), min: 0, max: 100, unit: '%', onChange: function (v) { setP('redPacketThanksChance', v / 100); } }),
            ]),
            h('div', { style: s.infoCard },
              h('div', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-primary)' }, children: '她现在的心情（按群）' }),
              moodData
                ? h('div', null,
                    h('div', { style: { marginTop: '4px' }, children: (moodData.label || '未知') + ' · ' + (moodData.mood === undefined ? '—' : moodData.mood) + ' / 100' + (moodData.lastConfidence === undefined ? '' : ' · 可信度 ' + moodData.lastConfidence) }),
                    h('div', { style: { marginTop: '2px', color: 'var(--dsw-alias-label-tertiary)' }, children: moodData.lastReason || '还没有可用的心情判断。' }),
                    h('div', { style: { marginTop: '4px', fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' }, children: '情绪：' + Object.entries(moodData.dims || {}).filter(function (entry) { return Math.abs(Number(entry[1])) >= 1; }).map(function (entry) { return entry[0] + ' ' + entry[1]; }).join(' / ') }),
                  )
                : h('div', { style: s.note, children: '正在读取心情…' }),
              h('button', { style: { ...s.btn, marginTop: '6px' }, onClick: function () { void resetMoodNow(); }, children: '重置到基线' }),
            ),
            Section({ title: '心情参数', note: '心情只作语气背景；低可信度不会注入。' }, [
              NumberField({ label: '启用心情', value: policy.moodEnabled === false ? 0 : 1, min: 0, max: 1, unit: '1=开 0=关', onChange: function (v) { setP('moodEnabled', v !== 0); } }),
              NumberField({ label: '基线', value: policy.moodBaseline === undefined ? 70 : policy.moodBaseline, min: 0, max: 100, unit: '分', onChange: function (v) { setP('moodBaseline', v); } }),
              NumberField({ label: '下限', value: policy.moodFloor === undefined ? 0 : policy.moodFloor, min: 0, max: 100, unit: '分', onChange: function (v) { setP('moodFloor', v); } }),
              NumberField({ label: '回稳半衰期', value: policy.moodHalfLifeHours === undefined ? 12 : policy.moodHalfLifeHours, min: 1, max: 168, unit: '小时', onChange: function (v) { setP('moodHalfLifeHours', v); } }),
              NumberField({ label: '注入可信度', value: policy.moodConfidence === undefined ? 60 : policy.moodConfidence, min: 0, max: 100, unit: '%', onChange: function (v) { setP('moodConfidence', v); } }),
              NumberField({ label: '每天注入上限', value: policy.moodDailyInject === undefined ? 6 : policy.moodDailyInject, min: 0, max: 50, unit: '次', onChange: function (v) { setP('moodDailyInject', v); } }),
            ]),
            h(Row, { label: '评分阈值' },
              h('input', { style: s.input, type: 'number', min: '0', max: '100', value: policy.scoreThreshold || 0, onChange: function (e) { setP('scoreThreshold', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '0~100：分数达到阈值才进入候选；真正概率 = 分数/100' }),
            ),
            Section({ title: '评分权重', note: '分数 = 基础分 + 各加成 - 各扣分；具体阈值/概率仍按群设置。' }, [
              NumberField({ label: '基础分', value: scoreWeights.base === undefined ? 15 : scoreWeights.base, min: 0, max: 100, unit: '分', onChange: function (v) { setScoreWeight('base', v); } }),
              NumberField({ label: '关键词倍率', value: scoreWeights.keywordMultiplier === undefined ? 50 : scoreWeights.keywordMultiplier, min: 0, max: 500, unit: '×', onChange: function (v) { setScoreWeight('keywordMultiplier', v); } }),
              NumberField({ label: '指定成员倍率', value: scoreWeights.memberMultiplier === undefined ? 50 : scoreWeights.memberMultiplier, min: 0, max: 500, unit: '×', onChange: function (v) { setScoreWeight('memberMultiplier', v); } }),
              NumberField({ label: '同一人接着说', value: scoreWeights.sameSpeaker === undefined ? 30 : scoreWeights.sameSpeaker, min: 0, max: 100, unit: '分', onChange: function (v) { setScoreWeight('sameSpeaker', v); } }),
              NumberField({ label: '接着她的话', value: scoreWeights.continuation === undefined ? 20 : scoreWeights.continuation, min: 0, max: 100, unit: '分', onChange: function (v) { setScoreWeight('continuation', v); } }),
              NumberField({ label: '直接接', value: scoreWeights.directContinuation === undefined ? 10 : scoreWeights.directContinuation, min: 0, max: 100, unit: '分', onChange: function (v) { setScoreWeight('directContinuation', v); } }),
              NumberField({ label: '第二人称「你」', value: scoreWeights.secondPerson === undefined ? 15 : scoreWeights.secondPerson, min: 0, max: 100, unit: '分', onChange: function (v) { setScoreWeight('secondPerson', v); } }),
              NumberField({ label: '@ 别人扣分', value: scoreWeights.atOtherPenalty === undefined ? 30 : scoreWeights.atOtherPenalty, min: 0, max: 100, unit: '分', onChange: function (v) { setScoreWeight('atOtherPenalty', v); } }),
              NumberField({ label: '引用别人扣分', value: scoreWeights.replyOtherPenalty === undefined ? 25 : scoreWeights.replyOtherPenalty, min: 0, max: 100, unit: '分', onChange: function (v) { setScoreWeight('replyOtherPenalty', v); } }),
              NumberField({ label: '被冷落每次扣', value: scoreWeights.ignoredPenalty === undefined ? 8 : scoreWeights.ignoredPenalty, min: 0, max: 100, unit: '分', onChange: function (v) { setScoreWeight('ignoredPenalty', v); } }),
              NumberField({ label: '单条消息扣', value: scoreWeights.singleMessagePenalty === undefined ? 5 : scoreWeights.singleMessagePenalty, min: 0, max: 100, unit: '分', onChange: function (v) { setScoreWeight('singleMessagePenalty', v); } }),
              NumberField({ label: '短消息扣', value: scoreWeights.shortMessagePenalty === undefined ? 8 : scoreWeights.shortMessagePenalty, min: 0, max: 100, unit: '分', onChange: function (v) { setScoreWeight('shortMessagePenalty', v); } }),
              NumberField({ label: '短消息字数阈值', value: scoreWeights.shortMessageChars === undefined ? 6 : scoreWeights.shortMessageChars, min: 0, max: 100, unit: '字', onChange: function (v) { setScoreWeight('shortMessageChars', v); } }),
            ]),
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
            h(Row, { label: '被隔开时引用' },
              h('input', { type: 'checkbox', checked: policy.quoteWhenSeparated !== false, onChange: function (e) { setP('quoteWhenSeparated', e.target.checked); } }),
              h('span', { style: s.note, children: '要回的消息不是最新一条时，发送时带 QQ 引用；不会额外调用模型，token 基本不变，只多一个 reply 段' }),
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
          ) : h('p', { style: s.note, children: '这个群还没有策略。' }),
        ),

        h('div', { style: { ...s.card, display: tab === 'memory' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '记忆与上下文' }),
          h('p', { style: s.note, children: '按群设置；压缩会把最旧的一段变成摘要和关键记忆，原文默认归档到 memory-archive.jsonl。' }),
          h(Row, { label: '群' },
            h('select', { style: s.input, value: groupId, onChange: function (e) { pickGroup(e.target.value); } },
              sessionIds.map(function (id) { return h('option', { key: id, value: id, children: sessionLabel(id) }); }),
            ),
          ),
          policy ? h('div', null,
            h(Row, { label: '最近上下文条数' },
              h('input', { style: s.input, type: 'number', min: '1', max: '100', value: policy.contextTurns || 24, onChange: function (e) { setP('contextTurns', Number(e.target.value)); } }),
            ),
            h(Row, { label: '记忆 v3' },
              h('input', { type: 'checkbox', checked: policy.memoryV3Enabled !== false, onChange: function (e) { setP('memoryV3Enabled', e.target.checked); } }),
              h('span', { style: s.note, children: '按证据召回 + 淡忘；关闭后回退旧 keyMemories' }),
            ),
            h(Row, { label: 'v3 提炼频率' },
              h('input', { style: s.fieldInput, type: 'number', min: '0', max: '200', value: policy.memoryV3ExtractEveryTurns === undefined ? 12 : policy.memoryV3ExtractEveryTurns, onChange: function (e) { setP('memoryV3ExtractEveryTurns', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '轮/次；0 = 只在压缩时提炼' }),
            ),
            h(Row, { label: 'v3 召回上限' },
              h('input', { style: s.fieldInput, type: 'number', min: '1', max: '20', value: policy.memoryV3MaxItems === undefined ? 6 : policy.memoryV3MaxItems, onChange: function (e) { setP('memoryV3MaxItems', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '条' }),
              h('input', { style: s.fieldInput, type: 'number', min: '100', max: '4000', value: policy.memoryV3MaxChars === undefined ? 800 : policy.memoryV3MaxChars, onChange: function (e) { setP('memoryV3MaxChars', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '字' }),
              h('input', { style: s.fieldInput, type: 'number', min: '0', max: '100', step: '0.05', value: Math.round((policy.memoryV3Threshold === undefined ? 0.35 : policy.memoryV3Threshold) * 100), onChange: function (e) { setP('memoryV3Threshold', Number(e.target.value) / 100); } }),
              h('span', { style: s.note, children: '证据门槛 %' }),
            ),
            h(Row, { label: '原始记忆上限' },
              h('input', { style: s.input, type: 'number', min: '20', max: '5000', value: policy.memoryMaxTurns || 200, onChange: function (e) { setP('memoryMaxTurns', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '条' }),
              h('input', { style: s.input, type: 'number', min: '500', max: '200000', value: policy.memoryMaxTokens || 12000, onChange: function (e) { setP('memoryMaxTokens', Number(e.target.value)); } }),
              h('span', { style: s.note, children: 'tokens 预算' }),
            ),
            h(Row, { label: '摘要长度' },
              h('input', { style: s.input, type: 'number', min: '200', max: '20000', value: policy.summaryMaxChars || 2000, onChange: function (e) { setP('summaryMaxChars', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '字' }),
              h('span', { style: s.note, children: '压缩方式' }),
              h('select', { style: s.input, value: policy.compressMode || 'hybrid', onChange: function (e) { setP('compressMode', e.target.value); } },
                h('option', { value: 'extractive', children: '提取式（不调模型）' }),
                h('option', { value: 'llm', children: '模型摘要 + 关键记忆' }),
                h('option', { value: 'hybrid', children: '混合（推荐）' }),
              ),
            ),
            h(Row, { label: '压缩频率' },
              h('span', { style: s.note, children: '每新增' }),
              h('input', { style: s.input, type: 'number', min: '5', max: '200', value: policy.compressEveryTurns || 40, onChange: function (e) { setP('compressEveryTurns', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '条压缩一次；关键记忆上限' }),
              h('input', { style: s.input, type: 'number', min: '0', max: '500', value: policy.keyMemoryMax || 50, onChange: function (e) { setP('keyMemoryMax', Number(e.target.value)); } }),
              h('label', { style: { ...s.note, display: 'inline-flex', alignItems: 'center', gap: '3px' } },
                h('input', { type: 'checkbox', checked: policy.archiveEnabled !== false, onChange: function (e) { setP('archiveEnabled', e.target.checked); } }),
                '归档原文',
              ),
            ),
          ) : null,
          h('div', { style: { ...s.row, marginTop: '8px' } },
            h('button', { style: s.btn, onClick: function () { void loadMemory(groupId); }, children: '刷新记忆' }),
            h('button', { style: s.btn, onClick: compressMemory, children: '立即压缩' }),
          ),
          memoryData ? h('div', { style: { marginTop: '8px' } },
            h('div', { style: s.row },
              h('span', { style: s.label, children: '新记忆' }),
              h('input', { style: s.input, value: memoryDraft, placeholder: '一条只讲一件事', onChange: function (e) { setMemoryDraft(e.target.value); } }),
              h('button', { style: s.btn, onClick: addMemoryDraft, children: '添加 v3' }),
              h('button', { style: s.btn, onClick: addKeyMemoryDraft, children: '添加关键' }),
            ),
            h('p', { style: s.note, children: '当前：' + memoryData.turns + ' 条原始消息，估算 ' + memoryData.estimatedTokens + ' tokens；关键记忆 ' + ((memoryData.keyMemories && memoryData.keyMemories.length) || 0) + ' 条' }),
            h('div', { style: s.row },
              h('span', { style: s.label, children: '摘要' }),
              h('textarea', { style: { ...s.area, minHeight: '100px' }, value: summaryDraft, onChange: function (e) { setSummaryDraft(e.target.value); } }),
              h('button', { style: s.btn, onClick: saveSummary, children: '保存摘要' }),
            ),
            memoryData.memoryV3 ? h('div', { style: { marginTop: '8px', padding: '8px', borderRadius: '8px', background: 'rgba(127,127,127,.06)', fontSize: '12px' } },
              h('div', { style: { fontWeight: 600, marginBottom: '3px' }, children: '记忆 v3（会淡忘 / 按证据召回）' }),
              h('div', { children: '有效 ' + memoryData.memoryV3.active + ' / 总 ' + memoryData.memoryV3.total + ' 条；其中长期事实 ' + memoryData.memoryV3.stable + ' 条' }),
              memoryData.lastRecall ? h('div', { style: { marginTop: '4px', color: 'var(--dsw-alias-label-tertiary)' }, children: '最近召回：选中 ' + memoryData.lastRecall.selected.length + ' 条，未入选 ' + memoryData.lastRecall.rejected.length + ' 条，共 ' + memoryData.lastRecall.chars + ' 字；查询：' + String(memoryData.lastRecall.query || '').slice(0, 40) }) : h('div', { style: { marginTop: '4px', color: 'var(--dsw-alias-label-tertiary)' }, children: '还没有召回记录；下一轮回复后会生成。' }),
              h('div', { style: { marginTop: '6px', maxHeight: '260px', overflow: 'auto' } },
                (memoryData.memoryV3Items || []).length === 0
                  ? h('div', { style: { color: 'var(--dsw-alias-label-tertiary)' }, children: '还没有 v3 条目。' })
                  : (memoryData.memoryV3Items || []).map(function (item) {
                      if (memoryEditing && memoryEditing.id === item.id) {
                        return h('div', { key: item.id, style: { padding: '6px 0', borderTop: '1px solid var(--dsw-alias-border-l2)' } },
                          h('input', { style: s.input, value: memoryEditing.text, onChange: function (e) { setMemoryEditing({ ...memoryEditing, text: e.target.value }); } }),
                          h('div', { style: { ...s.row, marginTop: '4px' } },
                            h('select', { style: s.input, value: memoryEditing.category, onChange: function (e) { setMemoryEditing({ ...memoryEditing, category: e.target.value }); } },
                              ['stable_profile', 'preference', 'relationship', 'inside_joke', 'event', 'fact'].map(function (c) { return h('option', { key: c, value: c, children: c }); }),
                            ),
                            h('input', { style: { ...s.input, maxWidth: '80px' }, type: 'number', min: '0', max: '1', step: '0.05', value: memoryEditing.importance, onChange: function (e) { setMemoryEditing({ ...memoryEditing, importance: Number(e.target.value) }); } }),
                            h('button', { style: s.btn, onClick: saveEditingMemory, children: '保存' }),
                            h('button', { style: s.btn, onClick: function () { setMemoryEditing(null); }, children: '取消' }),
                          ),
                        );
                      }
                      return h('div', { key: item.id, style: { display: 'flex', gap: '6px', alignItems: 'flex-start', padding: '4px 0', borderTop: '1px solid var(--dsw-alias-border-l2)' } },
                        h('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)', minWidth: '52px' }, children: item.category + (item.factKey ? ' · ' + item.factKey : '') }),
                        h('span', { style: { fontSize: '12px', flex: 1, textDecoration: item.supersededBy ? 'line-through' : 'none', opacity: item.supersededBy ? 0.55 : 1 }, children: item.text + (item.supersededBy ? '（已被新记忆取代）' : '') }),
                        h('button', { style: s.btn, onClick: function () { startEditMemory(item); }, children: '改' }),
                        h('button', { style: s.btn, onClick: function () { removeMemoryV3(item); }, children: '删' }),
                      );
                    }),
              ),
            ) : null,
            (memoryData.keyMemories || []).length > 0 ? h('div', { style: { marginTop: '6px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' } },
              h('div', { style: { ...s.note, marginBottom: '2px' }, children: '关键记忆 ' + memoryData.keyMemories.length + ' 条（滚动查看）' }),
              memoryData.keyMemories.map(function (m) {
                return h('div', { key: m.id, style: { ...s.row, padding: '3px 0' } },
                  h('span', { style: { fontSize: '12px', flex: 1 }, children: '[' + m.kind + '] ' + m.text + (m.pinned ? '（置顶）' : '') }),
                  h('button', { style: s.btn, onClick: function () { removeKeyMemory(m.id); }, children: '删除' }),
                );
              }),
            ) : h('p', { style: s.note, children: '还没有关键记忆；压缩后模型会自动抽取。' }),
            h('div', { style: { marginTop: '10px', padding: '8px', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l2)' } },
              h('div', { style: { fontWeight: 600, marginBottom: '3px' }, children: '永久记忆（不摘要、不淡忘、不自动删除）' }),
              h('p', { style: s.note, children: '自动记录主人和名单里的人说的话；容量满了只封存并提示，不会丢旧记忆。可手动新增、删除、多选 AI 合并。' }),
              h(Row, { label: '启用' },
                h('input', { type: 'checkbox', checked: !!(settings.permanent && settings.permanent.enabled !== false), onChange: function (e) { setSettings({ ...settings, permanent: { ...(settings.permanent || {}), enabled: e.target.checked } }); } }),
                h('span', { style: s.note, children: '关闭后不自动记录，也不注入提示词' }),
              ),
              h(Row, { label: '自动记录' },
                h('input', { type: 'checkbox', checked: !!(settings.permanent && settings.permanent.autoCapture !== false), onChange: function (e) { setSettings({ ...settings, permanent: { ...(settings.permanent || {}), autoCapture: e.target.checked } }); } }),
                h('span', { style: s.note, children: '主人始终包含' }),
              ),
              h(Row, { label: '容量' },
                h('input', { style: s.input, type: 'number', min: '10', max: '5000', value: (settings.permanent && settings.permanent.capacity) || 200, onChange: function (e) { setSettings({ ...settings, permanent: { ...(settings.permanent || {}), capacity: Number(e.target.value) } }); } }),
                h('span', { style: s.note, children: '条/会话；满了只封存' }),
                h('input', { style: s.input, type: 'number', min: '10', max: '2000', value: (settings.permanent && settings.permanent.globalCapacity) || 100, onChange: function (e) { setSettings({ ...settings, permanent: { ...(settings.permanent || {}), globalCapacity: Number(e.target.value) } }); } }),
                h('span', { style: s.note, children: '条全局' }),
              ),
              h('label', { style: { ...s.field, gridColumn: '1 / -1' } },
                h('span', { style: s.fieldLabel, children: '重要的人（一行一个 QQ 号；主人自动包含）' }),
                h('textarea', { style: { ...s.input, width: '100%', minHeight: '52px' }, value: ((settings.permanent && settings.permanent.people) || []).join('\n'), onChange: function (e) {
                  var people = e.target.value.split(/\r?\n/u).map(function (x) { return x.trim(); }).filter(function (x) { return /^\d{5,12}$/u.test(x); });
                  setSettings({ ...settings, permanent: { ...(settings.permanent || {}), people: people } });
                } }),
              ),
              permanentData
                ? (function () {
                    var bucket = permanentData[permanentScope] || { items: [], count: 0, capacity: 0, sealed: false };
                    return h('div', { style: { marginTop: '6px' } },
                      h('div', { style: { ...s.row, marginTop: '4px' } },
                        h('span', { style: s.label, children: '范围' }),
                        h('select', { style: s.input, value: permanentScope, onChange: function (e) { setPermanentScope(e.target.value); setPermanentSelected([]); } },
                          h('option', { value: 'session', children: '本会话（不跨群）' }),
                          h('option', { value: 'global', children: '全局主人记忆（跨会话）' }),
                        ),
                        permanentScope === 'global'
                          ? h('label', { style: { ...s.note, display: 'inline-flex', alignItems: 'center', gap: '3px' } },
                              h('input', { type: 'checkbox', checked: permanentPrivate, onChange: function (e) { setPermanentPrivate(e.target.checked); } }),
                              '私密（只在主人私聊读取，绝不进群）',
                            )
                          : null,
                        h('span', { style: s.note, children: '当前 ' + (bucket.count || 0) + ' / ' + (bucket.capacity || 0) + ' 条' + (bucket.sealed ? ' · 已满，请删除或合并' : '') }),
                        h('button', { style: s.btn, onClick: function () { void loadPermanent(groupId); }, children: '刷新' }),
                      ),
                      h('p', { style: s.note, children: permanentScope === 'global' ? '全局记忆只在主人私聊或主人本人在群里说话时读取；私密内容不会进群。' : '只在这个群/私聊读取，不跨群。' }),
                      h('div', { style: { ...s.row, marginTop: '4px' } },
                        h('input', { style: s.input, value: permanentDraft, placeholder: '手动新增一条永久记忆', onChange: function (e) { setPermanentDraft(e.target.value); } }),
                        h('button', { style: s.btn, disabled: permanentBusy || permanentDraft.trim() === '', onClick: addPermanentDraft, children: '添加' }),
                        h('button', { style: s.btn, disabled: permanentBusy || permanentSelected.length < 2, onClick: mergePermanent, children: 'AI 合并选中（' + permanentSelected.length + '）' }),
                      ),
                      (bucket.items || []).length === 0
                        ? h('p', { style: s.note, children: '还没有永久记忆。' })
                        : h('div', { style: { maxHeight: '260px', overflow: 'auto', marginTop: '4px' } },
                            (bucket.items || []).map(function (item) {
                              var checked = permanentSelected.indexOf(item.id) >= 0;
                              return h('div', { key: item.id, style: { display: 'flex', gap: '6px', alignItems: 'flex-start', padding: '5px 0', borderTop: '1px solid var(--dsw-alias-border-l2)' } },
                                h('input', { type: 'checkbox', checked: checked, onChange: function (e) {
                                  setPermanentSelected(function (prev) {
                                    return e.target.checked ? prev.concat([item.id]) : prev.filter(function (id) { return id !== item.id; });
                                  });
                                } }),
                                h('div', { style: { flex: 1, fontSize: '12px', whiteSpace: 'pre-wrap' } },
                                  h('div', { style: s.note, children: new Date(item.createdAt).toLocaleString() + ' · ' + item.source + (item.sensitivity === 'private' ? ' · 私密' : '') + (item.people && item.people.length ? ' · ' + item.people.join(',') : '') }),
                                  item.text,
                                ),
                                permanentScope === 'session'
                                  ? h('button', { style: s.btn, disabled: permanentBusy, title: '只提升主人相关的内容；全局容量可能已满', onClick: function () { void promotePermanentItem(item.id); }, children: '提升' })
                                  : null,
                                h('button', { style: s.btn, disabled: permanentBusy, onClick: function () { void removePermanent(item.id); }, children: '删' }),
                              );
                            }),
                          ),
                    );
                  })()
                : h('p', { style: s.note, children: '正在读取永久记忆…' }),
            ),
            h('p', { style: s.note, children: '提示：记忆设置点页面顶部「保存全部」后生效；关键记忆增删即时保存。' }),
          ) : h('p', { style: s.note, children: '点「刷新记忆」读取当前群状态。' }),
        ),

        h('div', { style: { ...s.card, display: tab === 'stickers' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '表情包' }),
          h(Row, { label: '群' },
            h('select', { style: s.input, value: groupId, onChange: function (e) { pickGroup(e.target.value); } },
              sessionIds.map(function (id) { return h('option', { key: id, value: id, children: sessionLabel(id) }); }),
            ),
          ),
          policy ? h('div', null,
            h(Row, { label: '允许发图' },
              h('input', { type: 'checkbox', checked: !!policy.imageEnabled, onChange: function (e) { setP('imageEnabled', e.target.checked); } }),
              h('span', { style: s.note, children: '关闭后任何情况下都不发图/表情包' }),
            ),
            h(Row, { label: '自动发图概率' },
              h('input', { style: s.fieldInput, type: 'number', min: '0', max: '100', value: Math.round((policy.imageChance || 0) * 100), onChange: function (e) { setP('imageChance', Number(e.target.value) / 100); } }),
              h('span', { style: s.note, children: '%（模型想发时，按这个概率真的发）' }),
            ),
            h(Row, { label: '被要求发图概率' },
              h('input', { style: s.fieldInput, type: 'number', min: '0', max: '100', value: Math.round((policy.requestedImageChance === undefined ? 0.9 : policy.requestedImageChance) * 100), onChange: function (e) { setP('requestedImageChance', Number(e.target.value) / 100); } }),
              h('span', { style: s.note, children: '%（群友明确说“发个表情包/来张图”时使用；100% = 必发）' }),
            ),
            h(Row, { label: '发送方式' },
              h('label', { style: { display: 'inline-flex', gap: '4px', alignItems: 'center', fontSize: '13px' } },
                h('input', { type: 'checkbox', checked: policy.stickerModelChoice !== false, onChange: function (e) { setP('stickerModelChoice', e.target.checked); } }),
                '模型自主选择',
              ),
              h('label', { style: { display: 'inline-flex', gap: '4px', alignItems: 'center', fontSize: '13px' } },
                h('input', { type: 'checkbox', checked: policy.stickerAutoChance !== false, onChange: function (e) { setP('stickerAutoChance', e.target.checked); } }),
                '按概率强制发送',
              ),
              h('span', { style: s.note, children: '两个都关 = 只有群友明确要图才发' }),
            ),
          ) : null,
          policy ? h('p', { style: s.note, children: '自拍已并入常用表情包库：把带“尾巴/自拍”标签的图放进常用表情包，明确要自拍时会按关键词选图，不再单独设置自拍库。' }) : null,
          policy ? h('div', { style: { ...s.section, display: 'none' } },
            h('h4', { style: s.sectionTitle, children: '鲸鱼娘自拍照' }),
            h('p', { style: s.sectionNote, children: '独立于普通表情包；只放角色形象素材，不要放真人照片。没有素材时只按正常文字聊天，不会明说“没有照片”。' }),
            h(Row, { label: '允许自拍' },
              h('input', { type: 'checkbox', checked: policy.selfieEnabled !== false, onChange: function (e) { setP('selfieEnabled', e.target.checked); } }),
              h('span', { style: s.note, children: '“爆个照/看看你/看看尾巴”时启用' }),
            ),
            h(Row, { label: '自拍概率' },
              h('input', { style: s.fieldInput, type: 'number', min: '0', max: '100', value: Math.round((policy.selfieChance === undefined ? 0.8 : policy.selfieChance) * 100), onChange: function (e) { setP('selfieChance', Number(e.target.value) / 100); } }),
              h('span', { style: s.note, children: '%（100% = 有素材时必发；没有素材时安静地只发文字）' }),
            ),
            h(Row, { label: '自拍方式' },
              h('label', { style: { display: 'inline-flex', gap: '4px', alignItems: 'center', fontSize: '13px' } },
                h('input', { type: 'checkbox', checked: policy.selfieOnRequest !== false, onChange: function (e) { setP('selfieOnRequest', e.target.checked); } }),
                '明确要求时发',
              ),
              h('label', { style: { display: 'inline-flex', gap: '4px', alignItems: 'center', fontSize: '13px' } },
                h('input', { type: 'checkbox', checked: policy.selfieAutoChance === true, onChange: function (e) { setP('selfieAutoChance', e.target.checked); } }),
                '允许随机自愿发',
              ),
              h('span', { style: s.note, children: '随机自拍按上面的自拍概率' }),
            ),
            h(Row, { label: '额外触发词' },
              h('input', { style: { ...s.input, flex: '1 1 240px' }, value: (policy.selfieKeywords || []).join(','), placeholder: '尾巴,耳朵,鱼尾,自拍', onChange: function (e) { setP('selfieKeywords', e.target.value.split(/[,，\\s]+/).map(function (x) { return x.trim(); }).filter(Boolean)); } }),
              h('span', { style: s.note, children: '逗号/空格分隔' }),
            ),
            h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' } },
              h('span', { style: s.fieldLabel, children: '素材 ' + selfies.length + ' 张' }),
              h('button', { style: s.btn, onClick: openSelfieDir, children: '打开文件夹' }),
              h('label', { style: { ...s.btn, cursor: 'pointer' }, children: [
                selfieUploading ? '上传中…' : '上传图片',
                h('input', { key: 'input', type: 'file', accept: 'image/*', multiple: true, disabled: selfieUploading, onChange: function (e) { void uploadSelfies(e.target.files); e.target.value = ''; }, style: { display: 'none' } }),
              ] }),
            ),
            h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '8px', marginTop: '8px' } },
              selfies.length === 0
                ? h('p', { style: s.note, children: '还没有自拍照。把角色图放进文件夹或点「上传图片」。' })
                : selfies.map(function (item) {
                    return h('div', { key: item.file, style: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '8px', overflow: 'hidden', position: 'relative' } },
                      h('img', { src: BASE + '/selfies/file?name=' + encodeURIComponent(item.file), alt: item.file, style: { width: '100%', height: '96px', objectFit: 'cover', display: 'block' } }),
                      h('div', { style: { fontSize: '10px', padding: '3px 5px', color: 'var(--dsw-alias-label-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: item.file }),
                      h('button', { style: { position: 'absolute', right: '3px', top: '3px', border: 'none', borderRadius: '5px', padding: '1px 5px', cursor: 'pointer', fontSize: '11px' }, onClick: function () { void deleteSelfieFile(item.file); }, children: '×' }),
                    );
                  }),
            ),
          ) : null,
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
            h('span', { style: s.note, children: '打开后，只有通过下面“入库过滤”的图片才会进暂存仓库' }),
          ),
          h(Row, { label: '入库过滤' },
            h('select', { style: s.input, value: settings.stickerFilter || 'smart', onChange: function (e) { setSettings({ ...settings, stickerFilter: e.target.value }); } },
              h('option', { value: 'smart', children: '智能（只收像表情包的，跳过截图/大照片）' }),
              h('option', { value: 'all', children: '全部保存到暂存仓库' }),
            ),
          ),
          h(Row, { label: '新图默认仓库' },
            h('select', { style: s.input, value: settings.stickerSaveRepo || 'inbox', onChange: function (e) { setSettings({ ...settings, stickerSaveRepo: e.target.value }); } },
              stickerRepos.map(function (repo) { return h('option', { key: repo.id, value: repo.id, children: repo.name + (repo.weight > 0 ? '（权重 ' + repo.weight + '%）' : '（不自动发送）') }); }),
            ),
            h('span', { style: s.note, children: '整理好后再手动移到常用仓库' }),
          ),
          h(Row, { label: '入库后 AI 识别' },
            h('input', { type: 'checkbox', checked: settings.stickerAnalyzeOnSave === true, onChange: function (e) { setSettings({ ...settings, stickerAnalyzeOnSave: e.target.checked }); } }),
            h('span', { style: s.note, children: '默认关闭省 token；需要时可在整理时手动识别' }),
          ),
          h(Row, { label: '全局上限' },
            h('input', { style: s.input, type: 'number', min: '20', max: '2000', value: settings.stickerMax || 300, onChange: function (e) { setSettings({ ...settings, stickerMax: Number(e.target.value) }); } }),
            h('span', { style: s.note, children: '张' }),
            h('input', { style: s.input, type: 'number', min: '20', max: '5000', value: settings.stickerMaxMB || 200, onChange: function (e) { setSettings({ ...settings, stickerMaxMB: Number(e.target.value) }); } }),
            h('span', { style: s.note, children: 'MB（仓库自身上限优先；单张 ≤2 MB）' }),
          ),
          h('div', { style: { ...s.card, marginTop: '8px' } },
            h('h4', { style: { fontSize: '13px', margin: '0 0 6px' }, children: '表情包仓库（权重为相对值，0 = 只手动使用）' }),
            stickerRepos.map(function (repo) {
              const items = stickerItems.filter(function (item) { return item.repoId === repo.id; });
              const bytes = items.reduce(function (sum, item) { return sum + (item.bytes || 0); }, 0);
              return h('div', { key: repo.id, style: { ...s.row, flexWrap: 'wrap', gap: '6px', padding: '4px 0' } },
                h('input', { style: { ...s.input, width: '120px' }, value: repo.name, onChange: function (e) { setStickerRepos(function (prev) { return prev.map(function (x) { return x.id === repo.id ? { ...x, name: e.target.value } : x; }); }); } }),
                h('span', { style: s.note, children: '权重' }),
                h('input', { style: { ...s.input, width: '64px' }, type: 'number', min: '0', max: '100', value: repo.weight, onChange: function (e) { setStickerRepos(function (prev) { return prev.map(function (x) { return x.id === repo.id ? { ...x, weight: Number(e.target.value) } : x; }); }); } }),
                h('span', { style: s.note, children: '%' }),
                h('label', { style: { ...s.note, display: 'inline-flex', alignItems: 'center', gap: '3px' } },
                  h('input', { type: 'checkbox', checked: repo.enabled !== false, onChange: function (e) { setStickerRepos(function (prev) { return prev.map(function (x) { return x.id === repo.id ? { ...x, enabled: e.target.checked } : x; }); }); } }),
                  '启用',
                ),
                h('span', { style: s.note, children: items.length + ' 张 / ' + (bytes / 1024 / 1024).toFixed(1) + ' MB' }),
                stickerRepos.length > 1 ? h('button', { style: s.btn, onClick: function () { setStickerRepos(function (prev) { return prev.filter(function (x) { return x.id !== repo.id; }); }); } }, '删除') : null,
              );
            }),
            h('div', { style: { ...s.row, marginTop: '6px' } },
              h('button', { style: s.btn, onClick: addStickerRepo, children: '新建仓库' }),
              h('button', { style: { ...s.btn, ...s.primary }, onClick: saveStickerRepos, children: '保存仓库设置' }),
              h('span', { style: s.note, children: '删除仓库后保存，里面的图会移到第一个仓库' }),
            ),
          ),
          h(Row, { label: '整理选中' },
            h('select', { style: s.input, value: stickerTarget, onChange: function (e) { setStickerTarget(e.target.value); } },
              stickerRepos.map(function (repo) { return h('option', { key: repo.id, value: repo.id, children: repo.name }); }),
            ),
            h('button', { style: s.btn, onClick: moveSelectedStickers, children: '移动到这里' }),
            h('button', { style: s.btn, onClick: deleteSelectedStickers, children: '删除选中' }),
            h('span', { style: s.note, children: '已选 ' + stickerSelected.length + ' 张' }),
          ),
          stickerItems.length > 0 ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', maxHeight: '360px', overflow: 'auto' } },
            stickerItems.slice(0, 120).map(function (item) {
              const repo = stickerRepos.filter(function (x) { return x.id === item.repoId; })[0];
              return h('label', { key: item.file, style: { width: '150px', border: '1px solid rgba(127,127,127,.25)', borderRadius: '6px', padding: '4px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px', cursor: 'pointer' } },
                h('img', { src: BASE + '/stickers/file?name=' + encodeURIComponent(item.file), style: { width: '100%', height: '96px', objectFit: 'contain', background: 'rgba(127,127,127,.08)' } }),
                h('input', { type: 'checkbox', checked: stickerSelected.indexOf(item.file) >= 0, onChange: function () { toggleSticker(item.file); } }),
                h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: (repo ? repo.name : item.repoId) + ' · ' + item.description }),
                h('button', { style: { ...s.btn, padding: '1px 5px', fontSize: '10px' }, onClick: function (e) { e.preventDefault(); e.stopPropagation(); void editSticker(item); } }, '编辑'),
              );
            }),
          ) : h('p', { style: s.note, children: '还没有表情包；打开自动保存或直接把图片放进素材库文件夹。' }),
          stickerItems.length > 120 ? h('p', { style: s.note, children: '只显示最近 120 张；完整内容请打开文件夹整理。' }) : null,
          h(Row, { label: '素材库文件夹' },
            h('span', { style: s.note, children: stickerDir || '（加载中）' }),
            h('button', { style: s.btn, onClick: openStickerDir, children: '打开文件夹' }),
            h('button', { style: s.btn, onClick: function () { void loadStickers(); }, children: '刷新' }),
          ),
        ),

        h('div', { style: { ...s.card, display: tab === 'file' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '文件阅读' }),
          h('p', { style: s.note, children: '支持 txt/md/json/csv/代码、PDF 文本层、DOCX、XLSX；扫描件/PPT 暂不支持。文件内容只作为资料，不会被当成指令。' }),
          h(Row, { label: '群' },
            h('select', { style: s.input, value: groupId, onChange: function (e) { pickGroup(e.target.value); } },
              sessionIds.map(function (id) { return h('option', { key: id, value: id, children: sessionLabel(id) }); }),
            ),
          ),
          policy ? h('div', null,
            h(Row, { label: '读取策略' },
              h('select', { style: s.input, value: policy.fileReadMode || 'custom', onChange: function (e) { setP('fileReadMode', e.target.value); } },
                h('option', { value: 'off', children: '关闭（不下载文件）' }),
                h('option', { value: 'custom', children: '自定义（下面多选）' }),
                h('option', { value: 'all', children: '所有文件都读' }),
              ),
            ),
            policy.fileReadMode === 'custom' ? h(Row, { label: '读取条件' },
              [['at', '@ / 叫名字 / 引用她'], ['context', '强相关上下文'], ['question', '文字里让她读/总结/分析']].map(function (item) {
                const modes = policy.fileReadModes || [];
                return h('label', { key: item[0], style: { display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '10px', fontSize: '13px' } },
                  h('input', {
                    type: 'checkbox',
                    checked: modes.indexOf(item[0]) >= 0,
                    onChange: function (e) {
                      const next = e.target.checked ? Array.from(new Set(modes.concat(item[0]))) : modes.filter(function (m) { return m !== item[0]; });
                      setP('fileReadModes', next);
                    },
                  }),
                  item[1],
                );
              }),
            ) : null,
            h(Row, { label: '大小 / 字数' },
              h('input', { style: s.input, type: 'number', min: '1', max: '100', value: policy.fileMaxMB || 10, onChange: function (e) { setP('fileMaxMB', Number(e.target.value)); } }),
              h('span', { style: s.note, children: 'MB；最多提取' }),
              h('input', { style: s.input, type: 'number', min: '1000', max: '200000', value: policy.fileMaxChars || 30000, onChange: function (e) { setP('fileMaxChars', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '字' }),
            ),
            h(Row, { label: '每日上限' },
              h('input', { style: s.input, type: 'number', min: '0', max: '200', value: policy.fileDailyLimit === undefined ? 20 : policy.fileDailyLimit, onChange: function (e) { setP('fileDailyLimit', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '个文件（0 = 不限）' }),
            ),
            h('h4', { style: { fontSize: '13px', margin: '10px 0 4px' }, children: '合并转发' }),
            h(Row, { label: '读取策略' },
              h('select', { style: s.input, value: policy.forwardReadMode || 'custom', onChange: function (e) { setP('forwardReadMode', e.target.value); } },
                h('option', { value: 'off', children: '关闭' }),
                h('option', { value: 'custom', children: '自定义（多选）' }),
                h('option', { value: 'all', children: '所有转发都读' }),
              ),
            ),
            policy.forwardReadMode === 'custom' ? h(Row, { label: '读取条件' },
              [['at', '@ / 叫名字 / 引用她'], ['context', '强相关上下文'], ['question', '文字里让她看/总结']].map(function (item) {
                const modes = policy.forwardReadModes || [];
                return h('label', { key: 'f-' + item[0], style: { display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '10px', fontSize: '13px' } },
                  h('input', {
                    type: 'checkbox',
                    checked: modes.indexOf(item[0]) >= 0,
                    onChange: function (e) {
                      const next = e.target.checked ? Array.from(new Set(modes.concat(item[0]))) : modes.filter(function (m) { return m !== item[0]; });
                      setP('forwardReadModes', next);
                    },
                  }),
                  item[1],
                );
              }),
            ) : null,
            h(Row, { label: '转发上限' },
              h('input', { style: s.input, type: 'number', min: '1', max: '200', value: policy.forwardMaxNodes || 50, onChange: function (e) { setP('forwardMaxNodes', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '条 /' }),
              h('input', { style: s.input, type: 'number', min: '500', max: '50000', value: policy.forwardMaxChars || 10000, onChange: function (e) { setP('forwardMaxChars', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '字' }),
            ),
          ) : h('p', { style: s.note, children: '先在上面选一个群。' }),
        ),

        h('div', { style: { ...s.card, display: tab === 'voice' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '语音（edge-tts / 本地 TTS）' }),
          h('p', { style: s.note, children: '回复/主动开口时把文字合成 QQ 语音；音色和参数是全局的，概率按群。' }),
          h(Row, { label: '群' },
            h('select', { style: s.input, value: groupId, onChange: function (e) { pickGroup(e.target.value); } },
              sessionIds.map(function (id) { return h('option', { key: id, value: id, children: sessionLabel(id) }); }),
            ),
          ),
          h(Row, { label: '试听句子' },
            h('input', { style: { ...s.input, flex: '1 1 320px' }, value: previewText, onChange: function (e) { setPreviewText(e.target.value); } }),
            h('button', { type: 'button', style: s.btn, disabled: preview && preview.loading, onClick: previewVoice, children: preview && preview.loading ? '合成中…' : '试听这段' }),
            preview && preview.url ? h('audio', { controls: true, src: preview.url, style: { height: '30px', maxWidth: '260px' } }) : null,
          ),
          h(Row, { label: '服务状态' },
            h('button', { type: 'button', style: s.btn, onClick: checkTtsHealth, children: '检查网关' }),
            h('span', { style: s.note, children: ttsHealth === null ? '未检查' : ttsHealth.ok === true ? '在线：' + (ttsHealth.endpoint || '') : '离线：' + (ttsHealth.message || ttsHealth.error || '无法连接') }),
          ),
          h(Row, { label: '语音后端' },
            h('select', { style: s.input, value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts && cfg.qq.config.tts.provider) || 'edge', onChange: function (e) { var v = e.target.value; setTts({ provider: v, endpoint: v === 'gpt-sovits' ? 'http://127.0.0.1:50123' : '', ...(v === 'edge' ? { voice: DEFAULT_VOICE } : {}) }); } },
              h('option', { value: 'edge', children: 'Edge TTS（快，无情感控制）' }),
              h('option', { value: 'gpt-sovits', children: 'GPT-SoVITS（本地，角色音色）' }),
            ),
            h('span', { style: s.note, children: 'GPT-SoVITS 需要本地网关' }),
          ),
          h('p', { style: s.note, children: '选 GPT-SoVITS 时，音色、情绪、语速参数由本地网关和角色权重决定；Edge 使用内置音色。' }),
          h(Row, { label: '本地 TTS 网关' },
            h('input', { style: { ...s.input, flex: '1 1 240px' }, value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts && cfg.qq.config.tts.endpoint) || 'http://127.0.0.1:50123', onChange: function (e) { setTts({ endpoint: e.target.value }); } }),
            h('span', { style: s.note, children: 'GPT-SoVITS 50123' }),
          ),
          h(Row, { label: '服务启动脚本' },
            h('input', { style: { ...s.input, flex: '1 1 320px' }, value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts && cfg.qq.config.tts.serviceScript) || '', placeholder: 'C:\\DSHwork\\models\\tts\\start-tts-all.bat', onChange: function (e) { setTts({ serviceScript: e.target.value }); } }),
            h('span', { style: s.note, children: '点「启动」时若网关离线，会自动运行这个脚本' }),
          ),
          h(Row, { label: 'GPT-SoVITS 情绪' },
            h('select', { style: s.input, value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts && cfg.qq.config.tts.style) || '', onChange: function (e) { setTts({ style: e.target.value }); } },
              h('option', { value: '', children: '自动（跟随每条回复的情绪）' }),
              ['开心', '生气', '吃惊', '中立', '难过', '厌恶', '恐惧', '喘息'].map(function (x) { return h('option', { key: x, value: x, children: x }); }),
            ),
            h('span', { style: s.note, children: '自动 = 用模型给这条回复判定的 emotion；固定档会覆盖所有回复；喘息仅霍霍有独立参考音' }),
          ),
          h(Row, { label: '音高偏移' },
            h('input', { style: { width: '220px' }, type: 'range', min: '-6', max: '6', step: '1', value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts && cfg.qq.config.tts.pitchSemitones) || 0, onChange: function (e) { setTts({ pitchSemitones: Number(e.target.value) }); } }),
            h('span', { style: s.note, children: ((cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts && cfg.qq.config.tts.pitchSemitones) || 0) + ' 半音（只对 GPT-SoVITS 生效）' }),
          ),
          h(Row, { label: '语速倍率' },
            h('input', { style: { width: '220px' }, type: 'range', min: '0.7', max: '1.5', step: '0.05', value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts && cfg.qq.config.tts.speed) || 1, onChange: function (e) { setTts({ speed: Number(e.target.value) }); } }),
            h('span', { style: s.note, children: ((cfg && cfg.qq && cfg.qq.config && cfg.qq.config.tts && cfg.qq.config.tts.speed) || 1) + 'x（只对 GPT-SoVITS 生效）' }),
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
          h('p', { style: s.note, children: 'RVC 变声已移除；语音只保留 Edge 和 GPT-SoVITS。' }),
          policy ? h('div', null,
            h(Row, { label: '回复语音概率' },
              h('input', { style: s.input, type: 'number', min: '0', max: '100', value: Math.round((policy.voiceChance || 0) * 100), onChange: function (e) { setP('voiceChance', Number(e.target.value) / 100); } }),
              h('span', { style: s.note, children: '%（每一条符合条件的文字回复独立掷骰，不再等模型选择）' }),
            ),
            h(Row, { label: '被要求发语音概率' },
              h('input', { style: s.fieldInput, type: 'number', min: '0', max: '100', value: Math.round((policy.requestedVoiceChance === undefined ? 1 : policy.requestedVoiceChance) * 100), onChange: function (e) { setP('requestedVoiceChance', Number(e.target.value) / 100); } }),
              h('span', { style: s.note, children: '%（明确说“发个语音/说句话/听听你声音”时使用；100% = 必发）' }),
            ),
            h(Row, { label: '语音字数上限' },
              h('input', { style: s.input, type: 'number', min: '0', max: '500', value: policy.voiceMaxChars === undefined ? 80 : policy.voiceMaxChars, onChange: function (e) { setP('voiceMaxChars', Number(e.target.value)); } }),
              h('span', { style: s.note, children: '字；超过就只发文字，0 = 不限制' }),
            ),
            h(Row, { label: '唱歌概率' },
              h('input', { style: s.fieldInput, type: 'number', min: '0', max: '100', value: Math.round((policy.singChance || 0) * 100), onChange: function (e) { setP('singChance', Number(e.target.value) / 100); } }),
              h('span', { style: s.note, children: '%（模型自己想唱歌时，按这个概率真的唱）' }),
            ),
            h(Row, { label: '被要求唱歌概率' },
              h('input', { style: s.fieldInput, type: 'number', min: '0', max: '100', value: Math.round((policy.requestedSingChance === undefined ? 1 : policy.requestedSingChance) * 100), onChange: function (e) { setP('requestedSingChance', Number(e.target.value) / 100); } }),
              h('span', { style: s.note, children: '%（明确说“唱首歌/点歌”时使用；100% = 必唱）' }),
            ),
          ) : h('p', { style: s.note, children: '先在上面选一个群。' }),
        ),

        h('div', { style: { ...s.card, display: tab === 'diary' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '鲸鱼娘的日记' }),
          h('p', { style: s.note, children: '群聊记忆与内心吐槽（模型的 thought，不会发到群里）；带评分、熟识度、好感度。' }),
          h(Row, { label: '群' },
            h('select', { style: s.input, value: diaryGroup, onChange: function (e) { pickDiaryGroup(e.target.value); } },
              h('option', { value: '', children: '全部群' }),
              sessionIds.map(function (id) { return h('option', { key: id, value: id, children: sessionLabel(id) }); }),
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
          diary.length === 0 ? h('p', { style: s.note, children: '还没有记录。' }) : h('div', {
            style: { maxHeight: '62vh', overflowY: 'auto', paddingRight: '6px' },
            onScroll: function (e) {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) void loadMoreDiary();
            },
          },
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
            h('div', { style: { ...s.row, justifyContent: 'center', padding: '10px 0' } },
              diaryHasMore
                ? h('button', { style: s.btn, disabled: diaryLoadingMore, onClick: function () { void loadMoreDiary(); }, children: diaryLoadingMore ? '加载中…' : '加载更早的日记' })
                : h('span', { style: s.note, children: '已经到底了' }),
            ),
          ),
        ),

        h('div', { style: { ...s.card, display: tab === 'qzone' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: 'QQ空间' }),
          h('p', { style: s.note, children: '让她把生活/日记写成说说。默认仅自己可见；发布前建议先生成草稿。' }),
          h(Row, { label: '启用' },
            h('input', { type: 'checkbox', checked: !!(settings.qzone && settings.qzone.enabled), onChange: function (e) { setSettings({ ...settings, qzone: { ...(settings.qzone || {}), enabled: e.target.checked } }); } }),
            h('span', { style: s.note, children: '关闭时不会发布，但草稿仍可生成' }),
          ),
          h(Row, { label: '发布模式' },
            h('select', { style: s.input, value: (settings.qzone && settings.qzone.mode) || 'draft', onChange: function (e) { setSettings({ ...settings, qzone: { ...(settings.qzone || {}), mode: e.target.value } }); } },
              h('option', { value: 'manual', children: '手动：只自己写/发' }),
              h('option', { value: 'draft', children: '草稿：生成后等我确认' }),
              h('option', { value: 'auto', children: '自动：按概率直接发（风险高）' }),
            ),
          ),
          h(Row, { label: '可见范围' },
            h('select', { style: s.input, value: (settings.qzone && settings.qzone.ugcRight) || 64, onChange: function (e) { setSettings({ ...settings, qzone: { ...(settings.qzone || {}), ugcRight: Number(e.target.value) } }); } },
              h('option', { value: 64, children: '仅自己可见（推荐）' }),
              h('option', { value: 4, children: '好友可见' }),
              h('option', { value: 1, children: '所有人可见' }),
            ),
          ),
          h(Row, { label: '每日上限 / 间隔' },
            h('input', { style: s.input, type: 'number', min: '0', max: '20', value: (settings.qzone && settings.qzone.dailyLimit) || 1, onChange: function (e) { setSettings({ ...settings, qzone: { ...(settings.qzone || {}), dailyLimit: Number(e.target.value) } }); } }),
            h('span', { style: s.note, children: '条/天，间隔' }),
            h('input', { style: s.input, type: 'number', min: '0', max: '1440', value: (settings.qzone && settings.qzone.minIntervalMinutes) || 120, onChange: function (e) { setSettings({ ...settings, qzone: { ...(settings.qzone || {}), minIntervalMinutes: Number(e.target.value) } }); } }),
            h('span', { style: s.note, children: '分钟' }),
          ),
          h(Row, { label: '自动概率' },
            h('input', { style: s.input, type: 'number', min: '0', max: '100', value: Math.round(((settings.qzone && settings.qzone.autoChance) || 0.2) * 100), onChange: function (e) { setSettings({ ...settings, qzone: { ...(settings.qzone || {}), autoChance: Number(e.target.value) / 100 } }); } }),
            h('span', { style: s.note, children: '%（仅 auto 模式；还要过每日上限）' }),
          ),
          Section({ title: '配图', note: '从表情包仓库选图，最多 9 张；只读取本地图片，不额外上传到别处。' }, [
            h('label', { style: { ...s.field, gridColumn: '1 / -1' } },
              h('span', { style: s.fieldLabel, children: '配图模式' }),
              h('select', { style: s.input, value: (settings.qzone && settings.qzone.imageMode) || 'off', onChange: function (e) { setQzone({ imageMode: e.target.value }); } },
                h('option', { value: 'off', children: '不配图' }),
                h('option', { value: 'fixed', children: '固定张数' }),
                h('option', { value: 'range', children: '区间随机' }),
                h('option', { value: 'model', children: '模型决定 0~9 张' }),
              ),
            ),
            ((settings.qzone && settings.qzone.imageMode) === 'fixed')
              ? NumberField({ label: '固定张数', value: (settings.qzone && settings.qzone.imageFixed) || 0, min: 0, max: 9, unit: '张', onChange: function (v) { setQzone({ imageFixed: v }); } })
              : null,
            ((settings.qzone && settings.qzone.imageMode) === 'range')
              ? h('div', { style: s.grid },
                  NumberField({ label: '最少', value: (settings.qzone && settings.qzone.imageMin) || 0, min: 0, max: 9, unit: '张', onChange: function (v) { setQzone({ imageMin: v }); } }),
                  NumberField({ label: '最多', value: (settings.qzone && settings.qzone.imageMax) || 3, min: 0, max: 9, unit: '张', onChange: function (v) { setQzone({ imageMax: v }); } }),
                )
              : null,
            h('div', { style: { gridColumn: '1 / -1', marginTop: '4px' } },
              h('div', { style: s.fieldLabel, children: '取图仓库（不选 = 全部）' }),
              h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' } },
                stickerRepos.map(function (repo) {
                  var id = String(repo.id || repo.name || '');
                  var selected = ((settings.qzone && settings.qzone.imageRepos) || []).indexOf(id) >= 0;
                  return h('label', { key: id, style: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' } },
                    h('input', { type: 'checkbox', checked: selected, onChange: function (e) {
                      var list = ((settings.qzone && settings.qzone.imageRepos) || []).slice();
                      if (e.target.checked) { if (list.indexOf(id) < 0) list.push(id); }
                      else list = list.filter(function (x) { return x !== id; });
                      setQzone({ imageRepos: list });
                    } }),
                    h('span', { children: repo.name || id }),
                  );
                }),
              ),
            ),
          ]),
          Section({ title: '文本 @', note: 'NapCat 没有真正的空间 @ 接口；这里只是正文写「@昵称」，不保证对方收到通知。' }, [
            h('label', { style: { ...s.field } },
              h('span', { style: s.fieldLabel, children: '@ 模式' }),
              h('select', { style: s.input, value: (settings.qzone && settings.qzone.mentionMode) || 'off', onChange: function (e) { setQzone({ mentionMode: e.target.value }); } },
                h('option', { value: 'off', children: '不 @' }),
                h('option', { value: 'list', children: '从名单随机' }),
                h('option', { value: 'model', children: '交给模型决定' }),
              ),
            ),
            NumberField({ label: '@ 概率', value: Math.round(((settings.qzone && settings.qzone.mentionChance) || 0.3) * 100), min: 0, max: 100, unit: '%', onChange: function (v) { setQzone({ mentionChance: v / 100 }); } }),
            h('label', { style: { ...s.field, gridColumn: '1 / -1' } },
              h('span', { style: s.fieldLabel, children: '名单（一行一个：QQ=昵称）' }),
              h('textarea', { style: { ...s.input, width: '100%', minHeight: '64px' }, value: ((settings.qzone && settings.qzone.mentionList) || []).map(function (m) { return m.qq + '=' + m.name; }).join('\n'), onChange: function (e) {
                var list = e.target.value.split(/\r?\n/u).map(function (line) {
                  var m = /^(\d{5,12})\s*[=,，\s]\s*(.*)$/u.exec(line.trim());
                  return m ? { qq: m[1], name: (m[2] || m[1]).trim().slice(0, 30) } : null;
                }).filter(Boolean);
                setQzone({ mentionList: list });
              } }),
            ),
          ]),
          Section({ title: '远程读取（Qzone cookie，风险）', note: '默认关闭。启用后会用 NapCat 的 Qzone cookie 读取说说和评论，可能触发风控；只建议手动读取，不要高频轮询。' }, [
            h('label', { style: { ...s.field } },
              h('span', { style: s.fieldLabel, children: '启用远程读取' }),
              h('input', { type: 'checkbox', checked: !!(settings.qzone && settings.qzone.remoteEnabled), onChange: function (e) { setQzone({ remoteEnabled: e.target.checked }); } }),
            ),
            h('label', { style: { ...s.field } },
              h('span', { style: s.fieldLabel, children: '接受风险' }),
              h('input', { type: 'checkbox', checked: !!(settings.qzone && settings.qzone.remoteRiskAccepted), onChange: function (e) { setQzone({ remoteRiskAccepted: e.target.checked }); } }),
            ),
            h('label', { style: { ...s.field } },
              h('span', { style: s.fieldLabel, children: '读取评论' }),
              h('input', { type: 'checkbox', checked: !!(settings.qzone && settings.qzone.commentEnabled), onChange: function (e) { setQzone({ commentEnabled: e.target.checked }); } }),
            ),
            h('label', { style: { ...s.field } },
              h('span', { style: s.fieldLabel, children: '评论风险' }),
              h('input', { type: 'checkbox', checked: !!(settings.qzone && settings.qzone.commentRiskAccepted), onChange: function (e) { setQzone({ commentRiskAccepted: e.target.checked }); } }),
            ),
            h('label', { style: { ...s.field, gridColumn: '1 / -1' } },
              h('span', { style: s.fieldLabel, children: '读取谁的 QQ（留空 = 自己）' }),
              h('input', { style: { ...s.input, flex: '1 1 180px' }, value: qzoneRemoteUin, onChange: function (e) { setQzoneRemoteUin(e.target.value); }, placeholder: '留空读自己' }),
              h('button', { style: s.btn, disabled: qzoneRemoteBusy, onClick: function () { void loadQzoneRemote(qzoneRemoteUin.trim()); }, children: qzoneRemoteBusy ? '读取中…' : '读取空间' }),
            ),
          ]),
          qzoneRemote
            ? h('div', { style: { marginTop: '8px', fontSize: '12px' } },
                qzoneRemote.ok === true
                  ? h('div', null,
                      h('div', { style: s.note, children: '读取到 ' + (qzoneRemote.entries || []).length + ' 条；' + (qzoneRemote.risk || '') }),
                      (qzoneRemote.entries || []).slice(0, 10).map(function (entry) {
                        return h('div', { key: entry.tid || String(entry.ts), style: { padding: '6px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)' } },
                          h('div', { style: s.note, children: new Date(entry.ts).toLocaleString() }),
                          h('div', { children: entry.content }),
                          (entry.comments || []).length > 0
                            ? h('div', { style: s.note, children: '评论：' + entry.comments.map(function (c) { return (c.name || c.uin) + '：' + c.content; }).join(' / ') })
                            : null,
                        );
                      }),
                    )
                  : h('p', { style: { ...s.note, ...s.bad }, children: '读取失败：' + (qzoneRemote.message || '未知错误') }),
              )
            : null,
          h(Row, { label: '草稿' },
            h('button', { style: s.btn, disabled: qzoneBusy, onClick: generateQzone, children: qzoneBusy ? '生成中…' : '用今天日记生成' }),
            h('button', { style: { ...s.btn, ...s.primary }, disabled: qzoneBusy || qzoneDraft.trim() === '', onClick: publishQzone, children: '发布到空间' }),
            h('button', { style: s.btn, onClick: function () { void loadQzone(); }, children: '刷新' }),
          ),
          h('textarea', { style: { ...s.input, width: '100%', minHeight: '110px', marginTop: '6px' }, value: qzoneDraft, placeholder: '生成的草稿会出现在这里，可以改完再发', onChange: function (e) { setQzoneDraft(e.target.value); } }),
          h('div', { style: { marginTop: '6px', display: 'flex', gap: '10px', flexWrap: 'wrap' } },
            h('span', { style: s.note, children: '草稿配图：' + (qzoneImages.length > 0 ? qzoneImages.length + ' 张' : '无') }),
            qzoneImages.length > 0 ? h('button', { style: { ...s.btn, fontSize: '11px', padding: '3px 8px' }, onClick: function () { setQzoneImages([]); }, children: '清空配图' }) : null,
          ),
          h('div', { style: { marginTop: '8px' } },
            h('span', { style: s.note, children: qzoneData && qzoneData.available === true ? 'NapCat 空间接口可用' : 'NapCat 未连接或空间接口不可用' }),
          ),
          h('h4', { style: { fontSize: '13px', margin: '14px 0 4px' }, children: '已发布' }),
          h(Row, { label: '筛选' },
            h('input', { style: s.input, type: 'date', value: qzoneFrom, onChange: function (e) { setQzoneFrom(e.target.value); } }),
            h('span', { style: s.note, children: '到' }),
            h('input', { style: s.input, type: 'date', value: qzoneTo, onChange: function (e) { setQzoneTo(e.target.value); } }),
            h('select', { style: s.input, value: qzoneOrder, onChange: function (e) { setQzoneOrder(e.target.value); } },
              h('option', { value: 'desc', children: '最新在前' }),
              h('option', { value: 'asc', children: '最早在前' }),
            ),
            h('button', { style: s.btn, onClick: function () { void loadQzone(); }, children: '刷新' }),
            h('span', { style: s.note, children: '共 ' + ((qzoneData && qzoneData.total) || 0) + ' 条' }),
          ),
          (qzoneData && Array.isArray(qzoneData.entries) && qzoneData.entries.length > 0)
            ? h('div', {
                style: { maxHeight: '60vh', overflowY: 'auto', paddingRight: '6px' },
                onScroll: function (e) {
                  const el = e.currentTarget;
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) void loadMoreQzone();
                },
              },
                qzoneData.entries.map(function (entry) {
                  return h('div', { key: entry.tid || String(entry.ts), style: { padding: '8px 0', borderBottom: '1px solid var(--dsw-alias-border-l2)', fontSize: '13px' } },
                    h('div', { style: s.note, children: new Date(entry.ts).toLocaleString() + ' · ' + (entry.ugcRight === 1 ? '所有人' : entry.ugcRight === 4 ? '好友' : '仅自己') + (Array.isArray(entry.images) && entry.images.length > 0 ? ' · 配图 ' + entry.images.length + ' 张' : '') }),
                    h('div', { children: entry.content }),
                    entry.tid ? h('button', { style: { ...s.btn, fontSize: '11px', padding: '3px 8px', marginTop: '6px' }, disabled: qzoneBusy, onClick: function () { void deleteQzone(entry.tid); }, children: '删除这条' }) : null,
                  );
                }),
                h('div', { style: { ...s.row, justifyContent: 'center', padding: '10px 0' } },
                  qzoneHasMore
                    ? h('button', { style: s.btn, disabled: qzoneLoadingMore, onClick: function () { void loadMoreQzone(); }, children: qzoneLoadingMore ? '加载中…' : '加载更早的说说' })
                    : h('span', { style: s.note, children: '已经到底了' }),
                ),
              )
            : h('p', { style: s.note, children: '还没有发布记录。' }),
        ),

        h('div', { style: { ...s.card, display: tab === 'lists' ? 'block' : 'none' } },
          h('h3', { style: { fontSize: '14px', margin: 0 }, children: '用户画像与关系' }),
          h('div', { style: s.infoCard },
            h('div', { style: { fontWeight: 600, color: 'var(--dsw-alias-label-primary)', marginBottom: '4px' }, children: '关系语气档位（提示词硬性规则）' }),
            h('div', { children: '熟识度：<20 陌生、保持距离；20~44 认识、正常友好；45~74 熟悉、可调侃/用昵称/主动关心；≥75 很熟、可互损/撒娇/吐槽。' }),
            h('div', { children: '好感度：≤-30 反感、冷淡简短不主动帮忙；-29~-1 略疏远；0~29 普通；30~59 有好感、温和关心；≥60 亲近、更耐心更愿意解释，但不会无脑舔。' }),
            h('div', { style: s.note, children: '下面的数值决定画像涨落速度；所有“每日上限”填 0 表示不限。' }),
          ),
          Section({ title: '主人（全局）', note: '所有群共用同一组熟识度/好感度；主人不会被日常互动或衰减改动。' }, [
            NumberField({ label: '主人熟识度', value: settings.ownerFamiliarity === undefined ? 60 : settings.ownerFamiliarity, min: 0, max: 100, unit: '/100', onChange: function (v) { setSettings({ ...settings, ownerFamiliarity: v }); } }),
            NumberField({ label: '主人好感度', value: settings.ownerAffinity === undefined ? 80 : settings.ownerAffinity, min: -100, max: 100, unit: '', onChange: function (v) { setSettings({ ...settings, ownerAffinity: v }); } }),
          ]),
          Section({ title: '关系评分加成', note: '只影响价值评分，不影响语气档位。' }, [
            NumberField({ label: '熟识度加成', value: scoreWeights.familiarityMax === undefined ? 8 : scoreWeights.familiarityMax, min: 0, max: 100, unit: '分', onChange: function (v) { setScoreWeight('familiarityMax', v); } }),
            NumberField({ label: '好感度加成', value: scoreWeights.affinityMax === undefined ? 10 : scoreWeights.affinityMax, min: 0, max: 100, unit: '分', onChange: function (v) { setScoreWeight('affinityMax', v); } }),
          ]),
          Section({ title: '熟识度增长', note: '每天首次发言、后续发言、被点名、她回复分别计算，互不占用上限。' }, [
            NumberField({ label: '每日首次发言', value: pr('firstMessageFam', 2), min: 0, max: 100, step: 0.1, unit: '分', onChange: function (v) { setProfileRule('firstMessageFam', v); } }),
            NumberField({ label: '当天后续发言', value: pr('repeatMessageFam', 0.1), min: 0, max: 100, step: 0.1, unit: '分', onChange: function (v) { setProfileRule('repeatMessageFam', v); } }),
            NumberField({ label: '发言每日上限', value: pr('messageFamDailyCap', 4), min: 0, max: 1000, unit: '0=不限', onChange: function (v) { setProfileRule('messageFamDailyCap', v); } }),
            NumberField({ label: '被点名一次', value: pr('mentionFam', 1), min: 0, max: 100, step: 0.1, unit: '分', onChange: function (v) { setProfileRule('mentionFam', v); } }),
            NumberField({ label: '点名每日上限', value: pr('mentionFamDailyCap', 3), min: 0, max: 1000, unit: '0=不限', onChange: function (v) { setProfileRule('mentionFamDailyCap', v); } }),
            NumberField({ label: '她回复你', value: pr('replyFam', 0.5), min: 0, max: 100, step: 0.1, unit: '分', onChange: function (v) { setProfileRule('replyFam', v); } }),
            NumberField({ label: '回复每日上限', value: pr('replyFamDailyCap', 3), min: 0, max: 1000, unit: '0=不限', onChange: function (v) { setProfileRule('replyFamDailyCap', v); } }),
          ]),
          Section({ title: '好感度增长', note: '回复、接话、引用分开计数；敌意扣分单独设置。' }, [
            NumberField({ label: '她回复你', value: pr('replyAffinity', 1), min: 0, max: 100, step: 0.1, unit: '分', onChange: function (v) { setProfileRule('replyAffinity', v); } }),
            NumberField({ label: '回复每日上限', value: pr('replyAffinityDailyCap', 5), min: 0, max: 1000, unit: '0=不限', onChange: function (v) { setProfileRule('replyAffinityDailyCap', v); } }),
            NumberField({ label: '你接她的话', value: pr('continuationAffinity', 2), min: 0, max: 100, step: 0.1, unit: '分', onChange: function (v) { setProfileRule('continuationAffinity', v); } }),
            NumberField({ label: '接话每日上限', value: pr('continuationAffinityDailyCap', 6), min: 0, max: 1000, unit: '0=不限', onChange: function (v) { setProfileRule('continuationAffinityDailyCap', v); } }),
            NumberField({ label: '引用回复她', value: pr('quoteAffinity', 1), min: 0, max: 100, step: 0.1, unit: '分', onChange: function (v) { setProfileRule('quoteAffinity', v); } }),
            NumberField({ label: '引用每日上限', value: pr('quoteAffinityDailyCap', 5), min: 0, max: 1000, unit: '0=不限', onChange: function (v) { setProfileRule('quoteAffinityDailyCap', v); } }),
          ]),
          Section({ title: '敌意与长期衰减', note: '敌意由模型判断；长期不互动按周衰减。' }, [
            NumberField({ label: '轻度敌意扣好感', value: pr('hostilityMildLoss', 2), min: 0, max: 100, unit: '分', onChange: function (v) { setProfileRule('hostilityMildLoss', v); } }),
            NumberField({ label: '严重敌意扣好感', value: pr('hostilitySevereLoss', 4), min: 0, max: 100, unit: '分', onChange: function (v) { setProfileRule('hostilitySevereLoss', v); } }),
            NumberField({ label: '敌意每日上限', value: pr('hostilityDailyCap', 0), min: 0, max: 1000, unit: '0=不限', onChange: function (v) { setProfileRule('hostilityDailyCap', v); } }),
            NumberField({ label: '熟识衰减等待', value: pr('inactiveDaysBeforeFamDecay', 14), min: 0, max: 365, unit: '天', onChange: function (v) { setProfileRule('inactiveDaysBeforeFamDecay', v); } }),
            NumberField({ label: '熟识每周衰减', value: pr('famDecayPerWeek', 10), min: 0, max: 100, step: 0.1, unit: '分', onChange: function (v) { setProfileRule('famDecayPerWeek', v); } }),
            NumberField({ label: '熟识最低保留', value: pr('famDecayFloor', 1), min: 0, max: 100, step: 0.1, unit: '分', onChange: function (v) { setProfileRule('famDecayFloor', v); } }),
            NumberField({ label: '好感衰减等待', value: pr('inactiveDaysBeforeAffinityDecay', 7), min: 0, max: 365, unit: '天', onChange: function (v) { setProfileRule('inactiveDaysBeforeAffinityDecay', v); } }),
            NumberField({ label: '好感每周靠拢', value: pr('affinityDecayPerWeek', 1), min: 0, max: 100, step: 0.1, unit: '分', onChange: function (v) { setProfileRule('affinityDecayPerWeek', v); } }),
          ]),
          Section({ title: '初始好感', note: '只对尚未初始化的画像生效，不会追溯修改老画像。' }, [
            NumberField({ label: '主人初始好感', value: pr('initialOwnerAffinity', 60), min: 0, max: 100, unit: '分', onChange: function (v) { setProfileRule('initialOwnerAffinity', v); } }),
            NumberField({ label: '白名单初始好感', value: pr('initialWhitelistAffinity', 20), min: 0, max: 100, unit: '分', onChange: function (v) { setProfileRule('initialWhitelistAffinity', v); } }),
          ]),
          Section({ title: '名单与开关' }, [
            h('label', { style: { ...s.field, gridColumn: '1 / -1', alignItems: 'center' } },
              h('span', { style: s.fieldLabel, children: '主人 QQ' }),
              h('input', { style: s.fieldInputWide, value: (cfg && cfg.qq && cfg.qq.config && cfg.qq.config.ownerQq) || '', placeholder: 'QQ 号', onChange: function (e) { setCfg({ ...cfg, qq: { ...cfg.qq, config: { ...cfg.qq.config, ownerQq: e.target.value } } }); } }),
            ),
            h('label', { style: { ...s.field, gridColumn: '1 / -1' } },
              h('span', { style: s.fieldLabel, children: '被怼时让模型判断' }),
              h('input', { type: 'checkbox', checked: settings.hostilityJudge !== false, onChange: function (e) { setSettings({ ...settings, hostilityJudge: e.target.checked }); } }),
            ),
            h('div', { style: { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginTop: '4px' } },
              h('div', null,
                h('div', { style: s.fieldLabel, children: '白名单 QQ（一行一个）' }),
                h('textarea', { style: { ...s.area, minHeight: '70px' }, value: (settings.whitelist || []).join('\n'), placeholder: 'QQ号，一行一个', onChange: function (e) { setSettings({ ...settings, whitelist: e.target.value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean) }); } }),
                h('div', { style: s.note, children: '评分下限' }),
                h('input', { style: s.fieldInput, type: 'number', min: '0', max: '100', value: settings.whitelistFloor || 0, onChange: function (e) { setSettings({ ...settings, whitelistFloor: Number(e.target.value) }); } }),
              ),
              h('div', null,
                h('div', { style: s.fieldLabel, children: '黑名单 QQ（一行一个）' }),
                h('textarea', { style: { ...s.area, minHeight: '70px' }, value: (settings.blacklist || []).join('\n'), placeholder: 'QQ号，一行一个', onChange: function (e) { setSettings({ ...settings, blacklist: e.target.value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean) }); } }),
                h('div', { style: s.note, children: '评分上限' }),
                h('input', { style: s.fieldInput, type: 'number', min: '0', max: '100', value: settings.blacklistCeil || 0, onChange: function (e) { setSettings({ ...settings, blacklistCeil: Number(e.target.value) }); } }),
              ),
            ),
          ]),
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
            h('input', { type: 'checkbox', checked: settings.autoStart === true, onChange: function (e) { setSettings({ ...settings, autoStart: e.target.checked }); } }),
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

        h('div', {
          style: {
            textAlign: 'center',
            margin: '18px 0 10px',
            fontSize: '11px',
            color: 'var(--dsw-alias-label-tertiary)',
          },
        },
          '千宇未来 · ',
          h('a', {
            href: 'https://github.com/SenuMirai/dsh-qq-group',
            target: '_blank',
            rel: 'noreferrer',
            style: { color: 'inherit', textDecoration: 'underline' },
          }, 'dsh-qq-group'),
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
