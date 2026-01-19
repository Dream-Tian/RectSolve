import { getConfig, saveConfig, normalizeBaseUrl } from '@/utils/storage';

const elements = {
  baseUrl: document.getElementById('baseUrl') as HTMLInputElement,
  apiKey: document.getElementById('apiKey') as HTMLInputElement,
  model: document.getElementById('model') as HTMLSelectElement,
  fetchModels: document.getElementById('fetchModels') as HTMLButtonElement,
  testConnection: document.getElementById('testConnection') as HTMLButtonElement,
  saveConfig: document.getElementById('saveConfig') as HTMLButtonElement,
  requestPermission: document.getElementById('requestPermission') as HTMLButtonElement,
  status: document.getElementById('status') as HTMLDivElement,
  permissionStatus: document.getElementById('permissionStatus') as HTMLDivElement
};

let cachedModels: string[] = [];

async function loadConfig() {
  const config = await getConfig();
  elements.baseUrl.value = config.baseUrl;
  elements.apiKey.value = config.apiKey;

  if (config.defaultModel) {
    const option = document.createElement('option');
    option.value = config.defaultModel;
    option.textContent = config.defaultModel;
    option.selected = true;
    elements.model.innerHTML = '';
    elements.model.appendChild(option);
    elements.model.disabled = false;
  }
}

function showStatus(message: string, type: 'success' | 'error' | 'info') {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  elements.status.classList.remove('hidden');

  if (type === 'success' || type === 'info') {
    setTimeout(() => {
      elements.status.classList.add('hidden');
    }, 3000);
  }
}

function showPermissionStatus(message: string, type: 'success' | 'error' | 'info') {
  elements.permissionStatus.textContent = message;
  elements.permissionStatus.className = `status ${type}`;
  elements.permissionStatus.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => {
      elements.permissionStatus.classList.add('hidden');
    }, 3000);
  }
}

async function testConnection() {
  const baseUrl = elements.baseUrl.value.trim();
  const apiKey = elements.apiKey.value.trim();

  if (!baseUrl || !apiKey) {
    showStatus('请填写 Base URL 和 API Key', 'error');
    return;
  }

  elements.testConnection.disabled = true;
  showStatus('测试连接中...', 'info');

  try {
    const normalizedUrl = normalizeBaseUrl(baseUrl);
    const response = await fetch(`${normalizedUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.data && Array.isArray(data.data)) {
      cachedModels = data.data.map((m: any) => m.id);
      showStatus(`✅ 连接成功！找到 ${cachedModels.length} 个模型`, 'success');
      elements.fetchModels.disabled = false;
      elements.model.disabled = false;
    } else {
      throw new Error('响应格式不正确');
    }
  } catch (error) {
    showStatus(`❌ 连接失败: ${(error as Error).message}`, 'error');
    console.error('Test connection error:', error);
  } finally {
    elements.testConnection.disabled = false;
  }
}

async function fetchModels() {
  if (cachedModels.length === 0) {
    showStatus('请先测试连接', 'error');
    return;
  }

  elements.model.innerHTML = '';

  cachedModels.forEach(modelId => {
    const option = document.createElement('option');
    option.value = modelId;
    option.textContent = modelId;
    elements.model.appendChild(option);
  });

  showStatus(`✅ 已加载 ${cachedModels.length} 个模型`, 'success');
}

async function handleSaveConfig() {
  const baseUrl = elements.baseUrl.value.trim();
  const apiKey = elements.apiKey.value.trim();
  const model = elements.model.value;

  if (!baseUrl || !apiKey) {
    showStatus('请填写 Base URL 和 API Key', 'error');
    return;
  }

  if (!model) {
    showStatus('请选择默认模型', 'error');
    return;
  }

  try {
    const normalizedUrl = normalizeBaseUrl(baseUrl);
    await saveConfig({
      baseUrl: normalizedUrl,
      apiKey,
      defaultModel: model
    });

    showStatus('✅ 配置已保存', 'success');
  } catch (error) {
    showStatus(`❌ 保存失败: ${(error as Error).message}`, 'error');
    console.error('Save config error:', error);
  }
}

async function requestPermission() {
  const baseUrl = elements.baseUrl.value.trim();

  if (!baseUrl) {
    showPermissionStatus('请先填写 Base URL', 'error');
    return;
  }

  try {
    const normalizedUrl = normalizeBaseUrl(baseUrl);
    const url = new URL(normalizedUrl);
    const origin = `${url.protocol}//${url.host}/*`;

    const granted = await chrome.permissions.request({
      origins: [origin]
    });

    if (granted) {
      showPermissionStatus(`✅ 已授权访问 ${url.host}`, 'success');
    } else {
      showPermissionStatus('❌ 用户拒绝授权', 'error');
    }
  } catch (error) {
    showPermissionStatus(`❌ 授权失败: ${(error as Error).message}`, 'error');
    console.error('Request permission error:', error);
  }
}

elements.testConnection.addEventListener('click', testConnection);
elements.fetchModels.addEventListener('click', fetchModels);
elements.saveConfig.addEventListener('click', handleSaveConfig);
elements.requestPermission.addEventListener('click', requestPermission);

loadConfig();

console.log('[RectSolve Options] Options page initialized');
