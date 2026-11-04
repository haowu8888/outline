/**
 * Data model of the interactive blocks (kanban, gallery, calendar, poll,
 * check-in and encrypted text). The data of each block is stored as JSON in
 * the node so that it travels with the document, Markdown export and API.
 */

export const SMART_BLOCK_KINDS = [
  "kanban",
  "gallery",
  "calendar",
  "poll",
  "checkin",
  "encrypted",
] as const;

export type SmartBlockKind = (typeof SMART_BLOCK_KINDS)[number];

/** Prefix of the drag data types used for drag and drop inside blocks. */
export const BLOCK_DRAG_TYPE = "application/x-outline-block";

/** Upper bound for the serialized data of one block. */
export const MAX_SMART_BLOCK_SIZE = 1024 * 1024;

export const ENCRYPTION_ITERATIONS = 210000;

export type KanbanData = {
  title: string;
  columns: { id: string; title: string }[];
  tasks: { id: string; columnId: string; text: string }[];
};

export type GalleryImage = { id: string; src: string; caption: string };

export type GalleryData = {
  title: string;
  layout: "grid" | "carousel";
  images: GalleryImage[];
};

export type CalendarEvent = { id: string; date: string; title: string };

export type CalendarData = {
  title: string;
  /** The month shown, formatted as YYYY-MM. */
  month: string;
  events: CalendarEvent[];
};

export type PollData = {
  title: string;
  multiple: boolean;
  options: { id: string; text: string }[];
  /** Selected option ids keyed by user id. */
  votes: Record<string, string[]>;
};

export type CheckinEntry = {
  id: string;
  userId: string;
  /** Local date formatted as YYYY-MM-DD. */
  date: string;
  note: string;
};

export type CheckinData = {
  title: string;
  entries: CheckinEntry[];
};

export type EncryptedData = {
  title: string;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

export type SmartBlockData = {
  kanban: KanbanData;
  gallery: GalleryData;
  calendar: CalendarData;
  poll: PollData;
  checkin: CheckinData;
  encrypted: EncryptedData;
};

export function isSmartBlockKind(value: unknown): value is SmartBlockKind {
  return SMART_BLOCK_KINDS.includes(value as SmartBlockKind);
}

export function blockId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Format a date as YYYY-MM-DD in local time. */
export function localDate(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

const str = (value: unknown) => (typeof value === "string" ? value : "");
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object"
      )
    : [];
const id = (value: unknown) => str(value) || blockId();

/**
 * Only allow images served over http(s) or from this server, so stored data
 * can not smuggle in javascript: or data: URLs.
 */
export function safeImageSource(value: string) {
  const src = value.trim();
  if (/^https?:\/\//i.test(src) || /^\/(?!\/)/.test(src)) {
    return src;
  }
  return "";
}

export function defaultBlockData<K extends SmartBlockKind>(
  kind: K
): SmartBlockData[K] {
  const defaults: SmartBlockData = {
    kanban: {
      title: "",
      columns: ["To do", "In progress", "Done"].map((title) => ({
        id: blockId(),
        title,
      })),
      tasks: [],
    },
    gallery: { title: "", layout: "grid", images: [] },
    calendar: { title: "", month: localDate().slice(0, 7), events: [] },
    poll: {
      title: "",
      multiple: false,
      options: [
        { id: blockId(), text: "" },
        { id: blockId(), text: "" },
      ],
      votes: {},
    },
    checkin: { title: "", entries: [] },
    encrypted: {
      title: "",
      iterations: ENCRYPTION_ITERATIONS,
      salt: "",
      iv: "",
      ciphertext: "",
    },
  };
  return defaults[kind];
}

/**
 * Parse stored block data, invalid or missing values fall back to defaults so
 * that a damaged block still renders.
 */
export function parseBlockData<K extends SmartBlockKind>(
  kind: K,
  json: string
): SmartBlockData[K] {
  let value: Record<string, unknown> = {};
  try {
    const parsed = json ? JSON.parse(json) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      value = parsed;
    }
  } catch {
    // fall back to defaults
  }
  if (!Object.keys(value).length) {
    return defaultBlockData(kind);
  }
  const title = str(value.title);
  const result: { [Kind in SmartBlockKind]: () => SmartBlockData[Kind] } = {
    kanban: () => {
      const columns = list(value.columns).map((column) => ({
        id: id(column.id),
        title: str(column.title),
      }));
      const ids = new Set(columns.map((column) => column.id));
      return {
        title,
        columns,
        tasks: list(value.tasks)
          .map((task) => ({
            id: id(task.id),
            columnId: str(task.columnId),
            text: str(task.text),
          }))
          .filter((task) => ids.has(task.columnId)),
      };
    },
    gallery: () => ({
      title,
      layout: value.layout === "carousel" ? "carousel" : "grid",
      images: list(value.images)
        .map((image) => ({
          id: id(image.id),
          src: safeImageSource(str(image.src)),
          caption: str(image.caption),
        }))
        .filter((image) => image.src),
    }),
    calendar: () => ({
      title,
      month: MONTH.test(str(value.month))
        ? str(value.month)
        : localDate().slice(0, 7),
      events: list(value.events)
        .map((event) => ({
          id: id(event.id),
          date: str(event.date),
          title: str(event.title),
        }))
        .filter((event) => DATE.test(event.date)),
    }),
    poll: () => {
      const options = list(value.options).map((option) => ({
        id: id(option.id),
        text: str(option.text),
      }));
      const ids = new Set(options.map((option) => option.id));
      const multiple = value.multiple === true;
      const votes: Record<string, string[]> = {};
      const stored =
        value.votes && typeof value.votes === "object" ? value.votes : {};
      for (const [userId, selected] of Object.entries(stored)) {
        const valid = Array.isArray(selected)
          ? [...new Set(selected.filter((item) => ids.has(item)))]
          : [];
        if (valid.length) {
          votes[userId] = multiple ? valid : valid.slice(0, 1);
        }
      }
      return { title, multiple, options, votes };
    },
    checkin: () => ({
      title,
      entries: list(value.entries)
        .map((entry) => ({
          id: id(entry.id),
          userId: str(entry.userId),
          date: str(entry.date),
          note: str(entry.note),
        }))
        .filter((entry) => DATE.test(entry.date)),
    }),
    encrypted: () => {
      const fields = [value.salt, value.iv, value.ciphertext].map(str);
      const valid = fields.every((field) => BASE64.test(field));
      return {
        title,
        iterations:
          typeof value.iterations === "number" && value.iterations > 0
            ? value.iterations
            : ENCRYPTION_ITERATIONS,
        salt: valid ? fields[0] : "",
        iv: valid ? fields[1] : "",
        ciphertext: valid ? fields[2] : "",
      };
    },
  };
  return result[kind]() as SmartBlockData[K];
}

/** Text of a block used for search and plain text export. */
export function blockPlainText(kind: SmartBlockKind, json: string) {
  const parts: string[] = [];
  switch (kind) {
    case "kanban": {
      const data = parseBlockData("kanban", json);
      parts.push(
        data.title,
        ...data.columns.map((column) => column.title),
        ...data.tasks.map((task) => task.text)
      );
      break;
    }
    case "gallery": {
      const data = parseBlockData("gallery", json);
      parts.push(data.title, ...data.images.map((image) => image.caption));
      break;
    }
    case "calendar": {
      const data = parseBlockData("calendar", json);
      parts.push(
        data.title,
        ...data.events.map((event) => `${event.date} ${event.title}`)
      );
      break;
    }
    case "poll": {
      const data = parseBlockData("poll", json);
      parts.push(data.title, ...data.options.map((option) => option.text));
      break;
    }
    case "checkin": {
      const data = parseBlockData("checkin", json);
      parts.push(data.title);
      break;
    }
    case "encrypted":
      parts.push(parseBlockData("encrypted", json).title);
      break;
  }
  return parts.filter(Boolean).join("\n");
}

const SALT_BYTES = 16;
const IV_BYTES = 12;

const toBase64 = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

/** Whether the browser can encrypt, WebCrypto needs a secure context. */
export function canEncrypt() {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number
) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt text in the browser, the password never leaves the client. */
export async function encryptText(
  data: EncryptedData,
  password: string,
  text: string
): Promise<EncryptedData> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, ENCRYPTION_ITERATIONS);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text)
  );
  return {
    ...data,
    iterations: ENCRYPTION_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(cipher)),
  };
}

/** Decrypt text, rejects when the password is wrong. */
export async function decryptText(data: EncryptedData, password: string) {
  const key = await deriveKey(password, fromBase64(data.salt), data.iterations);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(data.iv) },
    key,
    fromBase64(data.ciphertext)
  );
  return new TextDecoder().decode(plain);
}
