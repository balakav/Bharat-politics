import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;
const useLocalClient = import.meta.env.VITE_USE_BASE44 !== 'true' && !appBaseUrl;

const localUser = {
  id: 'local-user',
  email: 'local@bharat.politics',
  full_name: 'Local Player',
  role: 'admin',
};

const memoryStore = new Map();
const hasWindow = typeof window !== 'undefined';

function storageKey(entityName) {
  return `bharat_politics_local_${entityName}`;
}

function readRows(entityName) {
  if (!hasWindow) return memoryStore.get(entityName) || [];
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(entityName)) || '[]');
  } catch {
    return [];
  }
}

function writeRows(entityName, rows) {
  if (!hasWindow) {
    memoryStore.set(entityName, rows);
    return;
  }
  window.localStorage.setItem(storageKey(entityName), JSON.stringify(rows));
}

function matchesQuery(row, query = {}) {
  return Object.entries(query || {}).every(([key, value]) => {
    if (value === undefined || value === null || value === '') return true;
    return row?.[key] === value;
  });
}

function sortRows(rows, orderBy) {
  if (!orderBy) return rows;
  const desc = String(orderBy).startsWith('-');
  const field = desc ? String(orderBy).slice(1) : String(orderBy);
  return [...rows].sort((a, b) => {
    const av = a?.[field] ?? '';
    const bv = b?.[field] ?? '';
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * (desc ? -1 : 1);
  });
}

function makeEntity(entityName) {
  const read = () => readRows(entityName);
  const write = (rows) => writeRows(entityName, rows);

  return {
    async list(orderBy, limit) {
      const rows = sortRows(read(), orderBy);
      return typeof limit === 'number' ? rows.slice(0, limit) : rows;
    },
    async filter(query = {}, orderBy, limit) {
      const rows = sortRows(read().filter(row => matchesQuery(row, query)), orderBy);
      return typeof limit === 'number' ? rows.slice(0, limit) : rows;
    },
    async get(id) {
      return read().find(row => row.id === id) || { id };
    },
    async create(data = {}) {
      const now = new Date().toISOString();
      const row = {
        id: data.id || `${entityName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        created_date: data.created_date || now,
        updated_date: now,
        created_by_id: data.created_by_id || localUser.id,
        ...data,
      };
      write([row, ...read()]);
      return row;
    },
    async update(id, patch = {}) {
      let updated = null;
      const rows = read().map(row => {
        if (row.id !== id) return row;
        updated = { ...row, ...patch, id, updated_date: new Date().toISOString() };
        return updated;
      });
      if (!updated) {
        updated = { id, ...patch, updated_date: new Date().toISOString() };
        rows.unshift(updated);
      }
      write(rows);
      return updated;
    },
    async delete(id) {
      write(read().filter(row => row.id !== id));
      return { success: true };
    },
    async deleteMany(query = {}) {
      write(read().filter(row => !matchesQuery(row, query)));
      return { success: true };
    },
    async bulkCreate(items = []) {
      const created = [];
      for (const item of items) created.push(await this.create(item));
      return created;
    },
    async bulkUpdate(items = []) {
      const updated = [];
      for (const item of items) updated.push(await this.update(item.id, item));
      return updated;
    },
    subscribe() {
      return () => {};
    },
  };
}

function makeLocalBharat01() {
  const entityCache = new Map();
  const entities = new Proxy({}, {
    get(_target, entityName) {
      if (typeof entityName !== 'string') return undefined;
      if (!entityCache.has(entityName)) entityCache.set(entityName, makeEntity(entityName));
      return entityCache.get(entityName);
    },
  });

  const integrations = {
    Core: {
      async InvokeLLM() {
        return { response: 'Local mode is running without AI/backend services.' };
      },
      async UploadFile({ file } = {}) {
        return { file_url: file ? URL.createObjectURL(file) : '' };
      },
      async ExtractDataFromUploadedFile() {
        return { output: [] };
      },
    },
  };

  return {
    entities,
    integrations,
    asServiceRole: { integrations },
    auth: {
      async me() {
        return localUser;
      },
      logout() {
        return undefined;
      },
      redirectToLogin() {
        return undefined;
      },
      async register() {
        return { success: true };
      },
      async verifyOtp() {
        return { access_token: 'local-token' };
      },
      setToken() {
        return undefined;
      },
      async resendOtp() {
        return { success: true };
      },
      loginWithProvider() {
        return undefined;
      },
      async resetPassword() {
        return { success: true };
      },
    },
    users: {
      async inviteUser(email, role = 'user') {
        return { email, role, success: true };
      },
    },
    functions: new Proxy({}, {
      get() {
        return async () => ({ success: true, local: true });
      },
    }),
  };
}

export const isLocalBharat01 = useLocalClient;

const client = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// Automatic retry with backoff on platform rate limits (HTTP 429), so a burst
// of page loads never surfaces an error to the user — calls simply wait and retry.
const MAX_RETRIES = 3;

function isRateLimitError(e) {
  return Boolean(
    e &&
    (e.status === 429 ||
      e?.response?.status === 429 ||
      String(e?.status) === '429' ||
      /rate.?limit|too many requests/i.test(String(e?.message || '')))
  );
}

function withRetry(fn) {
  return async function (...args) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn.apply(this, args);
      } catch (e) {
        if (!isRateLimitError(e) || attempt >= MAX_RETRIES) throw e;
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1) * (attempt + 1)));
      }
    }
  };
}

// Wraps every entity's operations (list, filter, get, create, update, …) with the retry.
function wrapEntity(entity) {
  return new Proxy(entity, {
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (typeof value === 'function') return withRetry(value.bind(target));
      return value;
    },
  });
}

export const bharat01 = useLocalClient ? makeLocalBharat01() : new Proxy(client, {
  get(target, prop) {
    const value = Reflect.get(target, prop);
    if (prop === 'entities' && value && typeof value === 'object') {
      return new Proxy(value, {
        get(t, entityName) {
          const entity = Reflect.get(t, entityName);
          if (entity && typeof entity === 'object') return wrapEntity(entity);
          return entity;
        },
      });
    }
    if (typeof value === 'function') return value.bind(target);
    return value;
  },
});
